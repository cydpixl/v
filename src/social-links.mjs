const tiktokHosts = new Set(['tiktok.com','www.tiktok.com','m.tiktok.com','vm.tiktok.com','vt.tiktok.com']);
export function socialLink(value) {
 for (const match of String(value || '').slice(0,12000).matchAll(/https:\/\/[^\s<>"']+/gi)) {
  try {
   const url = new URL(match[0].replace(/[),.;\]}]+$/g,''));
   if (url.protocol !== 'https:' || url.port || url.username || url.password) continue;
   if (tiktokHosts.has(url.hostname)) {
    const id = url.pathname.match(/^\/(?:@[^/]+\/(?:video|photo)|video|player\/v1)\/(\d{15,22})\/?$/)?.[1];
    if (id) return {provider:'tiktok',label:'TikTok',id,url:`https://www.tiktok.com${url.pathname}`,embed:`https://www.tiktok.com/player/v1/${id}?controls=1&description=1&autoplay=0&rel=0`};
    if (/^\/t\/[A-Za-z0-9_-]{3,80}\/?$/.test(url.pathname) || /^(vm|vt)\.tiktok\.com$/.test(url.hostname) && /^\/[A-Za-z0-9_-]{3,80}\/?$/.test(url.pathname)) return {provider:'tiktok',label:'TikTok',id:null,url:url.origin+url.pathname};
   }
   if (['instagram.com','www.instagram.com'].includes(url.hostname)) {
    const post = url.pathname.match(/^\/(p|reel|reels|tv)\/([A-Za-z0-9_-]{5,80})\/?$/);
    if (post) {const kind=post[1]==='reels'?'reel':post[1],canonical=`https://www.instagram.com/${kind}/${post[2]}/`;return {provider:'instagram',label:'Instagram',id:post[2],url:canonical,embed:canonical+'embed/captioned/'};}
   }
  } catch {}
 }
 return null;
}
