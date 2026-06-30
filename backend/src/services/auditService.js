const { nativeDb } = require('../../database');

exports.getAuditLogs = () => {
    return nativeDb.prepare('SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT 100').all();
};

exports.createAuditLog = (action, entity, entity_id, details) => {
    const tx = nativeDb.transaction(() => {
        nativeDb.prepare('INSERT INTO audit_logs (action, entity, entity_id, details) VALUES (?, ?, ?, ?)').run(action, entity, entity_id, JSON.stringify(details || {}));
    });
    tx();
};
