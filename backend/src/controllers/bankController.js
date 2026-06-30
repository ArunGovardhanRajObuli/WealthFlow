const bankService = require('../services/bankService');
const transactionService = require('../services/transactionService');
const { validateTitle, validateAmount, validateDate, validateFk } = require('../utils/financialUtils');

exports.getBankBalances = (req, res, next) => {
    try {
        const enrichedBanks = bankService.getBankBalances();
        res.json({ data: enrichedBanks });
    } catch (err) {
        next(err);
    }
};

exports.createBankBalance = (req, res, next) => {
    try {
        const { bankName, balance, asOfDate, owner_member_id } = req.body;
        
        const safeName = validateTitle(bankName);
        const safeBalance = validateAmount(balance, true) || '0.00';
        
        // Default to today if asOfDate is not provided
        let safeDate = validateDate(asOfDate);
        if (!safeDate && !asOfDate) {
            safeDate = new Date().toISOString().split('T')[0];
        }

        const safeOwner = validateFk(owner_member_id);

        if (!safeName || !safeDate) {
            return res.status(400).json({ error: 'Valid bankName and asOfDate are required.' });
        }
        
        const id = bankService.createBankBalance(safeName, '0.00', safeDate, safeOwner);
        
        if (parseFloat(safeBalance) > 0) {
            transactionService.createTransaction({
                validTitle: 'Opening Balance',
                validAmount: safeBalance,
                validDate: safeDate,
                validCategory: 'opening_balance',
                validType: 'income',
                taxDed: 0,
                recUrl: null,
                s_bank: id,
                j_bank: null,
                safeSplitPercent: null,
                safeSplitAmount: null,
                l_loan: null,
                c_card: null,
                s_fund: null,
                i_inv: null,
                p_prop: null,
                f_fd: null,
                g_gold: null,
                n_nps: null,
                i_ins: null,
                s_sub: null,
                f_fam: null
            });
        }
        
        res.json({ id });
    } catch (err) {
        next(err);
    }
};

exports.deleteBankBalance = (req, res, next) => {
    try {
        bankService.deleteBankBalance(req.params.id);
        res.json({ success: true });
    } catch (err) {
        if (err.message.startsWith("Cannot delete")) {
            return res.status(400).json({ error: err.message });
        }
        next(err);
    }
};
