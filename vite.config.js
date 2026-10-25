import {defineConfig} from 'vite';
export default defineConfig({optimizeDeps:{include:['mediabunny','@mediabunny/ac3','@mediabunny/dts','@mediabunny/aac-encoder']},worker:{format:'es'},server:{proxy:{'/api':{target:'http://127.0.0.1:8787',ws:true},'/media':{target:'http://127.0.0.1:8787'}}},build:{rollupOptions:{output:{manualChunks:{firebase:['firebase/app','firebase/auth']}}}}});
