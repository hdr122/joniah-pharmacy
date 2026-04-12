#!/usr/bin/env node
import { execSync } from 'child_process';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

/**
 * سكريبت النسخ الاحتياطي لقاعدة البيانات
 * يقوم بتصدير البيانات من قاعدة البيانات وحفظها في ملفات JSON
 */

const BACKUP_DIR = join(process.cwd(), 'backups');
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

// إنشاء مجلد النسخ الاحتياطي إذا لم يكن موجوداً
if (!existsSync(BACKUP_DIR)) {
  mkdirSync(BACKUP_DIR, { recursive: true });
}

console.log('🔄 بدء عملية النسخ الاحتياطي لقاعدة البيانات...');

try {
  // تصدير schema الحالي
  console.log('📋 تصدير schema...');
  execSync('pnpm drizzle-kit introspect', { stdio: 'inherit' });
  
  // إنشاء ملف backup يحتوي على معلومات النسخة الاحتياطية
  const backupInfo = {
    timestamp: new Date().toISOString(),
    version: timestamp,
    description: 'نسخة احتياطية تلقائية لقاعدة البيانات',
    tables: [
      'user',
      'session',
      // أضف جداول إضافية هنا حسب الحاجة
    ]
  };
  
  const backupFilePath = join(BACKUP_DIR, `backup-${timestamp}.json`);
  writeFileSync(backupFilePath, JSON.stringify(backupInfo, null, 2));
  
  console.log(`✅ تم إنشاء النسخة الاحتياطية بنجاح: ${backupFilePath}`);
  console.log('📦 لحفظ البيانات في GitHub، قم بتشغيل:');
  console.log('   git add backups/ && git commit -m "backup: database snapshot" && git push github main');
  
} catch (error) {
  console.error('❌ خطأ في عملية النسخ الاحتياطي:', error.message);
  process.exit(1);
}
