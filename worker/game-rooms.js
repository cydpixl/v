const ready=new WeakSet();
export const gameRoomSchema=[
 'CREATE TABLE IF NOT EXISTS desktop_game_rooms(id TEXT PRIMARY KEY,host TEXT NOT NULL,guest TEXT NOT NULL,board TEXT NOT NULL,turn TEXT NOT NULL,winner TEXT NOT NULL DEFAULT "",revision INTEGER NOT NULL DEFAULT 0,updated INTEGER NOT NULL)',
 'CREATE INDEX IF NOT EXISTS desktop_game_host ON desktop_game_rooms(host,updated DESC)',
 'CREATE INDEX IF NOT EXISTS desktop_game_guest ON desktop_game_rooms(guest,updated DESC)'
];
export async function gameRoomsAPI(req,env,uid,{row,rows,body,json,fail}){
 const url=new URL(req.url),match=url.pathname.match(/^\/api\/game-rooms(?:\/([a-f0-9-]{36}))?$/);if(!match)return null;
 if(!ready.has(env)){await env.DB.batch(gameRoomSchema.map(sql=>env.DB.prepare(sql)));ready.add(env)}
 const id=match[1],method=req.method;
 const friend=async(a,b)=>a!==b&&!!await row(env,`SELECT 1 FROM friends WHERE status='accepted' AND ((a=? AND b=?) OR (b=? AND a=?)) AND NOT EXISTS(SELECT 1 FROM blocks WHERE (uid=? AND target=?) OR (target=? AND uid=?))`,a,b,a,b,a,b,a,b);
 if(!id){
  if(method==='GET'){
   const found=await rows(env,'SELECT r.*,h.name AS host_name,g.name AS guest_name FROM desktop_game_rooms r JOIN users h ON h.uid=r.host JOIN users g ON g.uid=r.guest WHERE (r.host=? OR r.guest=?) AND r.updated>? ORDER BY r.updated DESC LIMIT 20',uid,uid,Date.now()-86400000);
   const items=[];for(const room of found)if(await friend(room.host,room.guest))items.push({...room,board:JSON.parse(room.board)});return json({items});
  }
  if(method==='POST'){const data=await body(req);if(typeof data.guest!=='string'||!await friend(uid,data.guest))fail('Choose an accepted friend.',403);const pending=await row(env,`SELECT COUNT(*) AS n FROM desktop_game_rooms WHERE host=? AND winner='' AND updated>?`,uid,Date.now()-86400000);if(pending.n>=10)fail('Finish or close an existing game first.');const id=crypto.randomUUID();await env.DB.prepare('INSERT INTO desktop_game_rooms(id,host,guest,board,turn,updated) VALUES(?,?,?,?,?,?)').bind(id,uid,data.guest,JSON.stringify(Array(9).fill('')),uid,Date.now()).run();return json({id})}
  fail('Method not allowed.',405);
 }
 const room=await row(env,'SELECT * FROM desktop_game_rooms WHERE id=? AND (host=? OR guest=?)',id,uid,uid);
 if(!room||!await friend(room.host,room.guest))fail('Game not found.',404);
 if(method==='DELETE'){await env.DB.prepare('DELETE FROM desktop_game_rooms WHERE id=?').bind(id).run();return json({ok:true})}
 if(method!=='PUT')fail('Method not allowed.',405);
 const data=await body(req),board=JSON.parse(room.board);
 if(room.winner||room.turn!==uid||data.revision!==room.revision)fail('The board changed. Wait for your turn.',409);
 if(!Number.isInteger(data.cell)||data.cell<0||data.cell>8||board[data.cell])fail('Choose an empty square.');
 board[data.cell]=uid===room.host?'X':'O';
 const won=[[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]].some(line=>line.every(i=>board[i]===board[data.cell]));
 const winner=won?uid:board.every(Boolean)?'draw':'';
 const result=await env.DB.prepare('UPDATE desktop_game_rooms SET board=?,turn=?,winner=?,revision=revision+1,updated=? WHERE id=? AND revision=? AND turn=?').bind(JSON.stringify(board),uid===room.host?room.guest:room.host,winner,Date.now(),id,data.revision,uid).run();
 if(!result.meta.changes)fail('The board changed. Try again.',409);return json({ok:true});
}
