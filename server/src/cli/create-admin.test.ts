import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import Database from 'better-sqlite3';

describe('create-admin CLI', () => {
  const dbPath = path.join(__dirname, '../../../data/test-admin.db');

  beforeAll(() => {
    // Ensure test db directory exists
    const dbDir = path.dirname(dbPath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
  });

  beforeEach(() => {
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
  });

  afterAll(() => {
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
  });

  const runCLI = (inputs: string[]) => {
    const cliPath = path.join(__dirname, 'create-admin.ts');
    return require('child_process').spawnSync('npx', ['tsx', cliPath], {
      env: {
        ...process.env,
        DATABASE_PATH: dbPath,
      },
      input: inputs.join('\n') + '\n',
      encoding: 'utf-8',
    });
  };

  it('creates an admin successfully', async () => {
    const result = await runCLI(['test@example.com', 'SuperSecret123', 'SuperSecret123']);
    
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Admin user created successfully.');
    
    const db = new Database(dbPath);
    const user: any = db.prepare('SELECT * FROM users WHERE email = ?').get('test@example.com');
    expect(user).toBeDefined();
    expect(user.role).toBe('admin');
    expect(user.is_active).toBe(1);
    expect(user.password_hash).not.toBe('SuperSecret123');
    db.close();
  });

  it('rejects duplicate email', async () => {
    await runCLI(['duplicate@example.com', 'SuperSecret123', 'SuperSecret123']);
    const result2 = await runCLI(['duplicate@example.com', 'AnotherSecret123', 'AnotherSecret123']);
    
    expect(result2.status).toBe(1);
    expect(result2.stderr).toContain('A user with this email already exists.');
  });

  it('rejects short passwords', async () => {
    const result = await runCLI(['short@example.com', 'short', 'short']);
    
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Password must be at least 12 characters.');
  });

  it('rejects mismatched passwords', async () => {
    const result = await runCLI(['mismatch@example.com', 'SuperSecret123', 'SuperSecret456']);
    
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Passwords do not match.');
  });
});
