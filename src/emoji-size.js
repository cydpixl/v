const custom=/^<:([A-Za-z0-9_]{2,32}):([A-Za-z0-9-]+)>$/;
const segmenter=new Intl.Segmenter(undefined,{granularity:'grapheme'});
export const MIN_EMOJI_SIZE=16,MAX_EMOJI_SIZE=1000;
export const sizedEmojiPattern=()=>/\[\[vela-emoji:(\d{1,4}):([^\]\s]{1,800})\]\]/g;
export function emojiInfo(text){
 const match=String(text).match(custom);
 if(match)return {original:text,name:match[1],id:match[2]};
 if(String(text).length<=64&&[...segmenter.segment(String(text))].length===1&&/[\p{Extended_Pictographic}\p{Regional_Indicator}\u20e3]/u.test(text))return {original:text,name:text,id:''};
 return null;
}
export function decodeSizedEmoji(size,encoded){
 const pixels=Number(size);if(!Number.isInteger(pixels)||pixels<MIN_EMOJI_SIZE||pixels>MAX_EMOJI_SIZE)return null;
 try{const info=emojiInfo(decodeURIComponent(encoded));return info?{...info,size:pixels}:null}catch{return null}
}
export function sizedEmoji(original,size){return '[[vela-emoji:'+size+':'+encodeURIComponent(original)+']]'}
export function plainEmojis(text){return String(text??'').replace(sizedEmojiPattern(),(full,size,encoded)=>decodeSizedEmoji(size,encoded)?.original||full)}
export function customEmojiIds(text){return [...plainEmojis(text).matchAll(/<:[A-Za-z0-9_]{2,32}:([A-Za-z0-9-]+)>/g)].map(m=>m[1])}
export function emojiParts(text){
 const parts=[],pattern=/(<:[A-Za-z0-9_]{2,32}:[A-Za-z0-9-]+>)|\[\[vela-emoji:(\d{1,4}):([^\]\s]{1,800})\]\]/g;let end=0;
 const appendPlain=value=>{for(const {segment} of segmenter.segment(value)){const info=emojiInfo(segment);parts.push(info?{...info,token:segment,size:null}:{text:segment})}};
 for(const match of String(text).matchAll(pattern)){appendPlain(text.slice(end,match.index));const info=match[1]?emojiInfo(match[1]):decodeSizedEmoji(match[2],match[3]);parts.push(info?{...info,token:match[0]}:{text:match[0]});end=match.index+match[0].length}
 appendPlain(String(text).slice(end));return parts;
}
