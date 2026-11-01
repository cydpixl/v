(function () {
  "use strict";
  if (window.__velaSMTCLoaded) return;
  window.__velaSMTCLoaded = true;

  var ENDPOINT = "http://127.0.0.1:5000/now-playing";
  var APPLE_ID = "AppleInc.AppleMusicWin_nzyj5cx40ttqa!App";
  var onWindows = /Windows/i.test(navigator.userAgent) || navigator.userAgentData?.platform === "Windows";
  var state = { account: "", enabled: true, source: "any", showPaused: false, share: false, track: null, status: "off", error: "", lastSeen: 0 };
  var requestEpoch = 0, failures = 0, nextRefresh = 0, permissionDenied = false;
  var busy = false, controller = null, pollTimer = null, tickTimer = null, modal = null, card = null;
  var lastArt = "", lastTitle = "", sharedStatus = "", lastPublished = 0, lastSharedSong = "", publishing = false, publishNext = false, peerUid = "", peerState = null, peerBusy = false, peerPollAt = 0, artSource = "", tinyArt = "", cardArtSource = "", cardArt = "", scanPending = false, destroyed = false;
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
      state.enabled = saved.version === 2 ? saved.enabled !== false : true;
      state.source = saved.version === 2 && saved.source === "apple" ? "apple" : "any";
      state.showPaused = saved.showPaused === true;
      state.share = saved.share === true;
    } catch (_) {
      state.enabled = true;
      state.source = "any";
      state.showPaused = false;
      state.share = false;
    }
  }
  function saveSettings() {
    if (!state.account) return;
    try { localStorage.setItem(storageKey(), JSON.stringify({version:2,enabled:state.enabled,source:state.source,showPaused:state.showPaused,share:state.share})); } catch (_) {}
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
    var sessions = Array.isArray(payload?.sessions) ? payload.sessions.filter(function(s){return normalized(s);}) : [];
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
    if (!state.enabled) return "Automatic detection off";
    if (state.status === "error") return permissionDenied ? "Device access blocked" : "Waiting for SMTC Bridge";
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
    card.dataset.connection = state.enabled ? state.status : "off";
    var song = card.querySelector(".vela-smtc-song");
    var empty = card.querySelector(".vela-smtc-empty");
    var visible = state.enabled && state.track && (state.track.playing || state.showPaused);
    card.hidden = !visible;
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
        !state.enabled ? "Automatic detection is off." :
        state.track && !state.track.playing ? "Playback is paused." : "Bridge connected. Play music in any Windows player.");
      var action = card.querySelector("[data-smtc-action]");
      if (action) { action.hidden = state.enabled && state.status !== "error"; setText(action, state.enabled ? "Check now" : "Enable auto-detect"); }
    }
    renderSettings();
  }
  async function bridgePermission() {
    if (!navigator.permissions?.query) return;
    for (var name of ["loopback-network", "local-network-access"]) {
      try {
        var result = await navigator.permissions.query({name:name});
        permissionDenied = result.state === "denied";
        result.onchange = function () { permissionDenied = this.state === "denied"; nextRefresh = 0; if (!permissionDenied) refresh(); };
        return;
      } catch (_) {}
    }
  }
  async function refresh(force) {
    if (!state.enabled || busy || !state.account || (document.hidden&&!state.share&&!window.velaMusic?.hasLiveShares?.()) || !document.querySelector(".app-shell") || (!force && Date.now()<nextRefresh)) return;
    busy = true;
    var epoch = requestEpoch, account = state.account, request = new AbortController();
    controller = request;
    var timeout = setTimeout(function () { request.abort(); }, 3000);
    try {
      // A literal loopback IP already identifies its address space. Forcing the
      // experimental targetAddressSpace option breaks some Chrome releases.
      var response = await fetch(ENDPOINT, {mode:"cors",credentials:"omit",cache:"no-store",signal:request.signal});
      if (!response.ok) throw Error("Bridge returned HTTP " + response.status);
      var payload = await response.json();
      if (!payload || !Array.isArray(payload.sessions)) throw Error("Invalid bridge response");
      if(epoch!==requestEpoch || account!==state.account || !state.enabled)return;
      state.track = normalized(selectSession(payload));
      window.velaMusic?.observeListening?.(state.track,state.share);
      state.status = "connected"; state.error = ""; state.lastSeen = Date.now();
      failures = 0; permissionDenied = false; nextRefresh = Date.now()+(document.hidden?8000:1500);
      if(state.share)publishMusic();
      if(state.track&&window.velaMusic?.syncLive){
        var song=state.track;
        widgetSnapshot(song).then(function(data){if(epoch===requestEpoch&&account===state.account)window.velaMusic.syncLive(data);}).catch(function(){});
      }
    } catch (error) {
      if(epoch!==requestEpoch || account!==state.account || !state.enabled)return;
      await bridgePermission();
      if(epoch!==requestEpoch || account!==state.account || !state.enabled)return;
      state.track = null;window.velaMusic?.observeListening?.(null,state.share); state.status = "error";
      failures++;
      nextRefresh = Date.now()+(permissionDenied?30000:Math.min(15000,1000*Math.pow(2,Math.min(failures,4))));
      state.error = permissionDenied
        ? "Allow Apps on device in your browser’s site settings. Vela will reconnect automatically."
        : "Open SMTC Bridge on this computer. Vela will pick it up automatically.";
      if(state.share&&lastSharedSong)publishMusic(true);
    } finally {
      clearTimeout(timeout);
      if(controller===request)controller=null;
      busy = false;
      renderCard();
    }
  }

  function disconnect() {
    requestEpoch++; nextRefresh=0; failures=0;
    state.enabled = false;
    if(state.share)publishMusic(true);
    state.track = null;
    state.status = "off";
    state.error = "";
    controller?.abort();
    saveSettings();
    renderCard();
  }
  async function connect() {
    nextRefresh=0; failures=0;
    state.enabled = true;
    state.status = "loading";
    state.error = "";
    saveSettings();
    renderCard();
    await refresh(true);
  }

  async function compressCover(track) {
    if (!track?.artwork) return "";
    if (artSource === track.artwork) return tinyArt;
    var src = track.artwork;
    artSource = src; tinyArt = "";
    try {
      var img = new Image();
      await new Promise(function(resolve,reject){img.onload=resolve;img.onerror=reject;img.src=src;});
      var canvas = document.createElement("canvas");canvas.width=96;canvas.height=96;
      canvas.getContext("2d").drawImage(img,0,0,96,96);
      var result = canvas.toDataURL("image/jpeg",.58);
      if (result.length<=40000 && artSource===src) tinyArt=result;
    } catch (_) {tinyArt="";}
    return tinyArt;
  }
  async function messageArtwork(track) {
    if(!track?.artwork)return "";
    if(cardArtSource===track.artwork)return cardArt;
    const src=track.artwork;
    cardArtSource=src;cardArt="";
    try{
      const image=new Image();
      await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=reject;image.src=src;});
      const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');
      if(!ctx)return "";
      for(const size of [40,32,24]){
        canvas.width=size;canvas.height=size;
        ctx.drawImage(image,0,0,size,size);
        const url=canvas.toDataURL("image/jpeg",size===40?.36:.27);
        if(url.length<2100){if(cardArtSource===src)cardArt=url;break;}
      }
    }catch(_){cardArt="";}
    return cardArt;
  }
  async function widgetSnapshot(track) {
    return {...track,position:getPosition(track),artwork:await messageArtwork(track)};
  }
  async function api(path,options) {
    if (!window.velaMusic?.api) throw Error("The Vela frontend needs its latest build before sharing can work.");
    return window.velaMusic.api(path,options);
  }
  async function publishMusic(force=false) {
    if (publishing) {if(force)publishNext=true;return false;}
    if (!state.account) return;
    if (!window.velaMusic?.selfUid?.()) {sharedStatus="Site update is not active yet. Reload Vela after the next build.";renderSettings();return;}
    var now=Date.now(), track=state.enabled && state.share && state.status==="connected" ? state.track : null;
    var playing = track && (track.playing || state.showPaused);
    var signature = playing ? track.title+"\0"+track.artist+"\0"+track.playing : "";
    if (!force && now-lastPublished<19000 && lastSharedSong===signature) return;
    if (!playing && !lastSharedSong && !force) return;
    publishing=true;
    try {
      var record=null;
      if (playing) record={
        title:track.title.slice(0,200),artist:track.artist.slice(0,200),album:track.album.slice(0,200),
        source:track.source.slice(0,150),playing:track.playing,position:getPosition(track),
        duration:track.duration,artwork:await compressCover(track)
      };
      var response=await api("/profile-extras/"+encodeURIComponent(window.velaMusic.selfUid()),{method:"PUT",body:{music:record}});
      if (response?.music!==true) throw Error("The Cloudflare music-status update has not been deployed.");
      lastPublished=Date.now();lastSharedSong=signature;sharedStatus=record?"Sharing your music":"";
      if(record)window.velaMusic?.publishLocal?.({...record,updated:Date.now()});
      else window.velaMusic?.publishLocal?.(null);
      return true;
    } catch(error){sharedStatus=error.message||"Could not share music";lastPublished=Date.now();return false;}
    finally {publishing=false;renderSettings();if(publishNext){publishNext=false;publishMusic(true);}}
  }
  async function sendToChat() {
    if(!state.track||!(state.track.playing||state.showPaused))return;
    const info=card?.querySelector("[data-smtc-send-feedback]");
    const button=card?.querySelector("[data-smtc-send]");
    if(button)button.disabled=true;
    setText(info,"");
    try{
      if(!window.velaMusic?.sendSong)throw Error("Refresh Vela to send music.");
      if(!document.querySelector("#composer-form"))throw Error("Open a conversation first.");
      var sent=await window.velaMusic.sendSong(await widgetSnapshot(state.track));
      setText(button,sent?"Sent":"Send");
      setTimeout(()=>setText(button,"Send"),1700);
    }catch(error){setText(info,error.message||"Unable to send live music.");}
    finally{if(button)button.disabled=false;}
  }
  function peerMarkup(music) {
    var art=music.artwork && /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(music.artwork) ? '<img src="'+escapeHTML(music.artwork)+'" alt="Album artwork">' : '<span class="vela-peer-music-symbol">♫</span>';
    return '<span class="vela-peer-cover">'+art+'</span><span class="vela-peer-info"><strong>'+escapeHTML(music.title)+'</strong><small>'+escapeHTML(music.artist||"Unknown artist")+'</small></span><span class="vela-peer-state">'+(music.playing?"Listening":"Paused")+'</span>';
  }
  function renderPeer() {
    var identity=document.querySelector("#workspace-header .header-identity");
    var node=identity?.querySelector(".vela-peer-music");
    if (!identity || !peerUid || !peerState || !Number.isFinite(peerState.updated) || Date.now()-peerState.updated>60000) {
      node?.remove();return;
    }
    if(!node){node=document.createElement("div");node.className="vela-peer-music";node.setAttribute("aria-label","Friend's music activity");identity.append(node);}
    var signature=JSON.stringify(peerState);
    if(node.dataset.signature!==signature){node.innerHTML=peerMarkup(peerState);node.dataset.signature=signature;}
  }
  async function readPeer() {
    var uid=window.velaMusic?.conversationPeer?.();
    if (!uid || uid===window.velaMusic.selfUid?.()) {peerUid="";peerState=null;renderPeer();return;}
    if(uid!==peerUid){peerUid=uid;peerState=null;renderPeer();}
    if(peerBusy)return;
    peerBusy=true;
    try{
      var result=await api("/profile-extras/"+encodeURIComponent(uid));
      if(peerUid===uid){peerState=result.profile?.music||null;renderPeer();}
    }catch(_){if(peerUid===uid){peerState=null;renderPeer();}}
    finally{peerBusy=false;}
  }
  function cardHTML() {
    return '<div class="vela-smtc-head"><span class="vela-smtc-symbol" aria-hidden="true">♫</span><div class="vela-smtc-caption"><strong>Now playing <span class="vela-smtc-auto">AUTO</span></strong><small data-smtc-status role="status">Detecting Windows music…</small></div><button type="button" class="vela-smtc-more" data-smtc-settings aria-label="Music connection settings" title="Music settings">•••</button></div>' +
      '<div class="vela-smtc-song" hidden><div class="vela-smtc-main"><div class="vela-smtc-cover"><img data-smtc-art alt="Album artwork" hidden><span aria-hidden="true">♫</span></div><div class="vela-smtc-info"><strong data-smtc-title></strong><small data-smtc-artist></small></div><span class="vela-smtc-equalizer" aria-hidden="true"><i></i><i></i><i></i></span></div><div class="vela-smtc-timeline"><div><span data-smtc-elapsed>0:00</span><span data-smtc-total>0:00</span></div><div class="vela-smtc-bar"><i data-smtc-progress></i></div><button type="button" class="vela-smtc-share-button" data-smtc-send>Send</button><small data-smtc-send-feedback class="vela-smtc-send-feedback"></small></div></div>' +
      '<div class="vela-smtc-empty"><span data-smtc-message>Looking for SMTC Bridge…</span><button type="button" data-smtc-action>Check now</button></div>';
  }
  function ensureCard() {
    var sidebar = document.querySelector("#composer-form");
    var dock = sidebar?.querySelector(".composer");
    if (!sidebar || !dock || !state.account) { card = null; return; }
    card = sidebar.querySelector(".vela-smtc-card");
    if (!card) {
      card = document.createElement("section");
      card.className = "vela-smtc-card";
      card.setAttribute("aria-label", "Windows media activity");
      card.innerHTML = cardHTML();
      sidebar.prepend(card);
      lastArt = ""; lastTitle = "";
      card.querySelector("[data-smtc-settings]").addEventListener("click", openSettings);
      card.querySelector("[data-smtc-send]").addEventListener("click",sendToChat);
      card.querySelector("[data-smtc-action]").addEventListener("click", function () {
        connect();
      });
    }
    renderCard();
  }
  function settingsHTML() {
    return '<div class="vela-smtc-settings-body"><div class="vela-smtc-setting-row"><div><strong>SMTC Bridge</strong><p data-smtc-settings-state></p></div><span class="vela-smtc-dot"></span></div>' +
      '<p class="vela-smtc-note">Open SMTC Bridge and play music. Vela detects your active player automatically — no address, port, token or setup form. Sharing with friends is optional.</p>' +
      '<label class="vela-smtc-field">Media source<select data-smtc-source><option value="any">Automatic · current Windows player</option><option value="apple">Apple Music only</option></select></label>' +
      '<label class="vela-smtc-check"><input type="checkbox" data-smtc-paused> Show track while paused</label><label class="vela-smtc-check"><input type="checkbox" data-smtc-share> Share my music with friends</label><p class="vela-smtc-note" data-smtc-sharing-state></p>' +
      '<div class="vela-smtc-actions"><button type="button" class="primary" data-smtc-connect>Check now</button><button type="button" class="secondary" data-smtc-disconnect>Turn off auto-detect</button></div>' +
      '<p class="vela-smtc-note">Detection starts when you sign in and reconnects when the bridge restarts. If your browser asks to access apps on this device, choose Allow. Music stays private until you enable sharing.</p>' +
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
    host.querySelector("[data-smtc-share]").addEventListener("change", function (ev) {
      state.share=ev.target.checked;saveSettings();window.velaMusic?.setListeningSharing?.(state.share).catch(()=>{});
      if(!state.share){publishMusic(true);}else if(state.enabled){publishMusic(true);}
      renderSettings();
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
      var share=host.querySelector("[data-smtc-share]");if(share)share.checked=state.share;
      setText(host.querySelector("[data-smtc-sharing-state]"),state.share?(sharedStatus||"Your current track will be visible to other Vela users."):"Private — music stays on this computer.");
      var button = host.querySelector("[data-smtc-connect]");
      setText(button, state.enabled ? "Check now" : "Enable auto-detect");
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
      requestEpoch++; nextRefresh=0; failures=0; permissionDenied=false;
      controller?.abort();
      state.account = account;
      lastPublished=0;lastSharedSong="";sharedStatus="";peerUid="";peerState=null;artSource="";tinyArt="";
      state.track = null;
      state.status = "off";
      state.error = "";
      lastArt = "";
      lastTitle = "";
      if (account) {
        readSettings();
        if (state.enabled) { state.status = "loading"; refresh(true); }
      } else { state.enabled = false; card = null; }
    }
    if (!account) return;
    ensureCard();
    ensureConnectionSettings();
    renderPeer();
  }
  function scheduleScan() {
    if (scanPending) return;
    scanPending = true;
    requestAnimationFrame(scan);
  }
  new MutationObserver(scheduleScan).observe(document.body, {childList:true,subtree:true});
  pollTimer = setInterval(function () { if (state.enabled) refresh(); }, 1000);
  tickTimer = setInterval(updateProgress, 500);
  setInterval(function(){if(document.hidden||!state.account)return;var now=Date.now();if(now-peerPollAt>12000){peerPollAt=now;readPeer();}if(state.share&&state.enabled&&now-lastPublished>19500)publishMusic();renderPeer();},2400);
  document.addEventListener("visibilitychange", function () { if (!document.hidden){if(state.enabled)refresh(true);readPeer();} });
  window.addEventListener("online",function(){if(state.enabled)refresh(true);});
  window.addEventListener("focus",function(){if(state.enabled)refresh(true);});
  window.velaSMTC={setSharing:value=>{state.share=!!value;saveSettings();renderSettings();},track:()=>state.enabled?state.track:null,snapshot:()=>widgetSnapshot(state.track),openSettings};
  scan();
})();
