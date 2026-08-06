const ids = [
  'purchasePrice', 'buildingArea', 'rentPerSqm', 'annualRent', 'vacancyRate',
  'annualOutgoings', 'constructionCost', 'depositRate', 'interestRate',
  'holdingPeriod', 'growthRate', 'otherCosts'
];

const defaults = {
  purchasePrice: 2500000,
  buildingArea: 1250,
  rentPerSqm: 240,
  annualRent: 300000,
  vacancyRate: 5,
  annualOutgoings: 35000,
  constructionCost: 150000,
  depositRate: 35,
  interestRate: 7.5,
  holdingPeriod: 3,
  growthRate: 3,
  otherCosts: 75000
};

let rentMode = localStorage.getItem('dealcheck-rent-mode') || 'sqm';

const number = id => Math.max(0, Number(document.getElementById(id).value) || 0);
const signedNumber = id => Number(document.getElementById(id).value) || 0;
const money = value => new Intl.NumberFormat('en-NZ', { style: 'currency', currency: 'NZD', maximumFractionDigits: 0 }).format(value);
const percent = value => `${Number.isFinite(value) ? value.toFixed(1) : '0.0'}%`;

function saveState() {
  const values = Object.fromEntries(ids.map(id => [id, document.getElementById(id).value]));
  localStorage.setItem('dealcheck-values', JSON.stringify(values));
  localStorage.setItem('dealcheck-rent-mode', rentMode);
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem('dealcheck-values') || '{}');
    Object.entries(saved).forEach(([id, value]) => {
      const input = document.getElementById(id);
      if (input) input.value = value;
    });
  } catch (_) {
    localStorage.removeItem('dealcheck-values');
  }
}

function setRentMode(mode, sync = true) {
  const area = number('buildingArea');
  const rentPerSqmInput = document.getElementById('rentPerSqm');
  const annualRentInput = document.getElementById('annualRent');

  if (sync && mode !== rentMode) {
    if (mode === 'annual') {
      annualRentInput.value = Math.round(area * number('rentPerSqm'));
    } else {
      rentPerSqmInput.value = area > 0 ? (number('annualRent') / area).toFixed(2) : 0;
    }
  }

  rentMode = mode;
  const isSqm = mode === 'sqm';
  document.getElementById('rentPerSqmField').hidden = !isSqm;
  document.getElementById('annualRentField').hidden = isSqm;
  document.getElementById('rentModeSqm').classList.toggle('active', isSqm);
  document.getElementById('rentModeAnnual').classList.toggle('active', !isSqm);
  document.getElementById('rentModeSqm').setAttribute('aria-pressed', String(isSqm));
  document.getElementById('rentModeAnnual').setAttribute('aria-pressed', String(!isSqm));
  calculate();
  saveState();
}


function calculate() {
  const purchasePrice = number('purchasePrice');
  const area = number('buildingArea');
  const vacancy = Math.min(number('vacancyRate'), 100) / 100;
  const outgoings = number('annualOutgoings');
  const construction = number('constructionCost');
  const depositRate = Math.min(number('depositRate'), 100) / 100;
  const interestRate = number('interestRate') / 100;
  const hold = Math.max(1, Math.round(number('holdingPeriod')));
  const growthRate = signedNumber('growthRate') / 100;
  const otherCosts = number('otherCosts');

  const grossRent = rentMode === 'annual'
    ? number('annualRent')
    : area * number('rentPerSqm');
  const effectiveRent = grossRent * (1 - vacancy);
  const annualNetOperatingIncome = effectiveRent - outgoings;
  const debt = purchasePrice * (1 - depositRate);
  const annualInterest = debt * interestRate;
  const annualCashFlow = annualNetOperatingIncome - annualInterest;
  const exitValue = purchasePrice * Math.pow(1 + growthRate, hold);
  const equityRequired = purchasePrice * depositRate + construction + otherCosts;
  const totalRentalCashFlow = annualCashFlow * hold;
  const saleProceedsAfterDebt = exitValue - debt;
  const finalEquityValue = saleProceedsAfterDebt + totalRentalCashFlow;
  const profit = finalEquityValue - equityRequired;

  const grossYield = purchasePrice ? (grossRent / purchasePrice) * 100 : 0;
  const netYield = purchasePrice ? (annualNetOperatingIncome / purchasePrice) * 100 : 0;
  const roi = equityRequired ? (profit / equityRequired) * 100 : 0;
  const annualisedRoi = hold ? roi / hold : 0;
  const breakEvenRent = area && (1 - vacancy) > 0
    ? (outgoings + annualInterest) / (area * (1 - vacancy))
    : 0;

  document.getElementById('grossYield').textContent = percent(grossYield);
  document.getElementById('netYield').textContent = percent(netYield);
  document.getElementById('roi').textContent = percent(roi);
  document.getElementById('equityRequired').textContent = money(equityRequired);
  document.getElementById('annualNetIncome').textContent = money(annualCashFlow);
  document.getElementById('exitValue').textContent = money(exitValue);
  document.getElementById('profitAfterHold').textContent = money(profit);
  document.getElementById('breakEvenRent').textContent = `${money(breakEvenRent)}/m²`;

  let score = 50;
  score += Math.min(25, Math.max(-25, (netYield - 5) * 6));
  score += Math.min(25, Math.max(-25, (annualisedRoi - 8) * 2.5));
  score = Math.round(Math.max(0, Math.min(100, score)));

  const card = document.getElementById('verdictCard');
  const title = document.getElementById('verdictTitle');
  const text = document.getElementById('verdictText');
  card.classList.remove('good', 'investigate', 'bad');

  if (score >= 75 && profit > 0 && annualCashFlow > 0) {
    card.classList.add('good');
    title.textContent = 'Deal stacks up';
    text.textContent = 'The headline yield and simplified return are strong enough to progress to full due diligence.';
  } else if (score >= 48 && profit > 0) {
    card.classList.add('investigate');
    title.textContent = 'Worth investigating';
    text.textContent = 'The deal has potential, but pricing, rent, finance, or construction assumptions need testing.';
  } else {
    card.classList.add('bad');
    title.textContent = 'Does not stack up yet';
    text.textContent = 'The current assumptions produce weak or negative returns. Renegotiate the price or improve the income case.';
  }

  document.getElementById('scoreBadge').textContent = score;
}

ids.forEach(id => document.getElementById(id).addEventListener('input', () => { calculate(); saveState(); }));
document.getElementById('rentModeSqm').addEventListener('click', () => setRentMode('sqm'));
document.getElementById('rentModeAnnual').addEventListener('click', () => setRentMode('annual'));

document.getElementById('resetBtn').addEventListener('click', () => {
  Object.entries(defaults).forEach(([id, value]) => {
    document.getElementById(id).value = value;
  });
  localStorage.removeItem('dealcheck-values');
  localStorage.removeItem('dealcheck-rent-mode');
  setRentMode('sqm', false);
});

loadState();
setRentMode(rentMode, false);
