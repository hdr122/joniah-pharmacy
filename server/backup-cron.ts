import { CronJob } from 'cron';
import { getAllOrdersForBackup, getAllDailyStats, getAllActivityLogs, getAllLocations } from './db';

// دالة لإنشاء نسخة احتياطية
async function createBackup() {
  try {
    console.log('[Backup] Starting automatic backup...');
    
    const [orders, dailyStats, activityLogs, locations] = await Promise.all([
      getAllOrdersForBackup(),
      getAllDailyStats(),
      getAllActivityLogs(),
      getAllLocations(),
    ]);
    
    const backup = {
      timestamp: new Date().toISOString(),
      orders,
      dailyStats,
      activityLogs,
      locations,
    };
    
    // حفظ النسخة الاحتياطية في ملف JSON
    const fs = require('fs');
    const path = require('path');
    const backupDir = path.join(process.cwd(), 'backups');
    
    // إنشاء مجلد backups إذا لم يكن موجوداً
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    
    const filename = `backup_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    const filepath = path.join(backupDir, filename);
    
    fs.writeFileSync(filepath, JSON.stringify(backup, null, 2));
    
    console.log(`[Backup] Backup created successfully: ${filename}`);
    console.log(`[Backup] Orders: ${orders.length}, Daily Stats: ${dailyStats.length}, Activity Logs: ${activityLogs.length}, Locations: ${locations.length}`);
    
    // حفظ في GitHub (إذا كان متاحاً)
    try {
      const { execSync } = require('child_process');
      
      // التحقق من وجود git
      execSync('git --version', { stdio: 'ignore' });
      
      // إضافة الملف
      execSync(`git add "${filepath}"`, { cwd: process.cwd() });
      
      // عمل commit
      const commitMessage = `Automatic backup - ${new Date().toISOString()}`;
      execSync(`git commit -m "${commitMessage}"`, { cwd: process.cwd() });
      
      // دفع إلى GitHub
      execSync('git push origin main', { cwd: process.cwd() });
      
      console.log('[Backup] Backup pushed to GitHub successfully');
    } catch (gitError) {
      console.warn('[Backup] Could not push to GitHub:', gitError);
    }
    
    return backup;
  } catch (error) {
    console.error('[Backup] Error creating backup:', error);
    throw error;
  }
}

// إنشاء cron job للنسخ الاحتياطي اليومي (كل 24 ساعة في الساعة 3 صباحاً)
export const backupCronJob = new CronJob(
  '0 0 3 * * *', // كل يوم في الساعة 3:00 صباحاً
  async () => {
    try {
      await createBackup();
    } catch (error) {
      console.error('[Backup Cron] Failed to create backup:', error);
    }
  },
  null,
  false, // لا تبدأ تلقائياً
  'Asia/Baghdad' // المنطقة الزمنية
);

// بدء cron job
export function startBackupCron() {
  backupCronJob.start();
  console.log('[Backup Cron] Automatic backup scheduled (daily at 3:00 AM)');
}

// إيقاف cron job
export function stopBackupCron() {
  backupCronJob.stop();
  console.log('[Backup Cron] Automatic backup stopped');
}
