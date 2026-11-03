export const sharedNotesSchema=[
 'CREATE TABLE IF NOT EXISTS desktop_shared_notes(id TEXT PRIMARY KEY,owner TEXT NOT NULL,title TEXT NOT NULL,text TEXT NOT NULL,revision INTEGER NOT NULL DEFAULT 1,updated INTEGER NOT NULL)',
 'CREATE TABLE IF NOT EXISTS desktop_note_members(note TEXT NOT NULL,uid TEXT NOT NULL,PRIMARY KEY(note,uid))',
 'CREATE INDEX IF NOT EXISTS desktop_note_user ON desktop_note_members(uid,note)'
];
const ready=new WeakSet();
export async function sharedNotesAPI(req,env,uid,{row,rows,body,json,fail}){
 const path=new URL(req.url).pathname,match=path.match(/^\/api\/shared-notes(?:\/([a-f0-9-]{36})(?:\/(members))?)?$/);if(!match)return null;
 if(!ready.has(env)){await env.DB.batch(sharedNotesSchema.map(sql=>env.DB.prepare(sql)));ready.add(env)}
 const [,id,section]=match,method=req.method;
 const friend=async(a,b)=>a===b||!!await row(env,"SELECT 1 FROM friends WHERE status='accepted' AND ((a=? AND b=?) OR (b=? AND a=?)) AND NOT EXISTS(SELECT 1 FROM blocks WHERE (uid=? AND target=?) OR (target=? AND uid=?))",a,b,a,b,a,b,a,b);
 const validate=data=>{if(typeof data.title!=='string'||!data.title.trim()||data.title.length>180||typeof data.text!=='string'||data.text.length>200000)fail('Use a title up to 180 characters and a note up to 200,000 characters.');};
 const members=async values=>{if(!Array.isArray(values)||values.length>9||values.some(value=>typeof value!=='string'))fail('Choose up to nine friends.');const people=[...new Set([uid,...values])];for(const member of people)if(!await friend(uid,member))fail('Only accepted friends can share this note.',403);return people};
 if(!id){
  if(method==='GET'){const items=await rows(env,"SELECT n.id,n.owner,n.title,n.revision,n.updated FROM desktop_shared_notes n JOIN desktop_note_members m ON m.note=n.id WHERE m.uid=? AND (n.owner=? OR EXISTS(SELECT 1 FROM friends f WHERE f.status='accepted' AND ((f.a=m.uid AND f.b=n.owner) OR (f.b=m.uid AND f.a=n.owner)))) AND NOT EXISTS(SELECT 1 FROM blocks b WHERE (b.uid=m.uid AND b.target=n.owner) OR (b.target=m.uid AND b.uid=n.owner)) ORDER BY n.updated DESC LIMIT 100",uid,uid);return json({items})}

  if(method==='POST'){const data=await body(req);validate(data);const people=await members(data.members||[]);if((await row(env,'SELECT COUNT(*) AS count FROM desktop_shared_notes WHERE owner=?',uid)).count>=100)fail('You can create up to 100 shared notes.');const id=crypto.randomUUID(),statements=[env.DB.prepare('INSERT INTO desktop_shared_notes(id,owner,title,text,updated) VALUES(?,?,?,?,?)').bind(id,uid,data.title.trim(),data.text,Date.now()),...people.map(member=>env.DB.prepare('INSERT INTO desktop_note_members(note,uid) VALUES(?,?)').bind(id,member))];await env.DB.batch(statements);return json({id})}
  fail('Method not allowed.',405);
 }
 const note=await row(env,'SELECT n.* FROM desktop_shared_notes n JOIN desktop_note_members m ON m.note=n.id WHERE n.id=? AND m.uid=?',id,uid);if(!note||!await friend(uid,note.owner))fail('Note not found.',404);
 if(section==='members'){
  if(method!=='PUT')fail('Method not allowed.',405);if(note.owner!==uid)fail('Only the owner can change collaborators.',403);const people=await members((await body(req)).members);await env.DB.batch([env.DB.prepare('DELETE FROM desktop_note_members WHERE note=?').bind(id),...people.map(member=>env.DB.prepare('INSERT INTO desktop_note_members(note,uid) VALUES(?,?)').bind(id,member))]);return json({ok:true});
 }
 if(method==='GET'){const people=await rows(env,'SELECT u.uid,u.name,u.handle,u.avatar FROM desktop_note_members m JOIN users u ON u.uid=m.uid WHERE m.note=?',id);return json({...note,members:people})}
 if(method==='PUT'){const data=await body(req);validate(data);if(!Number.isSafeInteger(data.revision)||data.revision<1)fail('Reload this note before saving.');const result=await env.DB.prepare('UPDATE desktop_shared_notes SET title=?,text=?,updated=?,revision=revision+1 WHERE id=? AND revision=?').bind(data.title.trim(),data.text,Date.now(),id,data.revision).run();if(!result.meta.changes)fail('This note changed on another device. Your draft is preserved.',409);return json({ok:true,revision:data.revision+1})}
 fail('Method not allowed.',405);
}
