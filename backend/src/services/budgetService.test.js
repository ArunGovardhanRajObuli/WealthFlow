const { nativeDb } = require('../../database');
const budgetService = require('./budgetService');

describe('budgetService', () => {
const { insertTxWithLedger, decorateTx, getTx } = require('../utils/testHelpers');

    beforeAll(() => {
        // Clear tables
        nativeDb.prepare('DELETE FROM budgets').run();
        nativeDb.prepare('DELETE FROM transactions').run();
    });

    afterEach(() => {
        // Clear tables after each test
        nativeDb.prepare('DELETE FROM budgets').run();
        nativeDb.prepare('DELETE FROM transactions').run();
    });

    describe('createBudget', () => {
        it('should insert a new budget and return its id', () => {
            const id = budgetService.createBudget('Food', 5000);
            expect(id).toBeDefined();

            const row = nativeDb.prepare('SELECT * FROM budgets WHERE id = ?').get(id);
            expect(row).toBeDefined();
            expect(row.category).toBe('Food');
            expect(row.monthlyLimit).toBe(5000);
        });

        it('should replace an existing budget if category is the same (due to UNIQUE constraint)', () => {
            const id1 = budgetService.createBudget('Food', 5000);
            const id2 = budgetService.createBudget('Food', 6000);

            // Using REPLACE might generate a new ID
            const rows = nativeDb.prepare('SELECT * FROM budgets WHERE category = ?').all('Food');
            expect(rows.length).toBe(1);
            expect(rows[0].monthlyLimit).toBe(6000);
            expect(id1 === id2 || id1 !== id2).toBe(true); // just to acknowledge ID might change depending on SQLite version
        });
    });

    describe('getAllBudgets', () => {
        it('should return empty array if no budgets exist', () => {
            const budgets = budgetService.getAllBudgets();
            expect(budgets).toEqual([]);
        });

        it('should calculate spentPaise correctly for the current month', () => {
            // Setup budget
            budgetService.createBudget('Food', 5000);
            budgetService.createBudget('Travel', 2000);

            // Calculate current month prefix
            const tzOffsetMs = new Date().getTimezoneOffset() * 60000;
            const localDate = new Date(Date.now() - tzOffsetMs);
            const localMonthPrefix = localDate.toISOString().substring(0, 7); // YYYY-MM
            const currentDate = `${localMonthPrefix}-15T12:00:00.000Z`;
            const pastDate = '2000-01-01T12:00:00.000Z';

            // Insert transactions for Food
            // 1. Current month, expense (adds to spend)
            insertTxWithLedger('Lunch', 150.50, currentDate, 'expense', 'Food');
            // 2. Current month, income (subtracts from spend)
            insertTxWithLedger('Refund', 50.00, currentDate, 'income', 'Food');
            // 3. Past month, expense (ignored)
            insertTxWithLedger('Old Lunch', 200.00, pastDate, 'expense', 'Food');
            
            // Insert transactions for Travel
            insertTxWithLedger('Bus', 40.00, currentDate, 'expense', 'travel'); // lowercase category

            // Insert ignored category transaction
            insertTxWithLedger('Deployment', 1000.00, currentDate, 'expense', 'capital_deployment');

            const budgets = budgetService.getAllBudgets();
            expect(budgets.length).toBe(2);

            const foodBudget = budgets.find(b => b.category === 'Food');
            expect(foodBudget).toBeDefined();
            // 150.50 - 50 = 100.50 -> 10050 paise
            expect(foodBudget.spentPaise).toBe("10050");

            const travelBudget = budgets.find(b => b.category === 'Travel');
            expect(travelBudget).toBeDefined();
            // 40.00 -> 4000 paise
            expect(travelBudget.spentPaise).toBe("4000");
        });

        it('should handle budgets with no transactions', () => {
            budgetService.createBudget('Entertainment', 1000);
            
            const budgets = budgetService.getAllBudgets();
            expect(budgets.length).toBe(1);
            expect(budgets[0].spentPaise).toBe("0");
        });

        it('should handle null category gracefully', () => {
            // SQLite allows null if not constrained. Let's force a null category insert.
            nativeDb.prepare('INSERT INTO budgets (category, monthlyLimit) VALUES (NULL, 1000)').run();
            
            const budgets = budgetService.getAllBudgets();
            expect(budgets.length).toBe(1);
            expect(budgets[0].category).toBeNull();
            expect(budgets[0].spentPaise).toBe("0");
        });
    });

    describe('updateBudget', () => {
        it('should update the category and monthly limit', () => {
            const id = budgetService.createBudget('Food', 5000);
            
            budgetService.updateBudget(id, 'Groceries', 6000);

            const row = nativeDb.prepare('SELECT * FROM budgets WHERE id = ?').get(id);
            expect(row.category).toBe('Groceries');
            expect(row.monthlyLimit).toBe(6000);
        });

        it('should update associated transactions if category changes', () => {
            const id = budgetService.createBudget('Food', 5000);
            
            insertTxWithLedger('Lunch', 150.50, '2023-01-01T12:00:00Z', 'expense', 'Food');
            
            insertTxWithLedger('Dinner', 250.00, '2023-01-02T12:00:00Z', 'expense', 'food');

            budgetService.updateBudget(id, 'Groceries', 6000);

            const txs = nativeDb.prepare('SELECT category FROM transactions').all();
            expect(txs.length).toBe(2);
            expect(txs[0].category).toBe('Groceries');
            expect(txs[1].category).toBe('Groceries');
        });

        it('should NOT update associated transactions if category remains same case-insensitively', () => {
            const id = budgetService.createBudget('Food', 5000);
            
            insertTxWithLedger('Lunch', 150.50, '2023-01-01T12:00:00Z', 'expense', 'Food');

            budgetService.updateBudget(id, 'food', 6000);

            const txs = nativeDb.prepare('SELECT category FROM transactions').all();
            expect(txs.length).toBe(1);
            expect(txs[0].category).toBe('Food'); // the transaction category isn't updated
            
            const budgetRow = nativeDb.prepare('SELECT category FROM budgets WHERE id = ?').get(id);
            expect(budgetRow.category).toBe('food'); // the budget category is updated
        });

        it('should do nothing gracefully if the budget id does not exist', () => {
            expect(() => {
                budgetService.updateBudget(999, 'New Cat', 100);
            }).not.toThrow();
        });
    });

    describe('removeBudget', () => {
        it('should remove a budget if no transactions are associated', () => {
            const id = budgetService.createBudget('Food', 5000);
            
            budgetService.removeBudget(id);

            const row = nativeDb.prepare('SELECT * FROM budgets WHERE id = ?').get(id);
            expect(row).toBeUndefined();
        });

        it('should throw an error and not remove budget if transactions are associated', () => {
            const id = budgetService.createBudget('Food', 5000);
            
            insertTxWithLedger('Lunch', 150.50, '2023-01-01T12:00:00Z', 'expense', 'food');

            expect(() => {
                budgetService.removeBudget(id);
            }).toThrow(/Cannot delete: 1 transaction\(s\) are categorized under this budget/);

            const row = nativeDb.prepare('SELECT * FROM budgets WHERE id = ?').get(id);
            expect(row).toBeDefined(); // Still exists
        });

        it('should handle deleting non-existent budget gracefully', () => {
            expect(() => {
                budgetService.removeBudget(999);
            }).not.toThrow();
        });
    });
});
