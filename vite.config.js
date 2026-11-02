import {localMusic} from './scripts/local-music-plugin.mjs';
import {desktopPreview} from './scripts/desktop-preview.mjs';
import {pwaShell} from './scripts/pwa-shell.mjs';
import {defineConfig} from 'vite';
const previewUID=process.env.VELA_PREVIEW_UID;
const devTarget=process.env.VELA_DEV_API||'http://127.0.0.1:8787';
if(previewUID&&!['127.0.0.1','localhost'].includes(new URL(devTarget).hostname))throw Error('Local preview identity may only target a loopback API.');
export default defineConfig({plugins:[pwaShell(),localMusic(),desktopPreview()],optimizeDeps:{include:['mediabunny','@mediabunny/ac3','@mediabunny/dts','@mediabunny/aac-encoder']},worker:{format:'es'},server:{proxy:{'/api':{target:devTarget,changeOrigin:true,ws:true,configure:proxy=>{proxy.on('proxyReq',request=>{request.setHeader('Origin',devTarget);if(previewUID)request.setHeader('Authorization','Bearer test:'+previewUID)});proxy.on('proxyReqWs',request=>{request.setHeader('Origin',devTarget);if(previewUID)request.setHeader('Authorization','Bearer test:'+previewUID)});}},'/media':{target:devTarget}}},build:{rollupOptions:{output:{manualChunks:{firebase:['firebase/app','firebase/auth']}}}}});
