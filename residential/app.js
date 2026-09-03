import { calculateDeal, DEFAULTS, NUMERIC_INPUT_IDS, TEXT_INPUT_IDS } from './core.js';

const CURRENT_KEY = 'dealcheck-residential-current-v1';
const SAVED_KEY = 'dealcheck-residential-saved-v1';
const ALL_INPUT_IDS = [...TEXT_INPUT_IDS, ...NUMERIC_INPUT_IDS];

const moneyFormatter = new Intl.NumberFormat('en-NZ', {
  style: 'currency',
  currency: 'NZD',
  maximumFractionDigits: 0
});

const decimalFormatter = new Intl.NumberFormat('en-NZ', {
  maximumFractionDigits: 1,
  minimumFractionDigits: 1
});

const money = amount => Number.isFinite(amount) ? moneyFormatter.format(amount) : 'Not available';
const percent = amount => `${decimalFormatter.format(Number.isFinite(amount) ? amount : 0)}%`;

function getInputs() {
  return Object.fromEntries(ALL_INPUT_IDS.map(id => {
    const element = document.getElementById(id);
    return [id, TEXT_INPUT_IDS.includes(id) ? element.value.trim() : Math.max(0, Number(element.value) || 0)];
  }));
}

function setInputs(values) {
  ALL_INPUT_IDS.forEach(id => {
    const element = document.getElementById(id);
    if (element && values[id] !== undefined && values[id] !== null) element.value = values[id];
  });
}

function storageRead(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch (_) {
    return fallback;
  }
}

function storageWrite(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (_) {
    return false;
  }
}

function saveCurrent() {
  storageWrite(CURRENT_KEY, getInputs());
}

function renderVerdict(result) {
  const card = document.getElementById('verdictCard');
  const label = document.getElementById('verdictLabel');
  const title = document.getElementById('verdictTitle');
  const text = document.getElementById('verdictText');

  card.classList.remove('green', 'amber', 'red');
  card.classList.add(result.verdict);

  if (result.verdict === 'green') {
    label.textContent = 'GREEN · TARGETS MET';
    title.textContent = 'The deal stacks up';
    text.textContent = `Forecast net profit ${money(result.netProfit)} and cash ROI ${percent(result.cashRoi)} both meet your targets.`;
    return;
  }

  if (result.verdict === 'amber') {
    const gaps = [];
    if (result.netProfit < result.targetNetProfit) gaps.push(`profit is below ${money(result.targetNetProfit)}`);
    if (result.cashRoi < result.targetCashRoi) gaps.push(`cash ROI is below ${percent(result.targetCashRoi)}`);
    label.textContent = 'AMBER · REVIEW THE NUMBERS';
    title.textContent = 'Positive, but below target';
    text.textContent = gaps.length ? `The deal is profitable, but ${gaps.join(' and ')}.` : 'The deal is positive, but needs a closer review.';
    return;
  }

  label.textContent = 'RED · DOES NOT STACK UP';
  title.textContent = result.forecastSale > 0 ? 'The current forecast is a loss' : 'Enter a forecast sale price';
  text.textContent = result.forecastSale > 0
    ? `The entered assumptions produce a net result of ${money(result.netProfit)}. Rework the buy price, scope or sale price.`
    : 'Add the likely resale value to complete the feasibility.';
}

function render() {
  const inputs = getInputs();
  const result = calculateDeal(inputs);

  const outputs = {
    netProfit: money(result.netProfit),
    finalNetProfit: money(result.netProfit),
    cashRoi: percent(result.cashRoi),
    forecastSale: money(result.forecastSale),
    grossProfit: money(result.grossProfit),
    purchaseLoan: money(result.purchaseLoan),
    cashRequired: money(result.cashRequired),
    acquisitionCosts: money(result.acquisitionCosts),
    renovationCosts: money(result.renovationCosts),
    financeCosts: money(result.financeCosts),
    holdingCosts: money(result.holdingCosts),
    sellingCosts: money(result.sellingCosts),
    totalProjectCost: money(result.totalProjectCost),
    breakEvenSale: money(result.breakEvenSale),
    netMargin: percent(result.netMargin),
    taxAllowance: money(result.taxAllowance),
    acquisitionCostSummary: money(result.acquisitionCosts),
    renovationCostSummary: money(result.renovationCosts),
    financeCostSummary: money(result.financeCosts),
    holdingCostSummary: money(result.holdingCosts),
    sellingCostSummary: money(result.sellingCosts),
    targetSummary: `${money(result.targetNetProfit)} · ${percent(result.targetCashRoi)}`
  };

  Object.entries(outputs).forEach(([id, value]) => {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
  });

  document.getElementById('taxRow').hidden = result.taxAllowance <= 0;
  document.getElementById('netProfitNote').textContent = result.taxAllowance > 0
    ? 'After costs and entered tax allowance'
    : 'After all entered costs, before tax';
  document.title = `${inputs.dealName || 'DealCheck'} · Residential Flip`;
  renderVerdict(result);
  return { inputs, result };
}

let statusTimer;
function setStatus(message) {
  const status = document.getElementById('actionStatus');
  status.textContent = message;
  clearTimeout(statusTimer);
  statusTimer = setTimeout(() => { status.textContent = ''; }, 5000);
}

function savedDeals() {
  const saved = storageRead(SAVED_KEY, []);
  return Array.isArray(saved) ? saved : [];
}

function updateSavedCount() {
  document.getElementById('savedCount').textContent = String(savedDeals().length);
}

function saveSnapshot(showMessage = true) {
  const { inputs, result } = render();
  const snapshots = savedDeals();
  const snapshot = {
    id: globalThis.crypto?.randomUUID?.() || String(Date.now()),
    savedAt: new Date().toISOString(),
    inputs,
    headline: {
      verdict: result.verdict,
      netProfit: result.netProfit,
      cashRoi: result.cashRoi,
      salePrice: result.forecastSale
    }
  };
  snapshots.unshift(snapshot);
  const saved = storageWrite(SAVED_KEY, snapshots.slice(0, 30));
  updateSavedCount();
  if (showMessage) setStatus(saved ? 'Deal saved on this device.' : 'This browser could not save the deal.');
  return snapshot;
}

function formatSavedDate(iso) {
  const date = new Date(iso);
  return Number.isNaN(date.valueOf()) ? '' : new Intl.DateTimeFormat('en-NZ', {
    day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit'
  }).format(date);
}

function renderSavedDeals() {
  const list = document.getElementById('savedDealsList');
  const snapshots = savedDeals();
  list.replaceChildren();

  if (!snapshots.length) {
    const empty = document.createElement('p');
    empty.className = 'empty-state';
    empty.textContent = 'No saved deals yet.';
    list.append(empty);
    return;
  }

  snapshots.forEach(snapshot => {
    const item = document.createElement('article');
    item.className = `saved-deal ${snapshot.headline?.verdict || 'amber'}`;

    const info = document.createElement('div');
    const name = document.createElement('strong');
    name.textContent = snapshot.inputs?.dealName || snapshot.inputs?.propertyAddress || 'Untitled deal';
    const address = document.createElement('span');
    address.textContent = snapshot.inputs?.propertyAddress || formatSavedDate(snapshot.savedAt);
    const result = document.createElement('small');
    result.textContent = `${money(snapshot.headline?.netProfit || 0)} net · ${percent(snapshot.headline?.cashRoi || 0)} ROI`;
    info.append(name, address, result);

    const actions = document.createElement('div');
    actions.className = 'saved-actions';
    const loadButton = document.createElement('button');
    loadButton.type = 'button';
    loadButton.textContent = 'Load';
    loadButton.addEventListener('click', () => {
      setInputs(snapshot.inputs || DEFAULTS);
      render();
      saveCurrent();
      document.getElementById('savedDealsDialog').close();
      window.scrollTo({ top: 0, behavior: 'smooth' });
      setStatus('Saved deal loaded.');
    });
    const deleteButton = document.createElement('button');
    deleteButton.type = 'button';
    deleteButton.className = 'delete-button';
    deleteButton.textContent = 'Delete';
    deleteButton.addEventListener('click', () => {
      if (!window.confirm('Delete this saved deal from this device?')) return;
      storageWrite(SAVED_KEY, savedDeals().filter(item => item.id !== snapshot.id));
      renderSavedDeals();
      updateSavedCount();
    });
    actions.append(loadButton, deleteButton);
    item.append(info, actions);
    list.append(item);
  });
}

const REPORT_FIELDS = [
  ['Deal', 'Deal name', 'dealName', 'text'],
  ['Deal', 'Property address', 'propertyAddress', 'text'],
  ['Deal', 'Buy price', 'purchasePrice', 'money'],
  ['Deal', 'Forecast sale price', 'salePrice', 'money'],
  ['Deal', 'Holding period', 'holdingMonths', 'months'],
  ['Finance', 'Purchase finance', 'financePercent', 'percent'],
  ['Finance', 'Annual interest rate', 'interestRate', 'percent'],
  ['Finance', 'Lender fee', 'lenderFeePercent', 'percent'],
  ['Finance', 'Lender legal / valuation', 'lenderFixedCosts', 'money'],
  ['Finance', 'Renovation financed', 'renovationFinancePercent', 'percent'],
  ['Acquisition', 'Legal / due diligence', 'legalDueDiligence', 'money'],
  ['Acquisition', 'Building report / LIM', 'buildingReports', 'money'],
  ['Acquisition', 'Independent valuation', 'valuationCost', 'money'],
  ['Acquisition', 'Other acquisition costs', 'otherAcquisitionCosts', 'money'],
  ['Renovation', 'Renovation budget', 'renovationBudget', 'money'],
  ['Renovation', 'Contingency', 'contingencyPercent', 'percent'],
  ['Renovation', 'Consent / consultants', 'consentConsultants', 'money'],
  ['Holding', 'Council rates per year', 'ratesAnnual', 'money'],
  ['Holding', 'Insurance per month', 'insuranceMonthly', 'money'],
  ['Holding', 'Power / water per month', 'utilitiesMonthly', 'money'],
  ['Holding', 'Other holding per month', 'otherHoldingMonthly', 'money'],
  ['Selling', 'Agent commission', 'agentCommissionPercent', 'percent'],
  ['Selling', 'Marketing / staging', 'marketingStaging', 'money'],
  ['Selling', 'Sale legal costs', 'saleLegal', 'money'],
  ['Selling', 'Other selling costs', 'otherSellingCosts', 'money'],
  ['Targets', 'Minimum net profit', 'targetNetProfit', 'money'],
  ['Targets', 'Minimum cash ROI', 'targetCashRoi', 'percent'],
  ['Targets', 'Tax allowance', 'taxAllowancePercent', 'percent']
];

function reportValue(value, type) {
  if (type === 'money') return money(value);
  if (type === 'percent') return percent(value);
  if (type === 'months') return `${decimalFormatter.format(value)} months`;
  return value || '';
}

function csvCell(value) {
  return `"${String(value ?? '').replaceAll('"', '""')}"`;
}

function buildCsv(inputs, result) {
  const rows = [
    ['DealCheck residential flip report', '', ''],
    ['Created', '', new Intl.DateTimeFormat('en-NZ', { dateStyle: 'full', timeStyle: 'short' }).format(new Date())],
    ['Traffic light', '', result.verdict.toUpperCase()],
    ['', '', ''],
    ['Section', 'Item', 'Value'],
    ...REPORT_FIELDS.map(([section, label, key, type]) => [section, label, reportValue(inputs[key], type)]),
    ['', '', ''],
    ['Results', 'Forecast sale', money(result.forecastSale)],
    ['Results', 'Gross profit', money(result.grossProfit)],
    ['Results', 'Acquisition costs', money(result.acquisitionCosts)],
    ['Results', 'Renovation incl. contingency', money(result.renovationCosts)],
    ['Results', 'Finance costs incl. interest', money(result.financeCosts)],
    ['Results', 'Holding costs', money(result.holdingCosts)],
    ['Results', 'Selling costs', money(result.sellingCosts)],
    ['Results', 'Total project cost', money(result.totalProjectCost)],
    ['Results', 'Purchase loan', money(result.purchaseLoan)],
    ['Results', 'Estimated cash required', money(result.cashRequired)],
    ['Results', 'Break-even sale price', money(result.breakEvenSale)],
    ['Results', 'Net profit before tax allowance', money(result.netProfitBeforeTax)],
    ['Results', 'Tax allowance', money(result.taxAllowance)],
    ['Results', 'Final net profit', money(result.netProfit)],
    ['Results', 'Cash ROI', percent(result.cashRoi)],
    ['Results', 'Net margin on sale', percent(result.netMargin)],
    ['', '', ''],
    ['Note', 'Model', 'Quick screening estimate only. Confirm finance, GST, tax and sale-cost treatment before committing.']
  ];
  return `\uFEFF${rows.map(row => row.map(csvCell).join(',')).join('\r\n')}`;
}

function safeFilename(name) {
  const cleaned = (name || 'property-deal').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `${cleaned || 'property-deal'}-${new Date().toISOString().slice(0, 10)}.csv`;
}

async function shareReport() {
  const { inputs, result } = render();
  saveCurrent();
  const file = new File([buildCsv(inputs, result)], safeFilename(inputs.dealName || inputs.propertyAddress), { type: 'text/csv' });
  const shareData = {
    title: `${inputs.dealName || 'Property deal'} · DealCheck`,
    text: `${result.verdict.toUpperCase()} · Net ${money(result.netProfit)} · Cash ROI ${percent(result.cashRoi)}`,
    files: [file]
  };

  try {
    if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
      await navigator.share(shareData);
      setStatus('Report shared. Choose Google Drive to store it there.');
      return;
    }
  } catch (error) {
    if (error?.name === 'AbortError') return;
  }

  const link = document.createElement('a');
  link.href = URL.createObjectURL(file);
  link.download = file.name;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  setStatus('Report downloaded. Upload the CSV file to Google Drive.');
}

ALL_INPUT_IDS.forEach(id => {
  document.getElementById(id).addEventListener('input', () => {
    render();
    saveCurrent();
  });
});

document.getElementById('saveBtn').addEventListener('click', () => saveSnapshot());
document.getElementById('shareBtn').addEventListener('click', shareReport);
document.getElementById('printBtn').addEventListener('click', () => window.print());
document.getElementById('savedDealsBtn').addEventListener('click', () => {
  renderSavedDeals();
  document.getElementById('savedDealsDialog').showModal();
});
document.getElementById('closeSavedDealsBtn').addEventListener('click', () => document.getElementById('savedDealsDialog').close());
document.getElementById('savedDealsDialog').addEventListener('click', event => {
  if (event.target === event.currentTarget) event.currentTarget.close();
});
document.getElementById('resetBtn').addEventListener('click', () => {
  if (!window.confirm('Start a new deal? Your saved snapshots will be kept.')) return;
  setInputs(DEFAULTS);
  saveCurrent();
  render();
  window.scrollTo({ top: 0, behavior: 'smooth' });
  setStatus('New deal ready.');
});

const current = storageRead(CURRENT_KEY, null);
setInputs(current || DEFAULTS);
render();
updateSavedCount();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./service-worker.js'));
}
