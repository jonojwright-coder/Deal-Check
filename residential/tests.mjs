import assert from 'node:assert/strict';
import { calculateDeal, DEFAULTS } from './core.js';

const result = calculateDeal(DEFAULTS);

assert.equal(result.purchaseLoan, 637500);
assert.equal(result.acquisitionCosts, 8700);
assert.equal(result.renovationCosts, 115000);
assert.equal(result.holdingCosts, 6591.666666666667);
assert.equal(Math.round(result.agentCommission), 38500);
assert.equal(Math.round(result.sellingCosts), 47000);
assert.equal(Math.round(result.interestCost), 42766);
assert.equal(result.lenderFees, 16250);
assert.equal(Math.round(result.financeCosts), 59016);
assert.equal(Math.round(result.totalProjectCost), 1086307);
assert.equal(Math.round(result.taxAllowance), 3834);
assert.equal(Math.round(result.netProfit), 9859);
assert.equal(result.verdict, 'amber');

const green = calculateDeal({ ...DEFAULTS, purchasePrice: 720000, salePrice: 1100000 });
assert.equal(green.verdict, 'green');
assert.ok(green.netProfit > DEFAULTS.targetNetProfit);
assert.ok(green.cashRoi > DEFAULTS.targetCashRoi);

const red = calculateDeal({ ...DEFAULTS, salePrice: 900000 });
assert.equal(red.verdict, 'red');
assert.ok(red.netProfit < 0);

const taxed = calculateDeal({ ...DEFAULTS, purchasePrice: 720000, taxAllowancePercent: 33 });
assert.equal(Math.round(taxed.taxAllowance), Math.round(taxed.netProfitBeforeTax * 0.33));
assert.equal(Math.round(taxed.netProfit), Math.round(taxed.netProfitBeforeTax * 0.67));

console.log('All DealCheck calculation tests passed.');
