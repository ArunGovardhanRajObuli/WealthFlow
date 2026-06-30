const { nativeDb } = require('../../database');

exports.getSettings = (req, res, next) => {
    try {
        const rows = nativeDb.prepare("SELECT key, value FROM app_settings").all();
        const settings = {};
        rows.forEach(r => {
            settings[r.key] = r.value;
        });
        res.json({ data: settings });
    } catch (err) {
        next(err);
    }
};

exports.updateSettings = (req, res, next) => {
    try {
        const settingsToUpdate = req.body;
        const stmt = nativeDb.prepare("INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value");
        
        nativeDb.transaction(() => {
            for (const [key, value] of Object.entries(settingsToUpdate)) {
                stmt.run(key, String(value));
            }
        })();
        
        res.json({ message: 'Settings updated successfully' });
    } catch (err) {
        next(err);
    }
};

exports.wipeData = (req, res, next) => {
    try {
        const tables = [
            'transactions', 'ledger_lines', 'reminders', 'budgets', 'net_worth_snapshots',
            'credit_cards', 'loan_payments', 'sinking_funds', 'family_members', 'net_worth_history',
            'investments', 'real_estate', 'investment_lots', 'sip_purchases', 'savings_rules',
            'pending_sweeps', 'bank_balances', 'gold_holdings', 'nps_accounts', 'fixed_deposits',
            'nominees', 'documents'
        ];

        nativeDb.transaction(() => {
            tables.forEach(table => {
                nativeDb.prepare(`DELETE FROM ${table}`).run();
            });
        })();

        res.json({ message: 'Data wiped successfully. Database is now empty.' });
    } catch (err) {
        next(err);
    }
};
