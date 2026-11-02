import {OPTIONAL_APPS} from './desktop-catalog.js';
import {installedApps,setAppInstalled} from './desktop-storage.mjs';
import {gameDefinition} from './games/catalog.mjs';

// Deliberately paced local installs. Load the actual game bundle before completion.
const owners=new Set(),loads=new Map();let timer;
const key=owner=>'vela.downloads.v1.'+owner;
function read(owner){try{const value=JSON.parse(localStorage.getItem(key(owner))||'{}');return Object.fromEntries(Object.entries(value).filter(([id,j])=>OPTIONAL_APPS.includes(id)&&Number.isFinite(j.start)&&j.duration>=10000&&j.duration<=45000));}catch{return {};}}
function write(owner,jobs){localStorage.setItem(key(owner),JSON.stringify(jobs));}
function notify(owner){window.dispatchEvent(new CustomEvent('vela-installs-changed',{detail:owner}));}
function load(owner,id){const k=owner+':'+id;if(loads.has(k))return loads.get(k);const record={ready:false,error:null};loads.set(k,record);const request=gameDefinition(id)?import('./games/game.js'):id==='cinema'?import('./cinema/cinema-app.js'):Promise.resolve();request.then(()=>{record.ready=true;notify(owner);}).catch(()=>{record.error='Download interrupted. Try again.';notify(owner);});return record;}
export function installSnapshot(owner,id){const j=read(owner)[id];if(!j)return null;const elapsed=Math.max(0,Date.now()-j.start),fraction=Math.min(1,elapsed/j.duration),progress=Math.min(.99,Math.pow(fraction,.85)*.94+(fraction>.92?(fraction-.92)*.6:0));return {...j,progress,status:fraction<.06?'Waiting…':fraction<.9?'Downloading…':'Installing…',error:loads.get(owner+':'+id)?.error};}
function run(){let pending=false;for(const owner of owners){const jobs=read(owner);let changed=false;for(const [id,j] of Object.entries(jobs)){const record=load(owner,id);if(installedApps(owner).includes(id)){delete jobs[id];loads.delete(owner+':'+id);changed=true;continue;}if(record.error)continue;pending=true;if(Date.now()-j.start>=j.duration&&record.ready){try{setAppInstalled(owner,id,true);delete jobs[id];loads.delete(owner+':'+id);changed=true;}catch{record.error='Device storage is full. Free some space and retry.';}}}if(changed){write(owner,jobs);notify(owner);}else if(Object.keys(jobs).length)notify(owner);}if(!pending){clearInterval(timer);timer=null;}}
function ensure(owner){owners.add(owner);for(const id of Object.keys(read(owner)))load(owner,id);if(!timer)timer=setInterval(run,150);run();}
export function startInstall(owner,id){if(!OPTIONAL_APPS.includes(id)||installedApps(owner).includes(id))return;const jobs=read(owner);if(jobs[id]&&!loads.get(owner+':'+id)?.error){ensure(owner);return;}loads.delete(owner+':'+id);jobs[id]={start:Date.now(),duration:10000+Math.floor(Math.random()*35001)};write(owner,jobs);ensure(owner);notify(owner);}
export function cancelInstall(owner,id){const jobs=read(owner);delete jobs[id];write(owner,jobs);loads.delete(owner+':'+id);notify(owner);}
export function watchInstalls(owner,listener){const controller=new AbortController();window.addEventListener('vela-installs-changed',event=>{if(event.detail===owner)listener();},{signal:controller.signal});window.addEventListener('storage',event=>{if(event.key===key(owner)){ensure(owner);listener();}else if(event.key==='vela.installed.'+owner)listener();},{signal:controller.signal});ensure(owner);return ()=>controller.abort();}
