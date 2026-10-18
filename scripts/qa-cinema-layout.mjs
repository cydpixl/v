import {chromium} from 'playwright';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const account=JSON.parse(fs.readFileSync('.private/qa.json'));
const site=process.env.QA_SITE||'http://127.0.0.1:5178/';
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1600,height:1000}}),errors=[];
page.on('pageerror',error=>errors.push(error.message));
try{
 await page.goto(site);
 await page.locator('[name=handle]').fill(account.users[0].handle);
 await page.locator('[name=password]').fill(account.password);
 await page.locator('form button[type=submit]').click();
 await page.locator('.app-shell').waitFor();
 await page.getByRole('button',{name:'Movies',exact:true}).first().click();
 await page.locator('.cinema-provider-chip').first().waitFor();
 await page.waitForFunction(()=>{const image=document.querySelector('.cinema-feature-slide.is-active img');return image?.complete&&image.naturalWidth>0});
 for(const width of [1600,1280,1024]){
  await page.setViewportSize({width,height:1000});
  const layout=await page.locator('#vela-movies').evaluate(root=>({width:root.clientWidth,scrollWidth:root.scrollWidth,rail:getComputedStyle(root.querySelector('.cinema-rail')).display,grid:root.querySelector('.cinema-art').getBoundingClientRect().width,hero:root.querySelector('.cinema-feature').getBoundingClientRect().height}));
  assert.ok(layout.scrollWidth<=layout.width+1,JSON.stringify(layout));
  assert.equal(layout.rail,'flex');assert.ok(layout.hero<=541);assert.ok(layout.grid<400);
 }
 await page.setViewportSize({width:1600,height:1000});
 const dot=page.locator('[data-cinema-dot="1"]');await dot.click();
 await page.locator('[data-cinema-slide="1"]:not([hidden])').waitFor();
 assert.equal(await dot.getAttribute('aria-pressed'),'true');
 assert.equal(await page.locator('[data-cinema-dot="0"]').getAttribute('aria-pressed'),'false');
 await page.locator('[data-cinema-dot="0"]').click();
 await page.screenshot({path:'.private/vela-movies-redesign.png',animations:'disabled'});
 await page.locator('[data-movie-tab=search]').click();
 await page.getByRole('searchbox',{name:'Search films and shows',exact:true}).fill('Fight Club');
 await page.getByRole('button',{name:'Details for Fight Club',exact:true}).first().waitFor();
 assert.equal(await page.locator('.cinema-grid').evaluate(el=>getComputedStyle(el).display),'grid');
 await page.screenshot({path:'.private/vela-movies-search.png',animations:'disabled'});
 await page.getByRole('button',{name:'Details for Fight Club',exact:true}).first().click();
 await page.locator('.cinema-title-hero h1').waitFor();
 assert.equal(await page.locator('.vela-cinema-search').isVisible(),false);
 await page.screenshot({path:'.private/vela-movies-title.png',animations:'disabled'});
 await page.getByRole('button',{name:'Back to browsing',exact:true}).click();
 assert.equal(await page.getByRole('searchbox',{name:'Search films and shows',exact:true}).inputValue(),'Fight Club');
 await page.locator('#main-content').evaluate(el=>el.scrollTop=500);
 await page.locator('[data-movie-tab=list]').click();
 assert.equal(await page.locator('#main-content').evaluate(el=>el.scrollTop),0);
 assert.deepEqual(errors,[]);
 console.log(JSON.stringify({passed:true,site,widths:[1600,1280,1024],checks:['poster shelves','search grid','carousel selection','detail navigation','sticky navigation','no horizontal page overflow'],errors}));
}catch(error){await page.screenshot({path:'.private/cinema-layout-failure.png',animations:'disabled'});throw error}
finally{await browser.close()}
