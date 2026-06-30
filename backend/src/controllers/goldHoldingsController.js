const { validateAmount, parseToPaiseBigInt, validateDate, validateTitle, getLocalYYYYMMDD } = require('../utils/financialUtils');
const goldService = require('../services/goldService');
const YahooFinance = require('yahoo-finance2').default;
const yahooFinance = new YahooFinance();

exports.getPortfolio = (req, res, next) => {
    try {
        const data = goldService.getGoldPortfolio();
        res.json(data);
    } catch (err) {
        next(err);
    }
};

exports.syncPrice = async (req, res, next) => {
    try {
        const fetchQuote = (symbol) => Promise.race([
            yahooFinance.quote(symbol),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Yahoo API Timeout')), 5000))
        ]);

        const [goldQuote, fxQuote] = await Promise.all([
            fetchQuote('GC=F'),
            fetchQuote('INR=X')
        ]);
        
        const usdPerOz = goldQuote.regularMarketPrice;
        const inrPerUsd = fxQuote.regularMarketPrice;
        const inrPerGram = (usdPerOz * inrPerUsd) / 31.1035;
        const livePrice = Math.round(inrPerGram * 100) / 100;
        
        const updatedRows = goldService.updateGoldPrice(livePrice);
        
        res.json({ 
            success: true, 
            livePrice, 
            usdPerOz: Math.round(usdPerOz * 100) / 100,
            inrPerUsd: Math.round(inrPerUsd * 100) / 100,
            updatedRows: updatedRows || 0,
            syncedAt: new Date().toISOString()
        });
    } catch (err) {
        next(err);
    }
};

exports.create = (req, res, next) => {
    let { type, title, weightGrams, purchasePricePerGram, currentPricePerGram, purchaseDate, interestRate, maturityDate, owner_member_id, joint_owner_member_id, owner_split_percent, isHistorical, source_bank_id, joint_bank_id, split_amount } = req.body;
    purchasePricePerGram = validateAmount(purchasePricePerGram, true) || '0.00';
    currentPricePerGram = currentPricePerGram ? (validateAmount(currentPricePerGram, true) || '0.00') : purchasePricePerGram;
    weightGrams = parseFloat(weightGrams) || 0;
    interestRate = parseFloat(interestRate) || 0;
    const safeTitle = validateTitle(title);
    if (!safeTitle) return res.status(400).json({ error: 'Valid title is required.' });

    split_amount = validateAmount(split_amount) || '0.00';

    const safePurchaseDate = validateDate(purchaseDate) || getLocalYYYYMMDD();
    const safeMaturityDate = validateDate(maturityDate) || null;

    const safePurchasePrice = validateAmount(purchasePricePerGram) || '0.00';
    const safeCurrentPrice = validateAmount(currentPricePerGram) || safePurchasePrice;

    const rawSplit = parseFloat(owner_split_percent);
    const safeSplitPercent = (!isNaN(rawSplit) && rawSplit >= 0 && rawSplit <= 100) ? rawSplit : 100;

    const investedAmt = (parseFloat(weightGrams || 0) * parseFloat(safePurchasePrice)).toFixed(2);
    if (split_amount && parseToPaiseBigInt(split_amount) > parseToPaiseBigInt(investedAmt)) {
        return res.status(400).json({ error: 'Double-Entry Accounting Error: Split amount cannot exceed total invested amount.' });
    }

    try {
        if (!isHistorical && !source_bank_id && !joint_bank_id) {
            return res.status(400).json({ error: "Source Bank Account is required for non-historical deployments" });
        }

        const newId = goldService.createGoldHolding({
            type, safeTitle, weightGrams, safePurchasePrice, safeCurrentPrice, safePurchaseDate, 
            interestRate, safeMaturityDate, owner_member_id, joint_owner_member_id, safeSplitPercent, 
            isHistorical, source_bank_id, joint_bank_id, split_amount
        });

        res.json({ success: true, id: newId });
    } catch (err) {
        next(err);
    }
};

exports.remove = (req, res, next) => {
    const id = req.params.id;
    try {
        goldService.removeGoldHolding(id);
        res.json({ success: true });
    } catch (err) {
        if (err.message.startsWith('Cannot delete')) {
            return res.status(400).json({ error: err.message });
        }
        next(err);
    }
};
