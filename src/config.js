export const SITE_BASE=import.meta.env.BASE_URL;
export const API_ORIGIN=(import.meta.env.VITE_API_ORIGIN||location.origin).replace(/\/$/,'');
// Direct account API when GitHub Pages' gateway is temporarily unavailable.
export const API_DIRECT_ORIGIN=location.hostname==='cydpixl.github.io'?'https://vela-cyd.cydpixl7.workers.dev':'';
export const assetURL=path=>SITE_BASE+String(path).replace(/^\//,'');
export const apiURL=path=>API_ORIGIN+'/api'+path;
export function socketURL(path,ticket){const url=new URL(apiURL(path));url.protocol=url.protocol==='https:'?'wss:':'ws:';url.searchParams.set('ticket',ticket);return url;}
