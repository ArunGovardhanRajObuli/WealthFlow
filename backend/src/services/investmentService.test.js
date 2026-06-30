const { nativeDb } = require('../../database');
const investmentService = require('./investmentService');

describe('Investment Service', () => {
const { insertTxWithLedger, decorateTx, getTx } = require('../utils/testHelpers');

    beforeAll(() => {
        const tables = nativeDb.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
        for (const table of tables) {
            if (table.name !== 'sqlite_sequence' && table.name !== 'sqlite_stat1') {
                try {
                    nativeDb.prepare(`DELETE FROM ${table.name}`).run();
                } catch(e) {}
            }
        }
    });

    afterEach(() => {
        const tables = nativeDb.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
        for (const table of tables) {
            if (table.name !== 'sqlite_sequence' && table.name !== 'sqlite_stat1') {
                try {
                    nativeDb.prepare(`DELETE FROM ${table.name}`).run();
                } catch(e) {}
            }
        }
    });

    const createDummyBank = (id) => {
        nativeDb.prepare(`INSERT INTO bank_balances (id, bankName, balance) VALUES (?, 'Test Bank', '100000')`).run(id);
    };

    test('getAllInvestments - empty', () => {
        const result = investmentService.getAllInvestments();
        expect(result).toEqual([]);
    });

    test('createInvestment - non-historical with initial amount', () => {
        createDummyBank(1);
        
        const data = {
            title: 'Test Inv 1',
            category: 'Mutual Fund',
            assetClass: 'equity',
            currentAmount: '1000',
            targetAmount: '5000',
            roi: '10',
            dividendYield: '0',
            unrealizedGain: '0',
            schemeCode: '12345',
            latestNav: '100',
            isHistorical: false,
            totalUnits: '10',
            owner_member_id: null,
            joint_owner_member_id: null,
            owner_split_percent: 100,
            source_bank_id: 1,
            joint_bank_id: null,
            validatedSplitAmount: null
        };
        
        const id = investmentService.createInvestment(data);
        expect(id).toBeDefined();
        
        const invs = investmentService.getAllInvestments();
        expect(invs.length).toBe(1);
        expect(invs[0].title).toBe('Test Inv 1');
        
        const txs = nativeDb.prepare('SELECT * FROM transactions WHERE investment_id = ?').all(id).map(decorateTx);
        expect(txs.length).toBe(1);
        expect(txs[0].type).toBe('transfer');
        expect(txs[0].category).toBe('capital_deployment');
        
        const lots = nativeDb.prepare('SELECT * FROM investment_lots WHERE investment_id = ?').all(id);
        expect(lots.length).toBe(1);
        expect(lots[0].units).toBe(10);
    });

    test('createInvestment - historical with initial amount', () => {
        const data = {
            title: 'Test Inv 2',
            category: 'Mutual Fund',
            assetClass: 'debt',
            currentAmount: '2000',
            targetAmount: '10000',
            roi: '8',
            dividendYield: '0',
            unrealizedGain: '0',
            schemeCode: '999',
            latestNav: '200',
            isHistorical: true,
            totalUnits: '10',
            owner_member_id: null,
            joint_owner_member_id: null,
            owner_split_percent: 100,
            source_bank_id: null,
            joint_bank_id: null,
            validatedSplitAmount: null
        };
        
        const id = investmentService.createInvestment(data);
        const txs = nativeDb.prepare('SELECT * FROM transactions WHERE investment_id = ?').all(id).map(decorateTx);
        expect(txs.length).toBe(1);
        expect(txs[0].type).toBe('income');
        expect(txs[0].category).toBe('opening_balance');
    });

    test('createInvestment - zero initial amount', () => {
        const data = {
            title: 'Test Inv 3',
            category: 'Stocks',
            assetClass: 'equity',
            currentAmount: '0',
            targetAmount: '5000',
            roi: '10',
            dividendYield: '0',
            unrealizedGain: '0',
            schemeCode: null,
            latestNav: '0',
            isHistorical: false,
            totalUnits: '0',
            owner_member_id: null,
            joint_owner_member_id: null,
            owner_split_percent: 100,
            source_bank_id: null,
            joint_bank_id: null,
            validatedSplitAmount: null
        };
        
        const id = investmentService.createInvestment(data);
        const txs = nativeDb.prepare('SELECT * FROM transactions WHERE investment_id = ?').all(id).map(decorateTx);
        expect(txs.length).toBe(0); // no initial tx
    });

    test('fundInvestment', () => {
        createDummyBank(2);
        const data = {
            title: 'Fund Me',
            category: 'MF',
            assetClass: 'equity',
            currentAmount: '0',
            targetAmount: '1000',
            roi: '0',
            dividendYield: '0',
            unrealizedGain: '0',
            schemeCode: '111',
            latestNav: '50',
            isHistorical: false,
            totalUnits: '0',
            owner_member_id: null,
            joint_owner_member_id: null,
            owner_split_percent: 100,
            source_bank_id: null,
            joint_bank_id: null,
            validatedSplitAmount: null
        };
        const id = investmentService.createInvestment(data);
        
        // fund 500, nav 50 -> 10 units
        const newUnits = investmentService.fundInvestment(id, 500, 2, null, null);
        expect(newUnits).toBe(10);
        
        const sips = nativeDb.prepare('SELECT * FROM sip_purchases WHERE investment_id = ?').all(id);
        expect(sips.length).toBe(1);
        expect(sips[0].amount).toBe(500);
        expect(sips[0].unitsPurchased).toBe(10);
        
        const lots = nativeDb.prepare('SELECT * FROM investment_lots WHERE investment_id = ?').all(id);
        expect(lots.length).toBe(1);
        expect(lots[0].units).toBe(10);
        
        const txs = nativeDb.prepare('SELECT * FROM transactions WHERE investment_id = ?').all(id).map(decorateTx);
        expect(txs.length).toBe(1);
        expect(txs[0].amount).toBe(500);
    });

    test('fundInvestment throws if not found', () => {
        expect(() => {
            investmentService.fundInvestment(9999, 500, null, null, null);
        }).toThrow('Not found');
    });

    test('sellInvestment - equity long term', () => {
        createDummyBank(3);
        const id = investmentService.createInvestment({
            title: 'Sell Equity',
            category: 'MF',
            assetClass: 'equity',
            currentAmount: '1000',
            targetAmount: '1000',
            roi: '0',
            dividendYield: '0',
            unrealizedGain: '0',
            schemeCode: '111',
            latestNav: '100',
            isHistorical: false,
            totalUnits: '10',
            owner_member_id: null,
            joint_owner_member_id: null,
            owner_split_percent: 100,
            source_bank_id: 3,
            joint_bank_id: null,
            validatedSplitAmount: null
        });

        // Set the purchase date of the lot to 2 years ago to trigger LTCG
        const twoYearsAgo = new Date();
        twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
        const pdStr = twoYearsAgo.toISOString().split('T')[0];
        nativeDb.prepare('UPDATE investment_lots SET purchaseDate = ? WHERE investment_id = ?').run(pdStr, id);
        
        // Update NAV and current Amount in DB as it would be updated by external sync
        investmentService.updateInvestmentNav(150, id);
        nativeDb.prepare('UPDATE investments SET currentAmount = 1500, totalUnits = 10 WHERE id = ?').run(id);

        const validateAmountFn = (amt) => Number(amt);
        
        // Sell 5 units out of 10. Nav is 150.
        // Cost basis for 5 units is 500. Proceeds is 750. LTCG is 250.
        const res = investmentService.sellInvestment(id, 5, 3, null, validateAmountFn);
        expect(res.capitalRetrieved).toBe(750);
        expect(res.realizedGain).toBe(250);
        
        const txs = nativeDb.prepare(`SELECT * FROM transaction_details WHERE investment_id = ? AND type = 'income' ORDER BY id DESC`).all(id).map(decorateTx);
        // We should have a capital retrieved tx and an LTCG tx
        const categories = txs.map(t => t.category);
        expect(categories).toContain('capital_retrieval');
        expect(categories).toContain('realized_ltcg');
        
        const lots = nativeDb.prepare('SELECT * FROM investment_lots WHERE investment_id = ?').all(id);
        expect(lots.length).toBe(1);
        expect(lots[0].units).toBe(5);
        expect(lots[0].costBasis).toBe(500);
    });

    test('sellInvestment - equity short term loss', () => {
        createDummyBank(4);
        const id = investmentService.createInvestment({
            title: 'Sell Equity ST',
            category: 'MF',
            assetClass: 'equity',
            currentAmount: '1000',
            targetAmount: '1000',
            roi: '0',
            dividendYield: '0',
            unrealizedGain: '0',
            schemeCode: '111',
            latestNav: '100',
            isHistorical: false,
            totalUnits: '10',
            owner_member_id: null,
            joint_owner_member_id: null,
            owner_split_percent: 100,
            source_bank_id: 4,
            joint_bank_id: null,
            validatedSplitAmount: null
        });

        // Current nav drops to 80
        investmentService.updateInvestmentNav(80, id);
        nativeDb.prepare('UPDATE investments SET currentAmount = 800, totalUnits = 10 WHERE id = ?').run(id);

        const validateAmountFn = (amt) => Number(amt);
        
        // Sell 10 units. Proceeds = 800. Cost = 1000. Loss = 200.
        const res = investmentService.sellInvestment(id, 10, 4, null, validateAmountFn);
        expect(res.capitalRetrieved).toBe(800);
        expect(res.realizedGain).toBe(-200);
        
        const txs = nativeDb.prepare(`SELECT * FROM transactions WHERE investment_id = ? AND category = 'realized_stcl'`).all(id).map(decorateTx);
        expect(txs.length).toBe(1);
        expect(txs[0].amount).toBe(200);
        
        const lots = nativeDb.prepare('SELECT * FROM investment_lots WHERE investment_id = ?').all(id);
        expect(lots.length).toBe(0); // all deleted
    });

    test('sellInvestment - sovereign asset', () => {
        createDummyBank(5);
        const id = investmentService.createInvestment({
            title: 'SGB',
            category: 'SGB',
            assetClass: 'sovereign',
            currentAmount: '1000',
            targetAmount: '1000',
            roi: '0',
            dividendYield: '0',
            unrealizedGain: '0',
            schemeCode: '111',
            latestNav: '100',
            isHistorical: false,
            totalUnits: '10',
            owner_member_id: null,
            joint_owner_member_id: null,
            owner_split_percent: 100,
            source_bank_id: 5,
            joint_bank_id: null,
            validatedSplitAmount: null
        });

        investmentService.updateInvestmentNav(150, id);
        nativeDb.prepare('UPDATE investments SET currentAmount = 1500, totalUnits = 10 WHERE id = ?').run(id);

        const validateAmountFn = (amt) => Number(amt);
        
        // Sovereign doesn't generate gain/loss, just capital retrieval
        const res = investmentService.sellInvestment(id, 10, 5, null, validateAmountFn);
        expect(res.capitalRetrieved).toBe(1500);
        expect(res.realizedGain).toBe(0); // 0 because no gain/loss tracked for sovereign
        
        const txs = nativeDb.prepare(`SELECT * FROM transactions WHERE investment_id = ? AND category = 'capital_retrieval'`).all(id).map(decorateTx);
        expect(txs.length).toBe(1);
        expect(txs[0].amount).toBe(1500);
    });

    test('sellInvestment - throws if units exceed owned', () => {
        const id = investmentService.createInvestment({
            title: 'Exceed',
            category: 'SGB',
            assetClass: 'sovereign',
            currentAmount: '0',
            targetAmount: '1000',
            roi: '0',
            dividendYield: '0',
            unrealizedGain: '0',
            schemeCode: '111',
            latestNav: '100',
            isHistorical: false,
            totalUnits: '5',
            owner_member_id: null,
            joint_owner_member_id: null,
            owner_split_percent: 100,
            source_bank_id: null,
            joint_bank_id: null,
            validatedSplitAmount: null
        });
        nativeDb.prepare('UPDATE investments SET totalUnits = 5 WHERE id = ?').run(id);

        expect(() => {
            investmentService.sellInvestment(id, 10, null, null, (a) => a);
        }).toThrow('Cannot sell more units than owned');
    });

    test('deleteInvestment', () => {
        const id = investmentService.createInvestment({
            title: 'To Delete',
            category: 'SGB',
            assetClass: 'sovereign',
            currentAmount: '0',
            targetAmount: '1000',
            roi: '0',
            dividendYield: '0',
            unrealizedGain: '0',
            schemeCode: '111',
            latestNav: '100',
            isHistorical: false,
            totalUnits: '0',
            owner_member_id: null,
            joint_owner_member_id: null,
            owner_split_percent: 100,
            source_bank_id: null,
            joint_bank_id: null,
            validatedSplitAmount: null
        });

        // has no transactions because currentAmount was 0
        investmentService.deleteInvestment(id);
        const invs = investmentService.getAllInvestments();
        expect(invs.length).toBe(0);
    });

    test('deleteInvestment - throws if transactions exist', () => {
        createDummyBank(6);
        const id = investmentService.createInvestment({
            title: 'Delete Fail',
            category: 'SGB',
            assetClass: 'sovereign',
            currentAmount: '1000', // creates transaction
            targetAmount: '1000',
            roi: '0',
            dividendYield: '0',
            unrealizedGain: '0',
            schemeCode: '111',
            latestNav: '100',
            isHistorical: false,
            totalUnits: '10',
            owner_member_id: null,
            joint_owner_member_id: null,
            owner_split_percent: 100,
            source_bank_id: 6,
            joint_bank_id: null,
            validatedSplitAmount: null
        });

        expect(() => {
            investmentService.deleteInvestment(id);
        }).toThrow('Cannot delete: 1 transaction(s) are linked to this entity. Delete them first to maintain ledger integrity.');
    });

    test('addDividend', () => {
        createDummyBank(7);
        const id = investmentService.createInvestment({
            title: 'Div Inv',
            category: 'SGB',
            assetClass: 'sovereign',
            currentAmount: '0',
            targetAmount: '1000',
            roi: '0',
            dividendYield: '0',
            unrealizedGain: '0',
            schemeCode: '111',
            latestNav: '100',
            isHistorical: false,
            totalUnits: '0',
            owner_member_id: null,
            joint_owner_member_id: null,
            owner_split_percent: 100,
            source_bank_id: null,
            joint_bank_id: null,
            validatedSplitAmount: null
        });

        investmentService.addDividend(id, 50, '2023-01-01', 7, null, null);
        
        const txs = nativeDb.prepare(`SELECT * FROM transactions WHERE investment_id = ? AND category = 'dividend'`).all(id).map(decorateTx);
        expect(txs.length).toBe(1);
        expect(txs[0].amount).toBe(50);
        expect(txs[0].date).toBe('2023-01-01');
        expect(txs[0].type).toBe('income');
    });

    test('getInvestmentsWithSchemeCode', () => {
        investmentService.createInvestment({
            title: 'Scheme 1',
            category: 'SGB',
            assetClass: 'sovereign',
            currentAmount: '0',
            targetAmount: '1000',
            roi: '0',
            dividendYield: '0',
            unrealizedGain: '0',
            schemeCode: 'CODE1',
            latestNav: '100',
            isHistorical: false,
            totalUnits: '0',
            owner_member_id: null,
            joint_owner_member_id: null,
            owner_split_percent: 100,
            source_bank_id: null,
            joint_bank_id: null,
            validatedSplitAmount: null
        });
        
        investmentService.createInvestment({
            title: 'No Scheme',
            category: 'SGB',
            assetClass: 'sovereign',
            currentAmount: '0',
            targetAmount: '1000',
            roi: '0',
            dividendYield: '0',
            unrealizedGain: '0',
            schemeCode: null,
            latestNav: '100',
            isHistorical: false,
            totalUnits: '0',
            owner_member_id: null,
            joint_owner_member_id: null,
            owner_split_percent: 100,
            source_bank_id: null,
            joint_bank_id: null,
            validatedSplitAmount: null
        });

        const res = investmentService.getInvestmentsWithSchemeCode();
        expect(res.length).toBe(1);
        expect(res[0].schemeCode).toBe('CODE1');
    });

    test('updateInvestmentNav', () => {
        const id = investmentService.createInvestment({
            title: 'Nav Inv',
            category: 'SGB',
            assetClass: 'sovereign',
            currentAmount: '0',
            targetAmount: '1000',
            roi: '0',
            dividendYield: '0',
            unrealizedGain: '0',
            schemeCode: '111',
            latestNav: '100',
            isHistorical: false,
            totalUnits: '0',
            owner_member_id: null,
            joint_owner_member_id: null,
            owner_split_percent: 100,
            source_bank_id: null,
            joint_bank_id: null,
            validatedSplitAmount: null
        });

        investmentService.updateInvestmentNav(250, id);
        
        const inv = nativeDb.prepare('SELECT latestNav FROM investments WHERE id = ?').get(id);
        expect(inv.latestNav).toBe(250);
    });

});
