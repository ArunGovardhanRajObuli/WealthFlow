/**
 * Middleware to ensure requests originate from our Electron native window
 * and not an external browser or network scan.
 */
function verifyInternalToken(req, res, next) {
    // Only accept tokens from headers — never from query strings (logged, cached, referer-leaked)
    const internalToken = req.headers['x-internal-token'];
    
    if (!internalToken || internalToken !== process.env.INTERNAL_SECURE_TOKEN) {
        return res.status(401).json({
            error: 'Unauthorized. This backend is running in secure native mode.'
        });
    }

    // Verify session token (header only)
    const authHeader = req.headers['authorization'];
    const sessionToken = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!global.ACTIVE_SESSION_TOKEN || sessionToken !== global.ACTIVE_SESSION_TOKEN) {
        return res.status(401).json({ error: 'Unauthorized. Session expired or invalid.' });
    }
    
    next();
}

module.exports = { verifyInternalToken };
