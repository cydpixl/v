import fs from 'node:fs';
import {createHash} from 'node:crypto';
const data=JSON.parse(fs.readFileSync('../../outputs/desktop-redesign/apple-data.json','utf8'));
const entries=data.data[1].data.shelves[1].items.filter(item=>item.title&&item.videoUrl&&['Show','Movie'].includes(item.type));
const folder='public/apple-tv-art';fs.mkdirSync(folder,{recursive:true});
const art=(value,width,height)=>value.template.replace('{w}',width).replace('{h}',height).replace('{c}','sr').replace('{f}','webp');
async function cache(url){const filename=createHash('sha256').update(url).digest('hex').slice(0,20)+'.webp',path=folder+'/'+filename;if(!fs.existsSync(path)){const response=await fetch(url,{signal:AbortSignal.timeout(25000)});if(!response.ok)throw Error('Apple artwork: '+response.status);fs.writeFileSync(path,Buffer.from(await response.arrayBuffer()))}return 'apple-tv-art/'+filename;}
const heroes=[];
for(const item of entries){heroes.push({appleId:item.segue.destination.id,title:item.title.replaceAll('\ufffd','’'),type:item.type==='Show'?'tv':'movie',description:(item.description||'').replaceAll('\ufffd','’'),metadata:item.primaryMetadata,rating:item.ratingBadges?.[0]?.fallbackText||'',tagline:item.explainabilityLine||'',artwork:await cache(art(item.artwork.wide,2400,1350)),logo:item.contentLogo?await cache(art(item.contentLogo,900,Math.round(900*item.contentLogo.height/item.contentLogo.width))):'',trailer:item.videoUrl.wide});}
fs.writeFileSync('public/apple-tv-heroes.json',JSON.stringify({source:'https://tv.apple.com/',heroes},null,2));console.log('Cached original hero artwork and logos for '+heroes.length+' Apple TV titles.');
