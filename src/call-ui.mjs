const markup=new WeakMap();
export function stableCallMarkup(element,html){
 if(!element||markup.get(element)===html)return;
 element.innerHTML=html;markup.set(element,html);
}
export function updateSpeaking(stage,engine){
 if(!stage||!engine)return;
 for(const tile of stage.querySelectorAll('.call-tile')){
  const uid=tile.dataset.participant,mic=uid===engine.user.uid?!engine.muted:engine.remote.get(uid)?.state?.mic!==false;
  tile.classList.toggle('speaking',!!engine.speaking.get(uid)&&mic);
 }
}
