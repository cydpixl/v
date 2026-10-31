// Shared by the composer and API so queued, edited and scheduled messages agree.
// Keep links, code and custom expression tokens byte-for-byte intact.
const protectedText = /\[\[vela-live-music:1:[A-Za-z0-9_-]+\]\]|```[\s\S]*?```|`[^`\n]*`|https?:\/\/[^\s<>]+|<:[A-Za-z0-9_]{2,32}:[A-Za-z0-9-]+>/g;
const substitutions = [
  ['motherfucking', 'freaking'], ['motherfucker', 'friend'],
  ['fucking', 'freaking'], ['fucked', 'messed'], ['fuckers', 'friends'], ['fucker', 'friend'], ['fucks', 'fricks'], ['fuck', 'frick'],
  ['bullshit', 'nonsense'], ['shitting', 'messing'], ['shitty', 'crummy'], ['shits', 'shoots'], ['shit', 'shoot'],
  ['bitches', 'friends'], ['bitch', 'friend'], ['assholes', 'friends'], ['asshole', 'friend'],
  ['bastards', 'friends'], ['bastard', 'friend'], ['dammit', 'darn it'], ['damned', 'darned'], ['damn', 'darn'], ['hell', 'heck'],
  ['pissed', 'ticked'], ['dickhead', 'friend'], ['dick', 'dude'], ['cunt', 'friend'], ['ass', 'butt'],
];
const letters = {a:'[a@4]',i:'[i1!]',o:'[o0]',s:'[s$5]',t:'[t7]',u:'[uυ*]'};
const escape = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const pattern = word => [...word].map(c => letters[c] || escape(c)).join('[\\s.\\-_*\u200B-\u200D]*');
const swears = substitutions.map(([word, replacement]) => [new RegExp('(?<![\\p{L}\\p{N}_])'+pattern(word)+'(?![\\p{L}\\p{N}_])','giu'),replacement]);
function casing(original, replacement) {
  const letters = original.replace(/[^a-z]/gi,'');
  if (letters && letters === letters.toUpperCase()) return replacement.toUpperCase();
  return /^[A-Z]/.test(original) ? replacement[0].toUpperCase()+replacement.slice(1) : replacement;
}
const compliments = {
  stupid:'smart', dumb:'thoughtful', retarded:'capable', ugly:'beautiful',
  idiot:'a bright person', moron:'a thoughtful person', loser:'a winner', retard:'a capable person',
  dumbass:'a wonderful person', imbecile:'a thoughtful person', cretin:'a capable person',
  worthless:'valuable', useless:'helpful', pathetic:'impressive', annoying:'delightful',
  disgusting:'wonderful', fat:'lovely', hideous:'beautiful', trash:'a wonderful person',
};
const friendlyWords={...compliments,idiot:'bright friend',idiots:'bright friends',moron:'thoughtful friend',morons:'thoughtful friends',retard:'capable friend',retards:'capable friends',loser:'winner',losers:'winners',dumbass:'wonderful friend',imbecile:'thoughtful friend',cretin:'capable friend'};
const insultWord=Object.keys(friendlyWords).sort((a,b)=>b.length-a.length).map(pattern).join('|');
const wordEnd='(?![\\p{L}\\p{N}_])';
const insultRun='(?:'+insultWord+')'+wordEnd+'(?:[\\s,]+(?:(?:and|or)\\s+)?(?:'+insultWord+')'+wordEnd+')*';
const insult = new RegExp("\\b(you(?:['’]re| are)|u(?: r| are))\\s+(?:(?:really|so|very|such|freaking|fricking|an?)\\s+)*("+insultRun+")",'giu');
const bareInsults=new RegExp('(?<![\\p{L}\\p{N}_])'+insultRun,'giu');
const vocative=new RegExp('\\b(you|u)[,\\s]+('+insultRun+')','giu');
const insultMatchers=Object.keys(friendlyWords).map(word=>[word,new RegExp('^'+pattern(word)+'$','iu')]);
function friendly(original,direct=false){
 const word=insultMatchers.find(([,regex])=>regex.test(original))?.[0];
 return casing(original,word?(direct?compliments[word]||friendlyWords[word]:friendlyWords[word]):direct?'wonderful':'wonderful friend');
}
function negated(text,offset){
 const clause=text.slice(Math.max(0,offset-100),offset).split(/[.!?;\n]|\b(?:but|however|yet)\b/i).at(-1);
 return /\b(?:not|never|no|isn['’]?t|aren['’]?t|wasn['’]?t|weren['’]?t|don['’]?t|doesn['’]?t)\b[^,]*$/i.test(clause);
}
function rewritePlain(text) {
  for (const [regex, replacement] of swears) text = text.replace(regex, match => casing(match,replacement));
  text = text.replace(/\bfrick (?:you|u)\b/gi,match=>casing(match,'I appreciate you'));
  text = text.replace(/\bfrick off\b/gi,match=>casing(match,'Have a good day'));
  text = text.replace(insult, (match,subject,words,offset,source) => negated(source,offset)?match:casing(subject, "you're")+' '+friendly(words,true));
  text = text.replace(vocative,(match,subject,words,offset,source)=>negated(source,offset)?match:casing(subject,'you')+', '+friendly(words));
  text = text.replace(bareInsults,(match,offset,source)=>negated(source,offset)?match:friendly(match));
  text = text.replace(/\byou\s+(?:suck|are the worst)\b/gi, match=>casing(match,"you're awesome"));
  text = text.replace(/\bi hate you\b/gi, match=>casing(match,'I appreciate you'));
  text = text.replace(/\bshut (?:the frick )?up\b/gi, match=>casing(match,'Your voice matters'));
  return text;
}
export function kindMessage(value) {
  const text = String(value ?? '');
  let result = '', offset = 0;
  for (const match of text.matchAll(protectedText)) {
    result += rewritePlain(text.slice(offset,match.index))+match[0];
    offset = match.index+match[0].length;
  }
  return result+rewritePlain(text.slice(offset));
}
