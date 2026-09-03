import { calculateDeal, DEFAULTS, NUMERIC_INPUT_IDS, TEXT_INPUT_IDS } from './core.js';

const CURRENT_KEY = 'dealcheck-residential-current-v1';
const SAVED_KEY = 'dealcheck-residential-saved-v1';
const TAX_MIGRATION_KEY = 'dealcheck-residential-tax-default-28-v1';
const DATABASE_NAME = 'dealcheck-residential-storage';
const DATABASE_VERSION = 1;
const DEAL_STORE = 'saved-deals';
const META_STORE = 'meta';
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

let databasePromise;
function openDatabase() {
  if (!('indexedDB' in window)) return Promise.reject(new Error('IndexedDB unavailable'));
  if (databasePromise) return databasePromise;

  databasePromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(DEAL_STORE)) database.createObjectStore(DEAL_STORE, { keyPath: 'id' });
      if (!database.objectStoreNames.contains(META_STORE)) database.createObjectStore(META_STORE, { keyPath: 'key' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Could not open app database'));
  });

  return databasePromise;
}

async function databasePut(storeName, value) {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, 'readwrite');
    transaction.objectStore(storeName).put(value);
    transaction.oncomplete = () => resolve(true);
    transaction.onerror = () => reject(transaction.error || new Error('Could not save app data'));
    transaction.onabort = () => reject(transaction.error || new Error('App data save was interrupted'));
  });
}

async function databaseGetAll(storeName) {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = database.transaction(storeName, 'readonly').objectStore(storeName).getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error || new Error('Could not read app data'));
  });
}

async function databaseGet(storeName, key) {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = database.transaction(storeName, 'readonly').objectStore(storeName).get(key);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Could not read app data'));
  });
}

async function databaseDelete(storeName, key) {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, 'readwrite');
    transaction.objectStore(storeName).delete(key);
    transaction.oncomplete = () => resolve(true);
    transaction.onerror = () => reject(transaction.error || new Error('Could not delete app data'));
    transaction.onabort = () => reject(transaction.error || new Error('App data delete was interrupted'));
  });
}

let currentSaveTimer;
function saveCurrent() {
  const inputs = getInputs();
  const savedLocally = storageWrite(CURRENT_KEY, inputs);
  clearTimeout(currentSaveTimer);
  currentSaveTimer = setTimeout(() => {
    databasePut(META_STORE, { key: 'current-deal', value: inputs }).catch(() => {});
  }, 250);
  return savedLocally;
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
    headlineTaxAllowance: money(result.taxAllowance),
    preTaxProfit: money(result.netProfitBeforeTax),
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
    targetSummary: `${money(result.targetNetProfit)} · ${percent(result.targetCashRoi)} · Tax ${percent(inputs.taxAllowancePercent)}`
  };

  Object.entries(outputs).forEach(([id, value]) => {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
  });

  document.getElementById('headlineTaxNote').textContent = `${percent(inputs.taxAllowancePercent)} of positive forecast pre-tax profit`;
  document.getElementById('taxRowLabel').textContent = `Tax allowance (${percent(inputs.taxAllowancePercent)})`;
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

function locallySavedDeals() {
  const saved = storageRead(SAVED_KEY, []);
  return Array.isArray(saved) ? saved : [];
}

let savedDealsCache = locallySavedDeals();
function savedDeals() {
  return savedDealsCache;
}

function updateSavedCount() {
  document.getElementById('savedCount').textContent = String(savedDeals().length);
}

async function saveSnapshot(showMessage = true) {
  const { inputs, result } = render();
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
  savedDealsCache = [snapshot, ...savedDeals()].slice(0, 30);
  const savedLocally = storageWrite(SAVED_KEY, savedDealsCache);
  let savedToDatabase = false;
  try {
    await databasePut(DEAL_STORE, snapshot);
    savedToDatabase = true;
  } catch (_) {}
  updateSavedCount();
  if (showMessage) setStatus(savedLocally || savedToDatabase ? 'Deal saved securely on this iPhone.' : 'This browser could not save the deal.');
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
    deleteButton.addEventListener('click', async () => {
      if (!window.confirm('Delete this saved deal from this device?')) return;
      savedDealsCache = savedDeals().filter(item => item.id !== snapshot.id);
      storageWrite(SAVED_KEY, savedDealsCache);
      try { await databaseDelete(DEAL_STORE, snapshot.id); } catch (_) {}
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
  ['Tax', 'Tax rate', 'taxAllowancePercent', 'percent']
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

document.getElementById('saveBtn').addEventListener('click', () => { saveSnapshot(); });
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
if (current && !localStorage.getItem(TAX_MIGRATION_KEY)) {
  if (Number(current.taxAllowancePercent) === 0) current.taxAllowancePercent = DEFAULTS.taxAllowancePercent;
  localStorage.setItem(TAX_MIGRATION_KEY, 'complete');
}
setInputs(current || DEFAULTS);
render();
updateSavedCount();

async function synchroniseDurableStorage() {
  try {
    if (navigator.storage?.persist) await navigator.storage.persist();

    const [databaseDeals, databaseCurrent] = await Promise.all([
      databaseGetAll(DEAL_STORE),
      databaseGet(META_STORE, 'current-deal')
    ]);

    const mergedDeals = new Map();
    [...savedDealsCache, ...databaseDeals].forEach(deal => {
      if (deal?.id) mergedDeals.set(deal.id, deal);
    });
    savedDealsCache = [...mergedDeals.values()]
      .sort((a, b) => String(b.savedAt || '').localeCompare(String(a.savedAt || '')))
      .slice(0, 30);
    storageWrite(SAVED_KEY, savedDealsCache);

    await Promise.all(savedDealsCache.map(deal => databasePut(DEAL_STORE, deal)));

    if (current) {
      await databasePut(META_STORE, { key: 'current-deal', value: getInputs() });
    } else if (databaseCurrent?.value) {
      setInputs(databaseCurrent.value);
      render();
      storageWrite(CURRENT_KEY, databaseCurrent.value);
    }

    updateSavedCount();
  } catch (_) {
    updateSavedCount();
  }
}

synchroniseDurableStorage();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./service-worker.js'));
}
