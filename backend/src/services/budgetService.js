const { nativeDb } = require('../../database');

exports.getAllBudgets = () => {
    const rows = nativeDb.prepare('SELECT * FROM budgets').all();
    
    // Compute local timezone month bounds
    const tzOffsetMs = new Date().getTimezoneOffset() * 60000;
    const localDate = new Date(Date.now() - tzOffsetMs);
    const localMonthPrefix = localDate.toISOString().substring(0, 7); // YYYY-MM
    
    // Let SQLite sum the ledger lines for each budget category for the current month
    const spendSql = `
        SELECT LOWER(t.category) as cat, 
               SUM(COALESCE(debit_amount, 0) - COALESCE(credit_amount, 0)) as net_spend
        FROM ledger_lines l
        JOIN transactions t ON l.transaction_id = t.id
        WHERE t.date LIKE ? 
          AND l.account_class IN ('Expense', 'Revenue') 
          AND l.account_type = 'operating'
        GROUP BY LOWER(t.category)
    `;
    const spendRows = nativeDb.prepare(spendSql).all(`${localMonthPrefix}%`);
    
    const spendMap = {};
    for (const row of spendRows) {
        // Convert to BIGINT string representing raw paise (e.g. 150.50 -> 15050)
        const paise = Math.round((row.net_spend || 0) * 100);
        spendMap[row.cat] = paise.toString();
    }
    
    return rows.map(b => {
        const catLower = (b.category || '').toLowerCase();
        return {
            ...b,
            spentPaise: spendMap[catLower] || "0"
        };
    });
};

exports.createBudget = (safeCategory, monthlyLimit) => {
    const insertStmt = nativeDb.prepare('INSERT OR REPLACE INTO budgets (category, monthlyLimit) VALUES (?, ?)');
    const result = insertStmt.run(safeCategory, monthlyLimit);
    return result.lastInsertRowid;
};

exports.updateBudget = (id, safeCategory, monthlyLimit) => {
    const tx = nativeDb.transaction(() => {
        const oldBudget = nativeDb.prepare('SELECT category FROM budgets WHERE id = ?').get(id);
        
        const updateStmt = nativeDb.prepare('UPDATE budgets SET category = ?, monthlyLimit = ? WHERE id = ?');
        updateStmt.run(safeCategory, monthlyLimit, id);
        
        if (oldBudget && oldBudget.category && oldBudget.category !== safeCategory) {
            const updateTx = nativeDb.prepare('UPDATE transactions SET category = ? WHERE LOWER(category) = ?');
            updateTx.run(safeCategory, oldBudget.category.toLowerCase());
        }
    });
    
    tx();
};

exports.removeBudget = (id) => {
    const tx = nativeDb.transaction(() => {
        const budget = nativeDb.prepare('SELECT category FROM budgets WHERE id = ?').get(id);
        if (budget && budget.category) {
            const count = nativeDb.prepare('SELECT COUNT(id) as c FROM transactions WHERE LOWER(category) = ?').get(budget.category.toLowerCase()).c;
            if (count > 0) {
                throw new Error(`Cannot delete: ${count} transaction(s) are categorized under this budget. Re-categorize them before deletion.`);
            }
        }
        
        nativeDb.prepare('DELETE FROM budgets WHERE id = ?').run(id);
    });
    tx();
};
