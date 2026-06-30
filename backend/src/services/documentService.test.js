const fs = require('fs');
const path = require('path');
const { nativeDb } = require('../../database');
const documentService = require('./documentService');

jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  existsSync: jest.fn(),
  unlinkSync: jest.fn(),
}));

describe('documentService', () => {
const { insertTxWithLedger, decorateTx, getTx } = require('../utils/testHelpers');

    beforeAll(() => {
        // Clear all relevant tables
        nativeDb.prepare('DELETE FROM documents').run();
        nativeDb.prepare('DELETE FROM family_members').run();
        nativeDb.prepare('DELETE FROM reminders').run();
        nativeDb.prepare('DELETE FROM real_estate').run();
        nativeDb.prepare('DELETE FROM fixed_deposits').run();
    });

    afterEach(() => {
        nativeDb.prepare('DELETE FROM documents').run();
        nativeDb.prepare('DELETE FROM family_members').run();
        nativeDb.prepare('DELETE FROM reminders').run();
        nativeDb.prepare('DELETE FROM real_estate').run();
        nativeDb.prepare('DELETE FROM fixed_deposits').run();
        jest.clearAllMocks();
    });

    describe('getDocuments', () => {
        it('should return empty array if no documents', () => {
            const docs = documentService.getDocuments();
            expect(docs).toEqual([]);
        });

        it('should return documents with family member names and asset names', () => {
            // Insert family member
            const fmRes = nativeDb.prepare('INSERT INTO family_members (name, role, age) VALUES (?, ?, ?)')
                .run('John Doe', 'Husband', 30);
            const familyMemberId = fmRes.lastInsertRowid;

            // Insert real_estate asset
            const reRes = nativeDb.prepare('INSERT INTO real_estate (title, propertyType) VALUES (?, ?)')
                .run('Villa 1', 'Residential');
            const assetId = reRes.lastInsertRowid;

            // Insert document
            nativeDb.prepare('INSERT INTO documents (title, category, familyMemberId, assetId, fileUrl, expiryDate) VALUES (?, ?, ?, ?, ?, ?)')
                .run('House Deed', 'property', familyMemberId, assetId, '/uploads/house.pdf', '2030-01-01');

            const docs = documentService.getDocuments();
            expect(docs).toHaveLength(1);
            expect(docs[0].title).toBe('House Deed');
            expect(docs[0].family_member_name).toBe('John Doe');
            expect(docs[0].asset_name).toBe('Villa 1');
        });

        it('should fallback to other asset tables (bonds) if id matches', () => {
            const fdRes = nativeDb.prepare('INSERT INTO fixed_deposits (bankName, principal) VALUES (?, ?)')
                .run('Bank A', 1000);
            const assetId = fdRes.lastInsertRowid;

            nativeDb.prepare('INSERT INTO documents (title, category, assetId, fileUrl) VALUES (?, ?, ?, ?)')
                .run('FD Receipt', 'bonds', assetId, '/uploads/fd.pdf');

            const docs = documentService.getDocuments();
            expect(docs).toHaveLength(1);
            expect(docs[0].asset_name).toBe('Bank A');
        });
        
        it('should return null for asset_name if assetId does not exist', () => {
            nativeDb.prepare('INSERT INTO documents (title, category, assetId, fileUrl) VALUES (?, ?, ?, ?)')
                .run('Unknown Asset Doc', 'other', 9999, '/uploads/unknown.pdf');

            const docs = documentService.getDocuments();
            expect(docs).toHaveLength(1);
            expect(docs[0].asset_name).toBeNull();
        });
        
        it('should return null for asset_name if assetId is null', () => {
            nativeDb.prepare('INSERT INTO documents (title, category, assetId, fileUrl) VALUES (?, ?, ?, ?)')
                .run('No Asset Doc', 'other', null, '/uploads/no_asset.pdf');

            const docs = documentService.getDocuments();
            expect(docs).toHaveLength(1);
            expect(docs[0].asset_name).toBeNull();
        });
    });

    describe('createDocument', () => {
        it('should throw an error if no file is provided', () => {
            expect(() => {
                documentService.createDocument({ title: 'Test Doc' }, null);
            }).toThrow('No file uploaded');
        });

        it('should insert a document and return the record', () => {
            const documentData = {
                title: 'ID Card',
                category: 'identity',
                expiryDate: '2025-12-31',
                familyMemberId: '1',
                assetId: '2'
            };
            const file = { filename: 'idcard.jpg' };

            const result = documentService.createDocument(documentData, file);

            expect(result.id).toBeDefined();
            expect(result.title).toBe('ID Card');
            expect(result.category).toBe('identity');
            expect(result.expiryDate).toBe('2025-12-31');
            expect(result.fileUrl).toBe('/uploads/idcard.jpg');
            expect(result.familyMemberId).toBe(1);
            expect(result.assetId).toBe(2);

            // Verify db
            const dbDoc = nativeDb.prepare('SELECT * FROM documents WHERE id = ?').get(result.id);
            expect(dbDoc.title).toBe('ID Card');
        });

        it('should handle string "null" for familyMemberId and assetId', () => {
            const documentData = {
                title: 'Receipt',
                category: 'other',
                familyMemberId: 'null',
                assetId: 'null'
            };
            const file = { filename: 'receipt.pdf' };

            const result = documentService.createDocument(documentData, file);

            expect(result.familyMemberId).toBeNull();
            expect(result.assetId).toBeNull();
        });

        it('should handle undefined expiryDate', () => {
            const documentData = {
                title: 'Permanent Doc',
                category: 'other'
            };
            const file = { filename: 'doc.pdf' };

            const result = documentService.createDocument(documentData, file);

            expect(result.expiryDate).toBeUndefined();
            const dbDoc = nativeDb.prepare('SELECT * FROM documents WHERE id = ?').get(result.id);
            expect(dbDoc.expiryDate).toBeNull();
        });
    });

    describe('deleteDocument', () => {
        it('should delete document record and physical file if exists', () => {
            const insertRes = nativeDb.prepare('INSERT INTO documents (title, fileUrl) VALUES (?, ?)')
                .run('To Delete', '/uploads/delete_me.pdf');
            const docId = insertRes.lastInsertRowid;

            fs.existsSync.mockReturnValue(true);

            const result = documentService.deleteDocument(docId);

            expect(result).toBe(true);
            
            // Check fs calls
            expect(fs.existsSync).toHaveBeenCalledWith(expect.stringContaining('delete_me.pdf'));
            expect(fs.unlinkSync).toHaveBeenCalledWith(expect.stringContaining('delete_me.pdf'));

            // Check db
            const dbDoc = nativeDb.prepare('SELECT * FROM documents WHERE id = ?').get(docId);
            expect(dbDoc).toBeUndefined();
        });

        it('should delete document record but not throw if physical file does not exist', () => {
            const insertRes = nativeDb.prepare('INSERT INTO documents (title, fileUrl) VALUES (?, ?)')
                .run('No File Doc', '/uploads/missing.pdf');
            const docId = insertRes.lastInsertRowid;

            fs.existsSync.mockReturnValue(false);

            const result = documentService.deleteDocument(docId);

            expect(result).toBe(true);
            expect(fs.unlinkSync).not.toHaveBeenCalled();

            const dbDoc = nativeDb.prepare('SELECT * FROM documents WHERE id = ?').get(docId);
            expect(dbDoc).toBeUndefined();
        });

        it('should handle fs.unlinkSync error gracefully', () => {
            const insertRes = nativeDb.prepare('INSERT INTO documents (title, fileUrl) VALUES (?, ?)')
                .run('Error File Doc', '/uploads/error.pdf');
            const docId = insertRes.lastInsertRowid;

            fs.existsSync.mockReturnValue(true);
            fs.unlinkSync.mockImplementation(() => {
                throw new Error('Permission denied');
            });

            // Suppress console.error for this test to keep output clean
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

            const result = documentService.deleteDocument(docId);

            expect(result).toBe(true);
            expect(fs.unlinkSync).toHaveBeenCalled();
            expect(consoleSpy).toHaveBeenCalledWith("Failed to delete physical document file:", expect.any(Error));

            const dbDoc = nativeDb.prepare('SELECT * FROM documents WHERE id = ?').get(docId);
            expect(dbDoc).toBeUndefined();

            consoleSpy.mockRestore();
        });

        it('should do nothing gracefully if document id does not exist', () => {
            const result = documentService.deleteDocument(9999);
            expect(result).toBe(true);
            expect(fs.existsSync).not.toHaveBeenCalled();
        });
        
        it('should do nothing gracefully if document has no fileUrl', () => {
            const insertRes = nativeDb.prepare('INSERT INTO documents (title) VALUES (?)')
                .run('No URL Doc');
            const docId = insertRes.lastInsertRowid;

            const result = documentService.deleteDocument(docId);
            expect(result).toBe(true);
            expect(fs.existsSync).not.toHaveBeenCalled();
        });
    });
});
