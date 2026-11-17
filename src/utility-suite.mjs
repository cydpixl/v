import './utility-suite.css';
const definitions=[
 ['planner','Task Planner','Productivity','✓','Organize your work with persistent task lists.'],
 ['shopping','Shopping List','Lifestyle','▣','Make and check a list before shopping.'],
 ['habits','Habit Tracker','Lifestyle','◎','Track the daily habits you want to keep.'],
 ['journal','Daily Journal','Lifestyle','✎','Write a dated journal that stays on this device.'],
 ['scratch','Scratchpad','Productivity','≡','A quick place to write, saved automatically.'],
 ['minutes','Meeting Notes','Productivity','▤','Keep meeting minutes and action items.'],
 ['stopwatch','Stopwatch','Utilities','◷','Time activities with accurate elapsed time.'],
 ['countdown','Countdown','Utilities','◴','A configurable countdown timer.'],
 ['focus','Focus Timer','Productivity','◉','Twenty-five minute focused work sessions.'],
 ['budget','Budget Book','Finance','$','Track fictional or personal income and spending locally.'],
 ['split','Bill Splitter','Finance','÷','Split a bill with tax and tip.'],
 ['words','Word Counter','Writing','Aa','Track words, characters, and reading time.'],
 ['textlab','Text Lab','Writing','T','Trim, clean and change the case of text.'],
 ['json','JSON Formatter','Developer Tools','{ }','Validate, format and copy JSON.'],
 ['units','Unit Converter','Utilities','⇄','Convert common length, weight and temperature units.'],
 ['tips','Tip Calculator','Finance','%','Work out gratuities and totals.'],
 ['dates','Date Difference','Utilities','▦','Count the days between calendar dates.'],
 ['percentage','Percent Calculator','Education','%','Calculate a percentage of any amount.'],
 ['password','Password Generator','Security','✱','Generate secure random passwords locally.'],
 ['choose','Decision Picker','Lifestyle','↝','Randomly pick from a list of choices.'],
 ['dice','Dice Roller','Games','⚄','Roll one or several virtual dice.'],
 ['flashcards','Flashcards','Education','▧','Create cards and practice recall.'],
 ['bookmarks','Bookmarks','Productivity','⌑','Save and organize your favorite websites.'],
 ['colors','Color Lab','Design','◐','Explore HEX colors and text contrast.'],
 ['photo','Photo Optimizer','Photography','▧','Resize and compress an image on your device.'],
 ['world-clock','World Clock','Utilities','◴','View current times around the world.']
];
export const UTILITY_APPS=definitions.map(([slug,name,category,symbol,description])=>({id:'tool-'+slug,slug,name,category,symbol,description,icon:'file',note:'Runs locally in your browser; data is saved on this device.'}));
export const utilityDefinition=id=>UTILITY_APPS.find(app=>app.id===id);
const escapeHTML=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=n=>Number.isFinite(n)?new Intl.NumberFormat('en-US',{maximumFractionDigits:2}).format(n):'—';
const cash=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(n);
const today=()=>new Date().toLocaleDateString('en-CA');
function read(owner,slug){try{return JSON.parse(localStorage.getItem('vela.utility.'+owner+'.'+slug)||'{}')||{}}catch{return {}}}
function store(owner,slug,value){localStorage.setItem('vela.utility.'+owner+'.'+slug,JSON.stringify(value))}
const button=(label,act,secondary=false)=>'<button type="button" class="'+(secondary?'vs-secondary':'vs-button')+'" data-vs="'+act+'">'+label+'</button>';
const field=(label,name,kind='text',value='',attrs='')=>'<label class="vs-field"><span>'+label+'</span><input type="'+kind+'" name="'+name+'" value="'+escapeHTML(value)+'" '+attrs+'></label>';
const area=(label,name,value='',rows=8)=>'<label class="vs-field vs-field-wide"><span>'+label+'</span><textarea name="'+name+'" rows="'+rows+'">'+escapeHTML(value)+'</textarea></label>';
const wrap=(heading,body,extra='')=>'<div class="vs-work"><h2>'+heading+'</h2>'+body+extra+'</div>';
const listItems=(items,kind)=>items.map((a,i)=>'<div class="vs-list-row"><label><input type="checkbox" data-toggle="'+i+'" '+(a.done?'checked':'')+'><span class="'+(a.done?'vs-done':'')+'">'+escapeHTML(a.text)+'</span></label><button type="button" data-remove="'+i+'" aria-label="Remove '+escapeHTML(a.text)+'">×</button></div>').join('')||'<p class="vs-empty">No '+kind+' yet.</p>';
function randomInt(max){const nums=new Uint32Array(1);crypto.getRandomValues(nums);return nums[0]%max}
export function mountUtilityApp(root,{id,owner,toast=()=>{}}={}){
 const app=utilityDefinition(id);if(!app)throw Error('Unknown app');
 const slug=app.slug;let data=read(owner,slug),interval=null,imageFile=null,elapsed=0,start=0,remaining=slug==='focus'?1500:300,active=false,card=0,showAnswer=false;
 root.classList.add('vela-utility-root');
 root.innerHTML='<div class="vs-shell"><header class="vs-header"><span class="vs-mark">'+escapeHTML(app.symbol)+'</span><div><strong>'+escapeHTML(app.name)+'</strong><small>'+escapeHTML(app.category)+'</small></div></header><main class="vs-main"></main></div>';
 const main=root.querySelector('main');
 const save=()=>{try{store(owner,slug,data)}catch{toast('Local storage is full or unavailable.')}};
 const listen=(selector,event,handler)=>main.querySelectorAll(selector).forEach(el=>el.addEventListener(event,handler));
 const output=html=>{main.innerHTML=html};
 function render(){
 clearInterval(interval);interval=null;
 if(['planner','shopping','habits'].includes(slug)){
  let records=Array.isArray(data.items)?data.items:[];if(slug==='habits')records=records.map(x=>({...x,done:x.checkedDate===today()}));
  output(wrap(slug==='planner'?'My tasks':slug==='shopping'?'Shopping list':'Daily habits','<form class="vs-row"><input name="item" placeholder="'+(slug==='habits'?'Add a habit':'Add an item')+'" required maxlength="150"><button class="vs-button">Add</button></form><div class="vs-list">'+listItems(records,'items')+'</div><p class="vs-fine">'+records.filter(x=>x.done).length+' of '+records.length+' complete'+(slug==='habits'?' today':'')+'</p>'));
  main.querySelector('form').onsubmit=event=>{event.preventDefault();const text=event.currentTarget.item.value.trim();if(!text)return;data.items=[...(data.items||[]),{text,done:false,checkedDate:''}].slice(-300);save();render()};
  listen('[data-toggle]','change',event=>{const i=Number(event.currentTarget.dataset.toggle);if(slug==='habits')data.items[i].checkedDate=event.currentTarget.checked?today():'';else data.items[i].done=event.currentTarget.checked;save();render()});
  listen('[data-remove]','click',event=>{data.items.splice(Number(event.currentTarget.dataset.remove),1);save();render()});return;
 }
 if(['journal','scratch','minutes'].includes(slug)){
  const title=slug==='journal'?'Daily entry':slug==='scratch'?'Scratchpad':'Meeting notes';
  const entryKey=slug==='journal'?today():'text',content=slug==='journal'?(data.entries||{})[entryKey]||'':data.text||'';
  output(wrap(title,(slug==='journal'?'<p class="vs-fine">'+new Date().toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric',year:'numeric'})+'</p>':'')+area('Write here','text',content,15)+'<div class="vs-meta" data-save-status>Saved locally</div>'));
  main.querySelector('textarea').oninput=event=>{const value=event.target.value;if(slug==='journal'){data.entries={...data.entries,[entryKey]:value};}else data.text=value;save();main.querySelector('[data-save-status]').textContent='Saved locally · '+value.length+' characters';};return;
 }
 if(['stopwatch','countdown','focus'].includes(slug)){
  const clock=()=>{const ms=slug==='stopwatch'?elapsed+(active?Date.now()-start:0):Math.max(0,remaining-(active?Math.round((Date.now()-start)/1000):0));const secs=slug==='stopwatch'?Math.floor(ms/1000):Math.floor(ms);return String(Math.floor(secs/60)).padStart(2,'0')+':'+String(secs%60).padStart(2,'0')+(slug==='stopwatch'?'.'+String(Math.floor(ms%1000/10)).padStart(2,'0'):'')};
  output(wrap(slug==='stopwatch'?'Stopwatch':slug==='focus'?'Focus session':'Countdown','<div class="vs-clock" data-clock>'+clock()+'</div>'+(slug==='countdown'?field('Minutes','minutes','number','5','min="1" max="600"'):'')+'<div class="vs-actions">'+button('Start','start')+button('Pause','pause',true)+button('Reset','reset',true)+'</div><p class="vs-fine">'+(slug==='focus'?'A 25-minute work session. No alarms.':'Runs while this window is open.')+'</p>'));
  const face=main.querySelector('[data-clock]');
  function tick(){if(slug!=='stopwatch'&&active&&remaining-Math.round((Date.now()-start)/1000)<=0){remaining=0;active=false;clearInterval(interval);interval=null;}face.textContent=clock()}
  listen('[data-vs]','click',event=>{const cmd=event.currentTarget.dataset.vs;if(cmd==='start'){if(!active){if(slug==='countdown'&&remaining===300)remaining=Math.min(36000,Math.max(60,Number(main.querySelector('[name=minutes]').value||5)*60));start=Date.now();active=true;interval=setInterval(tick,70)}}else if(cmd==='pause'&&active){if(slug==='stopwatch')elapsed+=Date.now()-start;else remaining=Math.max(0,remaining-Math.round((Date.now()-start)/1000));active=false;clearInterval(interval);interval=null;}else if(cmd==='reset'){active=false;clearInterval(interval);interval=null;elapsed=0;remaining=slug==='focus'?1500:300;}tick()});return;
 }
 if(slug==='budget'){
  const entries=Array.isArray(data.entries)?data.entries:[],total=entries.reduce((n,x)=>n+Number(x.amount),0);
  output(wrap('Ledger','<div class="vs-total">'+cash(total)+'</div><form class="vs-form-grid">'+field('Description','text','text','','required maxlength="100"')+field('Amount (+ income / − expense)','amount','number','','step="0.01" required')+'<button class="vs-button">Add entry</button></form><div class="vs-list">'+entries.slice().reverse().map((x,i)=>'<div class="vs-list-row"><span>'+escapeHTML(x.text)+'</span><strong>'+cash(Number(x.amount))+'</strong><button data-delete="'+(entries.length-1-i)+'">×</button></div>').join('')+'</div><p class="vs-fine">Stored on this device. No linked accounts.</p>'));
  main.querySelector('form').onsubmit=event=>{event.preventDefault();const f=new FormData(event.currentTarget),amount=Number(f.get('amount'));if(!Number.isFinite(amount))return;data.entries=[...entries,{text:String(f.get('text')||''),amount}].slice(-300);save();render()};
  listen('[data-delete]','click',event=>{data.entries.splice(Number(event.currentTarget.dataset.delete),1);save();render()});return;
 }
 if(['split','tips','percentage'].includes(slug)){
  const isSplit=slug==='split',isPercent=slug==='percentage';
  output(wrap(isSplit?'Split your bill':isPercent?'Percentage':'Calculate tip','<form class="vs-form-grid">'+field(isPercent?'Amount':'Bill amount','amount','number','100','min="0" step="0.01" required')+field(isPercent?'Percent':'Tip percentage','percent','number','18','min="0" step="0.01" required')+(isSplit?field('People','people','number','2','min="1" step="1" required'):'')+'<button class="vs-button">Calculate</button></form><section class="vs-result" data-result></section>'));
  main.querySelector('form').onsubmit=event=>{event.preventDefault();const f=new FormData(event.currentTarget),amount=Number(f.get('amount')),percent=Number(f.get('percent')),p=Math.max(1,Math.floor(Number(f.get('people'))||1));const tip=amount*percent/100;main.querySelector('[data-result]').innerHTML=isPercent?'<b>'+cash(tip)+'</b><p>'+fmt(percent)+'% of '+cash(amount)+'</p>':isSplit?'<b>'+cash((amount+tip)/p)+'</b><p>Each person · '+cash(tip)+' total tip · '+cash(amount+tip)+' bill total</p>':'<b>'+cash(amount+tip)+'</b><p>Tip '+cash(tip)+'</p>';};return;
 }
 if(['words','textlab','json'].includes(slug)){
  output(wrap(slug==='json'?'JSON workspace':slug==='words'?'Text statistics':'Text editor',area('Input','body',data.text||'',14)+'<div class="vs-actions">'+(slug==='json'?button('Format JSON','format')+button('Minify','minify',true):slug==='textlab'?button('UPPERCASE','upper')+button('lowercase','lower',true)+button('Trim spaces','trim',true):button('Clear text','clear',true))+'</div><section class="vs-result" data-result></section>'));
  const areaEl=main.querySelector('textarea'),result=main.querySelector('[data-result]');
  const stats=()=>{const words=areaEl.value.trim().split(/\s+/).filter(Boolean).length;result.textContent=words+' words · '+areaEl.value.length+' characters · '+Math.ceil(words/200)+' min read';};
  if(slug==='words')stats();
  areaEl.oninput=()=>{data.text=areaEl.value.slice(0,500000);save();if(slug==='words')stats()};
  listen('[data-vs]','click',event=>{const c=event.currentTarget.dataset.vs;try{if(c==='format'||c==='minify'){const json=JSON.parse(areaEl.value);areaEl.value=JSON.stringify(json,null,c==='format'?2:0);result.textContent='Valid JSON.';}else if(c==='upper')areaEl.value=areaEl.value.toUpperCase();else if(c==='lower')areaEl.value=areaEl.value.toLowerCase();else if(c==='trim')areaEl.value=areaEl.value.split('\n').map(x=>x.trim()).join('\n');else if(c==='clear')areaEl.value='';data.text=areaEl.value;save();if(slug==='words')stats();}catch(error){result.textContent='JSON error: '+error.message}});return;
 }
 if(slug==='units'){
  const units={Length:{Meters:1,Kilometers:1000,Feet:.3048,Miles:1609.344,Inches:.0254},Mass:{Grams:1,Kilograms:1000,Ounces:28.349523125,Pounds:453.59237},Temperature:{Celsius:1,Fahrenheit:1,Kelvin:1}};
  output(wrap('Convert units','<div class="vs-form-grid">'+field('Value','value','number','1','step="any"')+'<label class="vs-field"><span>Type</span><select name="group">'+Object.keys(units).map(x=>'<option>'+x+'</option>').join('')+'</select></label><label class="vs-field"><span>From</span><select name="from"></select></label><label class="vs-field"><span>To</span><select name="to"></select></label></div><div class="vs-result" data-result></div>'));
  const value=main.querySelector('[name=value]'),group=main.querySelector('[name=group]'),from=main.querySelector('[name=from]'),to=main.querySelector('[name=to]'),result=main.querySelector('[data-result]');
  const sync=()=>{const opts=Object.keys(units[group.value]);from.innerHTML=opts.map(x=>'<option>'+x+'</option>').join('');to.innerHTML=opts.map(x=>'<option>'+x+'</option>').join('');to.selectedIndex=1};
  const calc=()=>{const n=Number(value.value),u=units[group.value];let ans;if(group.value==='Temperature'){const c=from.value==='Fahrenheit'?(n-32)*5/9:from.value==='Kelvin'?n-273.15:n;ans=to.value==='Fahrenheit'?c*9/5+32:to.value==='Kelvin'?c+273.15:c}else ans=n*u[from.value]/u[to.value];result.textContent=fmt(n)+' '+from.value+' = '+fmt(ans)+' '+to.value;};
  group.onchange=()=>{sync();calc()};[value,from,to].forEach(x=>x.addEventListener('input',calc));sync();calc();return;
 }
 if(slug==='dates'){
  output(wrap('Days between dates','<div class="vs-form-grid">'+field('Start','start','date',today())+field('End','end','date',today())+'</div><div data-result class="vs-result"></div>'));
  const calc=()=>{const a=Date.parse(main.querySelector('[name=start]').value+'T00:00:00Z'),b=Date.parse(main.querySelector('[name=end]').value+'T00:00:00Z');main.querySelector('[data-result]').textContent=Number.isFinite(a+b)?Math.round(Math.abs(b-a)/86400000)+' days apart':'Choose two dates';};
  listen('input','change',calc);calc();return;
 }
 if(slug==='password'){
  output(wrap('Generate password',field('Length','length','number','20','min="8" max="64"')+'<label class="vs-check"><input type="checkbox" name="special" checked> Include symbols</label>'+button('Generate','generate')+'<div class="vs-secret" data-secret></div>'+button('Copy password','copy',true)+'<p class="vs-fine">Generated with the browser’s cryptographic random source. Not sent to any server.</p>'));
  const target=main.querySelector('[data-secret]');let password='';
  function generate(){const chars='abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'+(main.querySelector('[name=special]').checked?'!@#$%^&*_-+':'');const bytes=new Uint32Array(Math.min(64,Math.max(8,Number(main.querySelector('[name=length]').value)||20)));crypto.getRandomValues(bytes);password=[...bytes].map(b=>chars[b%chars.length]).join('');target.textContent=password}
  listen('[data-vs]','click',event=>{if(event.currentTarget.dataset.vs==='generate')generate();else if(password)navigator.clipboard.writeText(password).then(()=>toast('Copied password')).catch(()=>toast('Clipboard permission unavailable.'))});generate();return;
 }
 if(slug==='choose'){
  output(wrap('Make a choice',area('One choice per line','choices',data.text||'Movie\nGame\nMusic',10)+button('Choose randomly','pick')+'<div data-result class="vs-result"></div>'));
  main.querySelector('textarea').oninput=event=>{data.text=event.target.value;save()};
  listen('[data-vs]','click',()=>{const options=main.querySelector('textarea').value.split('\n').map(x=>x.trim()).filter(Boolean);main.querySelector('[data-result]').textContent=options.length?options[randomInt(options.length)]:'Add at least one choice.'});return;
 }
 if(slug==='dice'){
  output(wrap('Roll the dice',field('Number of dice','count','number','2','min="1" max="12"')+button('Roll','roll')+'<div data-result class="vs-result"></div>'));
  listen('[data-vs]','click',()=>{const n=Math.max(1,Math.min(12,Number(main.querySelector('[name=count]').value)||2)),rolls=Array.from({length:n},()=>randomInt(6)+1);main.querySelector('[data-result]').innerHTML='<b>'+rolls.join(' · ')+'</b><p>Total '+rolls.reduce((a,b)=>a+b,0)+'</p>'});return;
 }
 if(slug==='flashcards'){
  let cards=Array.isArray(data.cards)?data.cards:[],item=cards[card%Math.max(1,cards.length)];
  output(wrap('Study cards','<form class="vs-form-grid">'+field('Front','front','text','','required maxlength="300"')+field('Back','back','text','','required maxlength="500"')+'<button class="vs-button">Add card</button></form>'+(item?'<button class="vs-flashcard" data-flip><small>'+(showAnswer?'ANSWER':'QUESTION')+' · '+(card%cards.length+1)+' / '+cards.length+'</small><strong>'+escapeHTML(showAnswer?item.back:item.front)+'</strong><span>Click to flip</span></button><div class="vs-actions">'+button('Previous','prev',true)+button('Next','next')+button('Delete card','delete',true)+'</div>':'<p class="vs-empty">Add your first study card.</p>')));
  main.querySelector('form').onsubmit=event=>{event.preventDefault();const f=new FormData(event.currentTarget);data.cards=[...cards,{front:f.get('front'),back:f.get('back')}].slice(-300);card=data.cards.length-1;showAnswer=false;save();render()};
  listen('[data-flip]','click',()=>{showAnswer=!showAnswer;render()});
  listen('[data-vs]','click',event=>{const a=event.currentTarget.dataset.vs;if(a==='delete'){data.cards.splice(card%cards.length,1);card=Math.max(0,card-1);save()}else card=(card+cards.length+(a==='next'?1:-1))%cards.length;showAnswer=false;render()});return;
 }
 if(slug==='bookmarks'){
  const links=Array.isArray(data.links)?data.links:[];
  output(wrap('Saved links','<form class="vs-form-grid">'+field('Label','title','text','','required maxlength="100"')+field('Website address','url','url','https://','required')+'<button class="vs-button">Save link</button></form><div class="vs-list">'+links.map((l,i)=>'<div class="vs-list-row"><a href="'+escapeHTML(l.url)+'" target="_blank" rel="noopener noreferrer">'+escapeHTML(l.title)+'</a><button data-delete="'+i+'">×</button></div>').join('')+'</div>'));
  main.querySelector('form').onsubmit=event=>{event.preventDefault();const f=new FormData(event.currentTarget);try{const parsed=new URL(String(f.get('url')));if(!['https:','http:'].includes(parsed.protocol))throw Error('Invalid protocol');data.links=[...links,{title:String(f.get('title')),url:parsed.href}].slice(-100);save();render()}catch{toast('Enter a valid HTTP or HTTPS website address')}};
  listen('[data-delete]','click',event=>{data.links.splice(Number(event.currentTarget.dataset.delete),1);save();render()});return;
 }
 if(slug==='colors'){
  output(wrap('Find your color',field('Color','color','color',data.color||'#3769be')+'<div class="vs-color-preview" data-preview><strong data-hex></strong><p>Sample foreground and background contrast</p></div>'+button('Copy HEX','copy',true)));
  const input=main.querySelector('[name=color]'),preview=main.querySelector('[data-preview]');
  function update(){const color=input.value;data.color=color;save();preview.style.background=color;preview.querySelector('[data-hex]').textContent=color.toUpperCase();const rgb=[1,3,5].map(i=>parseInt(color.slice(i,i+2),16));const luminance=rgb.reduce((n,c,i)=>n+(c/255<=.04045?c/255/12.92:Math.pow((c/255+.055)/1.055,2.4))*[.2126,.7152,.0722][i],0);preview.style.color=luminance>.35?'#0b1625':'#fff'}
  input.oninput=update;listen('[data-vs]','click',()=>navigator.clipboard.writeText(input.value).then(()=>toast('Copied color')).catch(()=>{}));update();return;
 }
 if(slug==='photo'){
  output(wrap('Optimize a photo','<label class="vs-field"><span>Choose image</span><input type="file" accept="image/png,image/jpeg,image/webp" data-file></label>'+field('Maximum width (px)','width','number','1600','min="100" max="4096"')+field('JPEG quality (%)','quality','range','82','min="40" max="100"')+button('Export JPEG','export')+'<div data-result class="vs-result">Choose a photo to begin. Photos stay on this device.</div>'));
  main.querySelector('[data-file]').onchange=event=>{imageFile=event.target.files[0]||null;main.querySelector('[data-result]').textContent=imageFile?imageFile.name+' · '+fmt(imageFile.size/1024)+' KB':'Choose a photo'};
  listen('[data-vs]','click',async()=>{if(!imageFile)return toast('Choose an image first.');let bmp;try{bmp=await createImageBitmap(imageFile);const width=Math.min(bmp.width,Math.max(100,Number(main.querySelector('[name=width]').value)||1600));const height=Math.round(bmp.height*width/bmp.width);const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;canvas.getContext('2d').drawImage(bmp,0,0,width,height);const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',Number(main.querySelector('[name=quality]').value)/100));if(!blob)throw Error('Could not export');const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=imageFile.name.replace(/\.[^.]+$/,'')+'-optimized.jpg';link.click();setTimeout(()=>URL.revokeObjectURL(url),60000);main.querySelector('[data-result]').textContent=width+'×'+height+' · '+fmt(blob.size/1024)+' KB exported';}catch(error){toast(error.message)}finally{bmp?.close()}});return;
 }
 if(slug==='world-clock'){
  const zones=['America/New_York','America/Chicago','America/Denver','America/Los_Angeles','Europe/London','Europe/Paris','Asia/Tokyo','Australia/Sydney'];
  output(wrap('World time','<div class="vs-clock-grid">'+zones.map(zone=>'<div class="vs-zone"><strong>'+escapeHTML(zone.split('/').at(-1).replaceAll('_',' '))+'</strong><time data-zone="'+zone+'"></time></div>').join('')+'</div>'));
  const update=()=>main.querySelectorAll('[data-zone]').forEach(el=>{el.textContent=new Intl.DateTimeFormat('en-US',{timeZone:el.dataset.zone,hour:'numeric',minute:'2-digit',second:'2-digit',hour12:true}).format(new Date())});
  update();interval=setInterval(update,1000);return;
 }
 }
 render();
 return ()=>{clearInterval(interval);root.replaceChildren()};
}
