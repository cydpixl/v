export async function prepareAIImage(file){
 if(!/^image\/(jpeg|png|webp)$/.test(file.type))throw Error('Choose a JPEG, PNG, or WebP image.');
 if(file.size>20000000)throw Error('Choose an image smaller than 20 MB.');
 const bitmap=await createImageBitmap(file);try{if(bitmap.width*bitmap.height>40000000)throw Error('This picture is too large to process. Choose a smaller image.');let edge=1600,blob;
  for(let attempt=0;attempt<7;attempt++){const scale=Math.min(1,edge/Math.max(bitmap.width,bitmap.height)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));const context=canvas.getContext('2d');context.fillStyle='#fff';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(bitmap,0,0,canvas.width,canvas.height);blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.84-attempt*.035));if(blob&&blob.size<=190000)break;edge=Math.round(edge*.8)}
  if(!blob||blob.size>190000)throw Error('This image could not be resized. Try another picture.');const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(Error('Could not read this image.'));reader.readAsDataURL(blob)});return {name:file.name||'Pasted image',data};
 }finally{bitmap.close()}
}
