const jose = require('jose');
const Database = require('better-sqlite3');
const path = require('path');

async function run() {
  const dbPath = path.join(__dirname, '../data/sqlite.db');
  const db = new Database(dbPath);

  const secret = new TextEncoder().encode(
    process.env.AUTH_ACCESS_TOKEN_SECRET || 'fallback-secret-do-not-use-in-prod'
  );

  const token = await new jose.SignJWT({ "sub": "855f8597-219c-45c7-b539-ef395b5c27e5" })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer('reels-private-media')
    .sign(secret);

  const videos = db.prepare('SELECT id, size_bytes FROM videos WHERE deleted_at IS NULL').all();
  
  for (const v of videos) {
    const url = `http://127.0.0.1:3000/api/videos/${v.id}/stream`;
    
    // Test different range headers
    const ranges = [
      'bytes=0-',
      'bytes=0-1023',
      `bytes=${v.size_bytes - 100}-`,
      `bytes=${v.size_bytes}-`, // out of bounds
    ];

    for (const range of ranges) {
      const res = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Range': range
        }
      });
      console.log(`Video: ${v.id}, Range: ${range}, Status: ${res.status}`);
    }
  }
}
run().catch(console.error);
