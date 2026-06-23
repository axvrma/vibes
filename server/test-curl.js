const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const jose = require('jose');

async function run() {
  const dbPath = path.join(__dirname, '../data/sqlite.db');
  const db = new Database(dbPath);

  const secret = new TextEncoder().encode(
    process.env.AUTH_ACCESS_TOKEN_SECRET || 'fallback-secret-do-not-use-in-prod'
  );

  const token = await new jose.SignJWT({ "sub": "855f8597-219c-45c7-b539-ef395b5c27e5" }) // Just need a valid sub
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer('reels-private-media')
    .sign(secret);

  const videos = db.prepare('SELECT id FROM videos WHERE deleted_at IS NULL').all();
  
  for (const v of videos) {
    const url = `http://127.0.0.1:3000/api/videos/${v.id}/stream`;
    const res = await fetch(url, {
      method: 'HEAD',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    console.log(`Video ID: ${v.id}, Status: ${res.status}`);
  }
}
run().catch(console.error);
