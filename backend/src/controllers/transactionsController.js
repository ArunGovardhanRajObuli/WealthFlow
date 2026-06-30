const fs = require('fs');
const path = require('path');
const { fork } = require('child_process');
const { validateAmount, validateDate, validateFk, validateTitle } = require('../utils/financialUtils');
const transactionService = require('../services/transactionService');

exports.getAll = (req, res, next) => {
    try {
        const rawLimit = parseInt(req.query.limit, 10);
        const limit = Math.max(1, Math.min(!isNaN(rawLimit) ? rawLimit : 50, 1000));
        const offset = parseInt(req.query.offset, 10) || 0;
        const startDate = validateDate(req.query.startDate);
        const endDate = validateDate(req.query.endDate);
        const type = req.query.type;
        const category = req.query.category;
        const search = req.query.search;

        const rows = transactionService.getAllTransactions({ limit, offset, startDate, endDate, type, category, search });
        res.json({ data: rows });
    } catch (err) {
        next(err);
    }
};

exports.create = (req, res, next) => {
    try {
        const newTxId = transactionService.createTransaction(req.validatedData);
        res.json({ id: newTxId, success: true });
    } catch (err) {
        next(err);
    }
};

exports.update = (req, res, next) => {
    try {
        transactionService.updateTransaction(req.params.id, req.validatedData);
        res.json({ success: true });
    } catch (err) {
        next(err);
    }
};

exports.remove = (req, res, next) => {
    try {
        transactionService.removeTransaction(req.params.id);
        res.json({ success: true });
    } catch (err) {
        next(err);
    }
};

exports.scanBill = async (req, res, next) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
        const localPath = `/uploads/${req.file.filename}`;
        
        const text = await new Promise((resolve, reject) => {
            const workerProcess = fork(path.join(__dirname, '../utils/ocrWorker.js'));
            workerProcess.on('message', (msg) => {
                if (msg.success) resolve(msg.text);
                else reject(new Error(msg.error));
                workerProcess.kill();
            });
            workerProcess.on('error', (err) => {
                reject(err);
                workerProcess.kill();
            });
            workerProcess.send(req.file.path);
        });
        try { await fs.promises.unlink(req.file.path); } catch(e) {}
        
        let detectedAmount = 0;
        const _d = new Date();
        let detectedDate = _d.getFullYear() + '-' + String(_d.getMonth() + 1).padStart(2, '0') + '-' + String(_d.getDate()).padStart(2, '0');
        let detectedTitle = 'Scanned Bill';
        
        const lines = text.split('\n');
        for (let l of lines) {
            const lower = l.toLowerCase();
            if (lower.includes('total') || lower.includes('amount')) {
                const match = l.match(/\d+(\.\d{1,2})?/);
                if (match) detectedAmount = parseFloat(match[0]);
            }
            if (lower.includes('date')) {
                const match = l.match(/\d{2}\/\d{2}\/\d{4}/);
                if (match) detectedDate = match[0];
            }
            if (lower.includes('merchant') || lower.includes('store')) {
                detectedTitle = l.replace(/merchant|store|:/gi, '').trim() || detectedTitle;
            }
        }
        
        // Sanitize OCR output to prevent XSS
        const safeText = String(text).replace(/<[^>]*>?/gm, '').slice(0, 10000); 

        res.json({
            text: safeText,
            extracted: { 
                amount: validateAmount(detectedAmount) ? Number(validateAmount(detectedAmount)) : 0, 
                date: validateDate(detectedDate), 
                title: validateTitle(detectedTitle) || 'Scanned Bill'
            },
            receiptUrl: localPath
        });
    } catch (err) {
        next(err);
    }
};

exports.transfer = (req, res, next) => {
    try {
        const { amount, date, source_bank_id, target_bank_id } = req.body;
        const transferAmount = validateAmount(amount);
        const validDate = validateDate(date);
        const safeSrcBank = validateFk(source_bank_id);
        const safeTgtBank = validateFk(target_bank_id);
        
        if (!transferAmount || !validDate || !safeSrcBank || !safeTgtBank) {
            return res.status(400).json({ error: 'Invalid input for transfer.' });
        }
        if (safeSrcBank === safeTgtBank) {
            return res.status(400).json({ error: 'Source and target bank accounts must be different.' });
        }

        const ids = transactionService.createTransfer(transferAmount, validDate, source_bank_id, target_bank_id);
        res.json({ success: true, transactionIds: ids });
    } catch (err) {
        next(err);
    }
};

exports.importCsv = async (req, res, next) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
        
        const source_bank_id = validateFk(req.body.source_bank_id) || null;
        const credit_card_id = validateFk(req.body.credit_card_id) || null;
        
        const inserted = await transactionService.importCsvTransactions(req.file.path, source_bank_id, credit_card_id);
        res.json({ success: true, message: "Successfully imported " + inserted + " transactions." });
    } catch (err) {
        next(err);
    }
};
