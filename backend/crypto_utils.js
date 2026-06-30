const crypto = require('crypto');

// 1. SYSTEM CRASH FIX: Do not generate an ephemeral key. Fail hard if key is missing.
if (!process.env.ENCRYPTION_KEY) {
    throw new Error('CRITICAL: ENCRYPTION_KEY environment variable is not set. Refusing to start or fallback to insecure keys.');
}
const ENCRYPTION_KEY = Buffer.from(process.env.ENCRYPTION_KEY, 'hex');
if (ENCRYPTION_KEY.length !== 32) {
    throw new Error(`CRITICAL: ENCRYPTION_KEY must be exactly 32 bytes (64 hex chars) for AES-256. Got ${ENCRYPTION_KEY.length} bytes.`);
}

function encrypt(text) {
    if (!text) return text;
    try {
        const iv = crypto.randomBytes(12);
        const cipher = crypto.createCipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
        let encrypted = cipher.update(text, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        const authTag = cipher.getAuthTag().toString('hex');
        return `${iv.toString('hex')}:${authTag}:${encrypted}`;
    } catch (e) {
        throw new Error('Encryption failed. Refusing to fail-open and store plaintext.');
    }
}

function decrypt(text) {
    if (!text || typeof text !== 'string') return text;
    const parts = text.split(':');
    if (parts.length !== 3) return text;

    try {
        const [ivHex, authTagHex, encryptedHex] = parts;
        const decipher = crypto.createDecipheriv('aes-256-gcm', ENCRYPTION_KEY, Buffer.from(ivHex, 'hex'));
        decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
        let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    } catch (e) {
        throw new Error('Decryption failed. The encryption key may have changed or the data is corrupted.');
    }
}

module.exports = { encrypt, decrypt };
