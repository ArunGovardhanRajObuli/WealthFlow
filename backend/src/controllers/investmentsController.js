const { validateAmount, parseToPaiseBigInt } = require('../utils/financialUtils');
const investmentService = require('../services/investmentService');
const YahooFinance = require('yahoo-finance2').default;
const yahooFinance = new YahooFinance();

exports.getAll = (req, res, next) => {
    try {
        const rows = investmentService.getAllInvestments();
        res.json({ data: rows });
    } catch (err) {
        next(err);
    }
};

exports.create = async (req, res, next) => {
    let { title, category, assetClass, currentAmount = '0', targetAmount = '0', roi = 0, dividendYield = 0, unrealizedGain = 0, schemeCode = null, latestNav = 0, isHistorical = false, manualUnits = null, owner_member_id = null, joint_owner_member_id = null, owner_split_percent = 100, source_bank_id = null, joint_bank_id = null, split_amount = null } = req.body;
    
    if (category === 'sip' || category === 'lumpsum') {
        const isDebt = /liquid|debt|gilt|bond|arbitrage|money market/i.test(title);
        assetClass = isDebt ? 'debt' : (assetClass || 'equity');
    }
    
    currentAmount = validateAmount(currentAmount, true) || '0.00'; 
    targetAmount = validateAmount(targetAmount, true) || '0.00'; 
    roi = parseFloat(roi) || 0; 
    dividendYield = parseFloat(dividendYield) || 0;
    unrealizedGain = validateAmount(unrealizedGain) || '0.00'; 
    latestNav = parseFloat(latestNav) || 0;
    const validatedSplitAmount = split_amount ? validateAmount(split_amount) : null;
    
    if (validatedSplitAmount && parseToPaiseBigInt(validatedSplitAmount) > parseToPaiseBigInt(currentAmount)) {
        return res.status(400).json({ error: 'Double-Entry Accounting Error: Split amount cannot exceed current amount.' });
    }
    
    if (category === 'stock' && schemeCode && (!isHistorical || latestNav === 0 || latestNav === 1)) {
        if (!/^[A-Z0-9.\-_]{1,20}$/i.test(schemeCode)) {
            return res.status(400).json({ error: 'Invalid scheme code format.' });
        }
        try {
            const quote = await Promise.race([
                yahooFinance.quote(schemeCode),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Yahoo API Timeout')), 5000))
            ]);
            if (quote && quote.regularMarketPrice > 0) {
                latestNav = quote.regularMarketPrice;
            }
        } catch (e) {
            console.error('Failed to fetch initial stock price:', e.message);
        }
    }

    let totalUnits = 0;
    if (isHistorical && manualUnits !== null) {
        totalUnits = parseFloat(manualUnits) || 0;
    } else {
        totalUnits = (latestNav > 0 && parseFloat(currentAmount) > 0) ? (parseFloat(currentAmount) / latestNav) : 0;
    }

    try {
        const newId = investmentService.createInvestment({
            title, category, assetClass, currentAmount, targetAmount, roi, dividendYield,
            unrealizedGain, schemeCode, latestNav, isHistorical, totalUnits,
            owner_member_id, joint_owner_member_id, owner_split_percent,
            source_bank_id, joint_bank_id, validatedSplitAmount
        });
        res.json({ id: newId });
    } catch (err) {
        next(err);
    }
};

exports.fund = (req, res, next) => {
    const amount = validateAmount(req.body.amount) || '0.00';
    const source_bank_id = req.body.source_bank_id || null;
    const joint_bank_id = req.body.joint_bank_id || null;
    const split_amount = req.body.split_amount ? validateAmount(req.body.split_amount) : null;
    const investId = req.params.id;
    
    try {
        if (parseFloat(amount) < 0) {
            throw new Error('Double-Entry Accounting Error: Capital retrieval must be executed via the /sell endpoint to preserve FIFO tax lots.');
        }

        const newUnits = investmentService.fundInvestment(investId, amount, source_bank_id, joint_bank_id, split_amount);
        res.json({ success: true, newUnits });
    } catch (err) {
        if (err.message === 'Not found') return res.status(404).json({ error: 'Not found' });
        next(err);
    }
};

exports.sell = (req, res, next) => {
    const unitsToSell = parseFloat(req.body.units);
    if (isNaN(unitsToSell) || unitsToSell <= 0) return res.status(400).json({ error: "Invalid units" });
    const source_bank_id = req.body.source_bank_id || null;
    const joint_bank_id = req.body.joint_bank_id || null;
    const investId = req.params.id;
    
    try {
        const { capitalRetrieved, realizedGain } = investmentService.sellInvestment(investId, unitsToSell, source_bank_id, joint_bank_id, validateAmount);
        res.json({ success: true, capitalRetrieved, realizedGain });
    } catch (err) {
        if (err.message === 'Not found') return res.status(404).json({ error: 'Not found' });
        if (err.message === 'Cannot sell more units than owned') return res.status(400).json({ error: 'Cannot sell more units than owned' });
        next(err);
    }
};

exports.remove = (req, res, next) => {
    const investId = req.params.id;
    try {
        investmentService.deleteInvestment(investId);
        res.json({ success: true, ledgerEntriesReversed: true });
    } catch (err) {
        if (err.message === 'Not found') return res.status(404).json({ error: 'Not found' });
        if (err.message.startsWith('Cannot delete')) return res.status(400).json({ error: err.message });
        next(err);
    }
};

exports.addDividend = (req, res, next) => {
    const amount = validateAmount(req.body.amount) || '0.00';
    const { date, target_bank_id, joint_bank_id, split_amount } = req.body;
    const validatedSplitAmount = split_amount ? validateAmount(split_amount) : '0.00';
    
    if (split_amount && parseToPaiseBigInt(validatedSplitAmount) > parseToPaiseBigInt(amount)) {
        return res.status(400).json({ error: 'Double-Entry Accounting Error: Split amount cannot exceed total dividend.' });
    }

    try {
        investmentService.addDividend(req.params.id, amount, date, target_bank_id, joint_bank_id, validatedSplitAmount);
        res.json({ success: true });
    } catch (err) {
        if (err.message === 'Not found') return res.status(404).json({ error: 'Investment not found' });
        next(err);
    }
};

// Global API
exports.amfiSearch = async (req, res, next) => {
    const q = req.query.q?.toLowerCase() || '';
    if (q.length < 3) return res.json({ data: [] });

    try {
        const response = await fetch('https://www.amfiindia.com/spages/NAVAll.txt');
        const text = await response.text();
        
        const lines = text.split('\n');
        const results = [];
        
        for (let line of lines) {
            if (!line || line.trim() === '' || line.includes('Scheme Code')) continue;
            
            const parts = line.split(';');
            if (parts.length >= 6) {
                const schemeName = parts[3];
                if (schemeName.toLowerCase().includes(q)) {
                    results.push({
                        schemeCode: parts[0],
                        name: schemeName,
                        nav: parseFloat(parts[4]) || 0,
                        date: parts[5].trim()
                    });
                }
            }
            if (results.length >= 20) break; // Limit UI payload
        }
        res.json({ data: results });
    } catch (err) {
        console.error('AMFI fetch error:', err);
        res.status(500).json({ error: 'Failed to fetch market data' });
    }
};

exports.syncMarket = async (req, res, next) => {
    try {
        const response = await fetch('https://www.amfiindia.com/spages/NAVAll.txt');
        const text = await response.text();
        const lines = text.split('\n');
        
        const navMap = new Map();
        for (let line of lines) {
            const parts = line.split(';');
            if (parts.length >= 5) navMap.set(parts[0], parseFloat(parts[4]) || 0);
        }

        const assets = investmentService.getInvestmentsWithSchemeCode();
        let updatedCount = 0;
        
        // AMFI updates
        for (let asset of assets) {
            if (asset.category === 'sip' && navMap.has(asset.schemeCode)) {
                const newNav = navMap.get(asset.schemeCode);
                if (newNav > 0) {
                    investmentService.updateInvestmentNav(newNav, asset.id);
                    updatedCount++;
                }
            }
        }

        // Async updates for Yahoo Finance (Parallelized)
        const stockAssets = assets.filter(asset => asset.category === 'stock' && /^[A-Z0-9.\-_]{1,20}$/i.test(asset.schemeCode));
        await Promise.allSettled(stockAssets.map(async (asset) => {
            try {
                const quote = await Promise.race([
                    yahooFinance.quote(asset.schemeCode),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000))
                ]);
                if (quote && quote.regularMarketPrice > 0) {
                    investmentService.updateInvestmentNav(quote.regularMarketPrice, asset.id);
                    updatedCount++;
                }
            } catch (e) {
                console.error(`Failed to fetch quote for ${asset.schemeCode}:`, e.message);
            }
        }));
        
        res.json({ success: true, updated: updatedCount });
    } catch (err) {
        next(err);
    }
};

exports.stocksSearch = async (req, res, next) => {
    const q = req.query.q?.trim() || '';
    if (!/^[A-Z0-9.\-_\s]{2,50}$/i.test(q)) return res.json({ data: [] });

    try {
        const results = await Promise.race([
            yahooFinance.search(q, { newsCount: 0, quotesCount: 10 }),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000))
        ]);
        const equities = results.quotes.filter(q => q.quoteType === 'EQUITY').map(q => ({
            schemeCode: q.symbol,
            name: q.shortname || q.longname || q.symbol,
            exchange: q.exchDisp || q.exchange
        }));
        res.json({ data: equities });
    } catch (err) {
        console.error('Yahoo Finance search error:', err.message);
        res.status(500).json({ error: 'Failed to search stock data' });
    }
};
