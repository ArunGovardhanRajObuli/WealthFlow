const { app, BrowserWindow, safeStorage } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');

// Generate a secure token to authenticate internal IPC/localhost requests
const INTERNAL_SECURE_TOKEN = crypto.randomBytes(64).toString('hex');
process.env.INTERNAL_SECURE_TOKEN = INTERNAL_SECURE_TOKEN;

// Set global user data path so backend components can use it instead of __dirname
process.env.USER_DATA_PATH = app.getPath('userData');

let mainWindow;

async function createWindow() {
    // Set up secure encryption key before requiring app
    const keyPath = path.join(app.getPath('userData'), 'encryption_key.bin');
    let encKeyHex;

    if (fs.existsSync(keyPath)) {
        const encryptedKey = fs.readFileSync(keyPath);
        if (safeStorage.isEncryptionAvailable()) {
            try {
                encKeyHex = safeStorage.decryptString(encryptedKey);
            } catch (e) {
                console.error("Failed to decrypt encryption key from safeStorage");
                app.quit();
                return;
            }
        } else {
            encKeyHex = encryptedKey.toString('utf8'); // fallback if safeStorage not available
        }
    } else {
        encKeyHex = crypto.randomBytes(32).toString('hex');
        if (safeStorage.isEncryptionAvailable()) {
            fs.writeFileSync(keyPath, safeStorage.encryptString(encKeyHex));
        } else {
            fs.writeFileSync(keyPath, encKeyHex, 'utf8'); // fallback
        }
    }

    process.env.ENCRYPTION_KEY = encKeyHex;

    // Now safely require the express app
    const expressApp = require('./app');

    // Start Express on a dynamic port
    // We will use a simple retry mechanism or fixed port
    
    const startServer = (desiredPort) => {
        const server = expressApp.listen(desiredPort, '127.0.0.1');

        server.on('error', (err) => {
            if (err.code === 'EADDRINUSE') {
                console.log(`Port ${desiredPort} in use, trying a dynamic port...`);
                // If 4000 is in use, retry with 0 (random port)
                startServer(0);
            } else {
                console.error(err);
                app.quit();
            }
        });

        server.on('listening', () => {
            const port = server.address().port;
            console.log(`Internal Express server running on port ${port}`);
            
            mainWindow = new BrowserWindow({
                width: 1200,
                height: 800,
                webPreferences: {
                    nodeIntegration: false,
                    contextIsolation: true,
                    // We'll pass the token to the frontend via a preload script or custom headers
                    preload: path.join(__dirname, 'preload.js')
                }
            });

            // Load the frontend
            if (app.isPackaged) {
                mainWindow.loadURL(`http://127.0.0.1:${port}`);
            } else {
                mainWindow.loadURL(`http://localhost:5173`); 
            }
            
            // Pass the token to the frontend via IPC or local auth storage setup
            mainWindow.webContents.on('did-finish-load', () => {
                mainWindow.webContents.send('set-secure-token', INTERNAL_SECURE_TOKEN);
            });
        });
    };

    startServer(4000);
}

app.whenReady().then(() => {
    createWindow();

    // Check for updates only in production
    if (app.isPackaged) {
        autoUpdater.checkForUpdatesAndNotify().catch(err => {
            console.error('Failed to check for updates:', err);
        });
    }

    autoUpdater.on('update-available', () => {
        console.log('A new update is available!');
    });

    autoUpdater.on('update-downloaded', () => {
        console.log('Update downloaded. It will be installed on restart.');
    });

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});
