import {plainEmojis} from './emoji-size.js';
export function messagePreview(text='',attachment){
 text=plainEmojis(text);
 if(attachment?.kind==='bodycam-library')return 'Bodycam · '+(attachment.items?.length||0)+' videos';
 if(attachment?.kind==='daily-dose-library')return 'Daily Dose of Internet · '+(attachment.items?.length||0)+' videos';
 if(attachment?.kind==='command-help')return 'VELA commands';
 if(/^(?:\s*<:[a-zA-Z0-9_]{2,32}:[a-zA-Z0-9-]+>\s*)+$/.test(String(text)))return 'Emoji';
 const value=String(text).replace(/<:([a-zA-Z0-9_]{2,32}):[a-zA-Z0-9-]+>/g,':$1:');
 if(value.startsWith('[[vela-film:'))return 'Shared a film';
 if(/^\[\[vela-live-music:1:[A-Za-z0-9_-]{8,2800}\]\]$/.test(value))return 'Shared live music';
 if(value.trim())return value;
 if(!attachment)return '';
 if(attachment.kind==='files')return attachment.files.length+' attachments';
 if(attachment.kind==='sticker')return 'Sticker';
 if(attachment.kind==='gif')return 'GIF';
 if(attachment.kind==='emoji')return 'Emoji';
 if(attachment.type?.startsWith('video/'))return 'Video';
 if(attachment.type?.startsWith('image/'))return 'Photo';
 if(attachment.type?.startsWith('audio/'))return 'Audio';
 return attachment.name||'Attachment';
}
