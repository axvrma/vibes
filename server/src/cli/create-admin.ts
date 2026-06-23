import db, { initDb } from '../db/index';
import * as argon2 from 'argon2';
import readline from 'readline';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';

dotenv.config();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const rlIterator = rl[Symbol.asyncIterator]();

const question = async (query: string, hidden: boolean = false): Promise<string> => {
  if (hidden) {
    (rl as any)._writeToOutput = function _writeToOutput(stringToWrite: string) {
      if (stringToWrite.includes('\r\n') || stringToWrite.includes('\n')) {
        (rl as any).output.write('\n');
      } else {
        (rl as any).output.write('*');
      }
    };
  } else {
    (rl as any)._writeToOutput = function _writeToOutput(stringToWrite: string) {
      (rl as any).output.write(stringToWrite);
    };
  }
  
  (rl as any).output.write(query);
  const { value, done } = await rlIterator.next();
  return done ? '' : value;
};

async function createAdmin() {
  console.log('--- Create Admin User ---');

  // Initialize DB and run migrations
  initDb();

  const rawEmail = await question('Admin email: ');
  const email = rawEmail.trim().toLowerCase();

  if (!email || !email.includes('@')) {
    console.error('Invalid email format.');
    process.exit(1);
  }

  // Check if email already exists
  try {
    const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existingUser) {
      console.error('A user with this email already exists.');
      process.exit(1);
    }
  } catch (error) {
    console.error('Error checking database for existing user.');
    process.exit(1);
  }

  const password = await question('Password: ', true);
  
  // Reset output write behavior early in case of error prints
  (rl as any)._writeToOutput = function _writeToOutput(stringToWrite: string) {
    (rl as any).output.write(stringToWrite);
  };
  
  console.log(); // newline after password

  if (password.length < 12) {
    console.error('Password must be at least 12 characters.');
    process.exit(1);
  }

  const confirmPassword = await question('Confirm password: ', true);
  
  (rl as any)._writeToOutput = function _writeToOutput(stringToWrite: string) {
    (rl as any).output.write(stringToWrite);
  };
  
  console.log(); // newline after confirm password

  if (password !== confirmPassword) {
    console.error('Passwords do not match.');
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
    console.error('Error creating admin. Failed to execute database operation.');
    process.exit(1);
  }

  process.exit(0);
}

if (require.main === module) {
  createAdmin();
} else {
  // if imported, do nothing or export
}
