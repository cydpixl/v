import {BASE_APP_IDS} from '../src/app-ids.mjs';
import {GAMES} from '../src/games/catalog.mjs';
const valid=new Set([...BASE_APP_IDS,...GAMES.map(game=>game.id)]),initialized=new WeakSet();
export async function appBrandAsset(req,env){
 const match=new URL(req.url).pathname.match(/^\/api\/app-brand-assets\/([a-f0-9-]{36})\.(png|jpg|webp)$/);if(!match)return null;
 if(req.method!=='GET')return new Response('Method not allowed',{status:405});
 const key=match[1]+'.'+match[2],file=await env.FILES.get('desktop-branding/'+key);if(!file)return new Response('Not found',{status:404});
 return new Response(file.body,{headers:{'Content-Type':{png:'image/png',jpg:'image/jpeg',webp:'image/webp'}[match[2]],'Cache-Control':'public,max-age=31536000,immutable','X-Content-Type-Options':'nosniff'}});
}
export async function appBrandingAPI(req,env,uid,{rows,row,body,json,fail}){
 const url=new URL(req.url),match=url.pathname.match(/^\/api\/app-branding(?:\/([a-z0-9-]+))?$/);if(!match)return null;
 if(!initialized.has(env)){await env.DB.prepare('CREATE TABLE IF NOT EXISTS desktop_app_branding(id TEXT PRIMARY KEY,name TEXT NOT NULL,description TEXT NOT NULL,logo TEXT NOT NULL DEFAULT "",revision INTEGER NOT NULL,updated_by TEXT NOT NULL,updated INTEGER NOT NULL)').run();initialized.add(env)}
 const canEdit=!!await row(env,'SELECT 1 FROM site_admins WHERE uid=?',uid);
 if(!match[1]&&req.method==='GET')return json({items:await rows(env,'SELECT id,name,description,logo,revision FROM desktop_app_branding'),canEdit});
 if(!canEdit)fail('Only site administrators can edit app branding.',403);
 const id=match[1];if(!valid.has(id))fail('Unknown app.',404);
 const old=await row(env,'SELECT * FROM desktop_app_branding WHERE id=?',id);
 if(req.method==='DELETE'){const data=await body(req);if(data.revision!==(old?.revision||0))fail('This app changed. Reload before resetting.',409);if(old){const result=await env.DB.prepare('DELETE FROM desktop_app_branding WHERE id=? AND revision=?').bind(id,data.revision).run();if(!result.meta.changes)fail('This app changed. Reload before resetting.',409)}return json({ok:true})}
 if(req.method!=='PUT')fail('Method not allowed.',405);
 const data=await body(req);if(data.revision!==(old?.revision||0))fail('This app changed in another window. Reload before saving.',409);
 const name=String(data.name||'').trim(),description=String(data.description||'').trim();
 if(!name||name.length>50||/[<>\u0000-\u001f]/.test(name)||description.length>500)fail('Use a name up to 50 characters and a description up to 500 characters.');
 let logo=old?.logo||'';
 if(data.removeLogo)logo='';
 if(data.image){
  const image=String(data.image).match(/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/);if(!image||image[2].length>700000)fail('Choose a PNG, JPEG, or WebP image under 500 KB.');
  const bytes=Uint8Array.from(atob(image[2]),c=>c.charCodeAt(0));const [a,b,c,d]=bytes;
  if(!(image[1]==='png'&&a===137&&b===80&&c===78&&d===71||image[1]==='jpeg'&&a===255&&b===216&&c===255||image[1]==='webp'&&String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP'))fail('This file is not a valid image.');
  const key=crypto.randomUUID()+'.'+(image[1]==='jpeg'?'jpg':image[1]);await env.FILES.put('desktop-branding/'+key,bytes,{httpMetadata:{contentType:'image/'+image[1]}});logo=url.origin+'/api/app-brand-assets/'+key;
 }
 const result=await env.DB.prepare('INSERT INTO desktop_app_branding(id,name,description,logo,revision,updated_by,updated) VALUES(?,?,?,?,1,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,description=excluded.description,logo=excluded.logo,revision=desktop_app_branding.revision+1,updated_by=excluded.updated_by,updated=excluded.updated WHERE desktop_app_branding.revision=? RETURNING id,name,description,logo,revision').bind(id,name,description,logo,uid,Date.now(),data.revision).first();
 if(!result)fail('This app changed in another window. Reload before saving.',409);return json({item:result});
}
