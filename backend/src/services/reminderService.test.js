const { nativeDb } = require('../../database');
const reminderService = require('./reminderService');

describe('reminderService', () => {
const { insertTxWithLedger, decorateTx, getTx } = require('../utils/testHelpers');

    afterEach(() => {
        nativeDb.prepare('DELETE FROM reminders').run();
        nativeDb.prepare('DELETE FROM transactions').run();
        nativeDb.prepare('DELETE FROM ledger_lines').run();
    });

    describe('getAllReminders', () => {
        it('should return empty array if no reminders', () => {
            const reminders = reminderService.getAllReminders();
            expect(reminders).toEqual([]);
        });

        it('should return all reminders ordered by dueDate ASC', () => {
            const insert = nativeDb.prepare('INSERT INTO reminders (title, amount, dueDate, category) VALUES (?, ?, ?, ?)');
            insert.run('Reminder 2', 200, '2023-12-01', 'bill');
            insert.run('Reminder 1', 100, '2023-11-01', 'bill');

            const reminders = reminderService.getAllReminders();
            expect(reminders.length).toBe(2);
            expect(reminders[0].title).toBe('Reminder 1');
            expect(reminders[1].title).toBe('Reminder 2');
        });
    });

    describe('createReminder', () => {
        it('should create a basic reminder', () => {
            const id = reminderService.createReminder({
                safeTitle: 'Test Reminder',
                amount: 150.5,
                safeDueDate: '2023-10-15',
                safeCategory: 'subscription',
                termYears: 1,
                safeFrequency: 'monthly',
                principalAmount: 0,
                interestRate: 0,
                safeOwnerId: 1,
                safePolicyType: null,
                safeSourceBankId: null
            });

            const reminder = nativeDb.prepare('SELECT * FROM reminders WHERE id = ?').get(id);
            expect(reminder).toBeDefined();
            expect(reminder.title).toBe('Test Reminder');
            expect(reminder.amount).toBe(150.5);
            expect(reminder.dueDate).toBe('2023-10-15');
            expect(reminder.category).toBe('subscription');
            expect(reminder.termYears).toBe(1);
            expect(reminder.frequency).toBe('monthly');
        });

        it('should create a loan reminder with disbursement transaction when principalAmount > 0', () => {
            const id = reminderService.createReminder({
                safeTitle: 'Home Loan',
                amount: 1000,
                safeDueDate: '2023-11-01',
                safeCategory: 'loan',
                termYears: 30,
                safeFrequency: 'monthly',
                principalAmount: 500000,
                interestRate: 5.5,
                safeOwnerId: null,
                safePolicyType: null,
                safeSourceBankId: 2
            });

            const reminder = nativeDb.prepare('SELECT * FROM reminders WHERE id = ?').get(id);
            expect(reminder.category).toBe('loan');
            expect(reminder.principalAmount).toBe(500000);

            const tx = decorateTx(nativeDb.prepare('SELECT * FROM transactions WHERE linked_loan_id = ?').get(id));
            expect(tx).toBeDefined();
            expect(tx.title).toBe('Loan Disbursement: Home Loan');
            expect(tx.amount).toBe(500000);
            expect(tx.category).toBe('loan');
            expect(['expense', 'income', 'transfer']).toContain(tx.type);
            expect(tx.source_bank_id).toBe(2);
        });

        it('should not create a disbursement transaction for a loan with 0 principalAmount', () => {
            const id = reminderService.createReminder({
                safeTitle: 'Zero Loan',
                amount: 0,
                safeDueDate: '2023-11-01',
                safeCategory: 'loan',
                termYears: 1,
                safeFrequency: 'once',
                principalAmount: 0,
                interestRate: 0,
                safeOwnerId: null,
                safePolicyType: null,
                safeSourceBankId: null
            });

            const txCount = nativeDb.prepare('SELECT COUNT(*) as count FROM transactions WHERE linked_loan_id = ?').get(id).count;
            expect(txCount).toBe(0);
        });
    });

    describe('updateReminder', () => {
        let reminderId;

        beforeEach(() => {
            const info = nativeDb.prepare('INSERT INTO reminders (title, amount, dueDate, category, principalAmount, owner_member_id, policyType) VALUES (?, ?, ?, ?, ?, ?, ?)')
                .run('Old Title', 100, '2023-10-01', 'insurance', 0, 1, 'Life');
            reminderId = info.lastInsertRowid;
        });

        it('should update basic properties', () => {
            reminderService.updateReminder(reminderId, {
                safeTitle: 'New Title',
                amount: 200,
                safeDueDate: '2023-10-02',
                termYears: 5,
                safeFrequency: 'yearly',
                principalAmount: 0,
                interestRate: 0,
                safeOwnerId: 1,
                safePolicyType: 'Life'
            });

            const reminder = nativeDb.prepare('SELECT * FROM reminders WHERE id = ?').get(reminderId);
            expect(reminder.title).toBe('New Title');
            expect(reminder.amount).toBe(200);
            expect(reminder.dueDate).toBe('2023-10-02');
            expect(reminder.termYears).toBe(5);
            expect(reminder.frequency).toBe('yearly');
        });

        it('should throw error if modifying insurance policy type with existing transactions', () => {
            insertTxWithLedger('Prem', 100, '2023-10-01', 'expense', 'insurance', 'insurance_id', [reminderId]);

            expect(() => {
                reminderService.updateReminder(reminderId, {
                    safeTitle: 'Old Title',
                    amount: 100,
                    safeDueDate: '2023-10-01',
                    termYears: 0,
                    safeFrequency: 'yearly',
                    principalAmount: 0,
                    interestRate: 0,
                    safeOwnerId: 1,
                    safePolicyType: 'Health' // changed
                });
            }).toThrow('Cannot modify Policy Type, Owner, or Principal Amount (>0) on an Insurance policy with existing premium payments.');
        });

        it('should throw error if modifying insurance owner with existing transactions', () => {
            insertTxWithLedger('Prem', 100, '2023-10-01', 'expense', 'insurance', 'insurance_id', [reminderId]);

            expect(() => {
                reminderService.updateReminder(reminderId, {
                    safeTitle: 'Old Title',
                    amount: 100,
                    safeDueDate: '2023-10-01',
                    termYears: 0,
                    safeFrequency: 'yearly',
                    principalAmount: 0,
                    interestRate: 0,
                    safeOwnerId: 2, // changed
                    safePolicyType: 'Life'
                });
            }).toThrow('Cannot modify Policy Type, Owner, or Principal Amount (>0) on an Insurance policy with existing premium payments.');
        });

        it('should throw error if modifying insurance principal amount (>0) with existing transactions', () => {
            insertTxWithLedger('Prem', 100, '2023-10-01', 'expense', 'insurance', 'insurance_id', [reminderId]);

            expect(() => {
                reminderService.updateReminder(reminderId, {
                    safeTitle: 'Old Title',
                    amount: 100,
                    safeDueDate: '2023-10-01',
                    termYears: 0,
                    safeFrequency: 'yearly',
                    principalAmount: 1000, // changed to > 0
                    interestRate: 0,
                    safeOwnerId: 1,
                    safePolicyType: 'Life'
                });
            }).toThrow('Cannot modify Policy Type, Owner, or Principal Amount (>0) on an Insurance policy with existing premium payments.');
        });

        it('should allow modifying insurance properties if no existing transactions', () => {
            expect(() => {
                reminderService.updateReminder(reminderId, {
                    safeTitle: 'Old Title',
                    amount: 100,
                    safeDueDate: '2023-10-01',
                    termYears: 0,
                    safeFrequency: 'yearly',
                    principalAmount: 1000,
                    interestRate: 0,
                    safeOwnerId: 2,
                    safePolicyType: 'Health'
                });
            }).not.toThrow();

            const reminder = nativeDb.prepare('SELECT * FROM reminders WHERE id = ?').get(reminderId);
            expect(reminder.policyType).toBe('Health');
            expect(reminder.owner_member_id).toBe(2);
            expect(reminder.principalAmount).toBe(1000);
        });

        it('should update loan disbursement transaction if it exists', () => {
            const loanInfo = nativeDb.prepare("INSERT INTO reminders (title, amount, dueDate, category, principalAmount) VALUES ('Old Loan', 100, '2023-10-01', 'loan', 1000)").run();
            const loanId = loanInfo.lastInsertRowid;

            const txInfo = insertTxWithLedger('Loan Disbursement: Old Loan', 1000, '2023-10-01', 'income', 'loan', 'linked_loan_id', [loanId]);
            const txId = txInfo.lastInsertRowid;

            reminderService.updateReminder(loanId, {
                safeTitle: 'New Loan',
                amount: 100,
                safeDueDate: '2023-10-01',
                termYears: 0,
                safeFrequency: 'monthly',
                principalAmount: 2000,
                interestRate: 0,
                safeOwnerId: null,
                safePolicyType: null
            });

            const tx = getTx(txId);
            expect(tx.amount).toBe(2000);
            expect(tx.title).toBe('Loan Disbursement: New Loan');
        });
    });

    describe('removeReminder', () => {
        it('should throw error if trying to delete loan with linked transactions', () => {
            const info = nativeDb.prepare("INSERT INTO reminders (title, category) VALUES ('Loan', 'loan')").run();
            const loanId = info.lastInsertRowid;

            nativeDb.prepare("INSERT INTO transactions (title, linked_loan_id) VALUES ('Tx', ?)").run(loanId);

            expect(() => {
                reminderService.removeReminder(loanId);
            }).toThrow('Cannot delete: 1 transaction(s) are linked to this loan. Delete them first to maintain ledger integrity.');
        });

        it('should throw error if trying to delete insurance with linked transactions', () => {
            const info = nativeDb.prepare("INSERT INTO reminders (title, category) VALUES ('Ins', 'insurance')").run();
            const insId = info.lastInsertRowid;

            nativeDb.prepare("INSERT INTO transactions (title, insurance_id) VALUES ('Tx', ?)").run(insId);

            expect(() => {
                reminderService.removeReminder(insId);
            }).toThrow('Cannot delete: 1 transaction(s) are linked to this insurance. Delete them first to maintain ledger integrity.');
        });

        it('should clear subscription_id from transactions when removing subscription', () => {
            const info = nativeDb.prepare("INSERT INTO reminders (title, category) VALUES ('Sub', 'subscription')").run();
            const subId = info.lastInsertRowid;

            const txInfo = nativeDb.prepare("INSERT INTO transactions (title, subscription_id) VALUES ('Tx', ?)").run(subId);
            const txId = txInfo.lastInsertRowid;

            reminderService.removeReminder(subId);

            const tx = nativeDb.prepare('SELECT subscription_id FROM transactions WHERE id = ?').get(txId);
            expect(tx.subscription_id).toBeNull();

            const reminder = nativeDb.prepare('SELECT * FROM reminders WHERE id = ?').get(subId);
            expect(reminder).toBeUndefined();
        });

        it('should clear insurance_id from transactions if bypassing the check somehow (e.g. category not recognized properly, though code throws)', () => {
            const info = nativeDb.prepare("INSERT INTO reminders (title, category) VALUES ('Ins', 'insurance')").run();
            const insId = info.lastInsertRowid;

            // Notice: it only throws if category == 'loan' or 'insurance' AND checkTxs.cnt > 0.
            // If checkTxs.cnt == 0, it proceeds to delete and runs UPDATE ... SET insurance_id = NULL.
            reminderService.removeReminder(insId);

            const reminder = nativeDb.prepare('SELECT * FROM reminders WHERE id = ?').get(insId);
            expect(reminder).toBeUndefined();
        });

        it('should delete standard reminder without error', () => {
            const info = nativeDb.prepare("INSERT INTO reminders (title, category) VALUES ('Bill', 'bill')").run();
            const billId = info.lastInsertRowid;

            reminderService.removeReminder(billId);

            const reminder = nativeDb.prepare('SELECT * FROM reminders WHERE id = ?').get(billId);
            expect(reminder).toBeUndefined();
        });
    });
});
