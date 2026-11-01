// Relationship data is always scoped to the authenticated viewer.
export async function relationshipState(env,uid){
 const {results}=await env.DB.prepare('SELECT b.uid,b.target,u.handle,u.name,u.avatar FROM blocks b JOIN users u ON u.uid=CASE WHEN b.uid=? THEN b.target ELSE b.uid END WHERE b.uid=? OR b.target=?').bind(uid,uid,uid).all();
 return {blocks:results.filter(b=>b.uid===uid).map(b=>({target:b.target,handle:b.handle,name:b.name,avatar:b.avatar})),blockedBy:results.filter(b=>b.target===uid).map(b=>({target:b.uid}))};
}
export function relationshipFor(state,uid){return {blocked:state.blocks.some(b=>b.target===uid),blockedBy:state.blockedBy.some(b=>b.target===uid)};}
export function relationshipPresence(person,relation){return relation.blocked||relation.blockedBy?{...person,...('presence'in person?{presence:'offline'}:{status:'offline'}),last_seen:0,last_read:0,custom_status:''}:person;}
export async function requireCommunication(env,uid,cid,fail){
 const found=await env.DB.prepare('SELECT 1 FROM members m JOIN blocks b ON (b.uid=? AND b.target=m.uid) OR (b.target=? AND b.uid=m.uid) WHERE m.conversation=? AND m.uid<>? LIMIT 1').bind(uid,uid,cid,uid).first();
 if(found)fail('Messaging and calling are unavailable while an account is blocked.',403);
}
