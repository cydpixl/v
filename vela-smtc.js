(function () {
  "use strict";
  if (window.__velaSMTCLoaded) return;
  window.__velaSMTCLoaded = true;

  var ENDPOINT = "http://127.0.0.1:5000/now-playing";
  var APPLE_ID = "AppleInc.AppleMusicWin_nzyj5cx40ttqa!App";
  var onWindows = /Windows/i.test(navigator.userAgent) || navigator.userAgentData?.platform === "Windows";
  var state = { account: "", enabled: false, source: "apple", showPaused: false, track: null, status: "off", error: "", lastSeen: 0 };
  var busy = false, controller = null, pollTimer = null, tickTimer = null, modal = null, card = null;
  var lastArt = "", lastTitle = "", scanPending = false, destroyed = false;
  if (!onWindows) return;

  function escapeHTML(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (c) {
      return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];
    });
  }
  function setText(node, value) {
    if (node && node.textContent !== value) node.textContent = value;
  }
  function storageKey() { return "vela.smtc.v1." + state.account; }
  function readSettings() {
    try {
      var saved = JSON.parse(localStorage.getItem(storageKey()) || "{}");
      state.enabled = saved.enabled === true;
      state.source = saved.source === "any" ? "any" : "apple";
      state.showPaused = saved.showPaused === true;
    } catch (_) {
      state.enabled = false;
      state.source = "apple";
      state.showPaused = false;
    }
  }
  function saveSettings() {
    if (!state.account) return;
    try { localStorage.setItem(storageKey(), JSON.stringify({enabled:state.enabled,source:state.source,showPaused:state.showPaused})); } catch (_) {}
  }
  function formatTime(ms) {
    var seconds = Math.max(0, Math.floor((Number(ms) || 0) / 1000));
    return Math.floor(seconds / 60) + ":" + String(seconds % 60).padStart(2, "0");
  }
  function normalized(session) {
    if (!session || !session.media_properties) return null;
    var media = session.media_properties, play = session.playback_info || {}, timeline = session.timeline_properties || {};
    var title = String(media.Title || "").trim(), artist = String(media.Artist || media.AlbumArtist || "").trim();
    if (!title) return null;
    var artwork = media.Thumbnail;
    if (typeof artwork !== "string" || !/^data:image\/(?:jpeg|jpg|png|webp);base64,[a-zA-Z0-9+/=]+$/.test(artwork) || artwork.length > 2500000) artwork = "";
    var duration = Math.max(0, Number(timeline.EndTime) - Number(timeline.StartTime || 0)) || 0;
    var position = Math.max(0, Number(timeline.Position) - Number(timeline.StartTime || 0)) || 0;
    if (!Number.isFinite(duration)) duration = 0;
    if (!Number.isFinite(position)) position = 0;
    return {
      title: title.slice(0, 250), artist: artist.slice(0, 250), album: String(media.AlbumTitle || "").slice(0, 250),
      artwork: artwork, source: String(session.source_app_id || ""), playing: Number(play.PlaybackStatus) === 4,
      paused: Number(play.PlaybackStatus) === 5, position: Math.min(position, duration || position),
      duration: duration, observed: performance.now()
    };
  }
  function selectSession(payload) {
    var sessions = Array.isArray(payload?.sessions) ? payload.sessions : [];
    if (state.source === "apple") return sessions.find(function (s) { return s.source_app_id === APPLE_ID; });
    return sessions.find(function (s) { return s.source_app_id === payload.current_session_id && Number(s.playback_info?.PlaybackStatus) === 4; })
      || sessions.find(function (s) { return Number(s.playback_info?.PlaybackStatus) === 4; })
      || sessions.find(function (s) { return s.source_app_id === payload.current_session_id; })
      || sessions[0];
  }
  function getPosition(track) {
    if (!track) return 0;
    var delta = track.playing ? performance.now() - track.observed : 0;
    return Math.max(0, Math.min(track.duration || Infinity, track.position + delta));
  }
  function activityLabel() {
    if (!state.enabled) return "Not connected";
    if (state.status === "error") return "Bridge unavailable";
    if (!state.track) return state.status === "loading" ? "Connecting…" : "No active music";
    if (!state.track.playing) return "Paused";
    return state.source === "apple" ? "Listening to Apple Music" : "Listening now";
  }
  function updateProgress() {
    if (!card || !card.isConnected || !state.track || card.querySelector(".vela-smtc-song")?.hidden) return;
    var position = getPosition(state.track);
    var progress = card.querySelector("[data-smtc-progress]");
    var elapsed = card.querySelector("[data-smtc-elapsed]");
    var total = card.querySelector("[data-smtc-total]");
    if (progress) progress.style.width = (state.track.duration ? Math.min(100, position / state.track.duration * 100) : 0) + "%";
    setText(elapsed, formatTime(position));
    setText(total, formatTime(state.track.duration));
  }
  function renderCard() {
    if (!card || !card.isConnected) return;
    var song = card.querySelector(".vela-smtc-song");
    var empty = card.querySelector(".vela-smtc-empty");
    var visible = state.enabled && state.track && (state.track.playing || state.showPaused);
    song.hidden = !visible;
    empty.hidden = !!visible;
    card.classList.toggle("is-playing", !!(visible && state.track.playing));
    var sub = card.querySelector("[data-smtc-status]");
    setText(sub, activityLabel());
    if (visible) {
      var track = state.track;
      var title = card.querySelector("[data-smtc-title]"), artist = card.querySelector("[data-smtc-artist]"), art = card.querySelector("[data-smtc-art]");
      if (title) { setText(title, track.title); title.title = track.title; }
      if (artist) { setText(artist, track.artist || track.album || "Unknown artist"); artist.title = track.artist; }
      if (art && (lastArt !== track.artwork || !lastTitle)) {
        lastArt = track.artwork;
        art.hidden = !track.artwork;
        if (track.artwork) art.src = track.artwork;
      }
      if (lastTitle !== track.title + "\0" + track.artist) {
        lastTitle = track.title + "\0" + track.artist;
        if (!matchMedia("(prefers-reduced-motion: reduce)").matches && typeof song.animate === "function")
          song.animate([{opacity:0.55,transform:"translateY(5px)"},{opacity:1,transform:"translateY(0)"}],{duration:260,easing:"ease-out"});
      }
      updateProgress();
    } else {
      lastTitle = "";
      var message = card.querySelector("[data-smtc-message]");
      setText(message, state.status === "error" ? state.error :
        !state.enabled ? "Connect SMTC Bridge to show your music." :
        state.track && !state.track.playing ? "Playback is paused." : "Play something in Apple Music to begin.");
      var action = card.querySelector("[data-smtc-action]");
      if (action) { action.hidden = state.enabled && state.status !== "error"; setText(action, state.enabled ? "Retry connection" : "Connect"); }
    }
    renderSettings();
  }
  async function refresh() {
    if (!state.enabled || busy || !state.account || document.hidden || !document.querySelector(".app-shell")) return;
    busy = true;
    controller = new AbortController();
    var timeout = setTimeout(function () { controller?.abort(); }, 3000);
    try {
      var response = await fetch(ENDPOINT, {mode:"cors",cache:"no-store",signal:controller.signal});
      if (!response.ok) throw Error("Bridge returned HTTP " + response.status);
      var payload = await response.json();
      if (!payload || !Array.isArray(payload.sessions)) throw Error("Invalid bridge response");
      var session = selectSession(payload);
      state.track = normalized(session);
      state.status = "connected";
      state.error = "";
      state.lastSeen = Date.now();
    } catch (error) {
      state.track = null;
      state.status = "error";
      state.error = "Cannot reach SMTC Bridge at 127.0.0.1:5000. Start the bridge and allow local-network access.";
    } finally {
      clearTimeout(timeout);
      controller = null;
      busy = false;
      renderCard();
    }
  }
  function disconnect() {
    state.enabled = false;
    state.track = null;
    state.status = "off";
    state.error = "";
    controller?.abort();
    saveSettings();
    renderCard();
  }
  async function connect() {
    state.enabled = true;
    state.status = "loading";
    state.error = "";
    saveSettings();
    renderCard();
    await refresh();
  }
  function cardHTML() {
    return '<div class="vela-smtc-head"><span class="vela-smtc-symbol" aria-hidden="true">♫</span><div class="vela-smtc-caption"><strong>Now playing</strong><small data-smtc-status>Not connected</small></div><button type="button" class="vela-smtc-more" data-smtc-settings aria-label="Music connection settings" title="Music settings">•••</button></div>' +
      '<div class="vela-smtc-song" hidden><div class="vela-smtc-main"><div class="vela-smtc-cover"><img data-smtc-art alt="Album artwork" hidden><span aria-hidden="true">♫</span></div><div class="vela-smtc-info"><strong data-smtc-title></strong><small data-smtc-artist></small></div><span class="vela-smtc-equalizer" aria-hidden="true"><i></i><i></i><i></i></span></div><div class="vela-smtc-timeline"><div><span data-smtc-elapsed>0:00</span><span data-smtc-total>0:00</span></div><div class="vela-smtc-bar"><i data-smtc-progress></i></div></div></div>' +
      '<div class="vela-smtc-empty"><span data-smtc-message>Connect SMTC Bridge to show your music.</span><button type="button" data-smtc-action>Connect</button></div>';
  }
  function ensureCard() {
    var sidebar = document.querySelector(".app-shell .sidebar");
    var dock = sidebar?.querySelector("#voice-dock") || sidebar?.querySelector("#account-dock");
    if (!sidebar || !dock || !state.account) { card = null; return; }
    card = sidebar.querySelector(".vela-smtc-card");
    if (!card) {
      card = document.createElement("section");
      card.className = "vela-smtc-card";
      card.setAttribute("aria-label", "Windows media activity");
      card.innerHTML = cardHTML();
      dock.before(card);
      card.querySelector("[data-smtc-settings]").addEventListener("click", openSettings);
      card.querySelector("[data-smtc-action]").addEventListener("click", function () {
        if (state.enabled) refresh(); else openSettings();
      });
    }
    renderCard();
  }
  function settingsHTML() {
    return '<div class="vela-smtc-settings-body"><div class="vela-smtc-setting-row"><div><strong>SMTC Bridge</strong><p data-smtc-settings-state></p></div><span class="vela-smtc-dot"></span></div>' +
      '<p class="vela-smtc-note">Show media playing on this Windows PC inside Vela. Music is read locally and is not shared with other users.</p>' +
      '<label class="vela-smtc-field">Media source<select data-smtc-source><option value="apple">Apple Music for Windows</option><option value="any">Current Windows media player</option></select></label>' +
      '<label class="vela-smtc-check"><input type="checkbox" data-smtc-paused> Show track while paused</label>' +
      '<div class="vela-smtc-actions"><button type="button" class="primary" data-smtc-connect>Connect</button><button type="button" class="secondary" data-smtc-disconnect>Disconnect</button></div>' +
      '<p class="vela-smtc-note">SMTC Bridge must be running on this computer at <code>127.0.0.1:5000</code>. Your browser may ask permission for local-network access.</p>' +
      '<a href="http://127.0.0.1:5000/now-playing" target="_blank" rel="noopener noreferrer">Open bridge diagnostics ↗</a></div>';
  }
  function wireSettings(host) {
    if (!host || host.dataset.smtcWired) return;
    host.dataset.smtcWired = "true";
    host.querySelector("[data-smtc-source]").addEventListener("change", function (ev) {
      state.source = ev.target.value === "any" ? "any" : "apple";
      state.track = null;
      saveSettings();
      renderCard();
      if (state.enabled) refresh();
    });
    host.querySelector("[data-smtc-paused]").addEventListener("change", function (ev) {
      state.showPaused = ev.target.checked;
      saveSettings();
      renderCard();
    });
    host.querySelector("[data-smtc-connect]").addEventListener("click", function () { connect(); });
    host.querySelector("[data-smtc-disconnect]").addEventListener("click", disconnect);
    renderSettings();
  }
  function renderSettings() {
    document.querySelectorAll(".vela-smtc-settings-body").forEach(function (host) {
      var label = host.querySelector("[data-smtc-settings-state]");
      setText(label, activityLabel());
      var source = host.querySelector("[data-smtc-source]");
      if (source && document.activeElement !== source) source.value = state.source;
      var paused = host.querySelector("[data-smtc-paused]");
      if (paused) paused.checked = state.showPaused;
      var button = host.querySelector("[data-smtc-connect]");
      setText(button, state.enabled ? "Reconnect" : "Connect");
      var stop = host.querySelector("[data-smtc-disconnect]");
      if (stop) stop.disabled = !state.enabled;
      var dot = host.querySelector(".vela-smtc-dot");
      if (dot) dot.classList.toggle("online", state.enabled && state.status === "connected");
    });
  }
  function openSettings() {
    if (modal?.isConnected) { modal.querySelector("[data-smtc-connect]")?.focus(); return; }
    var layer = document.querySelector("#layers") || document.body;
    modal = document.createElement("div");
    modal.className = "vela-smtc-overlay";
    modal.innerHTML = '<div class="vela-smtc-dialog" role="dialog" aria-modal="true" aria-label="Music activity settings"><header><div><small>VELA / CONNECTIONS</small><h2>Music activity</h2></div><button type="button" data-smtc-close aria-label="Close settings">×</button></header>' + settingsHTML() + '</div>';
    layer.append(modal);
    function close() { if (modal) { modal.remove(); modal = null; } document.removeEventListener("keydown", key); }
    function key(event) { if (event.key === "Escape") { event.stopPropagation(); close(); } }
    modal.querySelector("[data-smtc-close]").addEventListener("click", close);
    modal.addEventListener("pointerdown", function (event) { if (event.target === modal) close(); });
    document.addEventListener("keydown", key);
    wireSettings(modal.querySelector(".vela-smtc-settings-body"));
    modal.querySelector("[data-smtc-close]").focus();
  }
  function ensureConnectionSettings() {
    var page = document.querySelector(".desktop-settings #settings-page");
    if (!page || !page.isConnected || !page.querySelector(".discord-connection")) return;
    if (page.querySelector(".vela-smtc-settings-section")) return;
    var section = document.createElement("section");
    section.className = "vela-smtc-settings-section";
    section.innerHTML = '<header><div><h3>Windows · Now Playing</h3><p>Apple Music and other SMTC-compatible players.</p></div><span class="vela-smtc-connection-tag">LOCAL</span></header>' + settingsHTML();
    page.querySelector(".discord-connection").before(section);
    wireSettings(section.querySelector(".vela-smtc-settings-body"));
  }
  function scan() {
    scanPending = false;
    if (destroyed) return;
    var accountNode = document.querySelector("#account-dock .self-profile small");
    var account = (accountNode?.textContent || "").trim().toLowerCase();
    if (account !== state.account) {
      controller?.abort();
      state.account = account;
      state.track = null;
      state.status = "off";
      state.error = "";
      lastArt = "";
      lastTitle = "";
      if (account) {
        readSettings();
        if (state.enabled) { state.status = "loading"; refresh(); }
      } else { state.enabled = false; card = null; }
    }
    if (!account) return;
    ensureCard();
    ensureConnectionSettings();
  }
  function scheduleScan() {
    if (scanPending) return;
    scanPending = true;
    requestAnimationFrame(scan);
  }
  new MutationObserver(scheduleScan).observe(document.body, {childList:true,subtree:true});
  pollTimer = setInterval(function () { if (state.enabled) refresh(); }, 2000);
  tickTimer = setInterval(updateProgress, 500);
  document.addEventListener("visibilitychange", function () { if (!document.hidden && state.enabled) refresh(); });
  scan();
})();