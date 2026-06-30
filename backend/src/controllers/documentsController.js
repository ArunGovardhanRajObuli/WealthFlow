const documentService = require('../services/documentService');
const { validateTitle, validateDate, validateFk } = require('../utils/financialUtils');

exports.getDocuments = (req, res, next) => {
    try {
        const rows = documentService.getDocuments();
        res.json({ data: rows });
    } catch (err) {
        next(err);
    }
};

exports.createDocument = (req, res, next) => {
    try {
        const { title, category, expiryDate, familyMemberId, assetId, assetType } = req.body;
        const safeTitle = validateTitle(title) || 'Untitled Document';
        
        // Basic category allowlist
        const safeCategory = ['identity', 'financial', 'medical', 'property', 'insurance', 'other'].includes(category) ? category : 'other';
        
        const safeData = {
            title: safeTitle,
            category: safeCategory,
            expiryDate: validateDate(expiryDate) || null,
            familyMemberId: validateFk(familyMemberId),
            assetId: validateFk(assetId),
            assetType: typeof assetType === 'string' && assetType.length < 50 ? assetType : null
        };

        const result = documentService.createDocument(safeData, req.file);
        res.json(result);
    } catch (err) {
        if (err.message === 'No file uploaded') {
            return res.status(400).json({ error: err.message });
        }
        next(err);
    }
};

exports.deleteDocument = (req, res, next) => {
    try {
        documentService.deleteDocument(req.params.id);
        res.json({ success: true });
    } catch (err) {
        next(err);
    }
};
