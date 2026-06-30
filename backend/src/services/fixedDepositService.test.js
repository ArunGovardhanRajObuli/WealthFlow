const { nativeDb } = require('../../database');
const fixedDepositService = require('./fixedDepositService');

describe('Fixed Deposit Service', () => {
const { insertTxWithLedger, decorateTx, getTx } = require('../utils/testHelpers');

    beforeAll(() => {
        // Clear all relevant tables before running any tests
        nativeDb.prepare('DELETE FROM fixed_deposits').run();
        nativeDb.prepare('DELETE FROM transactions').run();
        nativeDb.prepare('DELETE FROM ledger_lines').run();
        nativeDb.prepare('DELETE FROM nominees').run();
        nativeDb.prepare('DELETE FROM bank_balances').run();
    });

    afterEach(() => {
        // Clean up after each test
        nativeDb.prepare('DELETE FROM fixed_deposits').run();
        nativeDb.prepare('DELETE FROM transactions').run();
        nativeDb.prepare('DELETE FROM ledger_lines').run();
        nativeDb.prepare('DELETE FROM nominees').run();
        nativeDb.prepare('DELETE FROM bank_balances').run();
    });

    describe('getAllFixedDeposits', () => {
        it('should return an empty array when no fixed deposits exist', () => {
            const result = fixedDepositService.getAllFixedDeposits();
            expect(result).toEqual([]);
        });

        it('should return all fixed deposits ordered by maturityDate ASC', () => {
            nativeDb.prepare(`
                INSERT INTO fixed_deposits (bankName, principal, interestRate, tenureMonths, startDate, maturityDate)
                VALUES 
                ('Bank A', 1000, 5, 12, '2023-01-01', '2024-01-01'),
                ('Bank B', 2000, 6, 24, '2023-01-01', '2025-01-01'),
                ('Bank C', 3000, 7, 6, '2023-06-01', '2023-12-01')
            `).run();

            const result = fixedDepositService.getAllFixedDeposits();
            expect(result.length).toBe(3);
            expect(result[0].bankName).toBe('Bank C'); // maturity 2023-12-01
            expect(result[1].bankName).toBe('Bank A'); // maturity 2024-01-01
            expect(result[2].bankName).toBe('Bank B'); // maturity 2025-01-01
        });
    });

    describe('createFixedDeposit', () => {
        beforeEach(() => {
            nativeDb.prepare("INSERT INTO bank_balances (id, bankName, balance) VALUES (1, 'Source Bank', 10000)").run();
        });

        it('should create a new fixed deposit with transaction and sync balances for historical = false', () => {
            const fdData = {
                safeBankName: 'Test Bank',
                principal: 5000,
                interestRate: 6.5,
                safeTenure: 12,
                safeStartDate: '2023-01-01',
                safeMaturityDate: '2024-01-01',
                isAutoRenew: 1,
                isTaxSaver: 0,
                safeOwnerId: 1,
                safeJointOwnerId: null,
                safeSplitPercent: 100,
                safeSourceBankId: 1,
                isHistorical: false
            };

            const fdId = fixedDepositService.createFixedDeposit(fdData);

            expect(fdId).toBeDefined();

            // Verify FD created
            const fd = nativeDb.prepare('SELECT * FROM fixed_deposits WHERE id = ?').get(fdId);
            expect(fd.bankName).toBe('Test Bank');
            expect(fd.principal).toBe(5000); // 0 initially, updated by syncAssetBalances
            expect(fd.interestRate).toBe(6.5);
            expect(fd.tenureMonths).toBe(12);

            // Verify transaction created
            const txs = nativeDb.prepare('SELECT * FROM transactions WHERE fd_id = ?').all(fdId).map(decorateTx);
            expect(txs.length).toBe(1);
            expect(txs[0].title).toBe('Capital -> FD Test Bank');
            expect(txs[0].amount).toBe(5000);
            expect(txs[0].category).toBe('capital_deployment');
            expect(txs[0].type).toBe('transfer');
            expect(txs[0].source_bank_id).toBe(1);

            // Verify bank balance updated
            const bank = nativeDb.prepare('SELECT * FROM bank_balances WHERE id = 1').get();
            expect(bank.balance).toBe(5000); // 10000 - 5000
            
            // Verify ledger lines created
            const ledgers = nativeDb.prepare('SELECT * FROM ledger_lines WHERE transaction_id = ?').all(txs[0].id);
            expect(ledgers.length).toBeGreaterThan(0);
        });

        it('should create a new fixed deposit with transaction and sync balances for historical = true', () => {
            const fdData = {
                safeBankName: 'Historical Bank',
                principal: 3000,
                interestRate: 7.0,
                safeTenure: 24,
                safeStartDate: '2022-01-01',
                safeMaturityDate: '2024-01-01',
                isAutoRenew: 0,
                isTaxSaver: 1,
                safeOwnerId: 2,
                safeJointOwnerId: null,
                safeSplitPercent: 100,
                safeSourceBankId: null,
                isHistorical: true
            };

            const fdId = fixedDepositService.createFixedDeposit(fdData);

            // Verify FD created
            const fd = nativeDb.prepare('SELECT * FROM fixed_deposits WHERE id = ?').get(fdId);
            expect(fd.bankName).toBe('Historical Bank');
            expect(fd.principal).toBe(3000); // Updated by syncAssetBalances
            expect(fd.isTaxSaver).toBe(1);

            // Verify transaction created
            const txs = nativeDb.prepare('SELECT * FROM transactions WHERE fd_id = ?').all(fdId).map(decorateTx);
            expect(txs.length).toBe(1);
            expect(txs[0].title).toBe('Opening Balance: FD Historical Bank');
            expect(txs[0].amount).toBe(3000);
            expect(txs[0].category).toBe('opening_balance');
            expect(txs[0].type).toBe('income');
            expect(txs[0].source_bank_id).toBeNull();
        });

        it('should create a fixed deposit without transactions if principal is 0', () => {
            const fdData = {
                safeBankName: 'Zero Bank',
                principal: 0,
                interestRate: 5.0,
                safeTenure: 6,
                safeStartDate: '2023-01-01',
                safeMaturityDate: '2023-07-01',
                isAutoRenew: 0,
                isTaxSaver: 0,
                safeOwnerId: null,
                safeJointOwnerId: null,
                safeSplitPercent: 100,
                safeSourceBankId: null,
                isHistorical: false
            };

            const fdId = fixedDepositService.createFixedDeposit(fdData);

            const fd = nativeDb.prepare('SELECT * FROM fixed_deposits WHERE id = ?').get(fdId);
            expect(fd.principal).toBe(0);

            const txs = nativeDb.prepare('SELECT * FROM transactions WHERE fd_id = ?').all(fdId).map(decorateTx);
            expect(txs.length).toBe(0);
        });

        it('should handle floating point numbers for principal and interestRate', () => {
            const fdId = fixedDepositService.createFixedDeposit({
                safeBankName: 'Float Bank',
                principal: 1234.56,
                interestRate: 6.75,
                safeTenure: 12,
                safeStartDate: '2023-01-01',
                safeMaturityDate: '2024-01-01',
                isAutoRenew: 0,
                isTaxSaver: 0,
                safeOwnerId: null,
                safeJointOwnerId: null,
                safeSplitPercent: 100,
                safeSourceBankId: null,
                isHistorical: false
            });

            const fd = nativeDb.prepare('SELECT * FROM fixed_deposits WHERE id = ?').get(fdId);
            expect(fd.principal).toBe(1234.56);
            expect(fd.interestRate).toBe(6.75);
        });

        it('should default to 0 principal if principal is not provided or empty', () => {
            const fdId = fixedDepositService.createFixedDeposit({
                safeBankName: 'Empty Bank',
                principal: '',
                interestRate: 6.75,
                safeTenure: 12,
                safeStartDate: '2023-01-01',
                safeMaturityDate: '2024-01-01',
                isAutoRenew: 0,
                isTaxSaver: 0,
                safeOwnerId: null,
                safeJointOwnerId: null,
                safeSplitPercent: 100,
                safeSourceBankId: null,
                isHistorical: false
            });

            const fd = nativeDb.prepare('SELECT * FROM fixed_deposits WHERE id = ?').get(fdId);
            expect(fd.principal).toBe(0);
        });
    });

    describe('removeFixedDeposit', () => {
        it('should throw an error if transactions are linked to the FD', () => {
            // First create an FD with transactions
            const fdId = fixedDepositService.createFixedDeposit({
                safeBankName: 'Test Bank',
                principal: 5000,
                interestRate: 6.5,
                safeTenure: 12,
                safeStartDate: '2023-01-01',
                safeMaturityDate: '2024-01-01',
                isAutoRenew: 1,
                isTaxSaver: 0,
                safeOwnerId: 1,
                safeJointOwnerId: null,
                safeSplitPercent: 100,
                safeSourceBankId: 1,
                isHistorical: false
            });

            expect(() => {
                fixedDepositService.removeFixedDeposit(fdId);
            }).toThrow(/Cannot delete: 1 transaction\(s\) are linked to this entity/);
        });

        it('should remove the fixed deposit and its nominees if no transactions exist', () => {
            // Create an FD with 0 principal so no transactions are linked
            const fdId = fixedDepositService.createFixedDeposit({
                safeBankName: 'Zero Bank',
                principal: 0,
                interestRate: 5.0,
                safeTenure: 6,
                safeStartDate: '2023-01-01',
                safeMaturityDate: '2023-07-01',
                isAutoRenew: 0,
                isTaxSaver: 0,
                safeOwnerId: null,
                safeJointOwnerId: null,
                safeSplitPercent: 100,
                safeSourceBankId: null,
                isHistorical: false
            });

            // Insert a dummy nominee
            nativeDb.prepare('INSERT INTO nominees (assetType, assetId, name) VALUES (?, ?, ?)').run('Fixed Deposit', fdId, 'John Doe');

            fixedDepositService.removeFixedDeposit(fdId);

            const fd = nativeDb.prepare('SELECT * FROM fixed_deposits WHERE id = ?').get(fdId);
            expect(fd).toBeUndefined();

            const nominees = nativeDb.prepare('SELECT * FROM nominees WHERE assetType = \'Fixed Deposit\' AND assetId = ?').all(fdId);
            expect(nominees.length).toBe(0);
        });
        
        it('should remove the fixed deposit if manually unlinked transactions', () => {
            nativeDb.prepare(`
                INSERT INTO fixed_deposits (id, bankName, principal, interestRate, tenureMonths, startDate, maturityDate)
                VALUES (99, 'Manual Bank', 0, 5, 12, '2023-01-01', '2024-01-01')
            `).run();

            fixedDepositService.removeFixedDeposit(99);

            const fd = nativeDb.prepare('SELECT * FROM fixed_deposits WHERE id = ?').get(99);
            expect(fd).toBeUndefined();
        });

        it('should not throw when removing a non-existent FD', () => {
            expect(() => {
                fixedDepositService.removeFixedDeposit(9999);
            }).not.toThrow();
        });
    });
});
