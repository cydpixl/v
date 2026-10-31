import assert from 'node:assert/strict';
import {kindMessage} from '../src/kind-message.mjs';
const cases = [
 ['This is fucking amazing!','This is freaking amazing!'],
 ['F-U-C-K-I-N-G great','FREAKING great'],
 ['f.u.c.k this shit','frick this shoot'],
 ['f*ck','frick'],
 ['You’re stupid. You are retarded. You\'re ugly.',"You're smart. You're capable. You're beautiful."],
 ['you are a fucking idiot',"you're a bright person"],
 ['You are not stupid. You are never ugly.','You are not stupid. You are never ugly.'],
 ['Class assignment, grass, assistant, Scunthorpe.','Class assignment, grass, assistant, Scunthorpe.'],
 ['`fuck` https://example.com/shit <:ass:abc-123>','`fuck` https://example.com/shit <:ass:abc-123>'],
 ['```js\nconst shit = 1;\n``` fucking great','```js\nconst shit = 1;\n``` freaking great'],
 ['I hate you. You suck.','I appreciate you. You\'re awesome.'],
 ['You are smart and beautiful.','You are smart and beautiful.'],
 ['fυck sh1t b1tch','frick shoot friend'],
 ['😀 fucking great ❤️','😀 freaking great ❤️'],
];
for (const [input,expected] of cases) {
 assert.equal(kindMessage(input),expected,input);
 assert.equal(kindMessage(kindMessage(input)),expected,'idempotent: '+input);
}
assert.equal(kindMessage(null),'');
assert.equal(kindMessage('a'.repeat(4000)),'a'.repeat(4000));
console.log(`Kind messages: ${cases.length} cases, idempotence, Unicode, protected content and limits passed.`);
