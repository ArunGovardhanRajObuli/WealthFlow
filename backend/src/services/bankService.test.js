const { nativeDb } = require('../../database');
const bankService = require('./bankService');

describe('Bank Service', () => {
const { insertTxWithLedger, decorateTx, getTx } = require('../utils/testHelpers');

    beforeAll(() => {
        // Clear tables just to be safe, though memory DB starts fresh if this is the only suite
        nativeDb.prepare('DELETE FROM bank_balances').run();
        nativeDb.prepare('DELETE FROM ledger_lines').run();
        nativeDb.prepare('DELETE FROM transactions').run();
    });

    afterEach(() => {
        nativeDb.prepare('DELETE FROM bank_balances').run();
        nativeDb.prepare('DELETE FROM ledger_lines').run();
        nativeDb.prepare('DELETE FROM transactions').run();
    });

    it('should create a bank balance', () => {
        const id = bankService.createBankBalance('Test Bank', 1000, '2025-01-01', null);
        expect(id).toBeDefined();

        const row = nativeDb.prepare('SELECT * FROM bank_balances WHERE id = ?').get(id);
        expect(row.bankName).toBe('Test Bank');
        expect(row.balance).toBe(1000);
    });

    it('should get all bank balances with ledger data', () => {
        const id = bankService.createBankBalance('HDFC', 5000, '2025-01-01', null);
        
        // Mock a ledger entry corresponding to this bank
        nativeDb.prepare(`
            INSERT INTO ledger_lines (account_class, account_type, entity_id, debit_amount, credit_amount) 
            VALUES ('Asset', 'bank', ?, 1000, 0)
        `).run(id);

        const banks = bankService.getBankBalances();
        expect(banks.length).toBe(1);
        expect(banks[0].bankName).toBe('HDFC');
        expect(banks[0].snapshotBalance).toBe(5000);
        expect(banks[0].ledgerBalance).toBe(1000);
    });

    it('should allow deletion if no transactions are linked', () => {
        const id = bankService.createBankBalance('SBI', 2000, '2025-01-01', null);
        
        expect(() => {
            bankService.deleteBankBalance(id);
        }).not.toThrow();

        const row = nativeDb.prepare('SELECT * FROM bank_balances WHERE id = ?').get(id);
        expect(row).toBeUndefined();
    });

    it('should prevent deletion if transactions are linked', () => {
        const id = bankService.createBankBalance('ICICI', 3000, '2025-01-01', null);
        
        // Mock a linked transaction
        insertTxWithLedger('Test Tx', 100, '2025-01-02', 'expense', 'other', ['source_bank_id'], [id]);

        expect(() => {
            bankService.deleteBankBalance(id);
        }).toThrow("Cannot delete bank account linked to existing transactions.");
    });
});
