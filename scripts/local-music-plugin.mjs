import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const directory=fileURLToPath(new URL('../../music-library/',import.meta.url));
export function localMusic(){
 function install(server){server.middlewares.use((req,res,next)=>{
  const url=new URL(req.url,'http://localhost');if(!url.pathname.startsWith('/local-music/'))return next();
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);return res.end();}
  if(req.headers.origin){try{const origin=new URL(req.headers.origin);if(!['localhost','127.0.0.1','[::1]'].includes(origin.hostname)){res.writeHead(403);return res.end();}}catch{res.writeHead(400);return res.end();}}
  let manifest;try{manifest=JSON.parse(fs.readFileSync(path.join(directory,'manifest.json'),'utf8'))}catch{res.writeHead(404);return res.end();}
  let name=url.pathname.slice('/local-music/'.length);let importing=false;if(name.startsWith('import/')){const track=manifest.tracks.find(track=>track.id===name.slice(7));if(!track){res.writeHead(404);return res.end();}res.writeHead(410,{'Content-Type':'application/json','Cache-Control':'no-store'});return res.end(JSON.stringify({error:'Automatic audio transfer is disabled.'}));}
  if(name==='manifest.json'){const body=JSON.stringify({id:manifest.id,name:manifest.name,tracks:manifest.tracks.map(({id,title,artist,album,duration,audio,artwork,size},index)=>({id,title,artist,album,duration,size,index,audio:'/local-music/import/'+id,artwork:artwork?'/local-music/'+artwork:''}))});res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store','Content-Length':Buffer.byteLength(body)});return res.end(req.method==='HEAD'?undefined:body);}
  if(name.endsWith('.mp3')){res.writeHead(410,{'Content-Type':'application/json','Cache-Control':'no-store'});return res.end(JSON.stringify({error:'Automatic audio transfer is disabled.'}));}
  const allowed=new Set(manifest.tracks.flatMap(track=>[track.audio,track.artwork]).filter(Boolean));if(!allowed.has(name)||path.basename(name)!==name){res.writeHead(404);return res.end();}
  const file=path.join(directory,name);let stat;try{stat=fs.statSync(file)}catch{res.writeHead(404);return res.end();}
  const headers={'Content-Type':importing?'application/octet-stream':name.endsWith('.mp3')?'audio/mpeg':'image/jpeg','Accept-Ranges':'bytes','Cache-Control':importing?'no-store':'private, max-age=3600','X-Content-Type-Options':'nosniff'};let start=0,end=stat.size-1,status=200;
  if(req.headers.range){const range=req.headers.range.match(/^bytes=(\d*)-(\d*)$/);if(!range||!range[1]&&!range[2]){res.writeHead(416,{'Content-Range':'bytes */'+stat.size});return res.end();}if(!range[1])start=Math.max(0,stat.size-Number(range[2]));else{start=Number(range[1]);if(range[2])end=Math.min(end,Number(range[2]));}if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start>end||start>=stat.size){res.writeHead(416,{'Content-Range':'bytes */'+stat.size});return res.end();}status=206;headers['Content-Range']=`bytes ${start}-${end}/${stat.size}`;}
  headers['Content-Length']=String(end-start+1);res.writeHead(status,headers);if(req.method==='HEAD')return res.end();const stream=fs.createReadStream(file,{start,end});stream.on('error',()=>res.destroy());res.on('close',()=>stream.destroy());stream.pipe(res);
 });}
 return {name:'vela-private-local-music',configureServer:install,configurePreviewServer:install};
}
