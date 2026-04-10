'use strict';

// ── State ──────────────────────────────────────────────────────────────────
const state = {
  heightIn:   '',
  weightLbs:  '',
  bodyFatPct: '',
  waistIn:    '',
};

// ── Storage key ────────────────────────────────────────────────────────────
const STORAGE_KEY       = 'ffmicalc_log';
const STORAGE_MAX_BYTES = 5 * 1024 * 1024;
const STORAGE_WARN_PCT  = 0.80;

// ── Lookup tables ──────────────────────────────────────────────────────────
const FFMI_CATEGORIES = [
  { max: 18,       label: 'Below Average',     color: '#6b7dab', glow: 'rgba(107,125,171,0.12)' },
  { max: 20,       label: 'Average',            color: '#00d4ff', glow: 'rgba(0,212,255,0.10)'   },
  { max: 22,       label: 'Above Average',      color: '#00b4a0', glow: 'rgba(0,180,160,0.12)'   },
  { max: 25,       label: 'Highly Muscular',    color: '#ffb830', glow: 'rgba(255,184,48,0.12)'  },
  { max: Infinity, label: 'Extremely Muscular', color: '#ff7c2a', glow: 'rgba(255,124,42,0.12)'  },
];

const WHR_CATEGORIES = [
  { max: 0.35,     label: 'Extremely Slim',    desc: 'May indicate being underweight or low muscle mass',   color: '#6b7dab', glow: 'rgba(107,125,171,0.12)' },
  { max: 0.43,     label: 'Slim',              desc: 'Very healthy — low risk of metabolic disease',        color: '#2ecc71', glow: 'rgba(46,204,113,0.12)'  },
  { max: 0.53,     label: 'Healthy / Average', desc: 'Ideal range for most adults',                         color: '#00d4ff', glow: 'rgba(0,212,255,0.10)'   },
  { max: 0.58,     label: 'Overweight',        desc: 'Increased risk of heart disease and Type 2 Diabetes', color: '#ffb830', glow: 'rgba(255,184,48,0.12)'  },
  { max: 0.63,     label: 'Very Overweight',   desc: 'High risk — significant abdominal fat accumulation',  color: '#ff7c2a', glow: 'rgba(255,124,42,0.12)'  },
  { max: Infinity, label: 'Obese',             desc: 'Very high risk of chronic health conditions',         color: '#ff4c4c', glow: 'rgba(255,76,76,0.12)'   },
];

// ── Formatters ─────────────────────────────────────────────────────────────
const fmt2 = v => Number(v).toFixed(2);
const fmt1 = v => Number(v).toFixed(1);

function todayISO() {
  return new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD
}

function displayDate() {
  return new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

function formatBytes(b) {
  if (b < 1024) return b + ' B';
  if (b < 1024 * 1024) return (b / 1024).toFixed(1) + ' KB';
  return (b / (1024 * 1024)).toFixed(2) + ' MB';
}

// ── Category lookups ───────────────────────────────────────────────────────
function getFFMICategory(ffmi) {
  return FFMI_CATEGORIES.find(c => ffmi < c.max) || FFMI_CATEGORIES[FFMI_CATEGORIES.length - 1];
}
function getWHRCategory(whr) {
  return WHR_CATEGORIES.find(c => whr < c.max) || WHR_CATEGORIES[WHR_CATEGORIES.length - 1];
}

// ── Core calculations ──────────────────────────────────────────────────────
function calculate(heightIn, weightLbs, bodyFatPct, waistIn) {
  const h  = parseFloat(heightIn);
  const w  = parseFloat(weightLbs);
  const bf = parseFloat(bodyFatPct);
  const wt = parseFloat(waistIn);

  if (isNaN(h) || h <= 0 || isNaN(w) || w <= 0 || isNaN(bf) || bf <= 0 || bf >= 100) return null;

  const heightM    = h  * 0.0254;
  const weightKg   = w  * 0.453592;
  const leanMassKg = weightKg * (1 - bf / 100);
  const ffmi       = leanMassKg / (heightM * heightM);
  const leanLbs    = leanMassKg / 0.453592;
  const whr        = (!isNaN(wt) && wt > 0) ? wt / h : null;

  return { ffmi, leanMassKg, leanLbs, weightKg, heightM, whr };
}

// ── Scale helpers ──────────────────────────────────────────────────────────
const ffmiScalePct = ffmi => Math.min(100, Math.max(0, ((ffmi - 14) / 16) * 100));
const whrScalePct  = whr  => Math.min(100, Math.max(0, ((whr  - 0.25) / 0.50) * 100));

// ── localStorage helpers ───────────────────────────────────────────────────
function loadLog() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
  catch { return []; }
}

function saveLog(log) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(log));
    return true;
  } catch {
    alert('⚠️ Storage is full. Please export your log then use "Clear All" to free space.');
    return false;
  }
}

function storageUsedBytes() {
  try { return new Blob([localStorage.getItem(STORAGE_KEY) || '']).size; }
  catch { return 0; }
}

// ── Save current result to log ─────────────────────────────────────────────
function saveEntry() {
  const result = calculate(state.heightIn, state.weightLbs, state.bodyFatPct, state.waistIn);
  if (!result) return;

  const ffmiCat = getFFMICategory(result.ffmi);
  const entry = {
    date:         todayISO(),
    heightIn:     parseFloat(state.heightIn),
    weightLbs:    parseFloat(state.weightLbs),
    bodyFatPct:   parseFloat(state.bodyFatPct),
    waistIn:      state.waistIn !== '' ? parseFloat(state.waistIn) : '',
    ffmi:         parseFloat(fmt2(result.ffmi)),
    ffmiCategory: ffmiCat.label,
    leanMassLbs:  parseFloat(fmt1(result.leanLbs)),
    whr:          result.whr !== null ? parseFloat(fmt2(result.whr)) : '',
    whrCategory:  result.whr !== null ? getWHRCategory(result.whr).label : '',
  };

  const log = loadLog();
  log.push(entry);
  if (!saveLog(log)) return;

  renderHistory();
  renderStorageBar();

  // Check if near limit
  const usedPct = storageUsedBytes() / STORAGE_MAX_BYTES;
  if (usedPct > STORAGE_WARN_PCT) {
    setTimeout(() => alert('⚠️ Your log is over 80% full (' + Math.round(usedPct * 100) + '%). Consider exporting and clearing old entries.'), 200);
  }

  // Button feedback
  const btn = document.getElementById('save-btn');
  if (btn) {
    btn.textContent = 'Saved ✓';
    btn.disabled = true;
    setTimeout(() => { btn.textContent = 'Save to Log'; btn.disabled = false; }, 1800);
  }
}

// ── Delete one entry ───────────────────────────────────────────────────────
function deleteEntry(realIdx) {
  if (!confirm('Delete this entry?')) return;
  const log = loadLog();
  log.splice(realIdx, 1);
  saveLog(log);
  renderHistory();
  renderStorageBar();
}

// ── Clear all entries ──────────────────────────────────────────────────────
function clearLog() {
  if (!confirm('Delete ALL log entries? This cannot be undone.\n\nTip: Export first to keep a backup.')) return;
  localStorage.removeItem(STORAGE_KEY);
  renderHistory();
  renderStorageBar();
}

// ── Export full log as CSV (Excel-friendly) ────────────────────────────────
function exportCSV() {
  const log = loadLog();
  if (log.length === 0) { alert('No entries to export yet.'); return; }

  const headers = [
    'Date','Height (in)','Weight (lbs)','Body Fat %','Waist (in)',
    'FFMI','FFMI Category','Lean Mass (lbs)','Waist-to-Height Ratio','WHR Category'
  ];

  const esc = v => {
    const s = String(v === null || v === undefined || v === '' ? '' : v);
    return (s.includes(',') || s.includes('"') || s.includes('\n'))
      ? '"' + s.replace(/"/g, '""') + '"' : s;
  };

  const rows = log.map(e => [
    e.date, e.heightIn, e.weightLbs, e.bodyFatPct,
    e.waistIn, e.ffmi, e.ffmiCategory, e.leanMassLbs,
    e.whr, e.whrCategory
  ]);

  const csv  = [headers, ...rows].map(r => r.map(esc).join(',')).join('\r\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement('a'), { href: url, download: 'ffmi-log-' + todayISO() + '.csv' });
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── Render storage status bar ──────────────────────────────────────────────
function renderStorageBar() {
  const used    = storageUsedBytes();
  const pct     = Math.min(100, (used / STORAGE_MAX_BYTES) * 100);
  const count   = loadLog().length;

  const fillEl  = document.getElementById('storage-fill');
  const usedEl  = document.getElementById('storage-used');
  const countEl = document.getElementById('storage-count');
  if (!fillEl) return;

  fillEl.style.width      = pct.toFixed(2) + '%';
  fillEl.style.background = pct > 80 ? '#ff4c4c' : pct > 50 ? '#ffb830' : '#00d4ff';
  usedEl.textContent      = formatBytes(used) + ' of 5 MB used';
  countEl.textContent     = count + (count === 1 ? ' entry' : ' entries');
}

// ── Render history table ───────────────────────────────────────────────────
function renderHistory() {
  const log       = loadLog();
  const emptyMsg  = document.getElementById('history-empty');
  const tableWrap = document.getElementById('history-table-wrap');
  if (!emptyMsg) return;

  if (log.length === 0) {
    emptyMsg.classList.remove('hidden');
    tableWrap.classList.add('hidden');
    return;
  }

  emptyMsg.classList.add('hidden');
  tableWrap.classList.remove('hidden');

  const rows = [...log].reverse().map((e, di) => {
    const ri = log.length - 1 - di; // real index in the original array
    return `<tr>
      <td>${e.date}</td>
      <td class="num">${e.ffmi}</td>
      <td class="cat-cell">${e.ffmiCategory}</td>
      <td class="num">${e.leanMassLbs}</td>
      <td class="num">${e.bodyFatPct}%</td>
      <td class="num">${e.whr !== '' ? e.whr : '—'}</td>
      <td class="cat-cell">${e.whrCategory || '—'}</td>
      <td><button class="del-btn" onclick="deleteEntry(${ri})">✕</button></td>
    </tr>`;
  }).join('');

  tableWrap.innerHTML = `
    <div class="table-scroll">
      <table class="history-table">
        <thead>
          <tr>
            <th>Date</th><th>FFMI</th><th>Category</th>
            <th>Lean&nbsp;lbs</th><th>BF%</th>
            <th>WHR</th><th>WHR Cat</th><th></th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

// ── Main render ────────────────────────────────────────────────────────────
function render() {
  const result    = calculate(state.heightIn, state.weightLbs, state.bodyFatPct, state.waistIn);
  const resultsEl = document.getElementById('results');
  const emptyEl   = document.getElementById('empty-state');

  if (!result) {
    resultsEl.classList.add('hidden');
    emptyEl.classList.remove('hidden');
    return;
  }

  emptyEl.classList.add('hidden');
  resultsEl.classList.remove('hidden');

  // Date
  document.getElementById('result-date').textContent = displayDate();

  // FFMI value + category
  const ffmiCat = getFFMICategory(result.ffmi);
  document.getElementById('ffmi-value').textContent = fmt2(result.ffmi);
  document.getElementById('ffmi-value').style.color = ffmiCat.color;

  const ffmiCatCard = document.getElementById('ffmi-cat-card');
  ffmiCatCard.style.setProperty('--cat-color', ffmiCat.color);
  ffmiCatCard.style.setProperty('--cat-glow',  ffmiCat.glow);
  document.getElementById('ffmi-cat-name').textContent         = ffmiCat.label;
  document.getElementById('ffmi-cat-name').style.color         = ffmiCat.color;
  document.getElementById('ffmi-cat-pill').style.borderColor   = ffmiCat.color;
  document.getElementById('ffmi-cat-pill').style.color         = ffmiCat.color;

  const fp = ffmiScalePct(result.ffmi);
  document.getElementById('ffmi-fill').style.width  = fp + '%';
  document.getElementById('ffmi-marker').style.left = fp + '%';

  // Lean mass
  document.getElementById('lean-value').textContent = fmt1(result.leanLbs);

  // WHR
  const whrSection = document.getElementById('whr-section');
  if (result.whr !== null) {
    whrSection.classList.remove('hidden');
    const whrCat = getWHRCategory(result.whr);

    document.getElementById('whr-value').textContent = fmt2(result.whr);
    document.getElementById('whr-value').style.color = whrCat.color;

    const whrCatCard = document.getElementById('whr-cat-card');
    whrCatCard.style.setProperty('--cat-color', whrCat.color);
    whrCatCard.style.setProperty('--cat-glow',  whrCat.glow);
    document.getElementById('whr-cat-name').textContent       = whrCat.label;
    document.getElementById('whr-cat-name').style.color       = whrCat.color;
    document.getElementById('whr-cat-pill').style.borderColor = whrCat.color;
    document.getElementById('whr-cat-pill').style.color       = whrCat.color;
    document.getElementById('whr-cat-desc').textContent       = whrCat.desc;

    const wp = whrScalePct(result.whr);
    document.getElementById('whr-fill').style.width      = wp + '%';
    document.getElementById('whr-marker').style.left     = wp + '%';
    document.getElementById('whr-marker').style.background  = whrCat.color;
    document.getElementById('whr-marker').style.boxShadow   = '0 0 8px ' + whrCat.color;
  } else {
    whrSection.classList.add('hidden');
  }
}

// ── Inputs / Reset ─────────────────────────────────────────────────────────
function onInput(field, value) { state[field] = value; render(); }

function resetAll() {
  Object.keys(state).forEach(k => state[k] = '');
  document.querySelectorAll('.field-input').forEach(el => el.value = '');
  render();
  const btn = document.getElementById('reset-btn');
  btn.textContent = 'Cleared ✓';
  setTimeout(() => btn.textContent = 'Reset', 1200);
}

// ── Init ───────────────────────────────────────────────────────────────────
function init() {
  const app = document.getElementById('app');

  app.innerHTML = `
    <div class="grid-bg"></div>

    <header class="app-header">
      <div class="logo-wrap">
        <div class="logo-icon">
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M4 18 C4 14 7 12 11 12 C15 12 18 14 18 18" stroke="#00d4ff" stroke-width="1.5" stroke-linecap="round"/>
            <circle cx="11" cy="7" r="3.5" stroke="#00d4ff" stroke-width="1.5"/>
            <path d="M7 12.5 L5 16 M15 12.5 L17 16" stroke="#00d4ff" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
        </div>
        <div>
          <div class="logo-title">FFMI<span>Calc</span></div>
          <div class="logo-sub">Body Composition</div>
        </div>
      </div>
      <button id="reset-btn" class="reset-btn" onclick="resetAll()">Reset</button>
    </header>

    <main class="main">

      <div class="section-head">Measurements</div>

      <div class="input-panel">
        <div class="input-grid">

          <div class="field">
            <label class="field-label" for="f-height">Height</label>
            <div class="input-wrap">
              <input id="f-height" class="field-input has-suf" type="number"
                inputmode="decimal" placeholder="70" min="0" step="0.5"
                oninput="onInput('heightIn', this.value)"/>
              <span class="input-suf">IN</span>
            </div>
          </div>

          <div class="field">
            <label class="field-label" for="f-weight">Weight</label>
            <div class="input-wrap">
              <input id="f-weight" class="field-input has-suf" type="number"
                inputmode="decimal" placeholder="180" min="0" step="0.5"
                oninput="onInput('weightLbs', this.value)"/>
              <span class="input-suf">LBS</span>
            </div>
          </div>

          <div class="field">
            <label class="field-label" for="f-bf">Body Fat %</label>
            <div class="input-wrap">
              <input id="f-bf" class="field-input has-suf" type="number"
                inputmode="decimal" placeholder="15" min="0" max="99" step="0.5"
                oninput="onInput('bodyFatPct', this.value)"/>
              <span class="input-suf">%</span>
            </div>
          </div>

          <div class="field">
            <label class="field-label" for="f-waist">Waist <span style="font-size:9px;color:#2a3f5a;text-transform:none;letter-spacing:0">(optional)</span></label>
            <div class="input-wrap">
              <input id="f-waist" class="field-input has-suf" type="number"
                inputmode="decimal" placeholder="34" min="0" step="0.5"
                oninput="onInput('waistIn', this.value)"/>
              <span class="input-suf">IN</span>
            </div>
          </div>

        </div>
      </div>

      <!-- RESULTS -->
      <div id="results" class="hidden">

        <div class="date-save-row">
          <div class="result-date-wrap">
            <span class="result-date-label">Date</span>
            <span class="result-date" id="result-date"></span>
          </div>
          <button id="save-btn" class="save-btn" onclick="saveEntry()">Save to Log</button>
        </div>

        <div class="section-head">FFMI Results</div>

        <div class="results-grid">

          <div class="result-card" style="--card-accent: var(--cyan)">
            <div class="card-label">Fat Free Mass Index</div>
            <div class="card-value" id="ffmi-value">—</div>
            <div class="card-unit">FFMI</div>
          </div>

          <div class="result-card" style="--card-accent: var(--teal)">
            <div class="card-label">Lean Body Mass</div>
            <div class="card-value small" style="color:var(--teal)" id="lean-value">—</div>
            <div class="card-unit">LBS</div>
          </div>

          <div class="category-card full" id="ffmi-cat-card">
            <div class="cat-header">
              <span class="cat-section-label">FFMI Category</span>
              <span class="cat-pill" id="ffmi-cat-pill">FFMI</span>
            </div>
            <div class="cat-name" id="ffmi-cat-name">—</div>
            <div class="scale-wrap">
              <div class="scale-track">
                <div class="scale-fill" id="ffmi-fill" style="width:0%"></div>
                <div class="scale-marker" id="ffmi-marker" style="left:0%"></div>
              </div>
              <div class="scale-labels">
                <span>Below Avg</span><span>Average</span><span>Above Avg</span><span>Muscular</span>
              </div>
            </div>
          </div>

        </div>

        <div id="whr-section" class="hidden">
          <div class="section-head" style="margin-top:4px">Waist-to-Height Results</div>
          <div class="results-grid">

            <div class="result-card" style="--card-accent: var(--cyan)">
              <div class="card-label">Waist-to-Height Ratio</div>
              <div class="card-value" id="whr-value">—</div>
              <div class="card-unit">RATIO</div>
            </div>

            <div class="category-card" id="whr-cat-card">
              <div class="cat-header">
                <span class="cat-section-label">Category</span>
                <span class="cat-pill" id="whr-cat-pill">WHR</span>
              </div>
              <div class="cat-name" id="whr-cat-name">—</div>
              <div class="cat-desc" id="whr-cat-desc"></div>
            </div>

            <div class="result-card full" style="--card-accent: var(--cyan); padding: 14px 16px">
              <div class="card-label" style="margin-bottom:12px">WHR Scale</div>
              <div class="scale-track">
                <div class="scale-fill" id="whr-fill" style="width:0%"></div>
                <div class="scale-marker" id="whr-marker" style="left:0%"></div>
              </div>
              <div class="scale-labels">
                <span>Slim</span><span>Healthy</span><span>Overweight</span><span>Obese</span>
              </div>
            </div>

          </div>
        </div>

        <p class="disclaimer">
          ⚠️ For informational purposes only. Not medical advice.
          FFMI is a general indicator of muscle mass relative to body size.
          Consult a qualified health professional for personalised guidance.
        </p>
      </div>

      <!-- EMPTY STATE -->
      <div id="empty-state" class="empty-state">
        <div class="empty-icon">
          <svg width="72" height="72" viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="36" cy="36" r="34" stroke="rgba(0,212,255,0.15)" stroke-width="1.5"/>
            <circle cx="36" cy="24" r="8" stroke="rgba(0,212,255,0.4)" stroke-width="1.5"/>
            <path d="M18 56 C18 46 26 40 36 40 C46 40 54 46 54 56" stroke="rgba(0,212,255,0.4)" stroke-width="1.5" stroke-linecap="round"/>
            <path d="M26 41 L22 52 M46 41 L50 52" stroke="rgba(0,212,255,0.25)" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
        </div>
        <p class="empty-title">Enter your measurements</p>
        <p class="empty-sub">Fill in height, weight and body fat % to calculate your FFMI. Add waist size for your waist-to-height ratio.</p>
      </div>

      <!-- HISTORY LOG -->
      <div class="section-head" style="margin-top:8px">History Log</div>

      <div class="storage-panel">
        <div class="storage-meta">
          <span id="storage-count" class="storage-count">0 entries</span>
          <span id="storage-used"  class="storage-used">0 B of 5 MB used</span>
        </div>
        <div class="storage-track">
          <div id="storage-fill" class="storage-fill" style="width:0%"></div>
        </div>
        <div class="history-actions">
          <button class="action-btn export-btn" onclick="exportCSV()">⬇ Export CSV</button>
          <button class="action-btn clear-log-btn" onclick="clearLog()">🗑 Clear All</button>
        </div>
      </div>

      <p id="history-empty" class="history-empty">No entries yet — calculate your results then tap "Save to Log".</p>
      <div id="history-table-wrap" class="hidden"></div>

    </main>
  `;

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }

  render();
  renderHistory();
  renderStorageBar();
}

document.addEventListener('DOMContentLoaded', init);
