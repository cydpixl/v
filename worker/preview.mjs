import cinemaAPI from './index.js';
export {ArcadeRoom} from './arcade-room.js';
const upstream='https://vela-cyd.cydpixl7.workers.dev';
export default {
 async fetch(request,env,ctx){
  const url=new URL(request.url);
  if(/^\/api\/(youtube|youtube-media|desktop-integrations|desktop-graphs|assistant|arcade-rooms|app-branding|app-brand-assets|cinema-library|cinema-rooms|music-playlists|music-library|shared-music|music-listening|game-rooms|apple-tv-page|apple-tv-collection|shared-notes)(?:\/|$)/.test(url.pathname))return cinemaAPI.fetch(request,env,ctx);
  if(url.pathname.startsWith('/api/')){
   const headers=new Headers(request.headers),origin=headers.get('Origin');
   if(origin&&origin!==url.origin&&origin!=='https://cydpixl.github.io')return Response.json({error:'Invalid origin.'},{status:403});
   if(origin)headers.set('Origin',upstream);
   const target=new URL(url.pathname+url.search,upstream);
   const response=await env.MAIN.fetch(new Request(target,new Request(request,{headers})));
   if(response.status===101)return response;
   const outgoing=new Headers(response.headers);outgoing.delete('Access-Control-Allow-Origin');outgoing.delete('Access-Control-Allow-Credentials');if(origin){outgoing.set('Access-Control-Allow-Origin',origin);outgoing.set('Access-Control-Expose-Headers','Date,Content-Range,Content-Length,Accept-Ranges');}
   return new Response(response.body,{status:response.status,statusText:response.statusText,headers:outgoing});
  }
  return env.ASSETS.fetch(request);
 }
};
