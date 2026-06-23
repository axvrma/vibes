import db from '../src/db/index';
import * as argon2 from 'argon2';
import readline from 'readline';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';

dotenv.config();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query: string, hidden: boolean = false): Promise<string> => {
  return new Promise((resolve) => {
    rl.question(query, (answer) => {
      resolve(answer);
    });
    // For hidden input (like password), we can't easily mask it in basic readline without intercepting keystrokes.
    // So we'll just accept standard input. In a real terminal we could mute stdout.
    if (hidden) {
      (rl as any)._writeToOutput = function _writeToOutput(stringToWrite: string) {
        if (stringToWrite.includes('\r\n') || stringToWrite.includes('\n')) {
          (rl.output as any).write('\n');
        } else {
          (rl.output as any).write('*');
        }
      };
    } else {
      (rl as any)._writeToOutput = function _writeToOutput(stringToWrite: string) {
        (rl.output as any).write(stringToWrite);
      };
    }
  });
};

async function createAdmin() {
  console.log('--- Create Admin User ---');
  
  const email = await question('Email: ');
  const password = await question('Password (min 12 chars): ', true);
  
  // Reset output write behavior
  (rl as any)._writeToOutput = function _writeToOutput(stringToWrite: string) {
    (rl.output as any).write(stringToWrite);
  };
  
  console.log();

  if (!email || !email.includes('@')) {
    console.error('Invalid email.');
    process.exit(1);
  }

  if (password.length < 12) {
    console.error('Password must be at least 12 characters.');
    process.exit(1);
  }

  try {
    const password_hash = await argon2.hash(password);
    
    db.prepare(`
      INSERT INTO users (id, email, password_hash, role, is_active, created_at, updated_at)
      VALUES (?, ?, ?, 'admin', 1, datetime('now'), datetime('now'))
    `).run(uuidv4(), email, password_hash);

    console.log('Admin user created successfully.');
  } catch (error: any) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      console.error('User with this email already exists.');
    } else {
      console.error('Error creating admin:', error);
    }
  }

  process.exit(0);
}

createAdmin();
