const jose = require('jose');

async function run() {
  const secret = new TextEncoder().encode(
    process.env.AUTH_ACCESS_TOKEN_SECRET || 'fallback-secret-do-not-use-in-prod'
  );

  const token = await new jose.SignJWT({ "sub": "855f8597-219c-45c7-b539-ef395b5c27e5" })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer('reels-private-media')
    .sign(secret);

  const url = `http://127.0.0.1:3000/api/videos`;
  const res = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
  const data = await res.json();
  console.log(JSON.stringify(data.videos.map(v => v.id), null, 2));
}
run().catch(console.error);
