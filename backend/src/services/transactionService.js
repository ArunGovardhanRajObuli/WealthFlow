const fs = require('fs');
const { nativeDb } = require('../../database');
const { syncAssetBalances } = require('./ledgerService');
const { validateAmount, parseToPaiseBigInt, validateTitle } = require('../utils/financialUtils');

const TX_JOIN_QUERY = `SELECT * FROM transaction_details`;

function calculateAssetUnits(amount, price) {
    if (price > 0) {
        const rawUnits = parseFloat(amount) / price;
        return Math.round(rawUnits * 1000000) / 1000000;
    }
    return 0;
}

exports.getAllTransactions = ({ limit, offset, startDate, endDate, type, category, search }) => {
    let baseQuery = `${TX_JOIN_QUERY} WHERE 1=1`;
    let params = [];

    if (startDate) { baseQuery += ' AND date >= ?'; params.push(startDate); }
    if (endDate) { baseQuery += ' AND date <= ?'; params.push(endDate); }
    if (category) { baseQuery += ' AND LOWER(category) = ?'; params.push(category.toLowerCase()); }
    if (search) { baseQuery += ' AND LOWER(title) LIKE ?'; params.push('%' + search.toLowerCase() + '%'); }

    let query = `SELECT * FROM (${baseQuery}) WHERE 1=1`;
    if (type) { query += ' AND type = ?'; params.push(type); }

    query += ' ORDER BY date DESC, id DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    return nativeDb.prepare(query).all(...params);
};

exports.createTransaction = (validatedData) => {
    const { 
        validTitle, validAmount, validDate, validCategory, validType, taxDed, recUrl,
        s_bank, j_bank, safeSplitPercent, safeSplitAmount, l_loan, c_card, s_fund, i_inv, 
        p_prop, f_fd, g_gold, n_nps, i_ins, s_sub, f_fam
    } = validatedData;

    const tx = nativeDb.transaction(() => {
        let navToUseForNew = 0;
        let newAssetUnits = null;
        
        if (i_inv) {
            const inv = nativeDb.prepare('SELECT latestNav FROM investments WHERE id = ?').get(i_inv);
            navToUseForNew = inv ? inv.latestNav : 0;
            newAssetUnits = calculateAssetUnits(validAmount, navToUseForNew);
        } else if (g_gold) {
            const g = nativeDb.prepare('SELECT currentPricePerGram, purchasePricePerGram FROM gold_holdings WHERE id = ?').get(g_gold);
            const price = g ? (parseFloat(g.currentPricePerGram) || parseFloat(g.purchasePricePerGram)) : 0;
            newAssetUnits = calculateAssetUnits(validAmount, price);
        }
        
        const insertStmt = nativeDb.prepare(`
            INSERT INTO transactions 
            (title, date, category, isTaxDeductible, receiptUrl, source_bank_id, joint_bank_id, split_percent, split_amount, linked_loan_id, credit_card_id, sinking_fund_id, investment_id, propertyId, fd_id, gold_id, nps_id, insurance_id, subscription_id, family_member_id, asset_units) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        const info = insertStmt.run(validTitle, validDate, validCategory, taxDed, recUrl, s_bank, j_bank, safeSplitPercent, safeSplitAmount, l_loan, c_card, s_fund, i_inv, p_prop, f_fd, g_gold, n_nps, i_ins, s_sub, f_fam, newAssetUnits);
        const txId = info.lastInsertRowid;
        
        const newTx = { 
            id: txId, title: validTitle, amount: validAmount, type: validType, category: validCategory, date: validDate,
            asset_units: newAssetUnits, source_bank_id: s_bank, joint_bank_id: j_bank, split_percent: safeSplitPercent, split_amount: safeSplitAmount,
            linked_loan_id: l_loan, credit_card_id: c_card, sinking_fund_id: s_fund, investment_id: i_inv, propertyId: p_prop,
            fd_id: f_fd, gold_id: g_gold, nps_id: n_nps, insurance_id: i_ins, subscription_id: s_sub, family_member_id: f_fam
        };
        
        syncAssetBalances(null, newTx);
        
        if (validCategory === 'loan_payment' || l_loan) {
            nativeDb.prepare('INSERT INTO loan_payments (loan_id, amount, date, source_bank_id, joint_bank_id, split_percent, split_amount, transaction_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
                .run(l_loan, validAmount, validDate, s_bank || null, j_bank || null, safeSplitPercent, safeSplitAmount, txId);
        }
        if (i_inv && validType !== 'income' && validCategory !== 'capital_retrieval') {
            nativeDb.prepare('INSERT INTO sip_purchases (investment_id, date, amount, navPrice, unitsPurchased, transaction_id) VALUES (?, ?, ?, ?, ?, ?)')
                .run(i_inv, validDate, validAmount, navToUseForNew, newAssetUnits, txId);
            nativeDb.prepare('INSERT INTO investment_lots (investment_id, purchaseDate, purchaseAmount, units, costBasis, currentNav, transaction_id) VALUES (?, ?, ?, ?, ?, ?, ?)')
                .run(i_inv, validDate, validAmount, newAssetUnits, validAmount, navToUseForNew, txId);
        }
        
        return txId;
    });

    return tx();
};

exports.updateTransaction = (id, validatedData) => {
    const tx = nativeDb.transaction(() => {
        const oldTx = nativeDb.prepare(`SELECT * FROM (${TX_JOIN_QUERY}) WHERE id = ?`).get(id);
        if (!oldTx) throw new Error('Transaction not found');
        
        const { 
            validTitle, validAmount, validDate, validCategory, validType, taxDed, 
            s_bank, j_bank, safeSplitPercent, safeSplitAmount, c_card, l_loan
        } = validatedData;
        const linked_loan_id = l_loan;

        let newAssetUnits = oldTx.asset_units;
        if (oldTx.investment_id && validAmount !== oldTx.amount) {
            let navToUse = 0;
            const sipNav = nativeDb.prepare('SELECT navPrice FROM sip_purchases WHERE transaction_id = ?').get(id);
            if (sipNav && sipNav.navPrice > 0) {
                navToUse = sipNav.navPrice;
            } else {
                const lotNav = nativeDb.prepare('SELECT currentNav FROM investment_lots WHERE transaction_id = ?').get(id);
                if (lotNav && lotNav.currentNav > 0) navToUse = lotNav.currentNav;
            }
            newAssetUnits = navToUse > 0 ? calculateAssetUnits(validAmount, navToUse) : oldTx.asset_units;
        } else if (oldTx.gold_id && validAmount !== oldTx.amount) {
            const g = nativeDb.prepare('SELECT currentPricePerGram, purchasePricePerGram FROM gold_holdings WHERE id = ?').get(oldTx.gold_id);
            const price = g ? (parseFloat(g.currentPricePerGram) || parseFloat(g.purchasePricePerGram)) : 0;
            if (price > 0) newAssetUnits = calculateAssetUnits(validAmount, price);
        }

        nativeDb.prepare(`
            UPDATE transactions 
            SET title=?, date=?, category=?, isTaxDeductible=?, 
                source_bank_id=?, joint_bank_id=?, split_percent=?, split_amount=?, 
                credit_card_id=?, linked_loan_id=?, asset_units=? 
            WHERE id=?
        `).run(
            validTitle, validDate, validCategory, 
            taxDed, s_bank, j_bank, safeSplitPercent, safeSplitAmount, 
            c_card, linked_loan_id, newAssetUnits, id
        );

        const newTx = { 
            id, title: validTitle, amount: validAmount, type: validType, category: validCategory, date: validDate,
            asset_units: newAssetUnits, source_bank_id: s_bank, joint_bank_id: j_bank, split_percent: safeSplitPercent, split_amount: safeSplitAmount,
            linked_loan_id: linked_loan_id, credit_card_id: c_card, sinking_fund_id: oldTx.sinking_fund_id, investment_id: oldTx.investment_id, propertyId: oldTx.propertyId,
            fd_id: oldTx.fd_id, gold_id: oldTx.gold_id, nps_id: oldTx.nps_id, insurance_id: oldTx.insurance_id, subscription_id: oldTx.subscription_id, family_member_id: oldTx.family_member_id
        };
        syncAssetBalances(oldTx, newTx);

        if (oldTx.investment_id && validAmount !== oldTx.amount) {
            nativeDb.prepare('UPDATE sip_purchases SET amount = ?, unitsPurchased = ? WHERE transaction_id = ?').run(validAmount, newAssetUnits, id);
            nativeDb.prepare('UPDATE investment_lots SET purchaseAmount = ?, costBasis = ?, units = ? WHERE transaction_id = ?').run(validAmount, validAmount, newAssetUnits, id);
        }

        if (oldTx.linked_loan_id || linked_loan_id) {
            nativeDb.prepare('DELETE FROM loan_payments WHERE transaction_id = ?').run(id);
            if (validCategory === 'loan_payment' || linked_loan_id) {
                nativeDb.prepare('INSERT INTO loan_payments (loan_id, amount, date, source_bank_id, joint_bank_id, split_percent, split_amount, transaction_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
                    .run(linked_loan_id || oldTx.linked_loan_id, validAmount, validDate, s_bank, j_bank, safeSplitPercent, safeSplitAmount, id);
            }
        }
    });

    tx();
};

exports.removeTransaction = (id) => {
    const tx = nativeDb.transaction(() => {
        const oldTx = nativeDb.prepare(`SELECT * FROM (${TX_JOIN_QUERY}) WHERE id = ?`).get(id);
        if (!oldTx) throw new Error('Transaction not found');
        
        if (oldTx.category === 'transfer') {
            if (oldTx.transfer_id) {
                const twin = nativeDb.prepare('SELECT * FROM transactions WHERE transfer_id = ? AND id != ?').get(oldTx.transfer_id, oldTx.id);
                
                nativeDb.prepare('DELETE FROM transactions WHERE transfer_id = ?').run(oldTx.transfer_id);
                
                syncAssetBalances(oldTx, null);
                if (twin) syncAssetBalances(twin, null);
                return;
            } else {
                const twin = nativeDb.prepare(`SELECT * FROM (${TX_JOIN_QUERY}) WHERE category = 'transfer' AND date = ? AND id != ?`)
                                     .all(oldTx.date, oldTx.id)
                                     .find(t => t.type === (oldTx.type === 'income' ? 'expense' : 'income') && String(t.amount) === String(oldTx.amount));
                if (twin) {
                    nativeDb.prepare('DELETE FROM transactions WHERE id IN (?, ?)').run(oldTx.id, twin.id);
                    syncAssetBalances(oldTx, null);
                    syncAssetBalances(twin, null);
                    return;
                }
            }
        }

        nativeDb.prepare('DELETE FROM loan_payments WHERE transaction_id = ?').run(id);
        nativeDb.prepare('DELETE FROM sip_purchases WHERE transaction_id = ?').run(id);
        nativeDb.prepare('DELETE FROM investment_lots WHERE transaction_id = ?').run(id);

        syncAssetBalances(oldTx, null);
        
        nativeDb.prepare('DELETE FROM transactions WHERE id = ?').run(id);
    });

    tx();
};

exports.createTransfer = (transferAmount, validDate, source_bank_id, target_bank_id) => {
    const tx = nativeDb.transaction(() => {
        const transfer_id = Date.now().toString() + '_' + Math.random().toString(36).substr(2, 9);
        const insertStmt = nativeDb.prepare('INSERT INTO transactions (title, category, date, source_bank_id, transfer_id) VALUES (?, ?, ?, ?, ?)');
        const t1 = insertStmt.run(`Transfer out to Bank ${target_bank_id}`, 'transfer', validDate, source_bank_id, transfer_id);
        const t2 = insertStmt.run(`Transfer in from Bank ${source_bank_id}`, 'transfer', validDate, target_bank_id, transfer_id);
        
        const newTx1 = { id: t1.lastInsertRowid, amount: transferAmount, type: 'expense', category: 'transfer', source_bank_id };
        const newTx2 = { id: t2.lastInsertRowid, amount: transferAmount, type: 'income', category: 'transfer', source_bank_id: target_bank_id };
        syncAssetBalances(null, newTx1);
        syncAssetBalances(null, newTx2);

        return [t1.lastInsertRowid, t2.lastInsertRowid];
    });

    return tx();
};

exports.importCsvTransactions = async (filePath, source_bank_id = null, credit_card_id = null) => {
    let fileContent;
    try {
        fileContent = await fs.promises.readFile(filePath, 'utf8');
    } catch(e) {
        throw new Error('Failed to read CSV file');
    }
    
    const lines = fileContent.split('\n').map(l => l.trim()).filter(l => l);
    if (lines.length < 2) throw new Error('Empty CSV or missing data rows');
    if (lines.length > 5000) throw new Error('CSV file exceeds maximum limit of 5000 rows');
    
    function parseCSVLine(line) {
        const result = [];
        let current = '';
        let inQuotes = false;
        // Strip formula injection chars, whitespace, and limit length to prevent DoS
        const sanitizeCell = (str) => {
            if (str === null || str === undefined) return '';
            let s = String(str).trim();
            if (/^[\=\+\@\t\r]/.test(s)) s = s.replace(/^[\=\+\@\t\r]+/, '');
            return s.substring(0, 255);
        };

        for (let c = 0; c < line.length; c++) {
            if (line[c] === '"') {
                if (inQuotes && c + 1 < line.length && line[c + 1] === '"') {
                    current += '"'; c++; 
                } else {
                    inQuotes = !inQuotes;
                }
            } else if (line[c] === ',' && !inQuotes) {
                result.push(sanitizeCell(current));
                current = '';
            } else {
                current += line[c];
            }
        }
        result.push(sanitizeCell(current));
        return result;
    }
    
    const headers = parseCSVLine(lines[0].toLowerCase());
    const dateIdx = headers.findIndex(h => h.includes('date'));
    const descIdx = headers.findIndex(h => h.includes('narration') || h.includes('description') || h.includes('particulars') || h.includes('title'));
    const debitIdx = headers.findIndex(h => h.includes('withdrawal') || h.includes('debit') || h.includes('dr'));
    const creditIdx = headers.findIndex(h => h.includes('deposit') || h.includes('credit') || h.includes('cr'));
    const amtIdx = headers.findIndex(h => h === 'amount');
    
    let inserted = 0;
    if (credit_card_id) {
        source_bank_id = null;
    }

    const tx = nativeDb.transaction(() => {
        const insertStmt = nativeDb.prepare('INSERT INTO transactions (title, category, date, source_bank_id, credit_card_id) VALUES (?, ?, ?, ?, ?)');
        for (let i = 1; i < lines.length; i++) {
            const parts = parseCSVLine(lines[i]);
            if (parts.length < headers.length) continue;
            
            const _d2 = new Date();
            const fallbackDate = _d2.getFullYear() + '-' + String(_d2.getMonth() + 1).padStart(2, '0') + '-' + String(_d2.getDate()).padStart(2, '0');
            let dateRaw = dateIdx !== -1 ? parts[dateIdx] : fallbackDate;
            let title = descIdx !== -1 ? parts[descIdx] : 'CSV Import';
            
            let debitStr = debitIdx !== -1 ? parts[debitIdx].replace(/,/g, '') : '0';
            let creditStr = creditIdx !== -1 ? parts[creditIdx].replace(/,/g, '') : '0';
            let amtColStr = amtIdx !== -1 ? parts[amtIdx].replace(/,/g, '') : '0';
            
            let type = 'expense';
            let amountStr = '0';
            let validFound = false;
            
            try {
                const creditPaise = parseToPaiseBigInt(creditStr);
                const debitPaise = parseToPaiseBigInt(debitStr);
                const amtPaise = parseToPaiseBigInt(amtColStr);
                
                if (creditPaise > 0n) {
                    type = 'income'; amountStr = creditStr; validFound = true;
                } else if (debitPaise > 0n) {
                    type = 'expense'; amountStr = debitStr; validFound = true;
                } else if (amtPaise !== 0n) {
                    type = amtPaise < 0n ? 'expense' : 'income';
                    amountStr = amtColStr.startsWith('-') || amtColStr.startsWith('+') ? amtColStr.slice(1) : amtColStr;
                    validFound = true;
                }
            } catch (err) {
                // fallthrough to validateAmount failure
            }
            
            if (!validFound) {
                continue; 
            }
            
            let date = dateRaw;
            if (dateRaw.includes('/')) {
                const d = dateRaw.split('/');
                if (d.length === 3) {
                    const year = d[2].length === 2 ? "20" + d[2] : d[2];
                    date = year + "-" + d[1].padStart(2, '0') + "-" + d[0].padStart(2, '0');
                }
            } else if (dateRaw.includes('-')) {
                const d = dateRaw.split('-');
                if (d.length === 3 && d[0].length === 2) { 
                    date = d[2] + "-" + d[1] + "-" + d[0];
                }
            }
            
            let category = type === 'expense' ? 'irregular' : 'salary';
            const lowerTitle = title.toLowerCase();
            if (lowerTitle.includes('swiggy') || lowerTitle.includes('zomato') || lowerTitle.includes('mcdonalds')) category = 'groceries';
            else if (lowerTitle.includes('amazon') || lowerTitle.includes('flipkart')) category = 'irregular';
            else if (lowerTitle.includes('emi') || lowerTitle.includes('loan') || lowerTitle.includes('hdfc bank loan')) category = 'loan';
            else if (lowerTitle.includes('rent') || lowerTitle.includes('pg')) category = type === 'income' ? 'rental_income' : 'rental';
            else if (lowerTitle.includes('salary') || lowerTitle.includes('payroll')) category = 'salary';
            else if (lowerTitle.includes('dividend') || lowerTitle.includes('div')) category = 'dividend';
            
            
            const safeTitle = validateTitle(title) || 'CSV Import';
            
            if (safeTitle && type) {
                const strAmount = validateAmount(amountStr);
                if (strAmount === null || parseToPaiseBigInt(strAmount) === 0n) continue;
                
                const info = insertStmt.run(safeTitle.substring(0,255), category, date, source_bank_id, credit_card_id);
                const newTx = { 
                    id: info.lastInsertRowid, title: safeTitle.substring(0,255), amount: strAmount, type, category, date,
                    source_bank_id, credit_card_id, asset_units: null, joint_bank_id: null, split_percent: null, split_amount: null,
                    linked_loan_id: null, sinking_fund_id: null, investment_id: null, propertyId: null,
                    fd_id: null, gold_id: null, nps_id: null, insurance_id: null, subscription_id: null, family_member_id: null
                };
                syncAssetBalances(null, newTx);
                inserted++;
            }
        }
    });
    
    tx();
    return inserted;
};
