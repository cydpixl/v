import {UTILITY_APPS,utilityDefinition} from './utility-suite.mjs';
import {OPEN_GAMES,openGameDefinition} from './open-games.mjs';
import {GENERATED_APP_ICONS} from './generated-app-icons.mjs';
import {GAMES,gameDefinition,gameIcon} from './games/catalog.mjs';
import {icon} from './icons.js';
import {assetURL} from './config.js';
import {escape as e} from './util.js';
export const OPTIONAL_APPS=['date','daily-thoughts','cinema','apple-tv','fortnite','music','arcade','app-studio','graphing','assistant','youtube',...GAMES.map(game=>game.id),...OPEN_GAMES.map(game=>game.id),'spectrum','live-studio',...UTILITY_APPS.map(app=>app.id)];
export const DESKTOP_APPS=[
 {id:'spectrum',name:'Spectrum',icon:'screen',category:'Utilities',description:'Explore fictional internet subscriptions with demo credits and simulated speeds.',note:'Interactive Spectrum-inspired demo. Not an official service or a real internet subscription.'},
 {id:'live-studio',name:'Live Studio',icon:'video',category:'Creativity',description:'Record your camera or screen and open a live Vela video call.',note:'Camera, screen preview and local video recording; public broadcasts are not yet available.'},
 {id:'date',name:'date.',icon:'file',category:'Lifestyle',description:'Write about your first date. Keep the photos, places and little moments together.'},
 {id:'daily-thoughts',name:'Daily Thoughts',icon:'file',category:'Lifestyle',description:'One thought each day. Write, draw, and revisit entries from earlier days.',note:'Your existing Daily Thoughts account, entries and five-minute editing window are preserved.'},
 {id:'youtube',name:'YouTube',icon:'play',category:'Entertainment',description:'Your videos, your community. Upload, watch, search, and share videos with Vela.'},
 {id:'graphing',name:'Desmos',icon:'calculator',category:'Education',description:'The real Desmos graphing calculator. Save graphs, explore sliders, and export images.'},
 {id:'assistant',name:'ChatGPT',icon:'chat',category:'Productivity',description:'Your private AI workspace. Write, learn, and code with Groq-powered models and saved conversations.'},
 {id:'app-studio',name:'App Studio',icon:'settings',category:'Developer tools',description:'Edit app names, descriptions, and logos across this desktop. Site administrators can publish changes.'},
 ...GAMES.map(game=>({...game,icon:'play',category:'Games',note:'VelaGames Studios'})),
 ...OPEN_GAMES.map(game=>({...game,icon:'play'})),
 ...UTILITY_APPS,
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
 if(id==='spectrum')return '<span style="display:grid;position:relative;place-items:center;background:#063a64;border-radius:20%;width:100%;height:100%;font-weight:900;color:#fff;font-size:29px;letter-spacing:-.09em">S<span style="position:absolute;font-size:12px;color:#36c9f6;right:5px;bottom:6px">▶</span></span>';
 if(id==='live-studio')return '<span style="display:grid;place-items:center;background:#191f2d;border:2px solid #df5064;border-radius:21%;width:100%;height:100%;color:#ed5166;font-size:30px">●</span>';
 if(id==='date')return `<img class="generated-app-icon" src="${assetURL('app-icons/date.svg')}" alt="">`;
 if(id==='daily-thoughts')return `<img class="generated-app-icon" src="${assetURL('app-icons/daily-thoughts.svg')}" alt="">`;
 if(id==='assistant')return `<img class="generated-app-icon" src="${assetURL('app-icons/chatgpt.svg')}" alt="">`;
 if(id==='youtube')return `<img class="generated-app-icon" src="${assetURL('app-icons/youtube.png')}" alt="">`;
 if(GENERATED_APP_ICONS[id])return `<img class="generated-app-icon" src="${assetURL(GENERATED_APP_ICONS[id])}" alt="">`;
 if(id==='graphing')return `<img class="generated-app-icon" src="${assetURL('app-icons/desmos.png')}" alt="">`;
 if(id==='cinema')return `<span class="official-netflix-icon"><svg viewBox="247 451 496 900" aria-hidden="true"><image href="${assetURL('app-icons/netflix-symbol.png')}" width="991" height="1801"/></svg></span>`;
 if(id==='apple-tv')return `<img src="${assetURL('app-icons/apple-tv.png')}" alt="">`;
 const utility=utilityDefinition(id);if(utility)return `<span style="display:grid;place-items:center;background:#354e79;color:#fff;border-radius:22%;width:100%;height:100%;font-weight:800;font-size:28px">${e(utility.symbol)}</span>`;
 const openGame=openGameDefinition(id);if(openGame)return `<span class="open-app-icon">${e(openGame.symbol)}</span>`;
 const game=gameDefinition(id);if(game)return `<span class="vela-game-icon" style="--game-icon-accent:${game.accent};--game-icon-ink:${game.ink}">${gameIcon(id)}</span>`;
 if(['music','notepad','files','calculator','store'].includes(id))return `<img class="downloaded-app-icon" src="${assetURL('app-icons/'+id+('.png'))}" alt="">`;
 if(id==='chat')return `<span class="messages-app-icon">${icon('chat',38)}</span>`;
 if(id==='fortnite')return `<img src="${assetURL('fortnite/logo.png')}" alt="">`;
 if(id==='calculator')return '<svg viewBox="0 0 48 48" fill="none"><rect x="10" y="6" width="28" height="36" rx="6" fill="#f4e7d9"/><rect x="14" y="11" width="20" height="9" rx="2" fill="#4d555c"/><path d="M16 26h2m5 0h2m5 0h2M16 32h2m5 0h2m5 0h2M16 37h9m5 0h2" stroke="#9d602b" stroke-width="3" stroke-linecap="round"/></svg>';
 if(id==='notepad')return '<svg viewBox="0 0 48 48" fill="none"><rect x="9" y="5" width="30" height="38" rx="6" fill="#fff0c5"/><path d="M9 15h30" stroke="#d4ac59" stroke-width="3"/><path d="M16 23h16M16 29h16M16 35h10" stroke="#9a8566" stroke-width="2" stroke-linecap="round"/><path d="M18 5v5M30 5v5" stroke="#f2cc68" stroke-width="3"/></svg>';
 if(id==='arcade')return '<svg viewBox="0 0 48 48" fill="none"><rect x="10" y="4" width="28" height="40" rx="12" fill="#f0d1a6"/><circle cx="24" cy="15" r="7" fill="#355564" stroke="#fff1cf" stroke-width="3"/><circle cx="24" cy="31" r="6" fill="#6bc6c2"/><circle cx="22" cy="29" r="2" fill="#d9fff8"/></svg>';
 return icon(appDefinition(id)?.icon||'file',30);
}
