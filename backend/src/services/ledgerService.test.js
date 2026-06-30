const { nativeDb } = require('../../database');
const ledgerService = require('./ledgerService');

describe('ledgerService', () => {
const { insertTxWithLedger, decorateTx, getTx } = require('../utils/testHelpers');

    beforeAll(() => {
        const tables = [
            'bank_balances', 'credit_cards', 'sinking_funds', 'investments',
            'family_members', 'fixed_deposits', 'nps_accounts', 'gold_holdings',
            'real_estate', 'ledger_lines', 'transactions', 'reminders'
        ];
        tables.forEach(table => {
            nativeDb.prepare(`DELETE FROM ${table}`).run();
        });
    });

    afterEach(() => {
        const tables = [
            'bank_balances', 'credit_cards', 'sinking_funds', 'investments',
            'family_members', 'fixed_deposits', 'nps_accounts', 'gold_holdings',
            'real_estate', 'ledger_lines', 'transactions', 'reminders'
        ];
        tables.forEach(table => {
            nativeDb.prepare(`DELETE FROM ${table}`).run();
        });
    });

    describe('getLedgerLines', () => {
        it('should return ledger lines joined with transactions ordered by date desc', () => {
            const txId = insertTxWithLedger('Tx1', 100, '2023-01-01', 'income', 'salary').lastInsertRowid;
            nativeDb.prepare("INSERT INTO ledger_lines (transaction_id, account_class, account_type, entity_id, debit_amount, credit_amount) VALUES (?, 'Asset', 'bank', 1, 100, 0)").run(txId);
            
            const txId2 = insertTxWithLedger('Tx2', 50, '2023-01-02', 'expense', 'food').lastInsertRowid;
            nativeDb.prepare("INSERT INTO ledger_lines (transaction_id, account_class, account_type, entity_id, debit_amount, credit_amount) VALUES (?, 'Expense', 'food', 1, 50, 0)").run(txId2);

            const lines = ledgerService.getLedgerLines(10);
            expect(lines.length).toBeGreaterThanOrEqual(2);
            expect(lines[0].title).toBe('Tx2');
            expect(lines[0].date).toBe('2023-01-02');
            expect(lines.find(x => x.title === 'Tx1')).toBeDefined();
            
        });
    });

    describe('getFamilyEstateLedger', () => {
        it('should compute estate share correctly for a member', () => {
            const memberId = nativeDb.prepare("INSERT INTO family_members (name, collegeSavings) VALUES ('John', 5000)").run().lastInsertRowid;
            const bankId = nativeDb.prepare("INSERT INTO bank_balances (bankName, balance, owner_member_id) VALUES ('HDFC', 10000, ?)").run(memberId).lastInsertRowid;
            
            // Ledger lines for bank (true balance = 2000)
            nativeDb.prepare("INSERT INTO ledger_lines (account_class, account_type, entity_id, debit_amount, credit_amount) VALUES ('Asset', 'bank', ?, 2000, 0)").run(bankId);

            const realEstateId = nativeDb.prepare("INSERT INTO real_estate (title, baseValue, owner_member_id, owner_split_percent) VALUES ('House', 500000, ?, 100)").run(memberId).lastInsertRowid;
            
            const loanId = nativeDb.prepare("INSERT INTO reminders (title, category, owner_member_id) VALUES ('Home Loan', 'loan', ?)").run(memberId).lastInsertRowid;
            nativeDb.prepare("UPDATE real_estate SET linkedLoanId = ? WHERE id = ?").run(loanId, realEstateId);

            // Ledger lines for loan
            nativeDb.prepare("INSERT INTO ledger_lines (account_class, account_type, entity_id, credit_amount, debit_amount) VALUES ('Liability', 'loan', ?, 50000, 0)").run(loanId);

            const ledger = ledgerService.getFamilyEstateLedger();
            expect(ledger.length).toBe(1);
            const member = ledger[0];
            expect(member.name).toBe('John');
            expect(member.assets.banks.length).toBe(1);
            expect(member.assets.banks[0].ledgerBalance).toBe(2000); 
            expect(member.assets.realEstate[0].calculatedValue).toBe(500000);
            expect(member.liabilities.linkedLoans[0].calculatedDebt).toBe(50000);
            
            expect(member.totalGrossAssets).toBe(507000);
            expect(member.totalLiabilities).toBe(50000);
            expect(member.totalEstateShare).toBe(457000);
        });

        it('should compute investments and FDs correctly', () => {
            const memberId = nativeDb.prepare("INSERT INTO family_members (name) VALUES ('Jane')").run().lastInsertRowid;
            nativeDb.prepare("INSERT INTO investments (title, currentAmount, owner_member_id, owner_split_percent) VALUES ('Mutual Fund', 10000, ?, 50)").run(memberId);
            nativeDb.prepare("INSERT INTO fixed_deposits (bankName, principal, interestRate, startDate, owner_member_id, owner_split_percent) VALUES ('SBI', 20000, 0, '2023-01-01', ?, 100)").run(memberId);

            const ledger = ledgerService.getFamilyEstateLedger();
            const member = ledger.find(m => m.name === 'Jane');
            
            expect(member.assets.investments[0].calculatedValue).toBe(5000);
            expect(member.assets.fds[0].calculatedValue).toBe(20000);
            expect(member.totalGrossAssets).toBe(25000);
        });
        
        it('should compute Gold SGB interest correctly', () => {
             const memberId = nativeDb.prepare("INSERT INTO family_members (name) VALUES ('Goldie')").run().lastInsertRowid;
             nativeDb.prepare("INSERT INTO gold_holdings (title, type, weightGrams, currentPricePerGram, purchaseDate, interestRate, owner_member_id) VALUES ('SGB 2020', 'SGB', 10, 5000, '2020-01-01', 2.5, ?)").run(memberId);
             
             const ledger = ledgerService.getFamilyEstateLedger();
             const member = ledger.find(m => m.name === 'Goldie');
             
             expect(member.assets.gold[0].calculatedValue).toBeGreaterThanOrEqual(50000);
        });
        
        it('should compute unlinked loans correctly', () => {
            const memberId = nativeDb.prepare("INSERT INTO family_members (name) VALUES ('Alice')").run().lastInsertRowid;
            const loanId = nativeDb.prepare("INSERT INTO reminders (title, category, owner_member_id) VALUES ('Personal Loan', 'loan', ?)").run(memberId).lastInsertRowid;
            
            // Unlinked loan debt
            nativeDb.prepare("INSERT INTO ledger_lines (account_class, account_type, entity_id, credit_amount, debit_amount) VALUES ('Liability', 'loan', ?, 25000, 0)").run(loanId);
            
            const ledger = ledgerService.getFamilyEstateLedger();
            const member = ledger.find(m => m.name === 'Alice');
            expect(member.liabilities.unlinkedLoans[0].calculatedDebt).toBe(25000);
        });

        it('should compute credit card debt correctly', () => {
            const memberId = nativeDb.prepare("INSERT INTO family_members (name) VALUES ('Bob')").run().lastInsertRowid;
            const ccId = nativeDb.prepare("INSERT INTO credit_cards (name, currentBalance, owner_member_id) VALUES ('Visa', 0, ?)").run(memberId).lastInsertRowid;
            
            // CC debt
            nativeDb.prepare("INSERT INTO ledger_lines (account_class, account_type, entity_id, credit_amount, debit_amount) VALUES ('Liability', 'credit_card', ?, 15000, 0)").run(ccId);
            
            const ledger = ledgerService.getFamilyEstateLedger();
            const member = ledger.find(m => m.name === 'Bob');
            expect(member.liabilities.creditCards[0].calculatedDebt).toBe(15000);
        });
    });

    describe('getReconciliation', () => {
        it('should return aligned reconciliation status', () => {
            const bankId = nativeDb.prepare("INSERT INTO bank_balances (bankName, balance) VALUES ('Axis', 1000)").run().lastInsertRowid;
            nativeDb.prepare("INSERT INTO ledger_lines (account_class, account_type, entity_id, debit_amount, credit_amount) VALUES ('Asset', 'bank', ?, 1000, 0)").run(bankId);
            
            const rec = ledgerService.getReconciliation();
            expect(rec.status).toBe('aligned');
            expect(rec.actualBankBalance).toBe('1000.00');
            expect(rec.computedFreeCash).toBe('1000.00');
        });

        it('should return major_discrepancy if difference > 100', () => {
            const bankId = nativeDb.prepare("INSERT INTO bank_balances (bankName, balance) VALUES ('Axis', 1200)").run().lastInsertRowid;
            nativeDb.prepare("INSERT INTO ledger_lines (account_class, account_type, entity_id, debit_amount, credit_amount) VALUES ('Asset', 'bank', ?, 1000, 0)").run(bankId);
            
            const rec = ledgerService.getReconciliation();
            expect(rec.status).toBe('major_discrepancy');
        });

        it('should return minor_discrepancy if difference <= 100 and > 0', () => {
            const bankId = nativeDb.prepare("INSERT INTO bank_balances (bankName, balance) VALUES ('Axis', 1050)").run().lastInsertRowid;
            nativeDb.prepare("INSERT INTO ledger_lines (account_class, account_type, entity_id, debit_amount, credit_amount) VALUES ('Asset', 'bank', ?, 1000, 0)").run(bankId);
            
            const rec = ledgerService.getReconciliation();
            expect(rec.status).toBe('minor_discrepancy');
        });
    });

    describe('getSystemReconciliation', () => {
        it('should return imbalanced transactions', () => {
            const txId = insertTxWithLedger('Tx1', 100, '2023-01-01', 'income', 'salary').lastInsertRowid;
            
            const tx2Info = nativeDb.prepare("INSERT INTO transactions (title, date, category) VALUES ('Tx2', '2023-01-01', 'food')").run();
            const tx2Id = tx2Info.lastInsertRowid;
            nativeDb.prepare("INSERT INTO ledger_lines (transaction_id, debit_amount, credit_amount) VALUES (?, 50, 0)").run(tx2Id);
            nativeDb.prepare("INSERT INTO ledger_lines (transaction_id, debit_amount, credit_amount) VALUES (?, 0, 50)").run(tx2Id);

            const sysRec = ledgerService.getSystemReconciliation();
            expect(sysRec.imbalancedCount).toBe(1);
            expect(sysRec.data[0].transaction_id).toBe(txId);
        });
    });

    describe('syncAssetBalances', () => {
        it('should handle expense with newTx', () => {
            const bankId = nativeDb.prepare("INSERT INTO bank_balances (bankName, balance) VALUES ('Axis', 1000)").run().lastInsertRowid;
            const newTx = {
                id: 1,
                amount: 100,
                type: 'expense',
                category: 'food',
                source_bank_id: bankId
            };
            
            ledgerService.syncAssetBalances(null, newTx);
            
            const bank = nativeDb.prepare("SELECT balance FROM bank_balances WHERE id = ?").get(bankId);
            expect(bank.balance).toBe(900);
            
            // Check ledger lines
            const lines = nativeDb.prepare("SELECT * FROM ledger_lines WHERE transaction_id = ?").all(1);
            expect(lines.length).toBe(2);
        });

        it('should reverse oldTx and apply newTx for transfer', () => {
            const srcBank = nativeDb.prepare("INSERT INTO bank_balances (bankName, balance) VALUES ('Bank1', 1000)").run().lastInsertRowid;
            const dstBank = nativeDb.prepare("INSERT INTO bank_balances (bankName, balance) VALUES ('Bank2', 500)").run().lastInsertRowid;
            
            const oldTx = {
                id: 1,
                amount: 100,
                type: 'transfer',
                source_bank_id: srcBank,
                joint_bank_id: dstBank
            };
            nativeDb.prepare("UPDATE bank_balances SET balance = 900 WHERE id = ?").run(srcBank);
            nativeDb.prepare("UPDATE bank_balances SET balance = 600 WHERE id = ?").run(dstBank);
            
            const newTx = {
                id: 1,
                amount: 200,
                type: 'transfer',
                source_bank_id: srcBank,
                joint_bank_id: dstBank
            };

            ledgerService.syncAssetBalances(oldTx, newTx);
            
            const src = nativeDb.prepare("SELECT balance FROM bank_balances WHERE id = ?").get(srcBank);
            const dst = nativeDb.prepare("SELECT balance FROM bank_balances WHERE id = ?").get(dstBank);
            
            expect(src.balance).toBe(800);
            expect(dst.balance).toBe(700);
        });

        it('should handle income with oldTx and newTx', () => {
            const bankId = nativeDb.prepare("INSERT INTO bank_balances (bankName, balance) VALUES ('Axis', 1000)").run().lastInsertRowid;
            const oldTx = {
                id: 1,
                amount: 100,
                type: 'income',
                category: 'salary',
                source_bank_id: bankId
            };
            const newTx = {
                id: 1,
                amount: 250,
                type: 'income',
                category: 'salary',
                source_bank_id: bankId
            };
            
            ledgerService.syncAssetBalances(oldTx, newTx);
            
            const bank = nativeDb.prepare("SELECT balance FROM bank_balances WHERE id = ?").get(bankId);
            expect(bank.balance).toBe(1150);
        });
        
        it('should handle credit card repayment', () => {
            const ccId = nativeDb.prepare("INSERT INTO credit_cards (name, currentBalance) VALUES ('CC', 500)").run().lastInsertRowid;
            const bankId = nativeDb.prepare("INSERT INTO bank_balances (bankName, balance) VALUES ('Bank', 1000)").run().lastInsertRowid;
            
            const tx = {
                id: 1,
                amount: 200,
                type: 'expense',
                category: 'cc_repayment',
                source_bank_id: bankId,
                credit_card_id: ccId
            };
            
            ledgerService.syncAssetBalances(null, tx);
            
            const cc = nativeDb.prepare("SELECT currentBalance FROM credit_cards WHERE id = ?").get(ccId);
            expect(cc.currentBalance).toBe(300);
            
            const bank = nativeDb.prepare("SELECT balance FROM bank_balances WHERE id = ?").get(bankId);
            expect(bank.balance).toBe(800);
        });

        it('should handle split transactions', () => {
            const bankId = nativeDb.prepare("INSERT INTO bank_balances (bankName, balance) VALUES ('Axis', 1000)").run().lastInsertRowid;
            const jointBankId = nativeDb.prepare("INSERT INTO bank_balances (bankName, balance) VALUES ('SBI', 2000)").run().lastInsertRowid;
            
            const tx = {
                id: 1,
                amount: 300,
                type: 'expense',
                category: 'food',
                source_bank_id: bankId,
                joint_bank_id: jointBankId,
                split_amount: 100
            };
            
            ledgerService.syncAssetBalances(null, tx);
            
            const bank = nativeDb.prepare("SELECT balance FROM bank_balances WHERE id = ?").get(bankId);
            expect(bank.balance).toBe(800); // 1000 - 200
            
            const jointBank = nativeDb.prepare("SELECT balance FROM bank_balances WHERE id = ?").get(jointBankId);
            expect(jointBank.balance).toBe(1900); // 2000 - 100
        });

        it('should handle split percentage transactions', () => {
            const bankId = nativeDb.prepare("INSERT INTO bank_balances (bankName, balance) VALUES ('Axis', 1000)").run().lastInsertRowid;
            const jointBankId = nativeDb.prepare("INSERT INTO bank_balances (bankName, balance) VALUES ('SBI', 2000)").run().lastInsertRowid;
            
            const tx = {
                id: 1,
                amount: 500,
                type: 'income',
                category: 'salary',
                source_bank_id: bankId,
                joint_bank_id: jointBankId,
                split_percent: 20
            };
            
            ledgerService.syncAssetBalances(null, tx);
            
            const bank = nativeDb.prepare("SELECT balance FROM bank_balances WHERE id = ?").get(bankId);
            expect(bank.balance).toBe(1400); // 1000 + 400
            
            const jointBank = nativeDb.prepare("SELECT balance FROM bank_balances WHERE id = ?").get(jointBankId);
            expect(jointBank.balance).toBe(2100); // 2000 + 100
        });

        it('should handle capital deployment to investment', () => {
            const bankId = nativeDb.prepare("INSERT INTO bank_balances (bankName, balance) VALUES ('Axis', 1000)").run().lastInsertRowid;
            const invId = nativeDb.prepare("INSERT INTO investments (title, currentAmount, totalUnits) VALUES ('MF', 0, 0)").run().lastInsertRowid;
            
            const tx = {
                id: 1,
                amount: 500,
                type: 'expense',
                category: 'capital_deployment',
                source_bank_id: bankId,
                investment_id: invId,
                asset_units: 10
            };
            
            ledgerService.syncAssetBalances(null, tx);
            
            const inv = nativeDb.prepare("SELECT currentAmount, totalUnits FROM investments WHERE id = ?").get(invId);
            expect(inv.currentAmount).toBe(500);
            expect(inv.totalUnits).toBe(10);
            
            const bank = nativeDb.prepare("SELECT balance FROM bank_balances WHERE id = ?").get(bankId);
            expect(bank.balance).toBe(500);
        });

        it('should handle capital retrieval from investment', () => {
            const bankId = nativeDb.prepare("INSERT INTO bank_balances (bankName, balance) VALUES ('Axis', 1000)").run().lastInsertRowid;
            const invId = nativeDb.prepare("INSERT INTO investments (title, currentAmount, totalUnits) VALUES ('MF', 1000, 20)").run().lastInsertRowid;
            
            const tx = {
                id: 1,
                amount: 500,
                type: 'income',
                category: 'capital_retrieval',
                source_bank_id: bankId,
                investment_id: invId,
                asset_units: 10
            };
            
            ledgerService.syncAssetBalances(null, tx);
            
            const inv = nativeDb.prepare("SELECT currentAmount, totalUnits FROM investments WHERE id = ?").get(invId);
            expect(inv.currentAmount).toBe(500);
            expect(inv.totalUnits).toBe(10);
            
            const bank = nativeDb.prepare("SELECT balance FROM bank_balances WHERE id = ?").get(bankId);
            expect(bank.balance).toBe(1500);
        });

        it('should handle opening balance for credit card', () => {
            const ccId = nativeDb.prepare("INSERT INTO credit_cards (name, currentBalance) VALUES ('CC', 0)").run().lastInsertRowid;
            
            const tx = {
                id: 1,
                amount: 1000,
                type: 'expense',
                category: 'opening_balance',
                credit_card_id: ccId
            };
            
            ledgerService.syncAssetBalances(null, tx);
            
            const cc = nativeDb.prepare("SELECT currentBalance FROM credit_cards WHERE id = ?").get(ccId);
            expect(cc.currentBalance).toBe(1000);
        });

        it('should handle zero amounts without crashing', () => {
            const tx = { id: 1, amount: 0, type: 'expense', category: 'food' };
            expect(() => ledgerService.syncAssetBalances(null, tx)).not.toThrow();
        });
        
        it('should not throw if tx amount is empty or undefined', () => {
            const tx = { id: 1, type: 'expense', category: 'food' };
            expect(() => ledgerService.syncAssetBalances(null, tx)).not.toThrow();
        });

        it('should clear old tx ledger lines', () => {
            nativeDb.prepare("INSERT INTO ledger_lines (transaction_id, debit_amount, credit_amount) VALUES (99, 100, 0)").run();
            const oldTx = { id: 99, amount: 100, type: 'expense', category: 'food' };
            ledgerService.syncAssetBalances(oldTx, null);
            
            const lines = nativeDb.prepare("SELECT * FROM ledger_lines WHERE transaction_id = 99").all();
            expect(lines.length).toBe(0);
        });
    });
});
