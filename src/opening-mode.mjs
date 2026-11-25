import {assetURL} from './config.js';
import {icon} from './icons.js';

const modeKey = 'vela.startup-mode';
const fullscreenKey = 'vela.auto-fullscreen';

export function openingMode() {
  const mode = localStorage.getItem(modeKey);
  return mode === 'chat' || mode === 'desktop' ? mode : null;
}

export function autoFullscreenEnabled() {
  return localStorage.getItem(fullscreenKey) !== 'off';
}

export function saveOpeningPreferences(mode, fullscreen) {
  localStorage.setItem(modeKey, mode);
  localStorage.setItem(fullscreenKey, fullscreen ? 'on' : 'off');
}

export function openingControls(mode, fullscreen) {
  return `<fieldset class="opening-modes">
    <legend class="sr-only">Opening mode</legend>
    <label class="opening-option">
      <input type="radio" name="mode" value="chat" required ${mode === 'chat' ? 'checked' : ''}>
      <span class="opening-icon">${icon('chat', 22)}</span>
      <span><strong>Simple Chat</strong><small>Your VELA conversations in a messages-only view.</small></span>
    </label>
    <label class="opening-option">
      <input type="radio" name="mode" value="desktop" required ${mode === 'desktop' ? 'checked' : ''}>
      <span class="opening-icon">${icon('screen', 22)}</span>
      <span><strong>Desktop</strong><small>Open the full VELA desktop with apps and windows.</small></span>
    </label>
  </fieldset>
  <label class="opening-fullscreen">
    <span><strong>Automatic fullscreen</strong><small>Applies when opening Desktop.</small></span>
    <input type="checkbox" name="fullscreen" role="switch" ${fullscreen ? 'checked' : ''}>
  </label>`;
}

export function chooseOpeningMode() {
  const saved = openingMode();
  if (saved) return Promise.resolve(saved);
  const dialog = document.createElement('dialog');
  dialog.className = 'opening-dialog';
  dialog.setAttribute('aria-labelledby', 'opening-title');
  dialog.innerHTML = `<form data-opening-controls>
    <img class="opening-mark" src="${assetURL('vela-mark.svg')}" alt="VELA">
    <h1 id="opening-title">How do you want to open VELA?</h1>
    ${openingControls(null, autoFullscreenEnabled())}
    <button type="submit" class="opening-primary" disabled>Continue</button>
  </form>`;
  document.body.append(dialog);
  dialog.addEventListener('cancel', event => event.preventDefault());
  dialog.showModal();
  const form = dialog.querySelector('form');
  form.addEventListener('change', () => {
    form.querySelector('[type=submit]').disabled = !form.elements.mode.value;
  });
  return new Promise(resolve => {
    form.addEventListener('submit', event => {
      event.preventDefault();
      const mode = form.elements.mode.value;
      saveOpeningPreferences(mode, form.elements.fullscreen.checked);
      dialog.close();
      dialog.remove();
      resolve(mode);
    });
  });
}

export function installDesktopAutoFullscreen() {
  let attempted = false;
  function enter(event) {
    const key = event.type === 'keydown';
    if (attempted || !event.isTrusted || openingMode() !== 'desktop' || !autoFullscreenEnabled() ||
        event.target.closest?.('[data-opening-controls]') ||
        (key ? !['Enter', ' '].includes(event.key) : event.button !== 0)) return;
    const page = document.documentElement;
    if (!document.fullscreenEnabled || document.fullscreenElement || !page.requestFullscreen) return;
    if (navigator.userActivation && !navigator.userActivation.isActive) return;
    attempted = true;
    page.requestFullscreen().catch(() => {});
  }
  document.addEventListener('click', enter, true);
  document.addEventListener('keydown', enter, true);
}
