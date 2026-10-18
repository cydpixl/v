import fs from 'node:fs';
const config=fs.readFileSync(process.env.APPDATA+'/xdg.config/.wrangler/config/default.toml','utf8');
const token=process.env.CLOUDFLARE_API_TOKEN||config.match(/oauth_token\s*=\s*"([^"]+)"/)?.[1];
const account='1009cf6c38c9760400a777525c33e643';
const res=await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/calls/turn_keys`,{headers:{Authorization:'Bearer '+token}});const data=await res.json();console.log(JSON.stringify({status:res.status,success:data.success,keys:data.result?.map(x=>({uid:x.uid,name:x.name})),errors:data.errors}));
