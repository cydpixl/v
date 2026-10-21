import assert from 'node:assert/strict';
import {clipboardImages,screenshotFile,bindImagePaste} from '../src/clipboard-images.js';
const image=new File(['png bytes'],'image.png',{type:'image/png'}),text=new File(['text'],'note.txt',{type:'text/plain'});
const item=file=>({kind:'file',getAsFile:()=>file});
assert.deepEqual(clipboardImages({items:[item(image)],files:[image]}),[image]);
assert.deepEqual(clipboardImages({items:[{kind:'string',type:'text/html',getAsFile:()=>{throw Error('Not a file')}}],files:[]}),[]);
assert.deepEqual(clipboardImages({items:[item(null)],files:[image,text]}),[image]);
assert.deepEqual(clipboardImages({files:[new File([],'empty.png',{type:'image/png'}),text]}),[]);
const screenshot=screenshotFile(image);assert.match(screenshot.name,/^Screenshot-.*\.png$/);assert.equal(screenshot.type,'image/png');assert.equal(await screenshot.text(),await image.text());
const named=new File(['jpeg'],'my-screenshot.jpg',{type:'image/jpeg'});assert.equal(screenshotFile(named),named);
const composer=new EventTarget(),received=[];let multiple=0,errors=0;
const unbind=bindImagePaste(composer,{onImage:file=>received.push(file),onMultiple:()=>multiple++,onError:()=>errors++});
function paste(data){const event=new Event('paste',{cancelable:true});Object.defineProperty(event,'clipboardData',{value:data});composer.dispatchEvent(event);return event}
assert.equal(paste({items:[],files:[]}).defaultPrevented,false);
assert.equal(paste({items:[item(image)],files:[image]}).defaultPrevented,true);assert.equal(received.length,1);
assert.equal(paste({files:[image,named]}).defaultPrevented,true);assert.equal(received.length,2);assert.equal(multiple,1);
unbind();paste({files:[image]});assert.equal(received.length,2);assert.equal(errors,0);
console.log('PASS: screenshot bytes/name/MIME, browser item+file deduplication, files-only fallback, text paste, multi-image limit and listener cleanup.');
