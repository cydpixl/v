import {normalizeRewriteConfig,applyRewriteRules} from '../src/rewrite-rules.mjs';
export async function isSiteAdmin(env,uid){return !!await env.DB.prepare('SELECT 1 FROM site_admins WHERE uid=?').bind(uid).first();}
export async function rewriteConfig(env){
 const row=await env.DB.prepare("SELECT data,revision FROM site_message_rules WHERE id='global'").first();
 return row?{...JSON.parse(row.data),revision:row.revision}:{enabled:false,rules:[],revision:0};
}
export async function rewriteMessage(env,uid,text,admin){return applyRewriteRules(text,await rewriteConfig(env),{admin:admin??await isSiteAdmin(env,uid)});}
export async function writeMessageEdit(env,uid,message,text,admin){
 if(message.deleted||message.sender!==uid&&!admin)throw Object.assign(Error('Only the sender or a site administrator can edit this message.'),{status:403});
 if(typeof text!=='string'||!text.trim()||text.length>4000)throw Object.assign(Error('Enter a message up to 4,000 characters.'),{status:400});
 const edited=Date.now();
 await env.DB.batch([
  ...(message.sender!==uid?[env.DB.prepare('INSERT INTO message_edit_audit(id,message,admin,before_text,after_text,edited) SELECT ?,id,?,text,?,? FROM messages WHERE id=? AND deleted=0').bind(crypto.randomUUID(),uid,text,edited,message.id)]:[]),
  env.DB.prepare('UPDATE messages SET text=?,edited=? WHERE id=? AND deleted=0').bind(text,edited,message.id)
 ]);
}
export async function messageAdminAPI(req,env,uid,h){
 if(new URL(req.url).pathname!=='/api/admin/rewrite-rules')return null;
 if(!h.siteAdmin)h.fail('Site administrator access required.',403);
 if(req.method==='GET')return h.json(await rewriteConfig(env));
 if(req.method!=='PUT')h.fail('Method not allowed.',405);
 const body=await h.body(req);let config;try{config=normalizeRewriteConfig(body);}catch(error){h.fail(error.message);}
 const old=await rewriteConfig(env);if(body.revision!==old.revision)h.fail('Rules changed in another window. Reload the editor before saving.',409);
 const revision=old.revision+1,now=Date.now(),data=JSON.stringify(config);
 const result=await env.DB.prepare("INSERT INTO site_message_rules(id,data,revision,updated_by,updated) VALUES('global',?,?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data,revision=excluded.revision,updated_by=excluded.updated_by,updated=excluded.updated WHERE site_message_rules.revision=? RETURNING revision").bind(data,revision,uid,now,old.revision).first();
 if(!result)h.fail('Rules changed in another window. Reload before saving.',409);
 return h.json({...config,revision});
}
