import {assetURL} from './config.js';
import './daily-thoughts-app.css';

// The Daily Thoughts frontend is published with Vela at /daily-thoughts/.
// Its existing Supabase session and saved entries remain intact.
export function mountDailyThoughts(root){
 const wrapper=document.createElement('section');
 wrapper.className='vela-daily-thoughts';
 wrapper.innerHTML=`<div class="vela-dt-loading" role="status" aria-live="polite"><span class="vela-dt-loading-mark" aria-hidden="true"></span><span>Opening Daily Thoughts</span></div><iframe class="vela-dt-frame" title="Daily Thoughts journal" loading="eager" allow="camera; microphone; clipboard-read; clipboard-write" referrerpolicy="same-origin"></iframe>`;
 root.replaceChildren(wrapper);
 const frame=wrapper.querySelector('iframe'),loading=wrapper.querySelector('.vela-dt-loading');
 let disposed=false;
 const done=()=>{if(disposed)return;frame.classList.add('is-loaded');loading?.remove()};
 const error=()=>{if(disposed)return;loading.textContent='Daily Thoughts could not be opened. Close the app and try again.'};
 frame.addEventListener('load',done);
 frame.addEventListener('error',error);
 frame.src=assetURL('daily-thoughts/index.html');
 return ()=>{disposed=true;frame.removeEventListener('load',done);frame.removeEventListener('error',error);frame.src='about:blank';wrapper.remove()};
}
