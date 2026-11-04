import {GENERATED_APP_ICONS} from './generated-app-icons.mjs';
import {GAMES,gameDefinition,gameIcon} from './games/catalog.mjs';
import {icon} from './icons.js';
import {assetURL} from './config.js';
import {escape as e} from './util.js';
export const OPTIONAL_APPS=['cinema','apple-tv','fortnite','music','arcade','app-studio','graphing','assistant',...GAMES.map(game=>game.id)];
export const DESKTOP_APPS=[
 {id:'graphing',name:'Desmos',icon:'calculator',category:'Education',description:'The real Desmos graphing calculator. Save graphs, explore sliders, and export images.'},
 {id:'assistant',name:'Nova',icon:'chat',category:'Productivity',description:'Your private AI workspace. Write, learn, and code with Groq-powered models and saved conversations.'},
 {id:'app-studio',name:'App Studio',icon:'settings',category:'Developer tools',description:'Edit app names, descriptions, and logos across this desktop. Site administrators can publish changes.'},
 ...GAMES.map(game=>({...game,icon:'play',category:'Games',note:'VelaGames Studios'})),
 {id:'cinema',name:'Netflix',icon:'film',category:'Entertainment',description:'Movies, TV shows, and watching together.',note:'Your movies and TV shows, together in one app.'},
 {id:'apple-tv',name:'Apple TV',icon:'film',category:'Entertainment',description:'Your shows, movies, watchlist, and shared watch parties.',note:'Your desktop profile, your own library.'},
 {id:'chat',name:'Messages',icon:'chat',description:'Your conversation, calls, and shared moments.'},
 {id:'calculator',name:'Calculator',icon:'calculator',description:'A little room to work things out.'},
 {id:'notepad',name:'Notepad',icon:'file',description:'Notes that save as you write.'},
 {id:'files',name:'Files',icon:'folder',description:'Everything saved to your desktop.'},
 {id:'store',name:'App Store',icon:'shop',description:'Choose what belongs on your desktop.'},
 {id:'settings',name:'Settings',icon:'settings',description:'Make this desktop yours.'},
 {id:'fortnite',name:'Fortnite',icon:'shop',category:'Entertainment',description:'The island, the daily item shop, cosmetic videos, and the latest news.',note:'Live shop and news require internet.'},
 {id:'music',name:'Music',icon:'music',category:'Music',description:'Your playlists, full local songs, and music discovery in one place.',note:'Plays your saved music. Discover songs with Apple Music previews.'},
 {id:'arcade',name:'Flick',icon:'play',category:'Games',description:'Pull back, let it roll, and chase a new high score. Nine balls. Four targets.',note:'Works offline. Mouse, touch, and keyboard.'}
];
export const appDefinition=id=>DESKTOP_APPS.find(app=>app.id===id);
export function desktopAppIcon(id){const logo=appDefinition(id)?.logo;return logo?`<img class="custom-app-logo" src="${e(logo)}" alt="">`:defaultDesktopAppIcon(id)}
export function defaultDesktopAppIcon(id){
 if(GENERATED_APP_ICONS[id])return `<img class="generated-app-icon" src="${assetURL(GENERATED_APP_ICONS[id])}" alt="">`;
 if(id==='graphing')return `<img class="generated-app-icon" src="${assetURL('app-icons/desmos.png')}" alt="">`;
 if(id==='cinema')return `<span class="official-netflix-icon"><svg viewBox="247 451 496 900" aria-hidden="true"><image href="${assetURL('app-icons/netflix-symbol.png')}" width="991" height="1801"/></svg></span>`;
 if(id==='apple-tv')return `<img src="${assetURL('app-icons/apple-tv.png')}" alt="">`;
 const game=gameDefinition(id);if(game)return `<span class="vela-game-icon" style="--game-icon-accent:${game.accent};--game-icon-ink:${game.ink}">${gameIcon(id)}</span>`;
 if(['music','notepad','files','calculator','store'].includes(id))return `<img class="downloaded-app-icon" src="${assetURL('app-icons/'+id+('.png'))}" alt="">`;
 if(id==='chat')return `<span class="messages-app-icon">${icon('chat',38)}</span>`;
 if(id==='fortnite')return `<img src="${assetURL('fortnite/logo.png')}" alt="">`;
 if(id==='calculator')return '<svg viewBox="0 0 48 48" fill="none"><rect x="10" y="6" width="28" height="36" rx="6" fill="#f4e7d9"/><rect x="14" y="11" width="20" height="9" rx="2" fill="#4d555c"/><path d="M16 26h2m5 0h2m5 0h2M16 32h2m5 0h2m5 0h2M16 37h9m5 0h2" stroke="#9d602b" stroke-width="3" stroke-linecap="round"/></svg>';
 if(id==='notepad')return '<svg viewBox="0 0 48 48" fill="none"><rect x="9" y="5" width="30" height="38" rx="6" fill="#fff0c5"/><path d="M9 15h30" stroke="#d4ac59" stroke-width="3"/><path d="M16 23h16M16 29h16M16 35h10" stroke="#9a8566" stroke-width="2" stroke-linecap="round"/><path d="M18 5v5M30 5v5" stroke="#f2cc68" stroke-width="3"/></svg>';
 if(id==='arcade')return '<svg viewBox="0 0 48 48" fill="none"><rect x="10" y="4" width="28" height="40" rx="12" fill="#f0d1a6"/><circle cx="24" cy="15" r="7" fill="#355564" stroke="#fff1cf" stroke-width="3"/><circle cx="24" cy="31" r="6" fill="#6bc6c2"/><circle cx="22" cy="29" r="2" fill="#d9fff8"/></svg>';
 return icon(appDefinition(id)?.icon||'file',30);
}
