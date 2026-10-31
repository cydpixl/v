export function databaseQuotaResponse(error,now=Date.now()){
 if(!/D1.*(?:daily|free tier).*(?:limit|exceed)|exceeded D1.*daily/i.test(String(error?.message)))return null;
 const time=new Date(now),resetAt=Date.UTC(time.getUTCFullYear(),time.getUTCMonth(),time.getUTCDate()+1);
 return Response.json({error:'The daily database allowance has been reached. Access resumes when the allowance resets.',code:'DATABASE_QUOTA_EXCEEDED',resetAt},{status:503,headers:{'Cache-Control':'no-store','Retry-After':String(Math.max(1,Math.ceil((resetAt-now)/1000)))}});
}
