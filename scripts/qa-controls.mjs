import {chromium,webkit} from 'playwright';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const qa=JSON.parse(fs.readFileSync(process.env.QA_CREDENTIALS||'.private/qa.json','utf8'));
const site=process.env.QA_SITE||'http://127.0.0.1:5198/',local=!process.env.QA_SITE;
const suffix=Date.now().toString(36),uids=['control-a-'+suffix,'control-b-'+suffix];
const apiBase=process.env.QA_API||'http://127.0.0.1:8787/api';
async function api(i,path,method='GET',body){const r=await fetch(apiBase+path,{method,headers:{Authorization:'Bearer test:'+uids[i],'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});const d=await r.json();assert.ok(r.ok,d.error);return d;}
if(!local)throw Error('Use this fixture-based suite against the local API only.');
for(let i=0;i<2;i++)await api(i,'/me','PUT',{handle:uids[i].replaceAll('-','_'),name:i?'Block Recipient':'Block Sender'});
await api(0,'/friends','POST',{handle:uids[1].replaceAll('-','_')});
await api(1,'/friends/'+(await api(1,'/state')).friends[0].id,'PATCH',{action:'accept'});
const cid=uids.slice().sort().join(':'),output='output/playwright/controls';fs.mkdirSync(output,{recursive:true});
const browser=await (process.env.QA_BROWSER==='webkit'?webkit:chromium).launch(process.env.QA_BROWSER==='webkit'?{headless:true}:{channel:'chrome',headless:true});
const pages=[],errors=[],passed=[];const pass=name=>{passed.push(name);console.log('PASS',name)};
async function closeDialogs(page){for(const d of await page.locator('dialog[open]').all())await d.getByRole('button',{name:'Close',exact:true}).click();}
try{
 for(let i=0;i<2;i++){
  const context=await browser.newContext({viewport:{width:1440,height:960}});
  await context.addInitScript(()=>{localStorage.setItem('vela.theme','midnight');localStorage.setItem('vela.theme.chosen','1')});
  await context.route('**/api/**',route=>route.continue({headers:{...route.request().headers(),authorization:'Bearer test:'+uids[i]}}));
  const page=await context.newPage();page.setDefaultTimeout(20000);page.on('pageerror',error=>errors.push(error.message));pages.push(page);
  await page.goto(site);await page.locator('[name=handle]').fill(qa.users[i].handle);await page.locator('[name=password]').fill(qa.password);await page.getByRole('button',{name:'Log In',exact:true}).click();await page.getByRole('button',{name:'Manage profile and status',exact:true}).waitFor();
  await page.locator('.dm-row').filter({hasText:i?'Block Sender':'Block Recipient'}).click();
 }
 const [a,b]=pages;
 for(const [value,label]of [['idle','Idle'],['dnd','Do Not Disturb'],['invisible','Invisible'],['online','Online']]){
  await a.getByRole('button',{name:'Manage profile and status',exact:true}).click();await a.locator('[data-account=status]').click();
  const option=a.locator('[data-status='+value+']');await option.waitFor({state:'visible'});
  await option.scrollIntoViewIfNeeded();assert.ok(await option.evaluate(el=>{const r=el.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight&&el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))}),'Status option is visible and clickable');
  await option.click();await a.locator('.account-popover').waitFor({state:'hidden'});assert.equal((await api(0,'/me')).user.status,value);
 }
 await a.reload();await a.getByRole('button',{name:'Manage profile and status',exact:true}).click();await a.locator('[data-account=status]').click();assert.equal(await a.locator('[data-status=online]').getAttribute('aria-checked'),'true');await a.keyboard.press('Escape');await a.keyboard.press('Escape');pass('All four presence statuses are reachable, saved and retained after reload');
 await a.getByRole('button',{name:'Manage profile and status',exact:true}).click();await a.getByRole('menuitem',{name:'Set custom status',exact:true}).click();
 await a.getByRole('textbox',{name:'Custom status',exact:true}).fill('Working buttons at last');await a.getByRole('button',{name:'Save status',exact:true}).click();
 await b.locator('.dm-row small').filter({hasText:'Working buttons at last'}).waitFor();await closeDialogs(a);pass('Custom status saves and updates the other account live');
 await a.locator('.dm-row').click();await a.locator('#composer').fill('Draft survives a block');
 await a.getByRole('button',{name:'Conversation Options',exact:true}).click();await a.getByRole('menuitem',{name:'Block Account',exact:true}).click();
 await a.locator('#relationship-banner').filter({hasText:'You blocked this account'}).waitFor();await b.locator('#relationship-banner').filter({hasText:'This account has blocked you'}).waitFor();
 for(const page of [a,b]){assert.equal(await page.locator('#composer').getAttribute('contenteditable'),'false');assert.equal(await page.getByRole('button',{name:'Send Message',exact:true}).isDisabled(),true);assert.equal(await page.getByRole('button',{name:'Start Voice Call',exact:true}).isDisabled(),true);}
 await a.locator('.header-identity [data-profile]').click();await a.getByRole('button',{name:'Unblock Account',exact:true}).waitFor();await closeDialogs(a);
 await a.screenshot({path:output+'/blocked-sender.png'});await b.screenshot({path:output+'/blocked-recipient.png'});pass('Directional block banners and disabled send/call controls update on both live accounts');
 await a.reload();await a.locator('.dm-row').click();await a.locator('#relationship-banner').filter({hasText:'You blocked this account'}).waitFor();assert.equal(await a.locator('#composer').innerText(),'Draft survives a block');
 await a.getByRole('button',{name:'User Settings',exact:true}).click();await a.locator('[data-settings=blocked]').click();await a.locator('.blocked-row').filter({hasText:'Block Recipient'}).waitFor();assert.ok((await a.locator('.blocked-row').innerText()).includes(uids[1].replaceAll('-','_')));await closeDialogs(a);pass('Blocked state survives reload; blocked-account settings show names and usernames; drafts preserved');
 await a.getByRole('button',{name:'Conversation Options',exact:true}).click();await a.getByRole('menuitem',{name:'Unblock Account',exact:true}).click();await a.locator('#relationship-banner').waitFor({state:'hidden'});await b.locator('#relationship-banner').waitFor({state:'hidden'});
 await a.locator('#composer').fill('Message after unblock');await a.getByRole('button',{name:'Send Message',exact:true}).click();await b.locator('.message-text').filter({hasText:'Message after unblock'}).waitFor();pass('Unblock from conversation menu restores controls and real message delivery');
 // Exercise the other block entry point and the settings recovery control.
 await a.getByRole('button',{name:'Friends',exact:true}).click();await a.locator('[data-tab=all]').click();await a.locator('[data-friend-menu]').click();await a.getByRole('menuitem',{name:'Block',exact:true}).click();await a.locator('.friend-name').filter({hasText:'You blocked this account'}).waitFor();
 await a.getByRole('button',{name:'User Settings',exact:true}).click();await a.locator('[data-settings=blocked]').click();await a.locator('[data-unblock]').click();await a.getByText('No blocked accounts.',{exact:true}).waitFor();await closeDialogs(a);pass('Friend menu blocking and Settings to Blocked Accounts to Unblock work');
 for(const viewport of [{width:390,height:844},{width:768,height:1024},{width:1440,height:600}]){
  await a.setViewportSize(viewport);await a.getByRole('button',{name:'Manage profile and status',exact:true}).click();await a.locator('[data-account=status]').click();await a.locator('[data-status=idle]').click();await a.locator('.account-popover').waitFor({state:'hidden'});
  await a.getByRole('button',{name:'Manage profile and status',exact:true}).click();await a.locator('[data-account=status]').click();await a.locator('[data-status=online]').click();await a.locator('.account-popover').waitFor({state:'hidden'});await a.screenshot({path:output+'/viewport-'+viewport.width+'x'+viewport.height+'.png'});
 }
 pass('Status works at phone, tablet and short desktop sizes');
 await a.setViewportSize({width:1440,height:960});await a.getByRole('button',{name:'User Settings',exact:true}).click();
 for(const id of ['account','privacy','notifications','appearance','accessibility','blocked','voice']){await a.locator('[data-settings='+id+']').click();assert.ok((await a.locator('#settings-page').innerText()).trim());}
 await closeDialogs(a);await a.getByRole('button',{name:'Inbox',exact:true}).click();await a.getByRole('dialog',{name:'Inbox',exact:true}).waitFor();await closeDialogs(a);
 await a.getByRole('button',{name:'Help',exact:true}).click();await a.getByRole('dialog',{name:'Help',exact:true}).waitFor();await closeDialogs(a);pass('Settings panels, Inbox and Help controls open successfully');
 assert.deepEqual(errors,[]);pass('No uncaught browser JavaScript errors');
 fs.writeFileSync(output+'/results-'+(process.env.QA_BROWSER||'chromium')+'.json',JSON.stringify({passed,errors},null,2));
}catch(error){for(let i=0;i<pages.length;i++)await pages[i].screenshot({path:output+'/failure-'+i+'.png'});throw error;}finally{await browser.close();}
