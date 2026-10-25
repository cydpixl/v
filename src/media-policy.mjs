export const CHAT_TYPES = new Set(['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm','video/quicktime','audio/webm','audio/mp4','audio/ogg','audio/mpeg','audio/wav','application/pdf','text/plain','application/zip','application/octet-stream']);
export async function validateChatFile(file) {
  if (!file.size || file.size > 512*1024**2) throw Error(`${file.name}: files must be between 1 byte and 512 MB.`);
  const bytes = new Uint8Array(await file.slice(0,4096).arrayBuffer());
  const ascii = new TextDecoder('latin1').decode(bytes), raw = file.type.split(';')[0].toLowerCase();
  let detected = '';
  if (ascii.startsWith('%PDF-')) detected='application/pdf';
  else if (bytes[0]===0x50 && bytes[1]===0x4b && [3,5,7].includes(bytes[2])) detected='application/zip';
  else if (ascii.startsWith('RIFF') && ascii.slice(8,12)==='WAVE') detected='audio/wav';
  else if (ascii.startsWith('RIFF') && ascii.slice(8,12)==='WEBP') detected='image/webp';
  else if (ascii.startsWith('GIF87a') || ascii.startsWith('GIF89a')) detected='image/gif';
  else if (bytes[0]===0x89 && ascii.slice(1,4)==='PNG') detected='image/png';
  else if (bytes[0]===0xff && bytes[1]===0xd8) detected='image/jpeg';
  else if (ascii.startsWith('ID3') || (bytes[0]===0xff && (bytes[1]&0xe0)===0xe0)) detected='audio/mpeg';
  else if (ascii.startsWith('OggS')) detected='audio/ogg';
  else if (bytes[0]===0x1a && bytes[1]===0x45 && bytes[2]===0xdf && bytes[3]===0xa3) detected=raw==='audio/webm'?'audio/webm':'video/webm';
  else if (ascii.slice(4,8)==='ftyp') detected=raw==='audio/mp4'?'audio/mp4':raw==='video/quicktime'?'video/quicktime':'video/mp4';
  if (detected && raw && raw !== detected && raw !== 'application/octet-stream' && !(raw==='audio/x-wav' && detected==='audio/wav') && !(raw==='application/x-zip-compressed' && detected==='application/zip')) throw Error(`${file.name}: the file content does not match its reported type.`);
  if (!detected && /^(image|video|audio)\//.test(raw)) throw Error(`${file.name}: this media format could not be validated.`);
  const type = detected || (raw==='text/plain' && !bytes.includes(0) ? 'text/plain' : 'application/octet-stream');
  if (!CHAT_TYPES.has(type)) throw Error(`${file.name}: unsupported attachment format.`);
  return file.type===type ? file : new File([file],file.name,{type,lastModified:file.lastModified});
}
export async function validateChatSelection(files) {
  if (files.length > 10) throw Error(`You selected ${files.length} files. Send up to 10 in one message; remove files or split the selection.`);
  return Promise.all([...files].map(validateChatFile));
}
