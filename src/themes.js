import {THEMES,WALLPAPERS,normalizeTheme} from './themes.mjs';
import './themes.css';
import './theme-picker.css';
export function applyTheme(theme){
 const id=normalizeTheme(theme);document.documentElement.dataset.theme=id;
 const selected=THEMES.find(t=>t.id===id),light=selected.light||id==='paper',style=document.documentElement.style;
 for(const [key,value]of Object.entries({bg:selected.bg,panel:selected.panel,raised:selected.raised,brand:selected.accent,text:selected.text,muted:light?'#696474':'#aba9b6',border:light?'#50435b26':'#d8d8f021',hover:`color-mix(in srgb, ${selected.text} 7%, ${selected.raised})`,selected:`color-mix(in srgb, ${selected.accent} 18%, ${selected.raised})`,'accent-soft':selected.accent+'18','on-brand':light?'#fff':selected.panel}))style.setProperty('--'+key,value);
 style.setProperty('--wallpaper',WALLPAPERS[id]);style.setProperty('--desktop-glass',light?'#f0f4f9bd':selected.panel+'a8');style.colorScheme=light?'light':'dark';document.documentElement.dataset.tone=light?'light':'dark';
 document.querySelector('meta[name="theme-color"]')?.setAttribute('content',selected.bg);
 return id;
}
export function themeChooser({current='graphite',onChoose}={}){
 const existing=document.querySelector('.theme-dialog');if(existing){existing.focus();return;}
 let selected=normalizeTheme(current),committed=false;const original=selected,dialog=document.createElement('dialog');dialog.className='theme-dialog windows-theme-dialog';dialog.setAttribute('aria-label','Choose your theme');
 dialog.innerHTML=`<header><span class="theme-wordmark">Personalization</span><h1>Themes</h1><p>Choose a theme for your desktop.</p></header><div class="theme-options" role="group" aria-label="Themes">${THEMES.map(theme=>`<button type="button" class="theme-option" data-choose-theme="${theme.id}" aria-pressed="${selected===theme.id}" style="--preview-bg:${theme.bg};--preview-panel:${theme.panel};--preview-raised:${theme.raised};--preview-accent:${theme.accent};--preview-text:${theme.text}"><span class="theme-app-preview theme-desktop-preview" aria-hidden="true"><span class="theme-mini-window"><span class="theme-mini-dots"><i></i><i></i><i></i></span><span class="theme-mini-message"></span><span class="theme-mini-message own"></span><span class="theme-mini-composer"></span></span><span class="theme-mini-dock"><i></i><i></i><i></i></span></span><span class="theme-option-label"><span><strong>${theme.name}</strong><small>${theme.description}</small></span><span class="theme-selected-dot" aria-hidden="true">✓</span></span></button>`).join('')}</div><footer><span>You can change this in Personalization.</span><button type="button" class="primary" data-confirm-theme>Use ${THEMES.find(t=>t.id===selected).name}</button></footer>`;
 document.querySelector('#layers').append(dialog);
 const close=document.createElement('button');close.className='theme-close icon-button';close.setAttribute('aria-label','Close theme chooser');close.textContent='×';close.onclick=()=>dialog.close();dialog.prepend(close);
 dialog.querySelectorAll('[data-choose-theme]').forEach(button=>button.onclick=()=>{selected=button.dataset.chooseTheme;applyTheme(selected);dialog.querySelectorAll('[data-choose-theme]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));dialog.querySelector('[data-confirm-theme]').textContent='Use '+THEMES.find(t=>t.id===selected).name;});
 dialog.querySelector('[data-confirm-theme]').onclick=()=>{committed=true;applyTheme(selected);localStorage.setItem('vela.theme',selected);localStorage.setItem('vela.theme.chosen','1');onChoose?.(selected);dialog.close();};
 dialog.addEventListener('close',()=>{if(!committed)applyTheme(original);dialog.remove();});dialog.showModal();
}
