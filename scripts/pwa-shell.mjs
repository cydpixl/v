import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
// Freeze the boot graph into the shell so the very first offline reopen works.
export function pwaShell(){let outDir;return {name:'vela-pwa-shell',configResolved(config){outDir=path.resolve(config.root,config.build.outDir);},writeBundle(_options,bundle){
 const files=Object.values(bundle).filter(file=>/\.(js|css)$/.test(file.fileName)).map(file=>'./'+file.fileName);
 const shell=['./','./manifest.webmanifest','./favicon.svg','./vela-mark.svg','./icons/icon-192.png','./icons/icon-512.png','./icons/apple-touch-icon.png','./icons/maskable-512.png','./vela-smtc.js','./vela-smtc.css',...fs.readdirSync('public/fonts').map(name=>'./fonts/'+name),...files];
 const hash=createHash('sha256').update(fs.readFileSync('public/sw.js')).update(files.join('|')).digest('hex').slice(0,12);
 const source=fs.readFileSync('public/sw.js','utf8').replace("const VERSION='pwa-repair-20261027';",`const VERSION='pwa-${hash}';`).replace(/\/\* VELA_PRECACHE \*\/\[[^;]+\]/,JSON.stringify(shell));
 fs.writeFileSync(path.join(outDir,'sw.js'),source);
 }};}
