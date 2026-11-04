import {DESKTOP_APPS} from './desktop-catalog.js';
import {GAMES} from './games/catalog.mjs';
const originals=new Map(DESKTOP_APPS.map(app=>[app.id,{...app}]));let saved=[],canEdit=false;
export const defaultApp=id=>({...originals.get(id)});
export const appBrandingRecord=id=>saved.find(app=>app.id===id)||{revision:0};
export const canEditApps=()=>canEdit;
export async function loadAppBranding(api){
 const data=await api('/app-branding');saved=data.items;canEdit=!!data.canEdit;
 for(const app of DESKTOP_APPS){Object.assign(app,originals.get(app.id),{logo:''});const custom=saved.find(item=>item.id===app.id);if(custom){app.name=custom.name;app.description=custom.description;app.logo=/^https?:\/\//.test(custom.logo)&&/\/api\/app-brand-assets\/[a-f0-9-]{36}\.(png|jpg|webp)$/.test(custom.logo)?custom.logo:''}const game=GAMES.find(game=>game.id===app.id);if(game){game.name=app.name;game.description=app.description}}
 window.dispatchEvent(new Event('vela-app-branding-changed'));return data;
}
