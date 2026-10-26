import {canPlayInVela} from './cinema/library-source.mjs';

export const VELA_BOT_UID='vela-system-bot-v1';
export const COMMANDS=Object.freeze([
 {name:'bodycam',description:'Post the bodycam collection for everyone in this chat',bot:true,args:'search (optional)'},
 {name:'dailydose',description:'Post Daily Dose of Internet videos for everyone in this chat',bot:true,args:'search (optional)'},
 {name:'help',description:'Show VELA’s available commands in this chat',bot:true},
 {name:'library',description:'Open your uploaded videos',local:true},
 {name:'movies',description:'Browse films and shows',local:true},
 {name:'saved',description:'Open your saved messages',local:true},
 {name:'shrug',description:'Send a message with a shrug',args:'message (optional)'},
]);
export function parseCommand(text){
 const value=String(text||'').trim();
 const alias=value.match(/^\/body\s+cam(?:\s+(.*))?$/i);
 const match=value.match(/^\/([a-z]+)(?:\s+([\s\S]*))?$/i);
 if(alias)return {name:'bodycam',args:(alias[1]||'').trim()};
 if(!match)return null;
 const name=match[1].toLowerCase();
 return COMMANDS.some(c=>c.name===name)?{name,args:(match[2]||'').trim()}:null;
}
export function commandMatches(query='',botOnly=false){
 const q=String(query).replace(/^\//,'').toLowerCase();
 return COMMANDS.filter(c=>(!botOnly||c.bot)&&(!q||c.name.startsWith(q)));
}
export const BODYCAM_CHANNELS=Object.freeze(['EWU Crime Storytime','EWU Crime','Midwest Safety','Code Blue Cam']);
export function bodycamItems(rows,query='',category='bodycam'){
 const words=query.trim().toLowerCase().split(/\s+/).filter(Boolean);
 return rows.filter(item=>canPlayInVela(item)&&item.category===category&&(category!=='bodycam'||BODYCAM_CHANNELS.includes(item.channel))&&words.every(w=>[item.title,item.channel].join(' ').toLowerCase().includes(w))).map(item=>({id:item.id,title:item.title,poster:item.poster,channel:item.channel,duration:item.duration,height:item.height,playback:item.playback,embedAllowed:item.embedAllowed}));
}
