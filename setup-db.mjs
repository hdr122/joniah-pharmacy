import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

console.log('🔄 Setting up database...');

// Remove old migrations
const migrationsDir = './drizzle/migrations';
if (fs.existsSync(migrationsDir)) {
  fs.rmSync(migrationsDir, { recursive: true, force: true });
}
fs.mkdirSync(migrationsDir, { recursive: true });

console.log('✅ Migrations directory cleaned');

// Generate migrations with auto-accept
try {
  console.log('📝 Generating migrations...');
  execSync('echo "" | pnpm drizzle-kit generate', { 
    stdio: 'inherit',
    cwd: process.cwd()
  });
  console.log('✅ Migrations generated');
} catch (error) {
  console.error('❌ Failed to generate migrations:', error.message);
  process.exit(1);
}

// Run migrations
try {
  console.log('🚀 Running migrations...');
  execSync('pnpm drizzle-kit migrate', { 
    stdio: 'inherit',
    cwd: process.cwd()
  });
  console.log('✅ Migrations completed');
} catch (error) {
  console.error('❌ Failed to run migrations:', error.message);
  process.exit(1);
}

console.log('🎉 Database setup completed successfully!');
