import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbPath = join(__dirname, '.data', 'sqlite.db');
const db = new Database(dbPath);

console.log('=== Super Admin Users ===');
const superAdmins = db.prepare(`
  SELECT id, username, name, role, isActive 
  FROM user 
  WHERE role IN ('super_admin', 'superadmin') OR username = 'HarthHDR1'
`).all();

console.log(JSON.stringify(superAdmins, null, 2));

db.close();
