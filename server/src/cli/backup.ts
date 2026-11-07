import 'dotenv/config';
import path from 'path';
import db from '../db';
async function main() {
 const destination=process.argv[2];
 if(!destination || !path.isAbsolute(destination)) throw new Error('Usage: node dist/cli/backup.js /absolute/path/vibes-backup.db');
 await db.backup(destination);
 console.log(`SQLite online backup completed: ${destination}`);db.close();
}
main().catch(err=>{console.error(err.message);process.exitCode=1;});
