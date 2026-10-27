import assert from 'node:assert/strict';
import {socialLink} from '../src/social-links.mjs';
import {resolveSocial} from '../worker/social.js';
const canonical='https://www.tiktok.com/@scout2015/video/6718335390845095173';
assert.equal(socialLink('Check this '+canonical+'?is_from_webapp=1).').id,'6718335390845095173');
assert.equal(socialLink(canonical+'?tracking=private').url,canonical);
assert.equal(socialLink('https://vm.tiktok.com/ZXabc123/').id,null);
assert.equal(socialLink('https://www.tiktok.com/@a/photo/6718335390845095173').id,'6718335390845095173');
assert.equal(socialLink('https://www.instagram.com/reel/ABC_def123/?igsh=tracking').embed,'https://www.instagram.com/reel/ABC_def123/embed/captioned/');
for(const url of ['https://tiktok.com.evil.test/@a/video/6718335390845095173','http://www.tiktok.com/@a/video/6718335390845095173','https://evil@www.tiktok.com/@a/video/6718335390845095173','https://www.tiktok.com:444/@a/video/6718335390845095173','https://127.0.0.1/','https://www.instagram.com/accounts/login/','https://www.youtube.com/watch?v=abc'])assert.equal(socialLink(url),null,url);
let calls=[];
const result=await resolveSocial('https://vm.tiktok.com/ZXabc123/',async(url,options)=>{calls.push(url);assert.equal(options.redirect,'manual');assert.equal(options.headers.Authorization,undefined);return new Response(null,{status:302,headers:{Location:canonical+'?secret=tracking'}});});
assert.equal(result.url,canonical);assert.equal(calls.length,1);
for(const redirect of ['https://127.0.0.1/internal','http://www.tiktok.com/t/12345','https://tiktok.com.evil.test/','https://www.instagram.com/p/abc123/']){calls=[];await assert.rejects(()=>resolveSocial('https://vm.tiktok.com/ZXabc123/',async url=>{calls.push(url);return new Response(null,{status:302,headers:{Location:redirect}});}),/could not expand/);assert.equal(calls.length,1);}
calls=[];await assert.rejects(()=>resolveSocial('https://vm.tiktok.com/ZXabc123/',async url=>{calls.push(url);return new Response(null,{status:302,headers:{Location:'/ZXabc123/'}});}),/could not expand/);assert.equal(calls.length,5);
assert.equal((await resolveSocial(canonical,()=>{throw Error('must not fetch canonical');})).url,canonical);
console.log('PASS social parsing, tracking removal, TikTok photo posts, Instagram Reels, malicious URLs, credential-free redirect allowlist, redirect bounds, canonical fast path');
