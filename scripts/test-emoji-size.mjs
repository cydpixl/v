import assert from 'node:assert/strict';
import {emojiParts,emojiInfo,decodeSizedEmoji,sizedEmoji,plainEmojis,customEmojiIds} from '../src/emoji-size.js';
import {messagePreview} from '../src/message-preview.js';
for(const emoji of ['😂','👨‍👩‍👧‍👦','🇺🇸','1️⃣','👍🏽','<:party:1234-abcd>']){
 assert.ok(emojiInfo(emoji));for(const size of [16,32,64,128]){const stored=sizedEmoji(emoji,size);assert.equal(plainEmojis(stored),emoji);const part=emojiParts('Hi '+stored+'!').find(p=>p.size);assert.equal(part.size,size);assert.equal(part.original,emoji)}
}
for(const size of [0,15,129,1000,-1,NaN])assert.equal(decodeSizedEmoji(size,encodeURIComponent('😂')),null);
assert.equal(decodeSizedEmoji(64,'%broken'),null);assert.equal(decodeSizedEmoji(64,encodeURIComponent('<img src=x onerror=alert(1)>')),null);
assert.deepEqual(customEmojiIds(sizedEmoji('<:party:private-id>',64)),['private-id']);
assert.equal(messagePreview(sizedEmoji('<:party:private-id>',64)),'Emoji');
assert.equal(messagePreview('Hi '+sizedEmoji('😂',64)),'Hi 😂');
assert.equal(emojiParts('ordinary text').filter(p=>p.token).length,0);
console.log('PASS: emoji grapheme clusters, size bounds, persistence, invalid markup, custom expression access IDs and readable previews');
