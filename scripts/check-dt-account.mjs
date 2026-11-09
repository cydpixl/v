import fs from 'node:fs/promises';

const bundle = await fs.readFile('docs/daily-thoughts/assets/dt-updated.js', 'utf8');
const key = bundle.match(/sb_publishable_[a-zA-Z0-9_-]+/)?.[0];
if (!key) throw new Error('Published Supabase client key is missing');
if (!bundle.includes('le.functions.invoke("dt-account"')) throw new Error('Username-only login was not published');
if (bundle.includes('placeholder:"Email address"')) throw new Error('An email form is still present');

const url = 'https://jqzdszkkrdzmedkcnpzp.supabase.co/functions/v1/dt-account';
const origin = 'https://cydpixl.github.io';

const options = await fetch(url, {
  method: 'OPTIONS',
  headers: {
    Origin: origin,
    'Access-Control-Request-Method': 'POST',
    'Access-Control-Request-Headers': 'authorization, apikey, content-type',
  },
  signal: AbortSignal.timeout(25000),
});
if (options.status !== 204 || options.headers.get('access-control-allow-origin') !== origin) {
  throw new Error('Auth CORS preflight failed: ' + options.status);
}

const fakeUsername = 'probe' + Math.random().toString(36).slice(2, 12);
const response = await fetch(url, {
  method: 'POST',
  headers: { Origin: origin, apikey: key, 'content-type': 'application/json' },
  body: JSON.stringify({ action: 'signin', username: fakeUsername, password: 'notthepassword_12345678' }),
  signal: AbortSignal.timeout(25000),
});
const body = await response.json().catch(() => ({}));
if (response.status !== 200 || body.error !== 'Incorrect username or password') {
  throw new Error('Username sign-in test failed: status=' + response.status + ' response=' + JSON.stringify(body).slice(0,200));
}
console.log('DailyThoughts username login endpoint and CORS verified. No test account created.');
