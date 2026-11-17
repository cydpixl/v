import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const games=['meteor-dodge','sky-glider','neon-runner','lane-drift','color-catcher','moving-targets','pulse-guard','gravity-swap','orbit-escape','laser-gates','word-search','word-scramble','code-breaker','math-rush','higher-lower','sequence-sprint','maze-path','peg-solitaire','flood-grid','seven-queens','domino-chain','dots-boxes','tri-peaks','number-trail'];
const base=process.env.VELA_QA_URL||'http://127.0.0.1:5218';
const folder='output/vela-collection';fs.mkdirSync(folder,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--no-sandbox']});
const context=await browser.newContext({viewport:{width:1040,height:680},serviceWorkers:'block'});
let failures=0;const logs=[];
try{
 for(const slug of games){
  const page=await context.newPage(),errors=[];page.on('pageerror',err=>errors.push(err.message));page.setDefaultTimeout(10000);
  try{
   await page.goto(base+'/open-games/vela-collection/index.html?game='+slug,{waitUntil:'domcontentloaded'});
   await page.locator('#start').click();
   assert.equal(await page.locator('#overlay').isVisible(),false,slug+' overlay never closed');
   const canvas=await page.locator('#arena canvas').count();
   assert.ok(canvas||await page.locator('.board').count(),slug+' has no game UI');
   if(canvas){await page.locator('canvas').click({position:{x:240,y:180}});await page.keyboard.press('Space');}
   if(slug==='word-search'){const items=await page.locator('.word-grid button').allTextContents();assert.equal(items.length,64);}
   if(slug==='code-breaker'){await page.locator('.answer input').fill('1234');await page.locator('.answer button').click();assert.ok(await page.locator('.pills .pill').count()>0);}
   if(slug==='number-trail'){await page.getByRole('button',{name:'Number 1',exact:true}).click();assert.equal(await page.locator('#score').innerText(),'4');}
   if(slug==='peg-solitaire'){await page.locator('.peg-grid button').nth(22).click();await page.locator('.peg-grid button').nth(24).click();assert.equal(await page.locator('#score').innerText(),'2');}
   if(slug==='dots-boxes'){await page.locator('.edge').first().click();assert.ok(await page.locator('.edge.claimed').count()>=2);}
   if(slug==='domino-chain'){await page.locator('.domino-hand button:not(:disabled)').first().click();assert.equal(await page.locator('#score').innerText(),'5');}
   if(slug==='flood-grid'){await page.locator('.rainbow button').nth(0).click();await page.locator('.rainbow button').nth(1).click();assert.ok(Number(await page.locator('#score').innerText())>=1);}
   if(slug==='tri-peaks'){const before=await page.locator('.deck button').innerText();await page.locator('.deck button').click();assert.notEqual(await page.locator('.deck button').innerText(),before);}
   if(slug==='maze-path')assert.equal(await page.locator('.grid-cell').count(),49);
   await page.waitForTimeout(80);
   if(['meteor-dodge','word-search','tri-peaks'].includes(slug))await page.screenshot({path:folder+'/'+slug+'.png'});
   await page.locator('#pause').click();
   assert.equal(await page.locator('#overlay').isVisible(),true,slug+' pause failed');
   await page.locator('#start').click();
   assert.equal(await page.locator('#overlay').isVisible(),false,slug+' resume failed');
   await page.locator('#restart').click();
   assert.ok(await page.locator('#arena').children().count()>0,slug+' restart failed');
   assert.deepEqual(errors,[],slug+' page errors');
   logs.push({slug,pass:true});
  }catch(error){failures++;logs.push({slug,pass:false,error:String(error),pageErrors:errors});console.error('FAIL '+slug,String(error));}
  finally{await page.close();}
 }
 const page=await context.newPage();await page.goto(base+'/scripts/fixtures/vela-games.html');await page.waitForFunction(()=>Boolean(window.qaHub));await page.evaluate(()=>window.qaHub.open('store'));await page.locator('.ms-store').waitFor();
 await page.getByRole('searchbox',{name:'Search apps and games'}).fill('Meteor Dodge');assert.equal(await page.locator('.ms-app-card').count(),1);await page.getByRole('button',{name:'View Meteor Dodge'}).click();assert.ok(await page.getByText('How to play',{exact:true}).isVisible());await page.close();
 const mobile=await context.newPage();await mobile.setViewportSize({width:390,height:844});await mobile.goto(base+'/open-games/vela-collection/index.html?game=number-trail');await mobile.locator('#start').click();assert.ok(await mobile.getByRole('button',{name:'Number 1'}).isVisible());assert.equal(await mobile.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await mobile.close();
 assert.equal(failures,0,failures+' games failed browser tests');
 console.log('PASS all 24 live game UIs, controls, pause/resume, restart, store listing and mobile sizing.');
}catch(error){console.error(error);process.exitCode=1;}
finally{fs.writeFileSync(folder+'/qa-report.json',JSON.stringify(logs,null,2));await browser.close();}
