export const VISION_MODEL='qwen/qwen3.8-27b';
export async function validateAssistantImages(input,fail){
 if(input===undefined)return [];if(!Array.isArray(input)||input.length>3)fail('Attach up to three images.');
 let total=0;const result=[];
 for(const image of input){const match=typeof image?.data==='string'&&image.data.match(/^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/);if(!match||match[2].length>810000||match[2].length%4)fail('Choose a valid JPEG, PNG, or WebP image.');
  let bytes;try{bytes=Uint8Array.from(atob(match[2]),c=>c.charCodeAt(0))}catch{fail('This image could not be read.')}
  total+=bytes.length;if(total>600000||!bytes.length)fail('Images are too large. Try a smaller picture.',413);
  const type=match[1],signature=type==='jpeg'?bytes[0]===255&&bytes[1]===216&&bytes[2]===255:type==='png'?[137,80,78,71,13,10,26,10].every((b,i)=>bytes[i]===b):String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP';if(!signature)fail('The image format does not match its contents.');
  const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(b=>b.toString(16).padStart(2,'0')).join('');result.push({bytes,mime:'image/'+type,hash,name:String(image.name||'Image').slice(0,120)});
 }return result;
}
export async function imageData(env,image,fail){const object=await env.FILES.get(image.object_key);if(!object)fail('A saved image is unavailable. Reattach it to continue.',410);const bytes=new Uint8Array(await object.arrayBuffer());let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));return 'data:'+image.mime+';base64,'+btoa(binary)}
export async function visionHistory(env,messages,images,fail){const keep=new Set(images.slice(-3).map(i=>i.id));return Promise.all(messages.map(async message=>{const attachments=images.filter(i=>i.message===message.id&&keep.has(i.id));return {role:message.role,content:attachments.length?[{type:'text',text:message.content},...await Promise.all(attachments.map(async image=>({type:'image_url',image_url:{url:await imageData(env,image,fail)}})))]:message.content}}))}
