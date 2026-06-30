const { nativeDb } = require('../../database');

exports.getBankBalances = () => {
    const banks = nativeDb.prepare('SELECT * FROM bank_balances ORDER BY asOfDate DESC').all();
    const ledgers = nativeDb.prepare("SELECT entity_id, SUM(COALESCE(debit_amount, 0) - COALESCE(credit_amount, 0)) as bal FROM ledger_lines WHERE account_type = 'bank' GROUP BY entity_id").all();
    
    return banks.map(b => {
        const dbBal = ledgers.find(l => String(l.entity_id) === String(b.id));
        return { ...b, snapshotBalance: b.balance, ledgerBalance: dbBal ? dbBal.bal : 0 };
    });
};

exports.createBankBalance = (bankName, balance, asOfDate, owner_member_id) => {
    const insertRes = nativeDb.prepare('INSERT INTO bank_balances (bankName, balance, asOfDate, owner_member_id) VALUES (?, ?, ?, ?)').run(bankName, balance || 0, asOfDate, owner_member_id || null);
    return insertRes.lastInsertRowid;
};

exports.deleteBankBalance = (id) => {
    const tx = nativeDb.transaction(() => {
        // Find opening balance transactions for this bank and delete them
        const openingTxs = nativeDb.prepare("SELECT id FROM transactions WHERE category = 'opening_balance' AND source_bank_id = ?").all(id);
        for (let t of openingTxs) {
            nativeDb.prepare("DELETE FROM transactions WHERE id = ?").run(t.id);
            nativeDb.prepare("DELETE FROM ledger_lines WHERE transaction_id = ?").run(t.id);
        }

        const linkedTxs = nativeDb.prepare("SELECT COUNT(id) as cnt FROM transactions WHERE (source_bank_id = ? OR joint_bank_id = ?) AND category != 'opening_balance'").get(id, id);
        if (linkedTxs && linkedTxs.cnt > 0) {
            throw new Error("Cannot delete bank account linked to existing transactions.");
        }
        nativeDb.prepare('DELETE FROM bank_balances WHERE id = ?').run(id);
        nativeDb.prepare("DELETE FROM nominees WHERE assetType = 'Bank Account' AND assetId = ?").run(id);
    });
    tx();
};
