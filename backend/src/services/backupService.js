const fs = require('fs');
const path = require('path');
const { nativeDb } = require('../../database');

class BackupService {
    constructor() {
        this.interval = null;
    }

    init() {
        // Run every 1 hour
        this.interval = setInterval(() => {
            this.runBackupCheck();
        }, 60 * 60 * 1000);
        
        // Run once on startup
        setTimeout(() => this.runBackupCheck(), 10000);
    }

    runBackupCheck() {
        try {
            const rows = nativeDb.prepare("SELECT key, value FROM app_settings").all();
            const settings = {};
            rows.forEach(r => settings[r.key] = r.value);

            const schedule = settings.backup_schedule || 'disabled';
            if (schedule === 'disabled') return;

            const backupLocation = settings.backup_location;
            if (!backupLocation) return;
            
            if (!fs.existsSync(backupLocation)) {
                try {
                    fs.mkdirSync(backupLocation, { recursive: true });
                } catch (e) {
                    console.error("BackupService: Failed to create backup directory", e);
                    return;
                }
            }

            const lastBackupStr = settings.last_backup_date;
            const now = new Date();
            let shouldBackup = false;

            if (!lastBackupStr) {
                shouldBackup = true;
            } else {
                const lastBackup = new Date(lastBackupStr);
                const diffMs = now - lastBackup;
                const diffDays = diffMs / (1000 * 60 * 60 * 24);

                if (schedule === 'daily' && diffDays >= 1) {
                    shouldBackup = true;
                } else if (schedule === 'weekly' && diffDays >= 7) {
                    shouldBackup = true;
                }
            }

            if (shouldBackup) {
                const dbPath = path.join(process.env.APPDATA || process.env.HOME || '', 'Financial Assistant', 'finance.sqlite');
                // Use backend db path if it exists, otherwise assume running in Dev
                const actualDbPath = fs.existsSync(dbPath) ? dbPath : path.join(__dirname, '../../../finance.sqlite');
                
                if (fs.existsSync(actualDbPath)) {
                    const dateStr = now.toISOString().split('T')[0];
                    const destFile = path.join(backupLocation, `finance_backup_${dateStr}.sqlite`);
                    
                    // Simple file copy
                    fs.copyFileSync(actualDbPath, destFile);
                    
                    // Update last backup date
                    nativeDb.prepare("INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
                        .run('last_backup_date', now.toISOString());
                    
                    console.log(`BackupService: Successfully backed up database to ${destFile}`);
                }
            }
        } catch (err) {
            console.error("BackupService Error:", err);
        }
    }
}

module.exports = new BackupService();
