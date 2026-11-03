import {DESKTOP_APPS} from './desktop-catalog.js';
import {isAppInstalled} from './desktop-storage.mjs';
export function pinnedApps(owner){let ids;try{ids=JSON.parse(localStorage.getItem('vela.taskbar.pins.'+owner)||'null')}catch{}if(!Array.isArray(ids))ids=['chat','files','store'];return [...new Set(ids)].filter(id=>DESKTOP_APPS.some(app=>app.id===id)&&isAppInstalled(owner,id))}
export function setAppPinned(owner,id,pinned){if(!DESKTOP_APPS.some(app=>app.id===id)||!isAppInstalled(owner,id))return;const ids=pinnedApps(owner).filter(app=>app!==id);if(pinned)ids.push(id);localStorage.setItem('vela.taskbar.pins.'+owner,JSON.stringify(ids));window.dispatchEvent(new CustomEvent('vela-taskbar-pins-changed',{detail:owner}))}
