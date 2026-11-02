import {THEMES,normalizeTheme} from './themes.mjs';
import './themes.css';
export function applyTheme(theme){
 const id=normalizeTheme(theme);document.documentElement.dataset.theme=id;
 const selected=THEMES.find(t=>t.id===id),light=selected.light||id==='paper',style=document.documentElement.style;
 for(const [key,value]of Object.entries({bg:selected.bg,panel:selected.panel,raised:selected.raised,brand:selected.accent,text:selected.text,muted:light?'#696474':'#aba9b6',border:light?'#50435b26':'#d8d8f021',hover:`color-mix(in srgb, ${selected.text} 7%, ${selected.raised})`,selected:`color-mix(in srgb, ${selected.accent} 18%, ${selected.raised})`,'accent-soft':selected.accent+'18','on-brand':light?'#fff':selected.panel}))style.setProperty('--'+key,value);
 style.colorScheme=light?'light':'dark';document.documentElement.dataset.tone=light?'light':'dark';
 document.querySelector('meta[name="theme-color"]')?.setAttribute('content',selected.bg);
 return id;
}
export function themeChooser({current='graphite',onChoose}={}){
 const existing=document.querySelector('.theme-dialog');if(existing){existing.focus();return;}
 let selected=normalizeTheme(current),committed=false;const original=selected,dialog=document.createElement('dialog');dialog.className='theme-dialog';dialog.setAttribute('aria-label','Choose your theme');
 dialog.innerHTML=`<header><span class="theme-wordmark">VELA</span><h1>Choose your theme</h1><p>Make yourself comfortable.</p></header><div class="theme-options" role="group" aria-label="Themes">${THEMES.map(theme=>`<button type="button" class="theme-option" data-choose-theme="${theme.id}" aria-pressed="${selected===theme.id}" style="--preview-bg:${theme.bg};--preview-panel:${theme.panel};--preview-raised:${theme.raised};--preview-accent:${theme.accent};--preview-text:${theme.text}"><span class="theme-app-preview" aria-hidden="true"><span class="theme-preview-rail"><i></i><i></i><i></i></span><span class="theme-preview-sidebar"><i></i><i></i><i></i></span><span class="theme-preview-chat"><i></i><i></i><i></i><b></b></span></span><span class="theme-option-label"><span><strong>${theme.name}</strong><small>${theme.description}</small></span><span class="theme-selected-dot" aria-hidden="true">✓</span></span></button>`).join('')}</div><footer><span>You can change this in Appearance.</span><button type="button" class="primary" data-confirm-theme>Use ${THEMES.find(t=>t.id===selected).name}</button></footer>`;
 document.querySelector('#layers').append(dialog);
 const close=document.createElement('button');close.className='theme-close icon-button';close.setAttribute('aria-label','Close theme chooser');close.textContent='×';close.onclick=()=>dialog.close();dialog.prepend(close);
 dialog.querySelectorAll('[data-choose-theme]').forEach(button=>button.onclick=()=>{selected=button.dataset.chooseTheme;applyTheme(selected);dialog.querySelectorAll('[data-choose-theme]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));dialog.querySelector('[data-confirm-theme]').textContent='Use '+THEMES.find(t=>t.id===selected).name;});
 dialog.querySelector('[data-confirm-theme]').onclick=()=>{committed=true;applyTheme(selected);localStorage.setItem('vela.theme',selected);localStorage.setItem('vela.theme.chosen','1');onChoose?.(selected);dialog.close();};
 dialog.addEventListener('close',()=>{if(!committed)applyTheme(original);dialog.remove();});dialog.showModal();
}
