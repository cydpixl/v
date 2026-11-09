import fs from 'node:fs/promises';
import path from 'node:path';

const source = new URL('https://daily-thoughts-eight.vercel.app/');
const base = '/v/daily-thoughts/';
const publicDir = path.resolve('public/daily-thoughts');
const pagesDir = path.resolve('docs/daily-thoughts');
const assetPrefix = '/assets/';
const queue = [];
const handled = new Set();
const decoder = new TextDecoder();
const encoder = new TextEncoder();

async function request(url) {
  const response = await fetch(url, {
    redirect: 'follow',
    signal: AbortSignal.timeout(45000),
    headers: { 'User-Agent': 'DailyThoughts-GitHubPages/1.0', 'Accept': '*/*' }
  });
  if (!response.ok) throw new Error(`Source request failed: ${response.status} ${url}`);
  return response;
}

function enqueue(input, from = '/') {
  if (!input || /^(?:https?:|data:|blob:|#|mailto:)/i.test(input)) return;
  const resolved = new URL(input, new URL(from, source));
  if (resolved.origin !== source.origin || !resolved.pathname.startsWith(assetPrefix)) return;
  const filename = resolved.pathname.slice(1);
  if (!handled.has(filename) && !queue.includes(filename)) queue.push(filename);
}

function discover(text, current = '/') {
  for (const m of text.matchAll(/(?:src|href)\s*=\s*["']([^"']+)["']/g)) enqueue(m[1], current);
  for (const m of text.matchAll(/(?:\.\.\/|\.\/|\/)?assets\/[A-Za-z0-9_./-]+\.(?:js|css|mjs|svg|png|jpg|jpeg|webp|avif|gif|woff2?|ttf)(?:\?[A-Za-z0-9=&_.-]+)?/g)) enqueue(m[0], current);
  for (const m of text.matchAll(/(?:import\s*\(|from\s*)["'](\.{1,2}\/[^"']+\.(?:js|css|mjs))["']/g)) enqueue(m[1], current);
}


// Keep account sessions and existing app behavior unchanged; only remove the signup-confirmation step.
function patchSignup(text) {
  const original = "else if(e===\"signup\"){const{data:K,error:L}=await le.auth.signUp({email:r.trim(),password:u,options:{data:{display_name:d.trim().slice(0,40)||r.trim().split(\"@\")[0]},emailRedirectTo:location.origin+\"/\"}});if(L)throw L;K.session?i(K.session):K.user?.identities?.length===0?_(\"This email already has an account. Sign in or reset your password.\"):T(\"Check your email to confirm your account.\")}";
  const updated = "else if(e===\"signup\"){const{data:K,error:L}=await le.functions.invoke(\"dt-signup\",{body:{email:r.trim(),password:u,display_name:d.trim().slice(0,40)||r.trim().split(\"@\")[0]}});if(L||K?.error)throw new Error(K?.error||L?.message||\"Could not create account\");const{data:Y,error:W}=await le.auth.signInWithPassword({email:r.trim(),password:u});if(W)throw W;if(Y.session)i(Y.session)}";
  if (text.includes(updated)) return text;
  const hits = text.split(original).length - 1;
  if (!hits) return text;
  if (hits !== 1) throw new Error("Ambiguous signup flow; refusing to publish.");
  return text.replace(original, updated);
}

function rebase(text) {
  return text
    .replaceAll('/assets/', base + 'assets/')
    .replace(/(href|src)=["']\/(favicon\.ico|manifest\.webmanifest)["']/g, (_m, attr, filename) => `${attr}="${base}${filename}"`);
}

const response = await request(source);
let html = await response.text();
if (!/<html/i.test(html) || !/Daily Thoughts|DailyThoughts/i.test(html)) {
  throw new Error('Source did not return the expected Daily Thoughts application.');
}
discover(html);
if (queue.length === 0) throw new Error('No compiled app assets were found at the source.');

await fs.rm(publicDir, { recursive: true, force: true });
await fs.mkdir(publicDir, { recursive: true });
let count = 0;
while (queue.length) {
  if (count >= 200) throw new Error('Unexpected number of frontend assets.');
  const name = queue.shift();
  if (handled.has(name)) continue;
  handled.add(name);
  const assetUrl = new URL('/' + name, source);
  const assetResponse = await request(assetUrl);
  const raw = Buffer.from(await assetResponse.arrayBuffer());
  const isText = /\.(?:js|mjs|css|svg|json|txt|webmanifest)$/i.test(name);
  let output = raw;
  if (isText) {
    const body = patchSignup(decoder.decode(raw)).replaceAll('location.origin+"/"', 'location.origin+location.pathname');
    discover(body, '/' + name);
    output = Buffer.from(encoder.encode(rebase(body)));
  }
  const dest = path.join(publicDir, name);
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.writeFile(dest, output);
  count++;
}

html = rebase(html).replace(/<head(\s[^>]*)?>/i, (match) => match + '<base href="' + base + '">');
await fs.writeFile(path.join(publicDir, 'index.html'), html);
await fs.writeFile(path.join(publicDir, '.nojekyll'), '');
await fs.rm(pagesDir, { recursive: true, force: true });
await fs.mkdir(path.dirname(pagesDir), { recursive: true });
await fs.cp(publicDir, pagesDir, { recursive: true });
console.log(`Daily Thoughts mirrored to GitHub Pages: ${count} assets, ${base}`);
