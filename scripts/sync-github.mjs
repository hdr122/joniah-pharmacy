#!/usr/bin/env node
import { execSync } from 'child_process';

/**
 * سكريبت المزامنة الثنائية مع GitHub
 * يقوم بسحب التغييرات من GitHub ودفع التغييرات المحلية
 */

console.log('🔄 بدء عملية المزامنة مع GitHub...');

try {
  // التحقق من وجود تغييرات محلية
  console.log('📋 فحص التغييرات المحلية...');
  const status = execSync('git status --porcelain', { encoding: 'utf8' });
  
  if (status.trim()) {
    console.log('📝 تم العثور على تغييرات محلية، جاري حفظها...');
    
    // إضافة جميع التغييرات
    execSync('git add .', { stdio: 'inherit' });
    
    // إنشاء commit
    const timestamp = new Date().toISOString();
    execSync(`git commit -m "auto-sync: ${timestamp}"`, { stdio: 'inherit' });
  } else {
    console.log('✅ لا توجد تغييرات محلية للحفظ');
  }
  
  // سحب التغييرات من GitHub
  console.log('⬇️  سحب التغييرات من GitHub...');
  try {
    execSync('git pull github main --rebase', { stdio: 'inherit' });
  } catch (error) {
    console.log('⚠️  لا توجد تغييرات جديدة في GitHub');
  }
  
  // دفع التغييرات إلى GitHub
  console.log('⬆️  دفع التغييرات إلى GitHub...');
  execSync('git push github main', { stdio: 'inherit' });
  
  console.log('✅ تمت المزامنة بنجاح!');
  console.log('🔗 رابط المستودع: https://github.com/harthhdr/joniah-pharmacy-backup');
  
} catch (error) {
  console.error('❌ خطأ في عملية المزامنة:', error.message);
  process.exit(1);
}
