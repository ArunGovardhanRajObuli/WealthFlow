const { nativeDb } = require('../../database');
const {
    getAllSinkingFunds,
    createSinkingFund,
    updateSinkingFund,
    fundSinkingFund,
    removeSinkingFund
} = require('./sinkingFundService');

describe('Sinking Fund Service', () => {
const { insertTxWithLedger, decorateTx, getTx } = require('../utils/testHelpers');

    beforeAll(() => {
        // Clear relevant tables
        nativeDb.prepare('DELETE FROM sinking_funds').run();
        nativeDb.prepare('DELETE FROM transactions').run();
        nativeDb.prepare('DELETE FROM ledger_lines').run();
        nativeDb.prepare('DELETE FROM nominees').run();
    });

    afterEach(() => {
        nativeDb.prepare('DELETE FROM sinking_funds').run();
        nativeDb.prepare('DELETE FROM transactions').run();
        nativeDb.prepare('DELETE FROM ledger_lines').run();
        nativeDb.prepare('DELETE FROM nominees').run();
    });

    describe('createSinkingFund', () => {
        it('should create a new sinking fund successfully', () => {
            const payload = {
                safeTitle: 'Vacation Fund',
                targetAmount: '5000.00',
                currentAmount: '0.00',
                safeTargetDate: '2027-12-31',
                safeOwnerId: 1,
                safeJointOwnerId: null,
                split: 100,
                safeSourceBankId: null
            };

            const newId = createSinkingFund(payload);
            expect(newId).toBeDefined();

            const fund = nativeDb.prepare('SELECT * FROM sinking_funds WHERE id = ?').get(newId);
            expect(fund).toBeDefined();
            expect(fund.title).toBe('Vacation Fund');
            expect(fund.targetAmount).toBe(5000);
            expect(fund.currentAmount).toBe(0);
            expect(fund.targetDate).toBe('2027-12-31');
            expect(fund.owner_member_id).toBe(1);
            expect(fund.joint_owner_member_id).toBeNull();
            expect(fund.owner_split_percent).toBe(100);

            // currentAmount is 0, no transaction should be created
            const tx = decorateTx(nativeDb.prepare('SELECT * FROM transactions WHERE sinking_fund_id = ?').get(newId));
            expect(tx).toBeUndefined();
        });

        it('should create a sinking fund with initial current amount (no source bank)', () => {
            const payload = {
                safeTitle: 'Car Fund',
                targetAmount: '10000.00',
                currentAmount: '1000.00',
                safeTargetDate: '2025-01-01',
                safeOwnerId: 2,
                safeJointOwnerId: null,
                split: 100,
                safeSourceBankId: null
            };

            const newId = createSinkingFund(payload);
            const fund = nativeDb.prepare('SELECT * FROM sinking_funds WHERE id = ?').get(newId);
            expect(fund.title).toBe('Car Fund');

            // Should create a transaction
            const txs = nativeDb.prepare('SELECT * FROM transactions WHERE sinking_fund_id = ?').all(newId).map(decorateTx);
            expect(txs.length).toBe(1);
            expect(txs[0].title).toBe('Opening Balance: Car Fund');
            expect(txs[0].amount).toBe(1000);
            expect(txs[0].type).toBe('income');
            expect(txs[0].category).toBe('opening_balance');
            expect(txs[0].source_bank_id).toBeNull();
        });

        it('should create a sinking fund with initial current amount and source bank', () => {
            const payload = {
                safeTitle: 'House Fund',
                targetAmount: '50000.00',
                currentAmount: '2000.00',
                safeTargetDate: '2030-01-01',
                safeOwnerId: 3,
                safeJointOwnerId: 4,
                split: 50,
                safeSourceBankId: 99
            };

            const newId = createSinkingFund(payload);
            
            // Verify transaction
            const txs = nativeDb.prepare('SELECT * FROM transactions WHERE sinking_fund_id = ?').all(newId).map(decorateTx);
            expect(txs.length).toBe(1);
            expect(txs[0].title).toBe('Capital -> House Fund');
            expect(txs[0].amount).toBe(2000);
            expect(txs[0].type).toBe('transfer');
            expect(txs[0].category).toBe('capital_deployment');
            expect(txs[0].source_bank_id).toBe(99);
        });
    });

    describe('getAllSinkingFunds', () => {
        it('should return all sinking funds ordered by targetDate ASC', () => {
            // Insert dummy data
            nativeDb.prepare('INSERT INTO sinking_funds (title, targetAmount, targetDate) VALUES (?, ?, ?)').run('Fund B', 1000, '2025-12-31');
            nativeDb.prepare('INSERT INTO sinking_funds (title, targetAmount, targetDate) VALUES (?, ?, ?)').run('Fund A', 2000, '2024-01-01');

            const funds = getAllSinkingFunds();
            expect(funds.length).toBe(2);
            expect(funds[0].title).toBe('Fund A');
            expect(funds[1].title).toBe('Fund B');
        });

        it('should return an empty array when no sinking funds exist', () => {
            const funds = getAllSinkingFunds();
            expect(funds).toEqual([]);
        });
    });

    describe('updateSinkingFund', () => {
        it('should update an existing sinking fund', () => {
            const insertInfo = nativeDb.prepare('INSERT INTO sinking_funds (title, targetAmount, targetDate, owner_member_id) VALUES (?, ?, ?, ?)').run('Old Title', 1000, '2024-01-01', 1);
            const fundId = insertInfo.lastInsertRowid;

            updateSinkingFund(fundId, {
                safeTitle: 'New Title',
                targetAmount: '2000.00',
                safeTargetDate: '2025-01-01',
                safeOwnerId: 2,
                safeJointOwnerId: 3,
                split: 50
            });

            const updated = nativeDb.prepare('SELECT * FROM sinking_funds WHERE id = ?').get(fundId);
            expect(updated.title).toBe('New Title');
            expect(updated.targetAmount).toBe(2000);
            expect(updated.targetDate).toBe('2025-01-01');
            expect(updated.owner_member_id).toBe(2);
            expect(updated.joint_owner_member_id).toBe(3);
            expect(updated.owner_split_percent).toBe(50);
        });
    });

    describe('fundSinkingFund', () => {
        it('should throw an error if the fund does not exist', () => {
            expect(() => fundSinkingFund(999, '100.00', null)).toThrow("Fund not found");
        });

        it('should add capital (positive amount)', () => {
            const insertInfo = nativeDb.prepare('INSERT INTO sinking_funds (title, targetAmount, currentAmount) VALUES (?, ?, ?)').run('Test Fund', 1000, 0);
            const fundId = insertInfo.lastInsertRowid;

            fundSinkingFund(fundId, '500.00', 88);

            const txs = nativeDb.prepare('SELECT * FROM transactions WHERE sinking_fund_id = ?').all(fundId).map(decorateTx);
            expect(txs.length).toBe(1);
            expect(txs[0].title).toBe('Capital -> Test Fund');
            expect(txs[0].amount).toBe(500);
            expect(txs[0].type).toBe('transfer');
            expect(txs[0].category).toBe('capital_deployment');
            expect(txs[0].source_bank_id).toBe(88);
        });

        it('should retrieve capital (negative amount)', () => {
            const insertInfo = nativeDb.prepare('INSERT INTO sinking_funds (title, targetAmount, currentAmount) VALUES (?, ?, ?)').run('Ret Fund', 1000, 500);
            const fundId = insertInfo.lastInsertRowid;

            fundSinkingFund(fundId, '-200.00', 88);

            const txs = nativeDb.prepare('SELECT * FROM transactions WHERE sinking_fund_id = ?').all(fundId).map(decorateTx);
            expect(txs.length).toBe(1);
            expect(txs[0].title).toBe('Retrieval <- Ret Fund');
            expect(txs[0].amount).toBe(200); // formatBigIntToDecimalString removes negative
            expect(txs[0].type).toBe('income');
            expect(txs[0].category).toBe('capital_retrieval');
            expect(txs[0].source_bank_id).toBe(88);
        });

        it('should handle zero amount gracefully', () => {
            const insertInfo = nativeDb.prepare('INSERT INTO sinking_funds (title, targetAmount) VALUES (?, ?)').run('Zero Fund', 1000);
            const fundId = insertInfo.lastInsertRowid;

            fundSinkingFund(fundId, '0', null);

            const txs = nativeDb.prepare('SELECT * FROM transactions WHERE sinking_fund_id = ?').all(fundId).map(decorateTx);
            expect(txs.length).toBe(0);
        });
    });

    describe('removeSinkingFund', () => {
        it('should delete a sinking fund with no linked transactions and its nominees', () => {
            const insertInfo = nativeDb.prepare('INSERT INTO sinking_funds (title) VALUES (?)').run('To Delete');
            const fundId = insertInfo.lastInsertRowid;
            
            // Add a nominee
            nativeDb.prepare('INSERT INTO nominees (name, assetType, assetId) VALUES (?, ?, ?)').run('John Doe', 'Sinking Fund', fundId);

            removeSinkingFund(fundId);

            const fund = nativeDb.prepare('SELECT * FROM sinking_funds WHERE id = ?').get(fundId);
            expect(fund).toBeUndefined();

            const nominee = nativeDb.prepare("SELECT * FROM nominees WHERE assetType = 'Sinking Fund' AND assetId = ?").get(fundId);
            expect(nominee).toBeUndefined();
        });

        it('should throw an error if trying to delete a fund with linked transactions', () => {
            const insertInfo = nativeDb.prepare('INSERT INTO sinking_funds (title) VALUES (?)').run('Has Tx Fund');
            const fundId = insertInfo.lastInsertRowid;
            
            // Add a transaction
            nativeDb.prepare('INSERT INTO transactions (title, sinking_fund_id) VALUES (?, ?)').run('Tx', fundId);

            expect(() => removeSinkingFund(fundId)).toThrow(/Cannot delete: 1 transaction\(s\) are linked to this entity/);

            // Fund should still exist
            const fund = nativeDb.prepare('SELECT * FROM sinking_funds WHERE id = ?').get(fundId);
            expect(fund).toBeDefined();
        });

        it('should throw an error if fund does not exist', () => {
            expect(() => removeSinkingFund(999)).toThrow("Not found");
        });
    });
});
