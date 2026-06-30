// Legacy entry point for developers running 'npm start' instead of the native app.
const crypto = require('crypto');

if (!process.env.INTERNAL_SECURE_TOKEN) {
    const token = crypto.randomBytes(64).toString('hex');
    process.env.INTERNAL_SECURE_TOKEN = token;
    console.log(`\n======================================================`);
    console.log(`DEV MODE TOKEN: ${token}`);
    console.log(`Include header: x-internal-token: ${token}`);
    console.log(`======================================================\n`);
}

if (!process.env.ENCRYPTION_KEY) {
    const devKey = crypto.randomBytes(32).toString('hex');
    process.env.ENCRYPTION_KEY = devKey;
    console.log(`\n[DEV MODE] Generated ephemeral ENCRYPTION_KEY: ${devKey}\n`);
}

const app = require('./src/app');

const PORT = process.env.PORT || 4000;
app.listen(PORT, '127.0.0.1', () => {
    console.log(`Backend server running in standalone mode on http://127.0.0.1:${PORT}`);
});
