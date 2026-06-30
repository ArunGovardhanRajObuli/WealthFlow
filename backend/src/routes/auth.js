const express = require('express');
const router = express.Router();
const { nativeDb } = require('../../database');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');

// Rate Limiter for Auth endpoints (5 per minute)
const authLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many authentication attempts, please try again later.' }
});

router.use(authLimiter);

// Store active session token in memory. Resets on restart.
global.ACTIVE_SESSION_TOKEN = null;

// Check if master password is set
router.get('/check-setup', (req, res) => {
    try {
        const row = nativeDb.prepare("SELECT value FROM app_settings WHERE key = 'master_password_hash'").get();
        res.json({ isSetup: !!(row && row.value) });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Authentication check failed." });
    }
});

// Set master password (only works once)
router.post('/setup', async (req, res) => {
    try {
        const { password } = req.body;
        if (!password || password.length < 8 || password.length > 72) {
            return res.status(400).json({ error: "Password must be between 8 and 72 characters." });
        }

        const existing = nativeDb.prepare("SELECT value FROM app_settings WHERE key = 'master_password_hash'").get();
        if (existing && existing.value) {
            return res.status(403).json({ error: "Authentication failed." });
        }

        const salt = await bcrypt.genSalt(12);
        const hash = await bcrypt.hash(password, salt);

        nativeDb.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES ('master_password_hash', ?)").run(hash);
        
        global.ACTIVE_SESSION_TOKEN = crypto.randomBytes(32).toString('hex');
        res.json({ success: true, token: global.ACTIVE_SESSION_TOKEN });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Authentication failed." });
    }
});

// Login with master password
router.post('/login', async (req, res) => {
    try {
        const { password } = req.body;
        if (!password || password.length > 72) {
            return res.status(400).json({ error: "Authentication failed." });
        }

        const row = nativeDb.prepare("SELECT value FROM app_settings WHERE key = 'master_password_hash'").get();
        if (!row || !row.value) {
            return res.status(400).json({ error: "Authentication failed." });
        }

        const isValid = await bcrypt.compare(password, row.value);
        if (!isValid) {
            return res.status(401).json({ error: "Authentication failed." });
        }

        global.ACTIVE_SESSION_TOKEN = crypto.randomBytes(32).toString('hex');
        res.json({ success: true, token: global.ACTIVE_SESSION_TOKEN });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Authentication failed." });
    }
});

module.exports = router;
