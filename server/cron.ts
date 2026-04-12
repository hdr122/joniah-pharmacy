import cron from 'node-cron';
import { saveDailyStatsSnapshot, checkDeliveryAnomalies, getAllOrdersForBackup, getAllDailyStats, getAllActivityLogs, getAllLocations, getAllBranches, permanentlyDeleteOldBranches } from './db';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

/**
 * Schedule daily statistics snapshot at 5:00 AM every day
 * Cron expression: "0 5 * * *"
 * - Minute: 0
 * - Hour: 5
 * - Day of month: * (every day)
 * - Month: * (every month)
 * - Day of week: * (every day of week)
 */
export function initializeCronJobs() {
  // Save daily statistics at 5:00 AM
  cron.schedule('0 5 * * *', async () => {
    try {
      console.log('[Cron] Running daily statistics snapshot at', new Date().toISOString());
      
      // Get all active branches
      const branches = await getAllBranches();
      
      // Save statistics for each branch
      for (const branch of branches) {
        try {
          const result = await saveDailyStatsSnapshot(branch.id);
          console.log(`[Cron] Daily statistics saved for branch ${branch.name}:`, result);
        } catch (branchError) {
          console.error(`[Cron] Failed to save statistics for branch ${branch.name}:`, branchError);
        }
      }
      
      console.log('[Cron] Daily statistics saved successfully for all branches');
    } catch (error) {
      console.error('[Cron] Failed to save daily statistics:', error);
    }
  }, {
    timezone: 'Asia/Baghdad' // Iraq timezone
  });
  
  console.log('[Cron] Daily statistics job scheduled for 5:00 AM (Asia/Baghdad timezone)');
  
  // Check for delivery anomalies every 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    try {
      console.log('[Cron] Checking delivery anomalies at', new Date().toISOString());
      await checkDeliveryAnomalies();
    } catch (error) {
      console.error('[Cron] Failed to check delivery anomalies:', error);
    }
  });
  
  console.log('[Cron] Delivery anomalies check scheduled every 5 minutes');
  
  // Automatic backup every 24 hours at 3:00 AM
  cron.schedule('0 3 * * *', async () => {
    try {
      console.log('[Cron] Running automatic backup at', new Date().toISOString());
      await createBackup();
    } catch (error) {
      console.error('[Cron] Failed to create backup:', error);
    }
  }, {
    timezone: 'Asia/Baghdad'
  });
  
  console.log('[Cron] Automatic backup scheduled for 3:00 AM (Asia/Baghdad timezone)');
  
  // Delete permanently old branches (deleted > 30 days ago) every day at 4:00 AM
  cron.schedule('0 4 * * *', async () => {
    try {
      console.log('[Cron] Checking for old deleted branches at', new Date().toISOString());
      const deletedCount = await permanentlyDeleteOldBranches();
      if (deletedCount > 0) {
        console.log(`[Cron] Permanently deleted ${deletedCount} old branches`);
      }
    } catch (error) {
      console.error('[Cron] Failed to delete old branches:', error);
    }
  }, {
    timezone: 'Asia/Baghdad'
  });
  
  console.log('[Cron] Old branches cleanup scheduled for 4:00 AM (Asia/Baghdad timezone)');
}

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
