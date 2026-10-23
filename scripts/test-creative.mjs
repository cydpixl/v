import assert from 'node:assert/strict';
import {floodFill} from '../src/creative-canvas.mjs';

function surface(width,height){
 const data=new Uint8ClampedArray(width*height*4).fill(255);
 return {data,ctx:{canvas:{width,height},getImageData:()=>({data:data.slice()}),putImageData:image=>data.set(image.data)}};
}
const {data,ctx}=surface(5,5);
// A black vertical boundary must contain the fill on its starting side.
for(let y=0;y<5;y++){const at=(y*5+2)*4;data[at]=data[at+1]=data[at+2]=0;}
floodFill(ctx,0,0,'ff0000');
assert.deepEqual([...data.slice(0,4)],[255,0,0,255]);
assert.deepEqual([...data.slice(8,12)],[0,0,0,255]);
assert.deepEqual([...data.slice(16,20)],[255,255,255,255]);
const before=data.slice();floodFill(ctx,-1,0,'000000');assert.deepEqual(data,before);
floodFill(ctx,0,0,'ff0000');assert.deepEqual(data,before,'Repeating a fill must be stable');
const protectedPage=surface(5,5),barrier=new Uint8Array(25);
for(let y=0;y<5;y++)barrier[y*5+2]=1;
floodFill(protectedPage.ctx,0,0,'336699',barrier);
assert.deepEqual([...protectedPage.data.slice(0,4)],[51,102,153,255]);
assert.deepEqual([...protectedPage.data.slice(8,12)],[255,255,255,255],'Gap-protection boundary stays intact');
assert.deepEqual([...protectedPage.data.slice(16,20)],[255,255,255,255],'Fill cannot cross protected outlines');
console.log('PASS: fill boundaries, exact colors, gap protection, repeat fill and canvas bounds');
