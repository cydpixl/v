import assert from 'node:assert/strict';import {kindMessage} from '../src/kind-message.mjs';
const cases=['log out','logour','loog outttt','l o g o u t','sign off',"I'm a stupid idiot. I'm sorry.","You're stupid. Fuck.",'`log out`','https://example.com/log-out','/unknown-command freely typed','😀 Anything I write ❤️','a'.repeat(4000)];
for(const text of cases)assert.equal(kindMessage(text),text);assert.equal(kindMessage(null),'');
console.log('PASS all former forced triggers, profanity, links, code and ordinary messages remain exactly as typed');
