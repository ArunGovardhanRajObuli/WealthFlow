const { nativeDb } = require('../../database');
const npsService = require('./npsService');
const ledgerService = require('./ledgerService');

// We don't mock the DB, but we may want to spy on ledgerService to verify it is called without actually updating other balances, 
// wait, the prompt says "Do NOT mock the database functions, we are using an in-memory real SQLite db." 
// Can I mock ledgerService.syncAssetBalances? Yes, or I can just let it run if it doesn't break. 
// Let's spy on it to prevent ledgerService from failing if accounts aren't perfectly set up, or just let it run since it updates real db.
// Actually, `syncAssetBalances` just reads the transaction and updates `bank_accounts` or `credit_cards` etc. If source_bank_id doesn't exist, it might do nothing or error. Let's provide a valid `source_bank_id` if needed, or mock the ledgerService.
// Let's create dummy bank accounts or just spy on `syncAssetBalances`.

describe('npsService', () => {
const { insertTxWithLedger, decorateTx, getTx } = require('../utils/testHelpers');

    beforeAll(() => {
        // Clear tables
        nativeDb.prepare('DELETE FROM nps_accounts').run();
        nativeDb.prepare('DELETE FROM transactions').run();
        nativeDb.prepare('DELETE FROM nominees').run();
    });

    afterEach(() => {
        // Clear tables after each test
        nativeDb.prepare('DELETE FROM nps_accounts').run();
        nativeDb.prepare('DELETE FROM transactions').run();
        nativeDb.prepare('DELETE FROM nominees').run();
        jest.restoreAllMocks();
    });

    describe('getAllNpsAccounts', () => {
        it('should return an empty array initially', () => {
            const accounts = npsService.getAllNpsAccounts();
            expect(accounts).toEqual([]);
        });

        it('should return inserted accounts ordered by id DESC', () => {
            nativeDb.prepare(`INSERT INTO nps_accounts (pranNumber, memberName, currentValue) VALUES (?, ?, ?)`).run('123', 'John', 100);
            nativeDb.prepare(`INSERT INTO nps_accounts (pranNumber, memberName, currentValue) VALUES (?, ?, ?)`).run('456', 'Jane', 200);

            const accounts = npsService.getAllNpsAccounts();
            expect(accounts).toHaveLength(2);
            expect(accounts[0].pranNumber).toBe('456'); // Inserted second
            expect(accounts[1].pranNumber).toBe('123'); // Inserted first
        });
    });

    describe('createNpsAccount', () => {
        it('should throw an error for non-historical account without bank IDs and currentValue > 0', () => {
            expect(() => {
                npsService.createNpsAccount(
                    '1234', 'John', 'Tier I', 5000, 5000, 1000, 500, 50, 30, 20, 
                    '2023-01-01', false, null, null, null, null, null, null
                );
            }).toThrow("Source Bank Account is required for non-historical NPS investments.");
        });

        it('should create a non-historical account successfully with source bank id', () => {
            const newId = npsService.createNpsAccount(
                '111', 'John', 'Tier I', 10000, 10000, 500, 500, 50, 30, 20,
                '2023-01-01', false, 1, null, 1, null, 100, 10000
            );

            expect(newId).toBeDefined();

            const accounts = nativeDb.prepare('SELECT * FROM nps_accounts WHERE id = ?').all(newId);
            expect(accounts).toHaveLength(1);
            expect(accounts[0].pranNumber).toBe('111');

            const txs = nativeDb.prepare('SELECT * FROM transactions WHERE nps_id = ?').all(newId).map(decorateTx);
            expect(txs).toHaveLength(1);
            expect(txs[0].title).toBe('Initial NPS Balance');
            expect(txs[0].amount).toBe(10000);
            expect(txs[0].type).toBe('expense');
            expect(txs[0].category).toBe('nps_investment');
            expect(txs[0].source_bank_id).toBe(1);
        });

        it('should create a historical account successfully without bank id', () => {
            const newId = npsService.createNpsAccount(
                '222', 'Jane', 'Tier II', 5000, 5000, 200, 0, 50, 25, 25,
                '2022-01-01', true, null, null, 1, null, 100, null
            );

            const accounts = nativeDb.prepare('SELECT * FROM nps_accounts WHERE id = ?').all(newId);
            expect(accounts[0].pranNumber).toBe('222');

            const txs = nativeDb.prepare('SELECT * FROM transactions WHERE nps_id = ?').all(newId).map(decorateTx);
            expect(txs).toHaveLength(1);
            expect(txs[0].title).toBe('Opening Balance: NPS');
            expect(txs[0].type).toBe('income');
            expect(txs[0].category).toBe('opening_balance');
        });

        it('should create an account without transactions if currentValue is 0', () => {
            const newId = npsService.createNpsAccount(
                '333', 'Bob', 'Tier I', 0, 0, 100, 100, 50, 30, 20,
                '2023-01-01', false, null, null, 1, null, 100, null
            );

            const txs = nativeDb.prepare('SELECT * FROM transactions WHERE nps_id = ?').all(newId).map(decorateTx);
            expect(txs).toHaveLength(0);
        });
    });

    describe('updateNpsAccount', () => {
        it('should update an existing account successfully', () => {
            const info = nativeDb.prepare(`INSERT INTO nps_accounts (pranNumber, memberName, tier) VALUES (?, ?, ?)`).run('123', 'John', 'Tier I');
            const id = info.lastInsertRowid;

            npsService.updateNpsAccount(
                id, '999', 'Johnny', 'Tier II', 5000, 100, 100, 60, 20, 20, '2023-01-01', 1, null, 100
            );

            const account = nativeDb.prepare('SELECT * FROM nps_accounts WHERE id = ?').get(id);
            expect(account.pranNumber).toBe('999');
            expect(account.memberName).toBe('Johnny');
            expect(account.tier).toBe('Tier II');
            expect(account.currentValue).toBe(5000);
            expect(account.equityPct).toBe(60);
        });
    });

    describe('deleteNpsAccount', () => {
        it('should throw an error if there are transactions linked', () => {
            const info = nativeDb.prepare(`INSERT INTO nps_accounts (pranNumber) VALUES (?)`).run('123');
            const id = info.lastInsertRowid;

            insertTxWithLedger('Test tx', 100, new Date().toISOString().split('T')[0], 'expense', 'operating', 'nps_id', [id]);

            expect(() => {
                npsService.deleteNpsAccount(id);
            }).toThrow('Cannot delete: 1 transaction(s) are linked to this entity. Delete them first to maintain ledger integrity.');
        });

        it('should delete account and nominees if no transactions are linked', () => {
            const info = nativeDb.prepare(`INSERT INTO nps_accounts (pranNumber) VALUES (?)`).run('123');
            const id = info.lastInsertRowid;

            nativeDb.prepare(`INSERT INTO nominees (assetType, assetId, name) VALUES (?, ?, ?)`).run('NPS Account', id, 'Wife');

            npsService.deleteNpsAccount(id);

            const account = nativeDb.prepare('SELECT * FROM nps_accounts WHERE id = ?').get(id);
            expect(account).toBeUndefined();

            const nominees = nativeDb.prepare('SELECT * FROM nominees WHERE assetType = ? AND assetId = ?').all('NPS Account', id);
            expect(nominees).toHaveLength(0);
        });
    });

    describe('getNpsProjections', () => {
        it('should return empty accounts and 0 total when no accounts exist', () => {
            const result = npsService.getNpsProjections(30, 60);
            expect(result.accounts).toEqual([]);
            expect(result.totalProjected).toBe(0);
        });

        it('should calculate projection properly with defaults and zero monthly contribution', () => {
            nativeDb.prepare(
                `INSERT INTO nps_accounts (currentValue, monthlyContribution, employerContribution, equityPct, corpBondPct, govtSecPct) 
                 VALUES (?, ?, ?, ?, ?, ?)`
            ).run(100000, 0, 0, 50, 30, 20);

            const result = npsService.getNpsProjections(50, 60); // 10 years
            
            // Expected return: 50% * 12% + 30% * 8% + 20% * 7% = 6% + 2.4% + 1.4% = 9.8% annual
            // Monthly rate = 9.8 / 12 = 0.816666%
            // FV = 100000 * (1 + 0.098/12)^(120)
            const r = 0.098 / 12;
            const expectedFutureVal = 100000 * Math.pow(1 + r, 120);

            expect(result.accounts).toHaveLength(1);
            expect(result.totalProjected).toBeCloseTo(expectedFutureVal, 2);
            expect(result.accounts[0].projectedValue).toBeCloseTo(expectedFutureVal, 2);
        });

        it('should calculate projection properly with monthly contributions', () => {
            nativeDb.prepare(
                `INSERT INTO nps_accounts (currentValue, monthlyContribution, employerContribution, equityPct, corpBondPct, govtSecPct) 
                 VALUES (?, ?, ?, ?, ?, ?)`
            ).run(10000, 1000, 1000, 50, 30, 20); // Total monthly = 2000

            const result = npsService.getNpsProjections(59, 60); // 1 year = 12 months

            const r = 0.098 / 12;
            const expectedBase = 10000 * Math.pow(1 + r, 12);
            const expectedContributions = 2000 * ((Math.pow(1 + r, 12) - 1) / r) * (1 + r);
            const expectedTotal = expectedBase + expectedContributions;

            expect(result.accounts).toHaveLength(1);
            expect(result.totalProjected).toBeCloseTo(expectedTotal, 2);
        });

        it('should handle zero percentages correctly (fall back to defaults)', () => {
            nativeDb.prepare(
                `INSERT INTO nps_accounts (currentValue, monthlyContribution, employerContribution, equityPct, corpBondPct, govtSecPct) 
                 VALUES (?, ?, ?, ?, ?, ?)`
            ).run(10000, 0, 0, 0, 0, 0);

            const result = npsService.getNpsProjections(59, 60); // 1 year

            const r = 0.098 / 12; // Falls back to 50, 30, 20
            const expectedBase = 10000 * Math.pow(1 + r, 12);

            expect(result.accounts).toHaveLength(1);
            expect(result.totalProjected).toBeCloseTo(expectedBase, 2);
        });

        it('should handle negative years (retAge <= curAge) by resulting in 0 months', () => {
            nativeDb.prepare(
                `INSERT INTO nps_accounts (currentValue, monthlyContribution) 
                 VALUES (?, ?)`
            ).run(10000, 1000);

            const result = npsService.getNpsProjections(65, 60); // 0 months

            expect(result.accounts).toHaveLength(1);
            expect(result.totalProjected).toBe(10000); // Only current value
            expect(result.accounts[0].projectedValue).toBe(10000);
        });

        it('should use default ages (30 and 60) if not provided', () => {
            nativeDb.prepare(
                `INSERT INTO nps_accounts (currentValue, monthlyContribution, employerContribution, equityPct, corpBondPct, govtSecPct) 
                 VALUES (?, ?, ?, ?, ?, ?)`
            ).run(10000, 0, 0, 50, 30, 20);

            const result = npsService.getNpsProjections(); // defaults 30, 60 => 30 years => 360 months
            const r = 0.098 / 12;
            const expectedFutureVal = 10000 * Math.pow(1 + r, 360);

            expect(result.accounts).toHaveLength(1);
            expect(result.totalProjected).toBeCloseTo(expectedFutureVal, 2);
        });
    });
});
