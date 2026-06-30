const fs = require('fs');
const path = require('path');
const { nativeDb } = require('../../database');
const { validateTitle } = require('../utils/financialUtils');

exports.getDocuments = () => {
    const docs = nativeDb.prepare(`
        SELECT d.*, 
               f.name as family_member_name,
               CASE 
                   WHEN d.assetId IS NOT NULL AND d.assetType IS NOT NULL THEN (
                       SELECT description FROM (
                           SELECT id, title as description, 'Insurance' as t FROM reminders WHERE policyType IS NOT NULL
                           UNION ALL SELECT id, title as description, 'Property' as t FROM real_estate
                           UNION ALL SELECT id, bankName as description, 'Fixed Deposit' as t FROM fixed_deposits
                           UNION ALL SELECT id, title as description, 'Investment' as t FROM investments
                           UNION ALL SELECT id, bankName as description, 'Bank Account' as t FROM bank_balances
                           UNION ALL SELECT id, pranNumber as description, 'NPS Account' as t FROM nps_accounts
                           UNION ALL SELECT id, title as description, 'Gold Holding' as t FROM gold_holdings
                           UNION ALL SELECT id, title as description, 'Sinking Fund' as t FROM sinking_funds
                           UNION ALL SELECT id, name as description, 'Family Member' as t FROM family_members
                       ) WHERE id = d.assetId AND t = d.assetType LIMIT 1
                   )
                   WHEN d.assetId IS NOT NULL THEN (SELECT description FROM (
                       SELECT id, title as description, 'insurance' as t FROM reminders WHERE policyType IS NOT NULL
                       UNION ALL SELECT id, title as description, 'property' as t FROM real_estate
                       UNION ALL SELECT id, bankName as description, 'bonds' as t FROM fixed_deposits
                       UNION ALL SELECT id, name as description, 'identity' as t FROM family_members
                   ) WHERE id = d.assetId LIMIT 1)
                   ELSE NULL
               END as asset_name
        FROM documents d
        LEFT JOIN family_members f ON d.familyMemberId = f.id
        ORDER BY d.uploadedAt DESC
    `).all();

    return docs.map(d => ({
        ...d,
        title: validateTitle(d.title) || 'Untitled Document',
        fileUrl: d.fileUrl && d.fileUrl.startsWith('/uploads/') && !d.fileUrl.includes('..') ? d.fileUrl : null
    }));
};

exports.createDocument = (documentData, file) => {
    if (!file) {
        throw new Error('No file uploaded');
    }
    
    let { title, category, expiryDate, familyMemberId, assetId, assetType } = documentData;
    
    // Validate inputs
    title = validateTitle(title) || 'Untitled Document';
    const validCategories = ['insurance', 'property', 'identity', 'bonds', 'tax', 'other'];
    category = validCategories.includes(category) ? category : 'other';
    
    const fileUrl = "/uploads/" + file.filename;
    
    familyMemberId = familyMemberId && familyMemberId !== 'null' ? parseInt(familyMemberId) : null;
    assetId = assetId && assetId !== 'null' ? parseInt(assetId) : null;
    assetType = assetType || null;
    if (familyMemberId !== null && (isNaN(familyMemberId) || familyMemberId < 1)) familyMemberId = null;
    if (assetId !== null && (isNaN(assetId) || assetId < 1)) assetId = null;
    
    const insertRes = nativeDb.prepare('INSERT INTO documents (title, category, expiryDate, fileUrl, familyMemberId, assetId, assetType) VALUES (?, ?, ?, ?, ?, ?, ?)').run(title, category, expiryDate || null, fileUrl, familyMemberId, assetId, assetType);
    return { id: insertRes.lastInsertRowid, title, category, expiryDate, fileUrl, familyMemberId, assetId, assetType };
};

exports.deleteDocument = (id) => {
    const doc = nativeDb.prepare('SELECT fileUrl FROM documents WHERE id = ?').get(id);
    if (doc && doc.fileUrl) {
        const filePath = path.join(__dirname, '../../', doc.fileUrl);
        const uploadsDir = path.resolve(__dirname, '../../uploads');
        if (filePath.startsWith(uploadsDir) && fs.existsSync(filePath)) {
            try {
                fs.unlinkSync(filePath);
            } catch (e) {
                console.error("Failed to delete physical document file:", e);
            }
        }
    }
    nativeDb.prepare('DELETE FROM documents WHERE id = ?').run(id);
    return true;
};
