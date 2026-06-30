const { validateTitle, validateAmount, validateDate, validateFk, parseToPaiseBigInt, validateReceiptUrl } = require('../utils/financialUtils');
const { nativeDb } = require('../../database');

function validateTransaction(req, res, next) {
    try {
        const isUpdate = req.method === 'PUT';
        let oldTx = null;

        if (isUpdate) {
            oldTx = nativeDb.prepare('SELECT * FROM transactions WHERE id = ?').get(req.params.id);
            if (!oldTx) {
                return res.status(404).json({ error: 'Transaction not found' });
            }
            if (oldTx.category === 'transfer' || (req.body.category && req.body.category === 'transfer')) {
                return res.status(400).json({ error: 'Double-Entry Accounting Error: Cannot edit transfer transactions directly. Please delete the transfer and create a new one to maintain ledger integrity.' });
            }
        }

        const data = req.body;
        
        const title = data.title !== undefined ? data.title : (oldTx?.title);
        const amount = data.amount !== undefined ? data.amount : (oldTx?.amount);
        const date = data.date !== undefined ? data.date : (oldTx?.date);
        const category = data.category !== undefined ? data.category : (oldTx?.category);
        const type = data.type !== undefined ? data.type : (oldTx?.type);
        const isTaxDeductible = data.isTaxDeductible !== undefined ? data.isTaxDeductible : (oldTx?.isTaxDeductible);
        
        // Handle source_bank_id and joint_bank_id nulling explicitly
        let source_bank_id = data.source_bank_id !== undefined ? data.source_bank_id : (oldTx?.source_bank_id);
        if (data.source_bank_id === null || data.source_bank_id === '') source_bank_id = null;
        
        let joint_bank_id = data.joint_bank_id !== undefined ? data.joint_bank_id : (oldTx?.joint_bank_id);
        if (data.joint_bank_id === null || data.joint_bank_id === '') joint_bank_id = null;

        const credit_card_id = data.credit_card_id !== undefined ? data.credit_card_id : (oldTx?.credit_card_id);
        const linked_loan_id = data.linked_loan_id !== undefined ? data.linked_loan_id : (oldTx?.linked_loan_id);
        const split_amount = data.split_amount !== undefined ? data.split_amount : (oldTx?.split_amount);

        const receiptUrl = data.receiptUrl !== undefined ? data.receiptUrl : (oldTx?.receiptUrl);
        const sinking_fund_id = data.sinking_fund_id !== undefined ? data.sinking_fund_id : (oldTx?.sinking_fund_id);
        const investment_id = data.investment_id !== undefined ? data.investment_id : (oldTx?.investment_id);
        const propertyId = data.propertyId !== undefined ? data.propertyId : (oldTx?.propertyId);
        const fd_id = data.fd_id !== undefined ? data.fd_id : (oldTx?.fd_id);
        const gold_id = data.gold_id !== undefined ? data.gold_id : (oldTx?.gold_id);
        const nps_id = data.nps_id !== undefined ? data.nps_id : (oldTx?.nps_id);
        const insurance_id = data.insurance_id !== undefined ? data.insurance_id : (oldTx?.insurance_id);
        const subscription_id = data.subscription_id !== undefined ? data.subscription_id : (oldTx?.subscription_id);
        const family_member_id = data.family_member_id !== undefined ? data.family_member_id : (oldTx?.family_member_id);

        if (category === 'opening_balance' && !credit_card_id && !source_bank_id) {
            return res.status(400).json({ error: "Opening balances must be associated with a valid bank or credit card." });
        }
        if (!isUpdate && joint_bank_id && split_amount === undefined) {
             return res.status(400).json({ error: "A valid split amount is required when specifying a joint bank account." });
        }

        const validTitle = validateTitle(title);
        const validAmount = validateAmount(amount);
        const validDate = validateDate(date);
        const validType = ['income', 'expense'].includes(type) ? type : null;

        const VALID_CATEGORIES = new Set(['regular', 'irregular', 'loan', 'cc_repayment', 'sinking_fund', 'investment', 'fd_investment', 'gold_investment', 'nps_investment', 'maintenance', 'insurance', 'subscription', 'salary', 'rental', 'dividend', 'capital_retrieval', 'capital_deployment', 'realized_ltcg', 'realized_stcg', 'realized_stcg_debt', 'realized_ltcl', 'realized_stcl', 'dividend_income', 'other', 'opening_balance', 'loan_payment', 'transfer']);
        let validCategory = (category && typeof category === 'string' && category.trim().length > 0) ? category.trim().substring(0, 50) : 'regular';

        if (validType === 'expense' && ['salary', 'rental', 'capital_retrieval', 'realized_ltcg', 'realized_stcg', 'realized_stcg_debt', 'dividend', 'other'].includes(validCategory)) {
            return res.status(400).json({ error: "Double-Entry Accounting Error: Category not allowed for expense type." });
        }
        if (validType === 'income' && ['regular', 'irregular', 'cc_repayment', 'sinking_fund', 'investment', 'fd_investment', 'gold_investment', 'nps_investment', 'maintenance', 'insurance', 'subscription', 'loan_payment'].includes(validCategory)) {
            return res.status(400).json({ error: "Double-Entry Accounting Error: Category not allowed for income type." });
        }

        if (!VALID_CATEGORIES.has(validCategory)) {
            const isBudget = nativeDb.prepare('SELECT category FROM budgets WHERE LOWER(category) = ?').get(validCategory.toLowerCase());
            if (!isBudget) {
                return res.status(400).json({ error: "Invalid category." });
            }
        }

        if (!isUpdate && validCategory === 'transfer') {
            return res.status(400).json({ error: "Double-Entry Accounting Error: Use /api/transfer for internal transfers." });
        }

        if (!validTitle || validAmount === null || !validDate || !validType) {
            return res.status(400).json({ error: 'Invalid input for transaction creation/update.' });
        }

        const s_bank = validateFk(source_bank_id);
        const j_bank = validateFk(joint_bank_id);
        const l_loan = validateFk(linked_loan_id);
        const c_card = validateFk(credit_card_id);
        const s_fund = validateFk(sinking_fund_id);
        const i_inv = validateFk(investment_id);
        const p_prop = validateFk(propertyId);
        const f_fd = validateFk(fd_id);
        const g_gold = validateFk(gold_id);
        const n_nps = validateFk(nps_id);
        const i_ins = validateFk(insurance_id);
        const s_sub = validateFk(subscription_id);
        const f_fam = validateFk(family_member_id);

        if (s_bank && j_bank && s_bank === j_bank) {
            return res.status(400).json({ error: 'Double-Entry Accounting Error: A transaction cannot originate and terminate at the identical banking institution.' });
        }

        if (validCategory !== 'opening_balance' && !s_bank && !c_card) {
            return res.status(400).json({ error: 'Double-Entry Accounting Error: A source bank account or credit card is strictly required.' });
        }
        
        if (validCategory !== 'cc_repayment' && validCategory !== 'opening_balance' && s_bank && c_card) {
            return res.status(400).json({ error: 'Double-Entry Accounting Error: Cannot specify both a bank account and a credit card.' });
        }
        if (validCategory === 'cc_repayment' && (!s_bank || !c_card)) {
            return res.status(400).json({ error: 'Double-Entry Accounting Error: cc_repayment requires both a source bank account and a credit card.' });
        }
        if ((validCategory === 'loan' || validCategory === 'loan_payment') && !l_loan) {
            return res.status(400).json({ error: 'Double-Entry Accounting Error: loan transactions require a linked_loan_id.' });
        }

        if (!isUpdate) {
            const isAssetTransfer = ['capital_deployment', 'capital_retrieval', 'investment', 'fd_investment', 'gold_investment', 'nps_investment', 'sinking_fund'].includes(validCategory);
            if (isAssetTransfer) {
                let hasValidId = false;
                let assetCount = 0;
                if (validCategory === 'investment' && i_inv) { hasValidId = true; assetCount++; }
                if (validCategory === 'fd_investment' && f_fd) { hasValidId = true; assetCount++; }
                if (validCategory === 'gold_investment' && g_gold) { hasValidId = true; assetCount++; }
                if (validCategory === 'nps_investment' && n_nps) { hasValidId = true; assetCount++; }
                if (validCategory === 'sinking_fund' && s_fund) { hasValidId = true; assetCount++; }
                if ((validCategory === 'capital_deployment' || validCategory === 'capital_retrieval') && (f_fd || n_nps || p_prop || g_gold || i_inv || s_fund || f_fam)) {
                    hasValidId = true;
                    assetCount = [i_inv, f_fd, g_gold, n_nps, s_fund, p_prop, f_fam].filter(id => id !== null).length;
                }
                
                if (!hasValidId) {
                    return res.status(400).json({ error: 'Double-Entry Accounting Error: Asset transfers require a valid asset ID matching the category.' });
                }
                if (assetCount !== 1) {
                    return res.status(400).json({ error: 'Double-Entry Accounting Error: A single transaction can only be linked to exactly ONE destination asset to prevent multi-asset inflation.' });
                }
            }
        }

        if (c_card && j_bank && validCategory !== 'cc_repayment') {
            return res.status(400).json({ error: 'Double-Entry Accounting Error: Cannot split a credit card transaction with a joint bank account.' });
        }

        let safeSplitAmount = null;
        let safeSplitPercent = 100.0;
        if (split_amount !== undefined && split_amount !== null && split_amount !== '') {
            safeSplitAmount = validateAmount(split_amount, isUpdate);
            if (safeSplitAmount === null || parseToPaiseBigInt(safeSplitAmount) < 0n || parseToPaiseBigInt(safeSplitAmount) > parseToPaiseBigInt(validAmount)) {
                 return res.status(400).json({ error: 'Split amount must be a valid number between 0 and total amount.' });
            }
            const splitBig = parseToPaiseBigInt(safeSplitAmount);
            const totalBig = parseToPaiseBigInt(validAmount);
            if (totalBig > 0n) {
                safeSplitPercent = Number((splitBig * 1000000n) / totalBig) / 10000;
            }
        }

        const taxDed = (isTaxDeductible === true || isTaxDeductible === 1 || isTaxDeductible === '1' || isTaxDeductible === 'true') ? 1 : 0;
        const recUrl = validateReceiptUrl(receiptUrl);
        
        req.validatedData = {
            validTitle, validAmount, validDate, validCategory, validType, taxDed, recUrl,
            s_bank, j_bank, safeSplitPercent, safeSplitAmount, l_loan, c_card, s_fund, i_inv, 
            p_prop, f_fd, g_gold, n_nps, i_ins, s_sub, f_fam, oldTx
        };

        next();
    } catch (err) {
        next(err);
    }
}

module.exports = validateTransaction;
