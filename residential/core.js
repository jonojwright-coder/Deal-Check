export const NUMERIC_INPUT_IDS = [
  'purchasePrice', 'salePrice', 'holdingMonths',
  'financePercent', 'interestRate', 'lenderFeePercent', 'lenderFixedCosts', 'renovationFinancePercent',
  'legalDueDiligence', 'buildingReports', 'valuationCost', 'otherAcquisitionCosts',
  'renovationBudget', 'contingencyPercent', 'consentConsultants',
  'ratesAnnual', 'insuranceMonthly', 'utilitiesMonthly', 'otherHoldingMonthly',
  'agentCommissionPercent', 'marketingStaging', 'saleLegal', 'otherSellingCosts',
  'targetNetProfit', 'targetCashRoi', 'taxAllowancePercent'
];

export const TEXT_INPUT_IDS = ['dealName', 'propertyAddress'];

export const DEFAULTS = {
  dealName: 'New residential flip',
  propertyAddress: '',
  purchasePrice: 850000,
  salePrice: 1100000,
  holdingMonths: 7,
  financePercent: 75,
  interestRate: 11.5,
  lenderFeePercent: 2,
  lenderFixedCosts: 3500,
  renovationFinancePercent: 0,
  legalDueDiligence: 4000,
  buildingReports: 2000,
  valuationCost: 1200,
  otherAcquisitionCosts: 1500,
  renovationBudget: 100000,
  contingencyPercent: 10,
  consentConsultants: 5000,
  ratesAnnual: 3500,
  insuranceMonthly: 250,
  utilitiesMonthly: 250,
  otherHoldingMonthly: 150,
  agentCommissionPercent: 3.5,
  marketingStaging: 5000,
  saleLegal: 2500,
  otherSellingCosts: 1000,
  targetNetProfit: 75000,
  targetCashRoi: 15,
  taxAllowancePercent: 0
};

const value = (input, key) => Math.max(0, Number(input[key]) || 0);
const rate = (input, key) => Math.min(value(input, key), 100) / 100;

export function calculateDeal(input) {
  const purchasePrice = value(input, 'purchasePrice');
  const salePrice = value(input, 'salePrice');
  const holdingMonths = value(input, 'holdingMonths');
  const financePercent = rate(input, 'financePercent');
  const annualInterestRate = value(input, 'interestRate') / 100;
  const lenderFeePercent = value(input, 'lenderFeePercent') / 100;
  const renovationFinancePercent = rate(input, 'renovationFinancePercent');
  const agentCommissionPercent = value(input, 'agentCommissionPercent') / 100;
  const taxAllowancePercent = rate(input, 'taxAllowancePercent');

  const acquisitionCosts = value(input, 'legalDueDiligence')
    + value(input, 'buildingReports')
    + value(input, 'valuationCost')
    + value(input, 'otherAcquisitionCosts');

  const contingency = value(input, 'renovationBudget') * rate(input, 'contingencyPercent');
  const renovationCosts = value(input, 'renovationBudget')
    + contingency
    + value(input, 'consentConsultants');

  const purchaseLoan = purchasePrice * financePercent;
  const renovationLoan = value(input, 'renovationBudget') * renovationFinancePercent;
  const averageRenovationLoan = renovationLoan * 0.5;
  const interestCost = (purchaseLoan + averageRenovationLoan) * annualInterestRate * holdingMonths / 12;
  const lenderFees = purchaseLoan * lenderFeePercent + value(input, 'lenderFixedCosts');
  const financeCosts = interestCost + lenderFees;

  const monthlyHolding = value(input, 'ratesAnnual') / 12
    + value(input, 'insuranceMonthly')
    + value(input, 'utilitiesMonthly')
    + value(input, 'otherHoldingMonthly');
  const holdingCosts = monthlyHolding * holdingMonths;

  const agentCommission = salePrice * agentCommissionPercent;
  const fixedSellingCosts = value(input, 'marketingStaging')
    + value(input, 'saleLegal')
    + value(input, 'otherSellingCosts');
  const sellingCosts = agentCommission + fixedSellingCosts;

  const grossProfit = salePrice - purchasePrice - renovationCosts;
  const totalProjectCost = purchasePrice + acquisitionCosts + renovationCosts + financeCosts + holdingCosts + sellingCosts;
  const netProfitBeforeTax = salePrice - totalProjectCost;
  const taxAllowance = Math.max(0, netProfitBeforeTax) * taxAllowancePercent;
  const netProfit = netProfitBeforeTax - taxAllowance;

  const cashRequired = (purchasePrice - purchaseLoan)
    + acquisitionCosts
    + Math.max(0, renovationCosts - renovationLoan)
    + financeCosts
    + holdingCosts;
  const cashRoi = cashRequired ? netProfit / cashRequired * 100 : 0;
  const netMargin = salePrice ? netProfit / salePrice * 100 : 0;
  const breakEvenBase = purchasePrice + acquisitionCosts + renovationCosts + financeCosts + holdingCosts + fixedSellingCosts;
  const breakEvenSale = agentCommissionPercent < 1 ? breakEvenBase / (1 - agentCommissionPercent) : Infinity;

  const targetNetProfit = value(input, 'targetNetProfit');
  const targetCashRoi = value(input, 'targetCashRoi');
  let verdict = 'red';
  if (salePrice > 0 && netProfit >= targetNetProfit && cashRoi >= targetCashRoi) verdict = 'green';
  else if (salePrice > 0 && netProfit > 0) verdict = 'amber';

  return {
    acquisitionCosts,
    contingency,
    renovationCosts,
    purchaseLoan,
    renovationLoan,
    interestCost,
    lenderFees,
    financeCosts,
    holdingCosts,
    agentCommission,
    sellingCosts,
    grossProfit,
    totalProjectCost,
    netProfitBeforeTax,
    taxAllowance,
    netProfit,
    cashRequired,
    cashRoi,
    netMargin,
    breakEvenSale,
    forecastSale: salePrice,
    verdict,
    targetNetProfit,
    targetCashRoi
  };
}
