export function floodFill(ctx,x,y,color,barrier=null){
 const W=ctx.canvas.width,H=ctx.canvas.height;if(x<0||y<0||x>=W||y>=H)return;
 const data=ctx.getImageData(0,0,W,H),p=data.data,start=(y*W+x)*4,target=p.slice(start,start+4),rgb=color.match(/\w\w/g).map(v=>parseInt(v,16));
 if(target[0]===rgb[0]&&target[1]===rgb[1]&&target[2]===rgb[2]&&target[3]===255)return;
 const seen=new Uint8Array(W*H),stack=[y*W+x];
 const matches=at=>!seen[at]&&!barrier?.[at]&&Math.abs(target[0]-p[at*4])<=32&&Math.abs(target[1]-p[at*4+1])<=32&&Math.abs(target[2]-p[at*4+2])<=32&&Math.abs(target[3]-p[at*4+3])<=32;
 while(stack.length){const at=stack.pop();if(!matches(at))continue;const row=Math.floor(at/W);let left=at%W;while(left>0&&matches(row*W+left-1))left--;let above=false,below=false;
 for(let cx=left;cx<W&&matches(row*W+cx);cx++){const n=row*W+cx;seen[n]=1;p[n*4]=rgb[0];p[n*4+1]=rgb[1];p[n*4+2]=rgb[2];p[n*4+3]=255;
 if(row>0){const hit=matches(n-W);if(hit&&!above)stack.push(n-W);above=hit;}
 if(row<H-1){const hit=matches(n+W);if(hit&&!below)stack.push(n+W);below=hit;}}
 }
 ctx.putImageData(data,0,0);
}
export function lineLayers(context,gap=2){
 const width=context.canvas.width,height=context.canvas.height,source=context.getImageData(0,0,width,height),ink=context.createImageData(width,height);let mask=new Uint8Array(width*height);
 for(let i=0;i<mask.length;i++){const n=i*4,shade=Math.min(source.data[n],source.data[n+1],source.data[n+2]);mask[i]=shade<185&&source.data[n+3]>80?1:0;ink.data[n]=ink.data[n+1]=ink.data[n+2]=0;ink.data[n+3]=Math.round((255-shade)*source.data[n+3]/255);}
 const step=(values,dilate)=>{const out=new Uint8Array(values.length);for(let y=0;y<height;y++)for(let x=0;x<width;x++){let result=dilate?0:1;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const xx=x+dx,yy=y+dy,v=xx>=0&&xx<width&&yy>=0&&yy<height?values[yy*width+xx]:0;result=dilate?(result||v):(result&&v);}out[y*width+x]=result;}return out;};
 for(let i=0;i<gap;i++)mask=step(mask,true);for(let i=0;i<gap;i++)mask=step(mask,false);
 const overlay=document.createElement('canvas');overlay.width=width;overlay.height=height;overlay.getContext('2d').putImageData(ink,0,0);return {mask,overlay,original:source};
}
