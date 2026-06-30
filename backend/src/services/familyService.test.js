const { nativeDb } = require('../../database');
const familyService = require('./familyService');

describe('familyService', () => {
const { insertTxWithLedger, decorateTx, getTx } = require('../utils/testHelpers');

    const clearDb = () => {
        const tables = [
            'family_members',
            'transactions',
            'reminders',
            'nominees',
            'real_estate',
            'investments',
            'fixed_deposits',
            'gold_holdings',
            'bank_balances',
            'ledger_lines',
            'credit_cards',
            'sinking_funds',
            'nps_accounts'
        ];
        tables.forEach(table => {
            try {
                nativeDb.prepare(`DELETE FROM ${table}`).run();
            } catch (e) { }
        });
    };

    beforeAll(() => {
        clearDb();
    });

    afterEach(() => {
        clearDb();
    });

    describe('getAllMembers', () => {
        it('should return empty array if no members exist', () => {
            const members = familyService.getAllMembers();
            expect(members).toEqual([]);
        });

        it('should return all members', () => {
            nativeDb.prepare('INSERT INTO family_members (id, name, role, age, annualIncome, lifeInsuranceCoverage, collegeSavings, targetAge, targetCollegeValue) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(1, 'John', 'Head', 40, '100000', '500000', '0', 60, '1000000');
            const members = familyService.getAllMembers();
            expect(members.length).toBe(1);
            expect(members[0].name).toBe("John");
        });

        it('should calculate life insurance coverage correctly from reminders', () => {
            nativeDb.prepare('INSERT INTO family_members (id, name, role, age, annualIncome, lifeInsuranceCoverage, collegeSavings, targetAge, targetCollegeValue) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(1, 'John', 'Head', 40, '100000', '50000', '0', 60, '1000000');
            nativeDb.prepare('INSERT INTO reminders (id, category, policyType, owner_member_id, principalAmount, startDate, termYears) VALUES (?, ?, ?, ?, ?, ?, ?)').run(1, 'insurance', 'life', 1, '150000', '2020-01-01', '20');
            const members = familyService.getAllMembers();
            expect(members.length).toBe(1);
            // 50000 (base) + 150000 (from reminder) = 200000
            expect(members[0].lifeInsuranceCoverage).toBe(200000);
        });

        it('should not include matured policies in coverage calculation', () => {
            nativeDb.prepare('INSERT INTO family_members (id, name, role, age, annualIncome, lifeInsuranceCoverage, collegeSavings, targetAge, targetCollegeValue) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(1, 'John', 'Head', 40, '100000', '50000', '0', 60, '1000000');
            nativeDb.prepare('INSERT INTO reminders (id, category, policyType, owner_member_id, principalAmount, startDate, termYears) VALUES (?, ?, ?, ?, ?, ?, ?)').run(1, 'insurance', 'life', 1, '150000', '2020-01-01', '2'); // matured in 2022
            const members = familyService.getAllMembers();
            expect(members.length).toBe(1);
            expect(members[0].lifeInsuranceCoverage).toBe(50000); // Only base
        });
    });

    describe('createMember', () => {
        it('should create a new member without initial college savings', () => {
            const memberId = familyService.createMember({
                name: 'Alice',
                role: 'Spouse',
                age: 38,
                annualIncome: '80000',
                lifeInsuranceCoverage: '100000',
                targetAge: 60,
                targetCollegeValue: '500000',
                collegeSavingsInitial: '0',
                source_bank_id: null
            });
            expect(memberId).toBeGreaterThan(0);

            const members = familyService.getAllMembers();
            expect(members.length).toBe(1);
            expect(members[0].name).toBe('Alice');
        });

        it('should create a new member with initial college savings and sync balances', () => {
            // First create a bank account
            const bankIdInfo = nativeDb.prepare('INSERT INTO bank_balances (bankName, balance) VALUES (?, ?)').run('Test Bank', '10000');
            const bankId = bankIdInfo.lastInsertRowid;

            const memberId = familyService.createMember({
                name: 'Bob',
                role: 'Child',
                age: 10,
                annualIncome: '0',
                lifeInsuranceCoverage: '0',
                targetAge: 18,
                targetCollegeValue: '200000',
                collegeSavingsInitial: '5000',
                source_bank_id: bankId
            });

            expect(memberId).toBeGreaterThan(0);

            const txs = nativeDb.prepare('SELECT * FROM transactions WHERE family_member_id = ?').all(memberId).map(decorateTx);
            expect(txs.length).toBe(1);
            expect(String(txs[0].amount)).toBe('5000');
            expect(txs[0].source_bank_id).toBe(bankId);

            // check ledger
            const ledgers = nativeDb.prepare('SELECT * FROM ledger_lines WHERE transaction_id = ?').all(txs[0].id);
            expect(ledgers.length).toBeGreaterThan(0);
        });
    });

    describe('fundMember', () => {
        it('should fund a member (positive) and sync ledger', () => {
            const memberIdInfo = nativeDb.prepare('INSERT INTO family_members (name, role, age, annualIncome, lifeInsuranceCoverage, collegeSavings, targetAge, targetCollegeValue) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run('Child1', 'Child', 10, 0, 0, 0, 18, 500000);
            const memberId = memberIdInfo.lastInsertRowid;

            const bankIdInfo = nativeDb.prepare('INSERT INTO bank_balances (bankName, balance) VALUES (?, ?)').run('Test Bank', '10000');
            const bankId = bankIdInfo.lastInsertRowid;

            familyService.fundMember(memberId, '2000', false, bankId, '2000');

            const txs = nativeDb.prepare('SELECT * FROM transactions WHERE family_member_id = ?').all(memberId).map(decorateTx);
            expect(txs.length).toBe(1);
            expect(txs[0].type).toBe('transfer');
            expect(txs[0].category).toBe('capital_deployment');
        });

        it('should retrieve from a member (negative) and sync ledger', () => {
            const memberIdInfo = nativeDb.prepare('INSERT INTO family_members (name, role, age, annualIncome, lifeInsuranceCoverage, collegeSavings, targetAge, targetCollegeValue) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run('Child1', 'Child', 10, 0, 0, 5000, 18, 500000);
            const memberId = memberIdInfo.lastInsertRowid;

            const bankIdInfo = nativeDb.prepare('INSERT INTO bank_balances (bankName, balance) VALUES (?, ?)').run('Test Bank', '10000');
            const bankId = bankIdInfo.lastInsertRowid;

            familyService.fundMember(memberId, '-2000', true, bankId, '-2000');

            const txs = nativeDb.prepare('SELECT * FROM transactions WHERE family_member_id = ?').all(memberId).map(decorateTx);
            expect(txs.length).toBe(1);
            expect(txs[0].type).toBe('income');
            expect(txs[0].category).toBe('capital_retrieval');
            expect(String(txs[0].amount)).toBe('2000');
        });

        it('should throw error if member not found', () => {
            expect(() => {
                familyService.fundMember(999, '2000', false, null, '2000');
            }).toThrow("Member not found");
        });
    });

    describe('updateMember', () => {
        it('should update member details', () => {
            const memberIdInfo = nativeDb.prepare('INSERT INTO family_members (name, role, age, annualIncome, lifeInsuranceCoverage, collegeSavings, targetAge, targetCollegeValue) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run('UpdateMe', 'Spouse', 30, '50000', '0', 0, 60, '0');
            const memberId = memberIdInfo.lastInsertRowid;

            familyService.updateMember(memberId, {
                age: 31,
                annualIncome: '55000',
                lifeInsuranceCoverage: '100000',
                targetAge: 65,
                targetCollegeValue: '1000000'
            });

            const updated = nativeDb.prepare('SELECT * FROM family_members WHERE id = ?').get(memberId);
            expect(updated.age).toBe(31);
            expect(String(updated.annualIncome)).toBe('55000');
        });

        it('should throw error if member not found', () => {
            expect(() => {
                familyService.updateMember(999, {
                    age: 31,
                    annualIncome: '55000',
                    lifeInsuranceCoverage: '100000',
                    targetAge: 65,
                    targetCollegeValue: '1000000'
                });
            }).toThrow("Member not found");
        });
    });

    describe('removeMember', () => {
        it('should remove member and clean up references', () => {
            const memberIdInfo = nativeDb.prepare('INSERT INTO family_members (name, role, age, annualIncome, lifeInsuranceCoverage, collegeSavings, targetAge, targetCollegeValue) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run('DeleteMe', 'Spouse', 30, '50000', '0', 0, 60, '0');
            const memberId = memberIdInfo.lastInsertRowid;

            // Set up some references
            nativeDb.prepare('INSERT INTO real_estate (title, owner_member_id) VALUES (?, ?)').run('House', memberId);
            nativeDb.prepare('INSERT INTO bank_balances (bankName, owner_member_id) VALUES (?, ?)').run('Bank', memberId);

            familyService.removeMember(memberId);

            const member = nativeDb.prepare('SELECT * FROM family_members WHERE id = ?').get(memberId);
            expect(member).toBeUndefined();

            const realEstate = nativeDb.prepare('SELECT * FROM real_estate WHERE title = ?').get('House');
            expect(realEstate.owner_member_id).toBeNull();

            const bank = nativeDb.prepare('SELECT * FROM bank_balances WHERE bankName = ?').get('Bank');
            expect(bank.owner_member_id).toBeNull();
        });

        it('should throw error if member has linked transactions', () => {
            const memberIdInfo = nativeDb.prepare('INSERT INTO family_members (name, role, age, annualIncome, lifeInsuranceCoverage, collegeSavings, targetAge, targetCollegeValue) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run('DeleteMe', 'Spouse', 30, '50000', '0', 0, 60, '0');
            const memberId = memberIdInfo.lastInsertRowid;

            insertTxWithLedger('Test', 1000, new Date().toISOString().split('T')[0], 'expense', 'capital_deployment', 'family_member_id', [memberId]);

            expect(() => {
                familyService.removeMember(memberId);
            }).toThrow(/Cannot delete: 1 transaction\(s\) are linked to this member/);
        });

        it('should throw error if member has insurance policies with linked transactions', () => {
            const memberIdInfo = nativeDb.prepare('INSERT INTO family_members (name, role, age, annualIncome, lifeInsuranceCoverage, collegeSavings, targetAge, targetCollegeValue) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run('DeleteMe', 'Spouse', 30, '50000', '0', 0, 60, '0');
            const memberId = memberIdInfo.lastInsertRowid;

            const policyIdInfo = nativeDb.prepare('INSERT INTO reminders (title, category, owner_member_id) VALUES (?, ?, ?)').run('Policy', 'insurance', memberId);
            const policyId = policyIdInfo.lastInsertRowid;

            insertTxWithLedger('Premium', 100, new Date().toISOString().split('T')[0], 'expense', 'insurance', 'insurance_id', [policyId]);

            expect(() => {
                familyService.removeMember(memberId);
            }).toThrow(/Cannot delete: 1 transaction\(s\) are linked to this member/);
        });
    });
});
