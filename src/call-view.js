const views=new WeakMap(),bound=new WeakSet();

// These choices affect this viewer only. Media tracks and the call stay active.
export class CameraVisibility{
 constructor(doc,host,onChange,{hidden=[],mediaOnly=false}={}){
  this.hidden=new Set(hidden);this.mediaOnly=mediaOnly;this.onChange=onChange;
  this.root=doc.createElement('div');this.root.className='camera-visibility';
  this.only=doc.createElement('button');this.only.type='button';this.only.className='view-screen-only';
  this.only.onclick=()=>{this.mediaOnly=!this.mediaOnly;this.menu.open=false;this.onChange();};
  this.menu=doc.createElement('details');const summary=doc.createElement('summary');summary.textContent='Cameras';
  this.list=doc.createElement('div');this.list.className='camera-visibility-list';
  this.menu.append(summary,this.list);this.root.append(this.only,this.menu);host.append(this.root);
 }
 update(cameras,hasMedia){
  this.only.hidden=!hasMedia&&!this.mediaOnly;this.only.textContent=this.mediaOnly?'Restore cameras':'Screen only';this.only.setAttribute('aria-pressed',String(this.mediaOnly));
  const signature=JSON.stringify(cameras.map(t=>[t.dataset.tile,t.dataset.self,t.querySelector('.tile-label span')?.textContent]));
  if(signature!==this.signature){this.signature=signature;this.list.replaceChildren();
   for(const tile of cameras){const label=this.list.ownerDocument.createElement('label'),input=this.list.ownerDocument.createElement('input'),text=this.list.ownerDocument.createElement('span');input.type='checkbox';input.dataset.cameraKey=tile.dataset.tile;const name=tile.querySelector('.tile-label span')?.textContent||'Participant';text.textContent=tile.dataset.self==='true'?'Show my camera':'Show '+name.replace(/ \(You\)$/,'')+"'s camera";input.setAttribute('aria-label',text.textContent);input.onchange=()=>{if(this.mediaOnly)for(const item of this.list.querySelectorAll('input'))this.hidden.add(item.dataset.cameraKey);this.mediaOnly=false;if(input.checked)this.hidden.delete(tile.dataset.tile);else this.hidden.add(tile.dataset.tile);this.onChange();};label.append(input,text);this.list.append(label);}
  }
  for(const input of this.list.querySelectorAll('input'))input.checked=!this.mediaOnly&&!this.hidden.has(input.dataset.cameraKey);
  this.menu.hidden=!cameras.length;
 }
 includes(tile){return tile.classList.contains('screen-tile')||tile.id==='vela-movie-player'||(!this.mediaOnly&&!this.hidden.has(tile.dataset.tile));}
}

export function revealCallControls(stage){
 stage.classList.add('view-controls-visible');clearTimeout(stage.__viewControlsTimer);
 stage.__viewControlsTimer=setTimeout(()=>stage.classList.remove('view-controls-visible'),2200);
}
export function bindFullscreenView(stage){
 if(!stage||bound.has(stage))return;bound.add(stage);
 stage.addEventListener('pointermove',()=>revealCallControls(stage));
 stage.addEventListener('pointerdown',()=>revealCallControls(stage));
 stage.addEventListener('keydown',()=>revealCallControls(stage));
}
document.addEventListener('fullscreenchange',()=>{const stage=document.fullscreenElement;if(stage){bindFullscreenView(stage);revealCallControls(stage);}});

export function setCallView(stage,choices){
 const view=views.get(stage);if(!view)return;
 view.hidden=new Set(choices.hidden||[]);view.mediaOnly=!!choices.mediaOnly;applyCallView(stage);
}
export function callViewChoices(stage){const view=views.get(stage);return {hidden:[...(view?.hidden||[])],mediaOnly:!!view?.mediaOnly};}
export function applyCallView(stage){
 const host=stage.querySelector('.presentation-options');if(!host)return;bindFullscreenView(stage);
 let view=views.get(stage);if(!view){view=new CameraVisibility(document,host,()=>{applyCallView(stage);revealCallControls(stage);});views.set(stage,view);}
 const tiles=[...stage.querySelectorAll('#call-tiles>.call-tile,#call-tiles>#vela-movie-player')],cameras=tiles.filter(t=>t.classList.contains('call-tile')&&!t.classList.contains('screen-tile')&&!t.classList.contains('ringing-tile')),media=tiles.filter(t=>t.classList.contains('screen-tile')||t.id==='vela-movie-player');
 view.update(cameras,!!media.length);
 for(const tile of tiles)tile.dataset.viewHidden=String(!view.includes(tile));
 let focused=tiles.find(t=>t.classList.contains('focused'));
 const next=view.mediaOnly&&media.length?media.find(t=>t===focused)||media[0]:focused?.dataset.viewHidden==='true'?media[0]||tiles.find(t=>t.dataset.viewHidden!=='true'):null;
 if(next&&next!==focused){document.dispatchEvent(new CustomEvent('vela-focus-call',{detail:next.dataset.tile}));return;}
 focused=tiles.find(t=>t.classList.contains('focused'));
 const others=tiles.filter(t=>t!==focused&&t.dataset.viewHidden!=='true'&&!view.mediaOnly);
 stage.classList.toggle('presentation-solo',!!focused&&!others.length);stage.classList.toggle('presentation-screen-only',view.mediaOnly&&!!focused);
 stage.querySelector('#call-tiles')?.style.setProperty('--tile-rows',Math.max(1,others.length));
}
