export const AI_MODELS=[{id:'openai/gpt-oss-120b',name:'GPT OSS 120B',detail:'For thoughtful answers'},{id:'openai/gpt-oss-20b',name:'GPT OSS 20B',detail:'For quick everyday work'},{id:'qwen/qwen3.8-27b',name:'Qwen 3.8',detail:'Writing, coding, and reasoning'}];
const ready=new WeakSet();
const uuid=value=>/^[a-f0-9-]{36}$/.test(value||'');
async function initialize(env){if(ready.has(env))return;await env.DB.batch([
 env.DB.prepare('CREATE TABLE IF NOT EXISTS desktop_graphs(id TEXT PRIMARY KEY,owner TEXT NOT NULL,name TEXT NOT NULL,state TEXT NOT NULL,revision INTEGER NOT NULL DEFAULT 1,updated INTEGER NOT NULL)'),
 env.DB.prepare('CREATE INDEX IF NOT EXISTS desktop_graphs_owner ON desktop_graphs(owner,updated)'),
 env.DB.prepare('CREATE TABLE IF NOT EXISTS assistant_chats(id TEXT PRIMARY KEY,owner TEXT NOT NULL,title TEXT NOT NULL,updated INTEGER NOT NULL,busy_until INTEGER NOT NULL DEFAULT 0)'),
 env.DB.prepare('CREATE INDEX IF NOT EXISTS assistant_chats_owner ON assistant_chats(owner,updated)'),
 env.DB.prepare('CREATE TABLE IF NOT EXISTS assistant_messages(id TEXT PRIMARY KEY,chat TEXT NOT NULL,role TEXT NOT NULL,content TEXT NOT NULL,model TEXT NOT NULL,created INTEGER NOT NULL)'),
 env.DB.prepare('CREATE INDEX IF NOT EXISTS assistant_messages_chat ON assistant_messages(chat,created)')]);ready.add(env)}
function groqKeys(env){let values=[];try{values=JSON.parse(env.GROQ_API_KEYS||'[]')}catch{}return [...new Set([env.GROQ_API_KEY,...values].filter(value=>typeof value==='string'&&value.length>10))]}
export async function desktopIntegrationsAPI(req,env,uid,{json,fail,body,row,rows,limit}){
 const url=new URL(req.url),path=url.pathname,method=req.method;
 if(path==='/api/desktop-integrations'&&method==='GET')return json({desmosKey:env.DESMOS_API_KEY||'',aiReady:groqKeys(env).length>0,models:AI_MODELS});
 if(!/^\/api\/(desktop-graphs|assistant\/chats)(?:\/|$)/.test(path))return null;
 await initialize(env);
 const graph=path.match(/^\/api\/desktop-graphs(?:\/([a-f0-9-]{36}))?$/);
 if(graph){const id=graph[1];if(!id&&method==='GET')return json({items:await rows(env,'SELECT id,name,revision,updated FROM desktop_graphs WHERE owner=? ORDER BY updated DESC LIMIT 100',uid)});
  if(!id)fail('Choose a graph.',404);const old=await row(env,'SELECT * FROM desktop_graphs WHERE id=? AND owner=?',id,uid);
  if(method==='GET'){if(!old)fail('Graph not found.',404);return json({item:{...old,state:JSON.parse(old.state)}})}
  if(method==='DELETE'){await env.DB.prepare('DELETE FROM desktop_graphs WHERE id=? AND owner=?').bind(id,uid).run();return json({ok:true})}
  if(method!=='PUT')fail('Method not allowed.',405);
  const data=await body(req),name=String(data.name||'Untitled graph').trim().slice(0,100),state=data.state;
  if(!state||typeof state!=='object'||!Array.isArray(state.expressions?.list)||state.expressions.list.length>500)fail('Choose a valid Desmos graph with up to 500 expressions.');
  const serialized=JSON.stringify(state);if(serialized.length>800000)fail('This graph is too large to save.',413);
  if(!old&&await row(env,'SELECT 1 FROM desktop_graphs WHERE id=?',id))fail('Graph not found.',404);
  if(!old&&(await row(env,'SELECT count(*) AS n FROM desktop_graphs WHERE owner=?',uid)).n>=100)fail('Your library holds 100 graphs. Export or remove one before adding another.');
  if(Number(data.revision)!==(old?.revision||0))fail('This graph changed in another window. Export your work, then reopen the saved graph.',409);
  const item=await env.DB.prepare('INSERT INTO desktop_graphs(id,owner,name,state,revision,updated) VALUES(?,?,?,?,1,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,state=excluded.state,revision=desktop_graphs.revision+1,updated=excluded.updated WHERE desktop_graphs.owner=? AND desktop_graphs.revision=? RETURNING id,name,revision,updated').bind(id,uid,name,serialized,Date.now(),uid,Number(data.revision)).first();if(!item)fail('This graph changed. Reopen it before saving.',409);return json({item});
 }
 const match=path.match(/^\/api\/assistant\/chats(?:\/([a-f0-9-]{36})(?:\/(messages))?)?$/);if(!match)fail('Not found.',404);
 const id=match[1];
 if(!id&&method==='GET')return json({items:await rows(env,'SELECT id,title,updated FROM assistant_chats WHERE owner=? ORDER BY updated DESC LIMIT 100',uid)});
 if(!id&&method==='POST'){const data=await body(req),id=uuid(data.id)?data.id:crypto.randomUUID();if((await row(env,'SELECT count(*) AS n FROM assistant_chats WHERE owner=?',uid)).n>=100)fail('You have 100 chats. Delete an older chat to start another.');await env.DB.prepare('INSERT INTO assistant_chats(id,owner,title,updated) VALUES(?,?,?,?)').bind(id,uid,'New chat',Date.now()).run();return json({item:{id,title:'New chat',updated:Date.now()}})}
 const chat=await row(env,'SELECT * FROM assistant_chats WHERE id=? AND owner=?',id,uid);if(!chat)fail('Chat not found.',404);
 if(!match[2]){
  if(method==='GET')return json({item:chat,messages:await rows(env,'SELECT id,role,content,model,created FROM assistant_messages WHERE chat=? ORDER BY created,id LIMIT 400',id)});
  if(method==='PATCH'){const data=await body(req),title=String(data.title||'').trim().slice(0,100);if(!title)fail('Enter a chat name.');await env.DB.prepare('UPDATE assistant_chats SET title=? WHERE id=? AND owner=?').bind(title,id,uid).run();return json({ok:true})}
  if(method==='DELETE'){if(chat.busy_until>Date.now())fail('Wait for the current reply before deleting this chat.',409);await env.DB.batch([env.DB.prepare('DELETE FROM assistant_messages WHERE chat=?').bind(id),env.DB.prepare('DELETE FROM assistant_chats WHERE id=? AND owner=?').bind(id,uid)]);return json({ok:true})}
  fail('Method not allowed.',405);
 }
 if(method!=='POST')fail('Method not allowed.',405);
 const data=await body(req),prompt=String(data.content||'').trim(),model=String(data.model||AI_MODELS[0].id),requestId=data.id;
 if(!uuid(requestId)||!prompt||prompt.length>16000||!AI_MODELS.some(item=>item.id===model))fail('Enter a message under 16,000 characters and choose an available model.');
 const existing=await row(env,'SELECT * FROM assistant_messages WHERE id=? AND chat=?',requestId+':reply',id);if(existing)return json({message:existing});
 const keys=groqKeys(env);if(!keys.length)fail('Nova is temporarily unavailable.',503);
 await limit(env,'nova:'+uid,12,60);
 const locked=await env.DB.prepare('UPDATE assistant_chats SET busy_until=? WHERE id=? AND owner=? AND busy_until<?').bind(Date.now()+120000,id,uid,Date.now()).run();if(!locked.meta.changes)fail('A reply is already being written in this chat.',409);
 try{
  const count=(await row(env,'SELECT count(*) AS n FROM assistant_messages WHERE chat=?',id)).n;if(count>=398)fail('This chat is full. Start a new chat to continue.');
  const prior=await row(env,'SELECT chat,content FROM assistant_messages WHERE id=?',requestId);if(prior&&(prior.chat!==id||prior.content!==prompt))fail('This message was already used. Send a new message.',409);
  const now=Date.now();await env.DB.prepare('INSERT OR IGNORE INTO assistant_messages(id,chat,role,content,model,created) VALUES(?,?,?,?,?,?)').bind(requestId,id,'user',prompt,model,now).run();
  const history=(await rows(env,'SELECT role,content FROM assistant_messages WHERE chat=? ORDER BY created DESC,id DESC LIMIT 30',id)).reverse();let budget=48000;const messages=[];for(const item of history.reverse()){if(item.content.length>budget)break;messages.unshift(item);budget-=item.content.length}
  messages.unshift({role:'system',content:'You are a helpful AI assistant in Vela’s ChatGPT app. You use Groq-hosted models; do not claim an official OpenAI account or service connection. Be clear, useful, and honest. You can write, explain, reason, and help with code. You cannot access the user’s desktop, personal data, files, or the live internet. Never pretend to have taken actions you cannot take. Use readable Markdown when useful.'});
  let response;for(let index=0;index<keys.length;index++){response=await fetch('https://api.groq.com/openai/v1/chat/completions',{method:'POST',headers:{Authorization:'Bearer '+keys[index],'Content-Type':'application/json'},signal:AbortSignal.any([req.signal,AbortSignal.timeout(90000)]),body:JSON.stringify({model,messages,max_completion_tokens:4096,reasoning_effort:'low'})});if(response.ok||![429,500,502,503,504].includes(response.status))break;await response.body?.cancel()}
  if(!response.ok){await response.body?.cancel();fail(response.status===429?'Nova is busy. Try again in a moment.':'The AI service could not finish this reply. Try again.',response.status===429?429:502)}
  const result=await response.json(),content=result.choices?.[0]?.message?.content?.trim();if(!content)fail('The model returned an empty reply. Try again.',502);
  const message={id:requestId+':reply',role:'assistant',content:content.slice(0,64000),model,created:Date.now()};await env.DB.batch([env.DB.prepare('INSERT INTO assistant_messages(id,chat,role,content,model,created) VALUES(?,?,?,?,?,?)').bind(message.id,id,'assistant',message.content,model,message.created),env.DB.prepare('UPDATE assistant_chats SET title=CASE WHEN title=? THEN ? ELSE title END,updated=? WHERE id=? AND owner=?').bind('New chat',prompt.replace(/\s+/g,' ').slice(0,65),Date.now(),id,uid)]);return json({message});
 }finally{await env.DB.prepare('UPDATE assistant_chats SET busy_until=0 WHERE id=? AND owner=?').bind(id,uid).run()}
}
