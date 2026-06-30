const { nativeDb } = require('../../database');

function insertTxWithLedger(title, amount, date, type, category, extraCols = '', extraVals = []) {
    const cols = 'title, date, category' + (extraCols ? ', ' + extraCols : '');
    const qMarks = '?, ?, ?' + (extraCols ? ', ' + extraVals.map(()=>'?').join(', ') : '');
    const info = nativeDb.prepare('INSERT INTO transactions (' + cols + ') VALUES (' + qMarks + ')').run(title, date, category, ...extraVals);
    const txId = info.lastInsertRowid;
    let acctClass = type === 'income' ? 'Revenue' : 'Expense';
    let acctType = 'operating';
    if (category === 'transfer' || category === 'deposit' || category === 'capital_deployment') {
        acctClass = 'Asset';
        acctType = 'bank';
    } else if (extraCols && extraCols !== 'propertyId') {
        acctClass = 'Asset';
        acctType = 'bank';
    }

    if (type === 'income') {
        if (acctClass === 'Asset') {
            nativeDb.prepare('INSERT INTO ledger_lines (transaction_id, account_class, account_type, debit_amount) VALUES (?, ?, ?, ?)').run(txId, acctClass, acctType, amount);
        } else {
            nativeDb.prepare('INSERT INTO ledger_lines (transaction_id, account_class, account_type, credit_amount) VALUES (?, ?, ?, ?)').run(txId, acctClass, acctType, amount);
        }
    } else {
        if (acctClass === 'Asset') {
            nativeDb.prepare('INSERT INTO ledger_lines (transaction_id, account_class, account_type, credit_amount) VALUES (?, ?, ?, ?)').run(txId, acctClass, acctType, amount);
        } else {
            nativeDb.prepare('INSERT INTO ledger_lines (transaction_id, account_class, account_type, debit_amount) VALUES (?, ?, ?, ?)').run(txId, acctClass, acctType, amount);
        }
    }
    return info;
}

function decorateTx(tx) {
    if (!tx) return tx;
    const details = nativeDb.prepare('SELECT * FROM transaction_details WHERE id = ?').get(tx.id);
    return details || tx;
}

function getTx(id) {
    const tx = nativeDb.prepare('SELECT * FROM transactions WHERE id = ?').get(id);
    if (!tx) return undefined;
    const llines = nativeDb.prepare('SELECT * FROM ledger_lines WHERE transaction_id = ?').all(id);
    const credit = llines.reduce((s, l) => s + (l.credit_amount||0), 0);
    const debit = llines.reduce((s, l) => s + (l.debit_amount||0), 0);
    tx.amount = Math.max(credit, debit);
    tx.type = credit > 0 ? 'income' : 'expense';
    return tx;
}

module.exports = {
    insertTxWithLedger,
    decorateTx,
    getTx
};
