const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const dbPath = path.join(__dirname, '../data/sqlite.db');
const db = new Database(dbPath);

const videos = db.prepare('SELECT id, storage_key, title FROM videos').all();
console.log(`Found ${videos.length} videos`);

const uploadsDir = path.join(__dirname, '../data/uploads');
videos.forEach(v => {
  const p = path.join(uploadsDir, v.storage_key);
  const exists = fs.existsSync(p);
  console.log(`Video ID: ${v.id}, File: ${v.storage_key}, Exists: ${exists}`);
});
