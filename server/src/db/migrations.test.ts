import {it,expect} from 'vitest';
import Database from 'better-sqlite3';
import path from 'path';
import {runMigrations} from './migrations';
it('upgrades an existing v2.2 database without changing media IDs or user state',()=>{
 const db=new Database(path.join(process.env.DATA_DIR!,'upgrade.db'));
 runMigrations(db,path.join(process.env.DATA_DIR!,'upgrade.db'));
 // Recreate the v2.2 shape by dropping only the additive 005 objects on a disposable DB.
 db.exec("DROP INDEX videos_source_path;DROP INDEX videos_library;DROP INDEX videos_fingerprint;DROP INDEX scan_one_active;DROP TABLE scan_errors;DROP TABLE scan_jobs;ALTER TABLE videos DROP COLUMN library_id;DROP TABLE media_libraries;");
 for(const column of ['source_type','relative_path','mtime_ms','fingerprint','availability','last_observed_scan','metadata_overridden'])db.exec(`ALTER TABLE videos DROP COLUMN ${column}`);
 db.exec("DROP INDEX videos_feed;DROP INDEX video_tags_tag;DROP INDEX state_favorites;DELETE FROM schema_migrations WHERE version='005_media_libraries';INSERT INTO users(id,email,password_hash,role,created_at,updated_at) VALUES ('u','test@example.test','hash','admin','now','now');INSERT INTO videos(id,title,original_filename,storage_key,created_at,updated_at) VALUES ('old-id','Original','old.mp4','old.mp4','now','now');INSERT INTO user_video_state(user_id,video_id,liked,note,progress_seconds,updated_at) VALUES ('u','old-id',1,'Keep me',7,'now');");
 runMigrations(db,path.join(process.env.DATA_DIR!,'upgrade.db'));runMigrations(db,path.join(process.env.DATA_DIR!,'upgrade.db'));
 expect(db.prepare('SELECT id,storage_key,source_type,availability FROM videos').get()).toEqual({id:'old-id',storage_key:'old.mp4',source_type:'upload',availability:'available'});
 expect(db.prepare('SELECT liked,note,progress_seconds FROM user_video_state').get()).toEqual({liked:1,note:'Keep me',progress_seconds:7});db.close();
});
