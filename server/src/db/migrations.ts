import fs from 'fs';
import path from 'path';
import type { Database } from 'better-sqlite3';

export function runMigrations(db: Database, dbPath: string) {
  // Check if we need to run migrations
  const hasMigrationsTable = db.prepare("SELECT count(*) as c FROM sqlite_master WHERE type='table' AND name='schema_migrations'").get() as { c: number };
  
  if (hasMigrationsTable.c === 0) {
    db.exec(`
      CREATE TABLE schema_migrations (
        version TEXT PRIMARY KEY,
        applied_at TEXT NOT NULL
      );
    `);
  }

  const backupDb = () => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(path.dirname(dbPath), `sqlite_backup_${timestamp}.db`);
    fs.copyFileSync(dbPath, backupPath);
    console.log(`[DB] Database backed up to ${backupPath}`);
  };

  const getAppliedMigrations = (): string[] => {
    const rows = db.prepare('SELECT version FROM schema_migrations').all() as { version: string }[];
    return rows.map((r) => r.version);
  };

  const recordMigration = (version: string) => {
    db.prepare("INSERT INTO schema_migrations (version, applied_at) VALUES (?, datetime('now'))").run(version);
  };

  const applyMigration = (version: string, sql: string, backupBefore: boolean = false) => {
    const applied = getAppliedMigrations();
    if (!applied.includes(version)) {
      console.log(`[DB] Applying migration: ${version}`);
      if (backupBefore && fs.existsSync(dbPath)) {
        backupDb();
      }
      db.transaction(() => {
        db.exec(sql);
        recordMigration(version);
      })();
    }
  };

  // Base Migration (equivalent to current schema)
  applyMigration('001_base_schema', `
    CREATE TABLE IF NOT EXISTS videos (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      original_filename TEXT NOT NULL,
      storage_key TEXT NOT NULL UNIQUE,
      mime_type TEXT,
      size_bytes INTEGER NOT NULL DEFAULT 0,
      duration_seconds REAL,
      width INTEGER,
      height INTEGER,
      codec TEXT,
      audio_codec TEXT,
      thumbnail_path TEXT,
      processing_status TEXT NOT NULL DEFAULT 'ready',
      processing_error TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT
    );

    CREATE TABLE IF NOT EXISTS tags (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL COLLATE NOCASE UNIQUE,
      color TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS video_tags (
      video_id TEXT NOT NULL,
      tag_id TEXT NOT NULL,
      PRIMARY KEY (video_id, tag_id),
      FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE,
      FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS user_video_state (
      video_id TEXT PRIMARY KEY,
      liked INTEGER NOT NULL DEFAULT 0,
      note TEXT NOT NULL DEFAULT '',
      progress_seconds REAL NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE
    );
  `, false);

  // Migration 2: Categories and Users
  applyMigration('002_categories_and_users', `
    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL COLLATE NOCASE UNIQUE,
      slug TEXT NOT NULL UNIQUE,
      color TEXT NOT NULL,
      icon TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS category_tags (
      category_id TEXT NOT NULL,
      tag_id TEXT NOT NULL,
      PRIMARY KEY (category_id, tag_id),
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE,
      FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL COLLATE NOCASE UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin', 'viewer')),
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      last_login_at TEXT
    );

    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      device_name TEXT,
      user_agent TEXT,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      revoked_at TEXT,
      replaced_by_token_id TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `, true);

  // Migration 3: Add category_id to videos
  applyMigration('003_video_categories', `
    ALTER TABLE videos ADD COLUMN category_id TEXT REFERENCES categories(id) ON DELETE RESTRICT;
  `, false);

  // Migration 4: Make user_video_state user-specific
  const applied = getAppliedMigrations();
  if (!applied.includes('004_user_video_state_migration')) {
    console.log('[DB] Applying migration: 004_user_video_state_migration');
    backupDb();
    
    db.transaction(() => {
      // Check if user_video_state has user_id
      const columns = db.prepare("PRAGMA table_info(user_video_state)").all() as { name: string }[];
      const hasUserId = columns.some(c => c.name === 'user_id');

      if (!hasUserId) {
        const timestamp = new Date().toISOString().replace(/[:.-]/g, '_');
        db.exec(`ALTER TABLE user_video_state RENAME TO "user_video_state_legacy_${timestamp}"`);
        console.warn(`[DB] Legacy user_video_state backed up to user_video_state_legacy_${timestamp} because no deterministic owner user exists.`);
      }

      db.exec(`
        CREATE TABLE IF NOT EXISTS user_video_state (
          user_id TEXT NOT NULL,
          video_id TEXT NOT NULL,
          liked INTEGER NOT NULL DEFAULT 0,
          note TEXT NOT NULL DEFAULT '',
          progress_seconds REAL NOT NULL DEFAULT 0,
          updated_at TEXT NOT NULL,
          PRIMARY KEY (user_id, video_id),
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE
        );
      `);

      recordMigration('004_user_video_state_migration');
    })();
  }
}
