export function messagePreview(text='',attachment){
 if(/^(?:\s*<:[a-zA-Z0-9_]{2,32}:[a-zA-Z0-9-]+>\s*)+$/.test(String(text)))return 'Emoji';
 const value=String(text).replace(/<:([a-zA-Z0-9_]{2,32}):[a-zA-Z0-9-]+>/g,':$1:');
 if(value.startsWith('[[vela-film:'))return 'Shared a film';
 if(value.trim())return value;
 if(!attachment)return '';
 if(attachment.kind==='sticker')return 'Sticker';
 if(attachment.kind==='gif')return 'GIF';
 if(attachment.kind==='emoji')return 'Emoji';
 if(attachment.type?.startsWith('video/'))return 'Video';
 if(attachment.type?.startsWith('image/'))return 'Photo';
 if(attachment.type?.startsWith('audio/'))return 'Audio';
 return attachment.name||'Attachment';
}
