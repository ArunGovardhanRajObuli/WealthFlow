const { contextBridge, ipcRenderer } = require('electron');

let cachedToken = null;
ipcRenderer.on('set-secure-token', (_event, token) => {
    cachedToken = token;
});

contextBridge.exposeInMainWorld('electronAPI', {
    getInternalToken: () => {
        return new Promise((resolve) => {
            if (cachedToken) return resolve(cachedToken);
            ipcRenderer.once('set-secure-token', (_event, token) => {
                cachedToken = token;
                resolve(token);
            });
        });
    },
    onSecureToken: (callback) => {
        if (cachedToken) callback(cachedToken);
        ipcRenderer.on('set-secure-token', (_event, token) => callback(token));
    },
    clearToken: () => {
        cachedToken = null;
    }
});
