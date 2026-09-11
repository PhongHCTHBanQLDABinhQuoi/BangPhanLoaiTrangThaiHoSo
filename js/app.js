/* ═══════════════════════════════════════════════════════════
   DOVETAIL APPLICATION ENGINE — EXECUTIVE BI & STAFF EVALUATION
   (Modular Frontend Application Logic)
   ═══════════════════════════════════════════════════════════ */

"use strict";

/* ── DOM Selectors & Palette ── */
const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);

const PAL = ['#6798ff','#10b981','#3b82f6','#ef4444','#8b5cf6','#0ea5e9','#d97706','#14b8a6','#f97316','#a78bfa','#ec4899','#f43f5e'];
/* Lõi nghiệp vụ dùng chung với trang /bangbaocao — xem js/report-engine.js */
const RE = window.ReportEngine;
const EMPTY = RE.EMPTY;
const PRIORITY = ['giai đoạn','tổ/phòng','trạng thái','trạng thái sla','người phụ trách','giao cho','nhóm về hiện trạng','nhóm có gcn/không có gcn','nhóm pháp lý tặng, cho, chuyển nhượng','nhóm tách thửa/ không tách thửa','người tạo','nhãn'];

/* Suy ra Tổ/Phòng: logic + TEAM_MAP nằm ở js/report-engine.js */
const TEAM_COL = RE.TEAM_COL;
const resolveTeam = RE.resolveTeam;

/* ── Global State ── */
let headers = [];
let rows = [];
let filters = {};
let filterCols = [];
let charts = [];
let page = 1;
let PER = 20;
let tableQuery = '';
let sortCol = -1;
let sortAsc = true;
let stageMap = {};
let stageOrder = {};          // mã giai đoạn → thứ tự trong quy trình (Base trả về)
let META = {};                 // meta của payload (nguồn, thời điểm cập nhật) — dùng khi xuất Excel
let liveLoading = false;
let autoTimer = null;
let _liveRetryTimer = null;
let _monthlyChartInstance = null;

/* ── Formatters & Utilities ── */
function fmt(n){ return (n || 0).toLocaleString('vi'); }
function pct(n, total){ return (total ? (n / total * 100).toFixed(1) : '0.0') + '%'; }
function escH(s){ return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function short(s, len){ s = String(s || ''); return s.length > len ? s.slice(0, len) + '…' : s; }
function ci(kw){ return headers.findIndex(h => h.toLowerCase().includes(kw)); }

function uniqueVals(data, cIdx){
  const m = new Map();
  data.forEach(r => {
    const v = r[cIdx] || EMPTY;
    m.set(v, (m.get(v) || 0) + 1);
  });
  return m;
}

function updateConn(ok, msg){
  const dot = $('#connDot'); if(dot) dot.className = 'dot ' + (ok ? 'on' : 'off');
  const txt = $('#connText'); if(txt) txt.textContent = msg || '';
}

function fmtMeta(d){
  const m = d.meta || {};
  META = m;
  let s = 'Cập nhật: ' + (m.updated || '') + ' · ' + fmt(d.rows.length) + ' hồ sơ';
  if(m.total_reported) s += ' / ' + fmt(m.total_reported);
  s += ' · Nguồn: ' + (m.source || 'Base Workflow');
  if(m.warning) s += ' ⚠ ' + m.warning;
  return s;
}

/* ── Navigation Tabs Switch ── */
$$('.tab-btn').forEach(btn => {
  btn.onclick = () => {
    $$('.tab-btn').forEach(b => b.classList.remove('active'));
    $$('.tab-pane').forEach(p => p.classList.add('hidden'));
    btn.classList.add('active');
    const target = $('#' + btn.dataset.tab);
    if(target) target.classList.remove('hidden');
    if(btn.dataset.tab === 'tab-monthly-kpi'){
      renderMonthlyKPI(filteredRows());
    } else if(btn.dataset.tab === 'tab-team'){
      renderDeep(filteredRows());
    } else if(btn.dataset.tab === 'tab-audit'){
      renderAudit(filteredRows());
    }
  };
});

/* ── Data Engine & Filtering ── */
function applyData(hdrs, rws, stgMap, stgOrder){
  headers = hdrs.map(h => String(h).trim() || '(cột)');
  rows = (rws || []).map(r => headers.map((_, i) => String(r[i] ?? '').trim()));
  stageMap = stgMap || {};
  stageOrder = stgOrder || {};
  enrichTeam();
  detectFilterCols();
  buildMoveLog();                // dựng nhật ký chuyển bước cho tab 7
  filters = {};
  auditF = { from: '', to: '', stFrom: '', stTo: '', by: '', recv: '', dir: '', q: '' };
  auditPage = 1;
  page = 1;
  tableQuery = '';
  sortCol = -1;
  sortAsc = true;

  const ts = $('#tableSearch'); if(ts) ts.value = '';
  buildFilterBar();
  buildMonthPickerOptions();
  render();
}

function enrichTeam(){
  RE.enrichTeam(headers, rows);
}

function detectFilterCols(){
  const c = [];
  headers.forEach((h, ci) => {
    const u = uniqueVals(rows, ci).size;
    if(u >= 2 && u <= 60 && u < rows.length * 0.5) c.push({ ci, h, u });
  });
  c.sort((a, b) => {
    const pa = PRIORITY.indexOf(a.h.toLowerCase()), pb = PRIORITY.indexOf(b.h.toLowerCase());
    return (pa < 0 ? 99 : pa) - (pb < 0 ? 99 : pb) || a.u - b.u;
  });
  filterCols = c.slice(0, 9);
  const ti = headers.indexOf(TEAM_COL);
  if(ti >= 0 && !filterCols.some(f => f.ci === ti)){
    const u = uniqueVals(rows, ti).size;
    if(u >= 1) filterCols.splice(1, 0, { ci: ti, h: TEAM_COL, u });
    filterCols = filterCols.slice(0, 9);
  }
}

/* ═══════════════════════════════════════════════════════════
   DOVETAIL MASTER FILTER ENGINE — UNIFIED FILTERING SYSTEM
   ═══════════════════════════════════════════════════════════ */

/* Chuẩn hoá GCN: xem js/report-engine.js */
const normGCN = RE.normGCN;

function filteredRows(){
  const activeEntries = Object.entries(filters).filter(([_, v]) => v !== undefined && v !== null && String(v).trim() !== '');
  if(!activeEntries.length) return rows;

  const gcnIdx = ci('gcn');

  return rows.filter(r => activeEntries.every(([ciKey, val]) => {
    const colIdx = +ciKey;
    const rawF = String(val || '').trim();
    const rawCell = String(r[colIdx] || EMPTY).trim();

    if(!rawF) return true;

    // Strict GCN Column Filtering
    if(colIdx === gcnIdx){
      const targetGcn = normGCN(rawF);
      const cellGcn = normGCN(rawCell);
      return targetGcn === cellGcn;
    }

    const f = rawF.toLowerCase();
    const cellVal = rawCell.toLowerCase();

    if(cellVal === f) return true;

    // SLA Overdue matching
    if((f.includes('trễ') || f.includes('overdue')) && cellVal.includes('trễ')) return true;

    return cellVal === f;
  }));
}

/* ── Build Clean Master Filter Bar ── */
function buildFilterBar(){
  const bar = $('#filterBar'); if(!bar) return; bar.innerHTML = '';

  const stgI = headers.findIndex(h => h.toLowerCase() === 'giai đoạn' || h.toLowerCase().includes('giai đoạn'));
  const teamI = headers.indexOf(TEAM_COL);
  const ttJobI = headers.findIndex(h => h.toLowerCase() === 'trạng thái');
  const slaI = headers.findIndex(h => h.toLowerCase().includes('trạng thái sla'));
  const gcI = headers.findIndex(h => h.toLowerCase().includes('phụ trách') || h.toLowerCase().includes('giao cho'));
  const htI = headers.findIndex(h => h.toLowerCase().includes('hiện trạng'));
  const gcnI = headers.findIndex(h => h.toLowerCase().includes('gcn'));
  const plI = headers.findIndex(h => h.toLowerCase().includes('tặng') || h.toLowerCase().includes('chuyển nhượng'));
  const tachI = headers.findIndex(h => h.toLowerCase().includes('tách thửa'));

  const filterSpecs = [
    { ci: stgI, title: 'Giai đoạn' },
    { ci: teamI, title: 'Tổ/Phòng' },
    { ci: ttJobI, title: 'Trạng thái' },
    { ci: slaI, title: 'Trạng thái SLA' },
    { ci: gcI, title: 'Người phụ trách' },
    { ci: htI, title: 'NHÓM VỀ HIỆN TRẠNG' },
    { ci: gcnI, title: 'NHÓM CÓ GCN/KHÔNG CÓ GCN' },
    { ci: plI, title: 'NHÓM PHÁP LÝ TẶNG, CHO, CHUYỂN NHƯỢNG' },
    { ci: tachI, title: 'NHÓM TÁCH THỬA/ KHÔNG TÁCH THỬA' }
  ].filter(s => s.ci >= 0);

  filterSpecs.forEach(spec => {
    const w = document.createElement('div');
    let vals = [];
    if(spec.ci === gcnI){
      const gcnMap = new Map();
      rows.forEach(r => {
        const norm = normGCN(r[gcnI]);
        gcnMap.set(norm, (gcnMap.get(norm) || 0) + 1);
      });
      vals = [...gcnMap.entries()].sort((a, b) => b[1] - a[1]);
    } else {
      vals = [...uniqueVals(rows, spec.ci).entries()].sort((a, b) => String(a[0]).localeCompare(String(b[0]), 'vi'));
    }
    w.innerHTML = `<label for="f_${spec.ci}">${escH(spec.title)}</label>`;
    const sel = document.createElement('select'); sel.id = 'f_' + spec.ci;
    sel.innerHTML = `<option value="">— Tất cả (${fmt(rows.length)}) —</option>` + vals.map(([v, n]) => `<option value="${escH(v)}">${escH(v)} (${fmt(n)})</option>`).join('');
    if(filters[spec.ci]) sel.value = filters[spec.ci];
    sel.onchange = () => { filters[spec.ci] = sel.value; page = 1; render(); };
    w.appendChild(sel); bar.appendChild(w);
  });

  const act = document.createElement('div'); act.className = 'filter-acts';
  const btn = document.createElement('button'); btn.className = 'btn'; btn.textContent = '✕ Xóa tất cả lọc';
  btn.onclick = () => { filters = {}; page = 1; buildFilterBar(); render(); };
  act.appendChild(btn); bar.appendChild(act);
}

function renderNote(data){
  const box = $('#activeNote'); if(!box) return;
  const activeEntries = Object.entries(filters).filter(([_, v]) => v !== undefined && v !== null && String(v).trim() !== '');
  if(!activeEntries.length){
    box.innerHTML = `⚡ Hiển thị <b>tất cả ${fmt(data.length)}</b> hồ sơ dự án`;
    return;
  }
  const tags = activeEntries.map(([ci, val]) => `<span>${escH(headers[+ci] || 'Lọc')}: <b>${escH(val)}</b></span>`).join(' · ');
  box.innerHTML = `🔍 <b>Đang lọc (${fmt(data.length)} hồ sơ):</b> ${tags} <button class="btn btn-ghost" style="padding:2px 8px;margin-left:10px" onclick="filters={};page=1;buildFilterBar();render();">✕ Bỏ lọc</button>`;
}

function setupQuickFilters(){
  const btnOverdue = $('#btnQuickOverdue');
  if(btnOverdue){
    btnOverdue.onclick = () => {
      const slaI = ci('trạng thái sla');
      if(slaI >= 0){
        filters = {}; filters[slaI] = 'Trễ'; page = 1; buildFilterBar(); render();
      }
    };
  }
  const btnNoGCN = $('#btnQuickNoGCN');
  if(btnNoGCN){
    btnNoGCN.onclick = () => {
      const gcnI = ci('gcn');
      if(gcnI >= 0){
        filters = {}; filters[gcnI] = 'KHÔNG CÓ GCN'; page = 1; buildFilterBar(); render();
      }
    };
  }
  const btnReset = $('#btnResetFilters');
  if(btnReset){
    btnReset.onclick = () => {
      filters = {}; page = 1; buildFilterBar(); render();
    };
  }
}

/* ── Build Month Picker ── */
function buildMonthPickerOptions(){
  const sel = $('#monthPickerSelect'); if(!sel) return;
  const movesColIdx = headers.findIndex(h => h.toLowerCase().includes('chuyển bước'));
  const monthsSet = new Set();

  if(movesColIdx >= 0){
    rows.forEach(r => {
      try {
        const raw = r[movesColIdx];
        const moves = typeof raw === 'string' ? JSON.parse(raw || '[]') : (raw || []);
        moves.forEach(m => {
          const ts = parseInt(m.st || m.et || 0);
          if(ts > 0){
            const dt = new Date(ts * 1000);
            const mKey = dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0');
            monthsSet.add(mKey);
          }
        });
      } catch(e){}
    });
  }

  const sortedMonths = [...monthsSet].sort().reverse();
  let html = `<option value="ALL">— Tất Cả Các Tháng (${fmt(rows.length)} hồ sơ) —</option>`;
  html += sortedMonths.map(mKey => {
    const [y, m] = mKey.split('-');
    return `<option value="${mKey}">Tháng ${m}/${y}</option>`;
  }).join('');

  sel.innerHTML = html;
  sel.value = 'ALL';
  sel.onchange = () => renderMonthlyKPI(filteredRows());
}

/* ── Chart Registration & Utility ── */
if(window.ChartDataLabels) Chart.register(ChartDataLabels);
Chart.defaults.font.family = "'Inter', ui-sans-serif, system-ui, sans-serif";
Chart.defaults.font.size = 11.5;
Chart.defaults.color = '#a7a7a7';
Chart.defaults.borderColor = 'rgba(49, 49, 49, 0.4)';
Chart.defaults.plugins.datalabels.display = true;
Chart.defaults.plugins.datalabels.color = '#ffffff';
Chart.defaults.plugins.datalabels.font = { family: 'JetBrains Mono', weight: '600', size: 9.5 };
Chart.defaults.plugins.datalabels.formatter = (val) => val ? fmt(val) : '';
Chart.defaults.plugins.datalabels.textStrokeColor = 'rgba(0,0,0,0.8)';
Chart.defaults.plugins.datalabels.textStrokeWidth = 2;
Chart.defaults.plugins.tooltip.backgroundColor = '#141414';
Chart.defaults.plugins.tooltip.borderColor = '#313131';
Chart.defaults.plugins.tooltip.borderWidth = 1;
Chart.defaults.plugins.tooltip.titleFont = { family: 'Inter', weight: '600' };
Chart.defaults.plugins.tooltip.bodyFont = { family: 'JetBrains Mono' };
Chart.defaults.plugins.tooltip.cornerRadius = 6;
Chart.defaults.plugins.tooltip.padding = 10;

function aggTop(data, c, n){
  const m = uniqueVals(data, c);
  const e = [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);
  return { labels: e.map(x => short(x[0], 30)), counts: e.map(x => x[1]) };
}

function aggTopFull(data, c, n){
  const m = uniqueVals(data, c);
  const e = [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);
  return { labels: e.map(x => short(x[0], 22)), counts: e.map(x => x[1]), fulls: e.map(x => x[0]) };
}

function mkChart(grid, span, title, tall, make){
  const card = document.createElement('div'); card.className = 'ccard ' + span;
  card.innerHTML = `<h3>${title}</h3><div class="cbox ${tall}"><canvas></canvas></div>`;
  grid.appendChild(card);
  charts.push(make(card.querySelector('canvas')));
}

/* ── Master Render Function ── */
function render(){
  charts.forEach(c => { try { if(c && c.destroy) c.destroy(); } catch(e){} });
  charts = [];
  const data = filteredRows();
  try { renderNote(data); } catch(e){ console.error('renderNote error:', e); }
  try { renderKPI(data); } catch(e){ console.error('renderKPI error:', e); }
  try { renderOverviewCharts(data); } catch(e){ console.error('renderOverviewCharts error:', e); }
  try { renderInsights(data); } catch(e){ console.error('renderInsights error:', e); }
  try { renderFunnel(data); } catch(e){ console.error('renderFunnel error:', e); }
  try { renderStageCross(data); } catch(e){ console.error('renderStageCross error:', e); }
  try { renderDonuts(data); } catch(e){ console.error('renderDonuts error:', e); }
  try { renderDeep(data); } catch(e){ console.error('renderDeep error:', e); }
  try { renderSLATable(data); } catch(e){ console.error('renderSLATable error:', e); }
  try { renderStageBottlenecks(data); } catch(e){ console.error('renderStageBottlenecks error:', e); }
  try { renderLegalRiskTable(data); } catch(e){ console.error('renderLegalRiskTable error:', e); }
  try { renderLegalReport(data); } catch(e){ console.error('renderLegalReport error:', e); }
  try { renderMonthlyKPI(data); } catch(e){ console.error('renderMonthlyKPI error:', e); }
  try { renderTable(data); } catch(e){ console.error('renderTable error:', e); }
  try { renderAudit(data); } catch(e){ console.error('renderAudit error:', e); }
}

/* ── Render Modules ── */
function renderNote(data){
  const nb = $('#activeNote'); if(!nb) return;
  const isFiltered = data.length !== rows.length;
  nb.innerHTML = isFiltered ? `<div class="note-banner">🔍 Đang lọc: <b>${fmt(data.length)}</b> / <b>${fmt(rows.length)}</b> hồ sơ.</div>` : '';
}

function renderKPI(data){
  const bar = $('#kpiBar'); if(!bar) return; bar.innerHTML = ''; const T = data.length;
  const ca = $('#countAll'); if(ca) ca.textContent = fmt(T);

  const items = [];
  items.push({ 
    s: 's-amber', 
    v: fmt(T), 
    sub: ' / ' + fmt(rows.length), 
    lbl: 'Tổng hồ sơ toàn bộ dữ liệu (' + pct(T, rows.length) + ')', 
    barPct: rows.length ? T / rows.length * 100 : 0, 
    barColor: 'var(--color-blue-cornflower)' 
  });

  const slaIdx = ci('trạng thái sla');
  if(slaIdx >= 0){
    const overdueCount = data.filter(r => String(r[slaIdx] || '').startsWith('Trễ')).length;
    const onTimeCount = T - overdueCount;
    const onTimePct = T ? (onTimeCount / T * 100).toFixed(1) + '%' : '0.0%';
    const co = $('#countOverdue'); if(co) co.textContent = fmt(overdueCount);

    items.push({ 
      s: 's-emerald', 
      v: onTimePct, 
      sub: ' · ' + fmt(onTimeCount) + ' hs', 
      lbl: '✅ Tỷ lệ Đúng Hạn SLA (KPI)', 
      barPct: T ? onTimeCount / T * 100 : 0, 
      barColor: 'var(--emerald)' 
    });

    items.push({ 
      s: 's-red', 
      v: fmt(overdueCount), 
      sub: ' · ' + pct(overdueCount, T), 
      lbl: '🚨 Hồ sơ Trễ hạn SLA (Quá hạn)', 
      barPct: T ? overdueCount / T * 100 : 0, 
      barColor: 'var(--red)' 
    });
  }

  const gcn = ci('gcn');
  if(gcn >= 0){
    const co = data.filter(r => normGCN(r[gcn]) === 'CÓ GCN').length;
    const ko = data.filter(r => normGCN(r[gcn]) === 'KHÔNG CÓ GCN').length;
    items.push({ 
      s: 's-violet', 
      v: pct(co, T), 
      sub: ' · ' + fmt(co) + ' hs', 
      lbl: '📄 CÓ Giấy chứng nhận (GCN)', 
      barPct: T ? co / T * 100 : 0, 
      barColor: 'var(--violet)' 
    });
    items.push({ 
      s: 's-amber', 
      v: pct(ko, T), 
      sub: ' · ' + fmt(ko) + ' hs', 
      lbl: '⚠️ KHÔNG có GCN (Cần xác minh)', 
      barPct: T ? ko / T * 100 : 0, 
      barColor: 'var(--amber)' 
    });
  }

  items.forEach(k => {
    const d = document.createElement('div'); d.className = 'hero-card';
    d.innerHTML = `<div class="stripe ${k.s}"></div><div class="value">${k.v}<small>${k.sub}</small></div><div class="label">${k.lbl}</div>` +
      (k.barPct !== undefined ? `<div class="bar"><i style="width:${k.barPct.toFixed(1)}%;background:${k.barColor}"></i></div>` : '');
    bar.appendChild(d);
  });
}

function renderOverviewCharts(data){
  if(!data.length) return;

  const T = data.length;
  const slaIdx = ci('trạng thái sla');
  const stgIdx = ci('giai đoạn');
  const teamIdx = headers.indexOf(TEAM_COL);
  const gcnIdx = ci('gcn');

  // 1. Chart SLA Donut
  const cvSla = $('#chartSlaDonut');
  if(cvSla && slaIdx >= 0){
    const overdueCount = data.filter(r => String(r[slaIdx] || '').startsWith('Trễ')).length;
    const onTimeCount = T - overdueCount;

    charts.push(new Chart(cvSla, {
      type: 'doughnut',
      data: {
        labels: ['Đúng Hạn SLA', 'Trễ Hạn SLA'],
        datasets: [{
          data: [onTimeCount, overdueCount],
          backgroundColor: ['#10b981', '#ef4444'],
          borderWidth: 2,
          borderColor: '#1e1e1e'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { boxWidth: 10, padding: 4, font: { size: 10 } } },
          datalabels: {
            display: true,
            color: '#ffffff',
            font: { family: 'JetBrains Mono', weight: '700', size: 10 },
            formatter: (val) => val ? `${fmt(val)}\n(${pct(val, T)})` : '',
            textStrokeColor: 'rgba(0,0,0,0.8)',
            textStrokeWidth: 2
          },
          tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${fmt(ctx.raw)} hs (${pct(ctx.raw, T)})` } }
        }
      }
    }));
  }

  // 2. Chart GCN Donut
  const cvGcn = $('#chartGcnDonut');
  if(cvGcn && gcnIdx >= 0){
    const co = data.filter(r => normGCN(r[gcnIdx]) === 'CÓ GCN').length;
    const ko = data.filter(r => normGCN(r[gcnIdx]) === 'KHÔNG CÓ GCN').length;
    const cx = T - co - ko;

    const gcnLabels = ['Có GCN', 'Không GCN'];
    const gcnCounts = [co, ko];
    const gcnColors = ['#10b981', '#8b5cf6'];
    if(cx > 0){ gcnLabels.push('Chưa xác định'); gcnCounts.push(cx); gcnColors.push('#64748b'); }

    charts.push(new Chart(cvGcn, {
      type: 'doughnut',
      data: {
        labels: gcnLabels,
        datasets: [{
          data: gcnCounts,
          backgroundColor: gcnColors,
          borderWidth: 2,
          borderColor: '#1e1e1e'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { boxWidth: 10, padding: 4, font: { size: 10 } } },
          datalabels: {
            display: true,
            color: '#ffffff',
            font: { family: 'JetBrains Mono', weight: '700', size: 10 },
            formatter: (val) => val ? `${fmt(val)}\n(${pct(val, T)})` : '',
            textStrokeColor: 'rgba(0,0,0,0.8)',
            textStrokeWidth: 2
          },
          tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${fmt(ctx.raw)} hs (${pct(ctx.raw, T)})` } }
        }
      }
    }));
  }

  // 3. Chart 8 Stage Bar
  const cvStage = $('#chartStageBar');
  if(cvStage && stgIdx >= 0){
    const m = uniqueVals(data, stgIdx);
    const stages = [...m.entries()].sort((a, b) => String(a[0]).localeCompare(String(b[0]), 'vi', { numeric: true }));

    charts.push(new Chart(cvStage, {
      type: 'bar',
      data: {
        labels: stages.map(x => short(x[0], 16)),
        datasets: [{
          label: 'Hồ sơ',
          data: stages.map(x => x[1]),
          backgroundColor: '#3b82f6',
          borderRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          datalabels: {
            display: true,
            color: '#ffffff',
            anchor: 'end',
            align: 'top',
            offset: -1,
            font: { family: 'JetBrains Mono', weight: '700', size: 9 },
            formatter: (val) => val ? `${fmt(val)}\n(${pct(val, T)})` : '',
            textStrokeColor: 'rgba(0,0,0,0.8)',
            textStrokeWidth: 2
          },
          tooltip: { callbacks: { label: ctx => ` ${fmt(ctx.raw)} hồ sơ (${pct(ctx.raw, T)})` } }
        },
        scales: {
          x: { grid: { display: false }, ticks: { font: { size: 9 } } },
          y: { beginAtZero: true, ticks: { precision: 0 } }
        }
      }
    }));
  }

  // 4. Chart Team Bar
  const cvTeam = $('#chartTeamBar');
  if(cvTeam && teamIdx >= 0){
    const d = aggTopFull(data, teamIdx, 5);

    charts.push(new Chart(cvTeam, {
      type: 'bar',
      data: {
        labels: d.labels,
        datasets: [{
          label: 'Hồ sơ',
          data: d.counts,
          backgroundColor: ['#6798ff', '#8b5cf6', '#10b981', '#0ea5e9', '#d97706'],
          borderRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          datalabels: {
            display: true,
            color: '#ffffff',
            anchor: 'end',
            align: 'top',
            offset: -1,
            font: { family: 'JetBrains Mono', weight: '700', size: 9.5 },
            formatter: (val) => val ? `${fmt(val)} (${pct(val, T)})` : '',
            textStrokeColor: 'rgba(0,0,0,0.8)',
            textStrokeWidth: 2
          },
          tooltip: { callbacks: { label: ctx => ` ${fmt(ctx.raw)} hồ sơ (${pct(ctx.raw, T)})` } }
        },
        scales: {
          x: { grid: { display: false }, ticks: { font: { size: 9.5 } } },
          y: { beginAtZero: true, ticks: { precision: 0 } }
        }
      }
    }));
  }
}

function renderInsights(data){
  const box = $('#insightsBox'); if(!box) return; const T = data.length;
  if(!T){ box.innerHTML = '<div class="insight-item">Không có dữ liệu.</div>'; return; }

  const ins = [];
  const slaIdx = ci('trạng thái sla');
  if(slaIdx >= 0){
    const od = data.filter(r => String(r[slaIdx] || '').startsWith('Trễ')).length;
    const ok = T - od;
    const okRate = T ? (ok / T * 100).toFixed(1) : 0;
    if(od > 0){
      ins.push(`🚨 <b>Tỷ lệ đáp ứng KPI SLA toàn dự án: ${okRate}%</b> — Hiện tại có <b>${fmt(od)}</b> hồ sơ trễ hạn SLA (${pct(od, T)}). Cần tập trung tháo gỡ điểm nghẽn tại các bước quá hạn.`);
    } else {
      ins.push(`🎉 <b>Tỷ lệ đáp ứng KPI SLA toàn dự án: 100%</b> — Tất cả ${fmt(T)} hồ sơ hiện tại đều đang được xử lý đúng tiến độ quy định!`);
    }
  }

  const stgIdx = ci('giai đoạn');
  if(stgIdx >= 0){
    const m = uniqueVals(data, stgIdx);
    const top = [...m.entries()].sort((a, b) => b[1] - a[1])[0];
    if(top) ins.push(`📌 <b>Điểm tập trung quy trình:</b> Giai đoạn <b>${escH(top[0])}</b> đang dồn ứ nhiều hồ sơ nhất với <b>${fmt(top[1])}</b> hồ sơ (${pct(top[1], T)} toàn dự án).`);
  }

  const gcnIdx = ci('gcn');
  if(gcnIdx >= 0){
    const ko = data.filter(r => normGCN(r[gcnIdx]) === 'KHÔNG CÓ GCN').length;
    if(ko > 0){
      ins.push(`⚠️ <b>Rủi ro pháp lý đất đai:</b> Có <b>${fmt(ko)}</b> hồ sơ chưa/không có GCN (${pct(ko, T)}). Cần ưu tiên thẩm định xác minh nguồn gốc đất.`);
    }
  }

  const teamIdx = headers.indexOf(TEAM_COL);
  if(teamIdx >= 0){
    const m = uniqueVals(data, teamIdx);
    const topTeam = [...m.entries()].sort((a, b) => b[1] - a[1])[0];
    if(topTeam){
      ins.push(`👥 <b>Khối lượng theo Tổ:</b> <b>${escH(topTeam[0])}</b> đang đảm nhận khối lượng lớn nhất với <b>${fmt(topTeam[1])}</b> hồ sơ (${pct(topTeam[1], T)}).`);
    }
  }

  box.innerHTML = ins.map(i => `<div class="insight-item">${i}</div>`).join('');
}

function renderFunnel(data){
  const box = $('#funnelRows'); if(!box) return; const T = data.length;
  const stgIdx = ci('giai đoạn'); if(stgIdx < 0){ box.innerHTML = 'Không có cột giai đoạn'; return; }

  const m = uniqueVals(data, stgIdx);
  const stages = [...m.entries()].sort((a, b) => String(a[0]).localeCompare(String(b[0]), 'vi', { numeric: true }));

  box.innerHTML = stages.map(([stg, count]) => `
    <div class="funnel-row" onclick="window._applyF(${stgIdx},'${escH(stg)}')">
      <div class="f-lbl">${escH(stg)}</div>
      <div class="f-bar-wrap"><div class="f-bar" style="width:${T ? (count / T * 100).toFixed(1) : 0}%"></div></div>
      <div class="f-val">${fmt(count)} hs <span>(${pct(count, T)})</span></div>
    </div>
  `).join('');
}

window._applyF = function(ci, val){
  filters[ci] = filters[ci] === val ? '' : val;
  page = 1; buildFilterBar(); render();
};

function renderStageCross(data){
  const grid = $('#pivotGrid'); if(!grid) return; grid.innerHTML = '';
  const cstg = ci('giai đoạn'), csla = ci('trạng thái sla');
  if(cstg < 0 || csla < 0) return;

  const stgs = [...uniqueVals(data, cstg).keys()].sort();
  const slas = [...uniqueVals(data, csla).keys()].sort();
  const matrix = {};

  stgs.forEach(s => { matrix[s] = {}; slas.forEach(l => matrix[s][l] = 0); });
  data.forEach(r => { const s = r[cstg] || EMPTY, l = r[csla] || EMPTY; if(matrix[s] && matrix[s][l] !== undefined) matrix[s][l]++; });

  mkChart(grid, 'col-12', 'Tiến Độ SLA Theo Giai Đoạn (Số Lượng)', 'medium', ctx => new Chart(ctx, {
    type: 'bar',
    data: {
      labels: stgs.map(s => short(s, 22)),
      datasets: slas.map((l, i) => ({
        label: l,
        data: stgs.map(s => matrix[s][l]),
        backgroundColor: PAL[i % PAL.length]
      }))
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true } }
    }
  }));
}

function renderDonuts(data){
  const grid = $('#donutGrid'); if(!grid) return; grid.innerHTML = '';
  const gcn = ci('gcn'), pl = ci('pháp lý tặng'), cl = ci('% checklist');

  if(gcn >= 0){
    const d = aggTop(data, gcn, 10);
    mkChart(grid, 'col-4', 'Nhóm Có GCN / Không GCN', 'small', ctx => new Chart(ctx, {
      type: 'doughnut',
      data: { labels: d.labels, datasets: [{ data: d.counts, backgroundColor: PAL }] },
      options: { responsive: true, maintainAspectRatio: false }
    }));
  }

  if(pl >= 0){
    const d = aggTop(data, pl, 10);
    mkChart(grid, 'col-4', 'Pháp Lý Tặng Cho, Chuyển Nhượng', 'small', ctx => new Chart(ctx, {
      type: 'doughnut',
      data: { labels: d.labels, datasets: [{ data: d.counts, backgroundColor: PAL.slice(2) }] },
      options: { responsive: true, maintainAspectRatio: false }
    }));
  }

  if(cl >= 0){
    const d = aggTop(data, cl, 10);
    mkChart(grid, 'col-4', 'Tiến Độ Checklist (% Hoàn Thành)', 'small', ctx => new Chart(ctx, {
      type: 'bar',
      data: { labels: d.labels, datasets: [{ label: 'Số lượng hồ sơ', data: d.counts, backgroundColor: 'var(--color-blue-cornflower)' }] },
      options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true } } }
    }));
  }
}

function renderDeep(data){
  const grid1 = $('#teamCrossGrid');
  const grid2 = $('#staffGrid');
  if(grid1) grid1.innerHTML = '';
  if(grid2) grid2.innerHTML = '';

  const teamIdx = headers.indexOf(TEAM_COL);
  const gcIdx = headers.findIndex(h => h.toLowerCase().includes('phụ trách') || h.toLowerCase().includes('giao cho'));

  if(teamIdx >= 0 && grid1){
    const d = aggTopFull(data, teamIdx, 15);
    mkChart(grid1, 'col-12', 'Khối Lượng Hồ Sơ Theo Tổ/Phòng', 'medium', ctx => new Chart(ctx, {
      type: 'bar',
      data: { labels: d.labels, datasets: [{ label: 'Hồ sơ', data: d.counts, backgroundColor: '#3b82f6' }] },
      options: { responsive: true, maintainAspectRatio: false, indexAxis: 'y', scales: { x: { beginAtZero: true } } }
    }));
  }

  if(gcIdx >= 0 && grid2){
    const d = aggTopFull(data, gcIdx, 15);
    mkChart(grid2, 'col-12', 'Top 15 Cán Bộ Được Giao Nhiều Hồ Sơ Nhất', 'medium', ctx => new Chart(ctx, {
      type: 'bar',
      data: { labels: d.labels, datasets: [{ label: 'Hồ sơ', data: d.counts, backgroundColor: '#10b981' }] },
      options: { responsive: true, maintainAspectRatio: false, indexAxis: 'y', scales: { x: { beginAtZero: true } } }
    }));
  }
}

function renderSLATable(data){
  const table = $('#overdueTable'); if(!table) return;
  const slaIdx = ci('trạng thái sla');
  const showCols = headers.map((_, i) => i).filter(i => !headers[i].includes('Link Base') && !headers[i].includes('chuyển bước')).slice(0, 7);

  const overdueRows = data.filter(r => slaIdx >= 0 && r[slaIdx].startsWith('Trễ'));

  const thead = table.querySelector('thead');
  if(thead){
    thead.innerHTML = '<tr>' + showCols.map(i => `<th>${escH(headers[i])}</th>`).join('') + '<th>Hành Động</th></tr>';
  }

  const tbody = table.querySelector('tbody');
  if(tbody){
    if(!overdueRows.length){
      tbody.innerHTML = `<tr><td colspan="${showCols.length + 1}" class="empty-msg">🎉 Không có hồ sơ nào trễ hạn SLA!</td></tr>`;
    } else {
      tbody.innerHTML = overdueRows.slice(0, 30).map(r => {
        const rIdx = rows.indexOf(r);
        return `<tr onclick="window.openDetail(${rIdx})">` + showCols.map(i => `<td>${escH(r[i])}</td>`).join('') +
          `<td><button class="btn btn-ghost" style="color:var(--red)">🚨 Đôn Đốc</button></td></tr>`;
      }).join('');
    }
  }
}

function renderStageBottlenecks(data){
  const table = $('#stageBottleneckTable tbody'); if(!table) return;
  const stgIdx = ci('giai đoạn'), slaIdx = ci('trạng thái sla'), movesIdx = headers.findIndex(h => h.toLowerCase().includes('chuyển bước'));

  const stats = new Map();
  data.forEach(r => {
    const stg = (r[stgIdx] || EMPTY).trim();
    const isOverdue = slaIdx >= 0 && r[slaIdx].startsWith('Trễ');

    if(!stats.has(stg)) stats.set(stg, { name: stg, total: 0, overdue: 0, durations: [] });
    const s = stats.get(stg);
    s.total++;
    if(isOverdue) s.overdue++;

    if(movesIdx >= 0 && r[movesIdx]){
      try {
        const moves = typeof r[movesIdx] === 'string' ? JSON.parse(r[movesIdx] || '[]') : (r[movesIdx] || []);
        moves.forEach(m => { if(m.d && m.d > 0) s.durations.push(m.d); });
      } catch(e){}
    }
  });

  const sorted = [...stats.values()].sort((a, b) => String(a.name).localeCompare(String(b.name), 'vi', { numeric: true }));

  if(!sorted.length){
    table.innerHTML = '<tr><td colspan="6" class="empty-msg">Không có dữ liệu giai đoạn.</td></tr>';
  } else {
    table.innerHTML = sorted.map(s => {
      const overduePct = (s.overdue / (s.total || 1) * 100).toFixed(1);
      const avgDays = s.durations.length ? (s.durations.reduce((a, b) => a + b, 0) / s.durations.length / 86400).toFixed(1) : '—';
      let badge = '<span class="badge b-ontime">🟢 An Toàn (&lt;10% Trễ)</span>';
      if(parseFloat(overduePct) >= 30) badge = '<span class="badge b-overdue">🚨 Nghiêm Trọng (&gt;30% Trễ)</span>';
      else if(parseFloat(overduePct) >= 10) badge = '<span class="badge b-warning">⚠️ Cần Đôn Đốc (10-30%)</span>';

      return `<tr>
        <td><b>${escH(s.name)}</b></td>
        <td><b>${fmt(s.total)}</b> hs</td>
        <td><b style="color:var(--red)">${fmt(s.overdue)}</b> hs</td>
        <td><b>${overduePct}%</b></td>
        <td>${avgDays !== '—' ? avgDays + ' ngày' : '—'}</td>
        <td>${badge}</td>
      </tr>`;
    }).join('');
  }
}

function renderLegalRiskTable(data){
  const table = $('#legalRiskTable tbody'); if(!table) return;
  const gcnIdx = ci('gcn'), plIdx = ci('pháp lý tặng');
  const T = data.length || 1;

  const tiers = [
    {
      name: 'Rủi ro Cao (Chuyển nhượng sau 01/7/2014 & Không GCN)',
      badge: '<span class="badge b-overdue">🔴 Tier 1 - Rủi Ro Cao</span>',
      filterFn: r => (gcnIdx >= 0 && r[gcnIdx] === 'KHÔNG CÓ GCN') && (plIdx >= 0 && r[plIdx].includes('SAU 01/7/2014')),
      eligible: '<span style="color:var(--red)">❌ Không đủ ĐK bồi thường đất</span>',
      advice: 'Cần kiểm tra kỹ nguồn gốc sử dụng đất, lập hồ sơ hỗ trợ khác.'
    },
    {
      name: 'Rủi ro Trung bình (Tự tách thửa & Không GCN)',
      badge: '<span class="badge b-warning">🟡 Tier 2 - Rủi Ro TB</span>',
      filterFn: r => (gcnIdx >= 0 && r[gcnIdx] === 'KHÔNG CÓ GCN') && (plIdx < 0 || !r[plIdx].includes('SAU 01/7/2014')),
      eligible: '<span style="color:var(--color-blue-cornflower)">⚠️ Thẩm tra nguồn gốc đất</span>',
      advice: 'Phối hợp UBND Phường xác minh thời điểm sử dụng đất.'
    },
    {
      name: 'Đủ điều kiện pháp lý (Đã được cấp GCN)',
      badge: '<span class="badge b-ontime">🟢 Tier 3 - Chuẩn Pháp Lý</span>',
      filterFn: r => gcnIdx >= 0 && r[gcnIdx] === 'CÓ GCN',
      eligible: '<span style="color:var(--emerald)">✅ Đủ điều kiện bồi thường</span>',
      advice: 'Lập phương án bồi thường, trình duyệt giá đất cụ thể.'
    },
    {
      name: 'Đang xác minh bổ sung',
      badge: '<span class="badge b-active">🔵 Tier 4 - Đang Rà Soát</span>',
      filterFn: r => (gcnIdx >= 0 ? r[gcnIdx] !== 'CÓ GCN' && r[gcnIdx] !== 'KHÔNG CÓ GCN' : true),
      eligible: '🔍 Đang rà soát thông tin',
      advice: 'Thu thập bổ sung giấy tờ pháp lý từ hộ dân.'
    }
  ];

  table.innerHTML = tiers.map(t => {
    const matched = data.filter(t.filterFn);
    const count = matched.length;
    return `<tr>
      <td>${t.badge}</td>
      <td><b>${escH(t.name)}</b></td>
      <td><b>${fmt(count)}</b> hs</td>
      <td><b>${(count / T * 100).toFixed(1)}%</b></td>
      <td>${t.eligible}</td>
      <td style="font-size:12.5px;color:var(--color-ash)">${t.advice}</td>
    </tr>`;
  }).join('');
}

/* ── Full Legal Hierarchy Report Generator (Print & Matrix Engine) ── */
function renderLegalReport(data){
  const tableBody = $('#legalHierarchyTable tbody');
  const printBody = $('#printHierarchyTable tbody');
  if(!tableBody && !printBody) return;

  const teamIdx = headers.indexOf(TEAM_COL);
  const TEAMS = RE.TEAMS;
  const TREE_SPEC = RE.TREE_SPEC;

  /* Phân loại hồ sơ vào cây pháp lý — TREE_SPEC ở js/report-engine.js */
  const cls = RE.classifyRows(headers, data);

  const counts = {};
  TREE_SPEC.forEach(n => {
    counts[n.id] = {};
    TEAMS.forEach(t => counts[n.id][t] = 0);
    (cls.nodeRows[n.id] || []).forEach(i => {
      const tm = (teamIdx >= 0 ? data[i][teamIdx] : '').trim();
      if(counts[n.id][tm] !== undefined) counts[n.id][tm]++;
    });
  });

  // Calculate totals first to get grandTotal for percentage calculation
  let grandTotal = 0;
  TREE_SPEC.forEach(n => {
    if(n.lvl === 1){
      const c = counts[n.id];
      const tot = TEAMS.reduce((sum, t) => sum + (c[t] || 0), 0);
      grandTotal += tot;
    }
  });
  const totalDenom = grandTotal > 0 ? grandTotal : 1;

  let rowsHtml = '';
  const teamTotals = {};
  TEAMS.forEach(t => teamTotals[t] = 0);

  TREE_SPEC.forEach(n => {
    const c = counts[n.id];
    const tot = TEAMS.reduce((sum, t) => sum + (c[t] || 0), 0);
    const trClass = 'lvl-' + n.lvl;

    // Build Total cell with % for lvl 1 (Roman) and lvl 2 (Numbered) items
    let totCellHtml = `<b>${fmt(tot)}</b>`;
    if((n.lvl === 1 || n.lvl === 2) && tot > 0){
      const overallPct = ((tot / totalDenom) * 100).toFixed(1);
      totCellHtml += `<span class="pct-badge"> (${overallPct}%)</span>`;
    }

    // Build Team cells with % for lvl 1 and lvl 2 items
    const teamCellsHtml = TEAMS.map(t => {
      const cnt = c[t] || 0;
      if(!cnt) return '<td class="num">0</td>';
      let cellStr = fmt(cnt);
      if((n.lvl === 1 || n.lvl === 2) && tot > 0){
        const teamPct = ((cnt / tot) * 100).toFixed(1);
        cellStr += `<span class="pct-sub"> (${teamPct}%)</span>`;
      }
      return `<td class="num">${cellStr}</td>`;
    }).join('');

    rowsHtml += `<tr class="${trClass}">
      <td class="title-col">${escH(n.title)}</td>
      <td class="num">${totCellHtml}</td>
      ${teamCellsHtml}
      <td class="note-col"></td>
    </tr>`;

    if(n.lvl === 1){
      TEAMS.forEach(t => teamTotals[t] += (c[t] || 0));
    }
  });

  // Grand Total row appended inside tbody so it appears ONCE at the end of the table
  const grandTotalTeamCellsHtml = TEAMS.map(t => {
    const cnt = teamTotals[t] || 0;
    const teamOverallPct = ((cnt / totalDenom) * 100).toFixed(1);
    return `<td class="num"><b>${fmt(cnt)}</b><span class="pct-badge"> (${teamOverallPct}%)</span></td>`;
  }).join('');

  rowsHtml += `<tr class="total-row">
    <td><b>TỔNG CỘNG HỒ SƠ BỒI THƯỜNG DỰ ÁN</b></td>
    <td class="num"><b>${fmt(grandTotal)}</b><span class="pct-badge"> (100.0%)</span></td>
    ${grandTotalTeamCellsHtml}
    <td class="note-col"></td>
  </tr>`;

  if(tableBody) tableBody.innerHTML = rowsHtml;
  if(printBody) printBody.innerHTML = rowsHtml;

  const tableFoot = $('#legalHierarchyTable tfoot'); if(tableFoot) tableFoot.innerHTML = '';
  const printFoot = $('#printHierarchyTable tfoot'); if(printFoot) printFoot.innerHTML = '';

  // Update print date timestamp
  const now = new Date();
  const dateStr = `ngày ${now.getDate()} tháng ${now.getMonth() + 1} năm ${now.getFullYear()}`;
  const pDate = $('#printDateStr'); if(pDate) pDate.textContent = dateStr;
}

function renderMonthlyKPI(data){
  const table = $('#monthlyStaffTable tbody'); if(!table) return;
  const gcIdx = headers.findIndex(h => h.toLowerCase().includes('phụ trách') || h.toLowerCase().includes('giao cho'));
  const teamIdx = headers.indexOf(TEAM_COL);
  const slaIdx = ci('trạng thái sla');
  const movesIdx = headers.findIndex(h => h.toLowerCase().includes('chuyển bước'));
  const sel = $('#monthPickerSelect');
  const selectedMonth = sel ? sel.value : 'ALL';

  const userStats = new Map();

  data.forEach(r => {
    const uName = (gcIdx >= 0 ? r[gcIdx] : EMPTY).trim() || EMPTY;
    const tName = (teamIdx >= 0 ? r[teamIdx] : EMPTY).trim() || EMPTY;

    if(!userStats.has(uName)){
      userStats.set(uName, { user: uName, team: tName, totalAssigned: 0, monthMoves: 0, monthOverdue: 0, durSum: 0, durCount: 0 });
    }
    const st = userStats.get(uName);
    st.totalAssigned++;

    if(movesIdx >= 0 && r[movesIdx]){
      try {
        const moves = typeof r[movesIdx] === 'string' ? JSON.parse(r[movesIdx] || '[]') : (r[movesIdx] || []);
        moves.forEach(m => {
          const ts = parseInt(m.st || m.et || 0);
          if(ts > 0){
            const dt = new Date(ts * 1000);
            const mKey = dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0');
            if(selectedMonth === 'ALL' || selectedMonth === mKey){
              st.monthMoves++;
              if(m.d && m.d > 0){ st.durSum += m.d; st.durCount++; }
              if(slaIdx >= 0 && r[slaIdx].startsWith('Trễ')) st.monthOverdue++;
            }
          }
        });
      } catch(e){}
    }
  });

  const sortedUsers = [...userStats.values()].sort((a, b) => b.monthMoves - a.monthMoves || b.totalAssigned - a.totalAssigned);

  // Render Hero Stats
  const heroBox = $('#monthlyHeroStats');
  if(heroBox){
    const totalMoves = sortedUsers.reduce((s, u) => s + u.monthMoves, 0);
    const totalOverdue = sortedUsers.reduce((s, u) => s + u.monthOverdue, 0);
    const activeStaff = sortedUsers.filter(u => u.monthMoves > 0).length;

    heroBox.innerHTML = `
      <div class="hero-card"><div class="stripe s-amber"></div><div class="value">${fmt(totalMoves)}<small> lượt</small></div><div class="label">⚡ Tổng Số Lượt Chuyển Bước Trong Tháng</div></div>
      <div class="hero-card"><div class="stripe s-emerald"></div><div class="value">${fmt(activeStaff)}<small> cán bộ</small></div><div class="label">👨‍💼 Số Cán Bộ Thực Hiện Xử Lý</div></div>
      <div class="hero-card"><div class="stripe s-red"></div><div class="value">${fmt(totalOverdue)}<small> hs</small></div><div class="label">🚨 Hồ Sơ Trễ Hạn SLA Trong Tháng</div></div>
      <div class="hero-card"><div class="stripe s-blue"></div><div class="value">${sortedUsers.length ? (totalMoves / sortedUsers.length).toFixed(1) : 0}<small> bước/người</small></div><div class="label">📈 Năng Suất Trung Bình Cán Bộ</div></div>
    `;
  }

  // Render Table
  table.innerHTML = sortedUsers.map(s => {
    const initials = s.user.slice(0, 2).toUpperCase();
    const avgDays = s.durCount ? (s.durSum / s.durCount / 86400).toFixed(1) + ' ngày' : '—';
    const numPct = s.monthMoves ? Math.max(0, Math.min(100, (s.monthMoves - s.monthOverdue) / s.monthMoves * 100)) : 100;
    const onTimePctStr = numPct.toFixed(1) + '%';
    const score = s.monthMoves * 10 - s.monthOverdue * 15;

    let rankBadge = '<span class="badge b-ontime">🟢 Hoàn Thành</span>';
    if(score >= 50) rankBadge = '<span class="badge b-done">🏆 Xuất Sắc</span>';
    else if(score < 0) rankBadge = '<span class="badge b-overdue">🚨 Cần Đôn Đốc</span>';

    const barClass = numPct >= 90 ? 'green' : (numPct >= 70 ? 'blue' : (numPct >= 50 ? 'amber' : 'red'));

    return `<tr>
      <td>
        <div class="user-badge">
          <div class="avatar">${initials}</div>
          <b>${escH(s.user)}</b>
        </div>
      </td>
      <td><span class="badge b-active">${escH(s.team)}</span></td>
      <td><b style="color:var(--color-blue-cornflower)">${fmt(s.monthMoves)}</b> bước</td>
      <td><b>${fmt(s.totalAssigned)}</b> hs</td>
      <td>${avgDays}</td>
      <td>
        <div class="mini-prog">
          <div class="track"><div class="fill ${barClass}" style="width:${numPct}%"></div></div>
          <div class="lbl">${onTimePctStr}</div>
        </div>
      </td>
      <td>${rankBadge}</td>
    </tr>`;
  }).join('');

  // Render Chart Grid
  const chartGrid = $('#monthlyChartGrid');
  if(chartGrid){
    chartGrid.innerHTML = '';
    const top10 = sortedUsers.slice(0, 10);
    mkChart(chartGrid, 'col-12', 'Top 10 Cán Bộ Có Số Lượt Chuyển Bước Nhiều Nhất Trong Tháng', 'medium', ctx => new Chart(ctx, {
      type: 'bar',
      data: {
        labels: top10.map(u => short(u.user, 20)),
        datasets: [
          { label: 'Số bước xử lý', data: top10.map(u => u.monthMoves), backgroundColor: '#3b82f6' },
          { label: 'Số hồ sơ trễ hạn', data: top10.map(u => u.monthOverdue), backgroundColor: '#ef4444' }
        ]
      },
      options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true } } }
    }));
  }
}

/* ═══════════════════════════════════════════════════════════
   ⭐ TAB 7 — NHẬT KÝ CHUYỂN BƯỚC (MOVE AUDIT TRAIL)
   ═══════════════════════════════════════════════════════════
   Trả lời đúng 1 câu hỏi: "Hồ sơ này AI chuyển, chuyển LÚC NÀO?"

   NGUỒN DỮ LIỆU: cột "Lịch sử chuyển bước" (JSON) của Base Workflow.
   Mỗi phần tử trong JSON là MỘT BƯỚC hồ sơ đã đi qua:
       u  = cán bộ phụ trách bước đó      s  = mã giai đoạn
       st = lúc vào bước (unix)           et = lúc rời bước (0 = đang ở đây)

   QUY ƯỚC DỰNG 1 LƯỢT CHUYỂN (đọc kỹ trước khi sửa):
     Ghép 2 bước liền nhau i và i+1 thành 1 sự kiện chuyển:
       • Thời điểm chuyển = et[i]  (lúc hồ sơ rời bước cũ; thiếu thì lấy st[i+1])
       • NGƯỜI CHUYỂN     = u[i]   — cán bộ phụ trách bước VỪA HOÀN TẤT,
                                     tức người bấm chuyển hồ sơ đi
       • NGƯỜI NHẬN       = u[i+1] — cán bộ phụ trách bước kế tiếp
       • Thời gian giữ    = et[i] - st[i] — thời gian THỰC ở bước cũ.
                            KHÔNG dùng khoá `d` vì `d` là hạn SLA cấu hình
                            sẵn của giai đoạn, không phải thời gian thực.
     ⇒ Bước cuối cùng (đang xử lý) KHÔNG sinh sự kiện vì chưa chuyển đi đâu.

   ⚠ KHÁC VỚI TAB 2: Tab 2 đếm "lượt chuyển bước" theo `st` và gán cho
     NGƯỜI NHẬN bước đó. Tab 7 gán cho NGƯỜI CHUYỂN ĐI. Vì vậy con số hai
     tab lệch nhau là ĐÚNG THEO THIẾT KẾ, không phải lỗi.
   ═══════════════════════════════════════════════════════════ */

/* Hướng chuyển — suy từ số thứ tự trong tên giai đoạn ("3. Số Hóa…" → 3) */
const AUDIT_DIRS = {
  fwd:    { label: '⏩ Chuyển tiếp',           cls: 'b-active'  },
  back:   { label: '↩️ Trả về bước trước',     cls: 'b-warning' },
  same:   { label: '🔁 Chuyển lại cùng bước',  cls: 'b-ontime'  },
  fail:   { label: '⛔ Chuyển sang Failed',    cls: 'b-overdue' },
  reopen: { label: '🔓 Mở lại từ Failed',      cls: 'b-done'    }
};

const AUDIT_UNKNOWN = '(Không rõ cán bộ)';

let moveLog = [];                 // toàn bộ lượt chuyển, mới nhất trước
let auditF = { from: '', to: '', stFrom: '', stTo: '', by: '', recv: '', dir: '', q: '' };
let auditPage = 1;
let auditPer = 50;                // 0 = xem tất cả
let auditSort = 't';
let auditAsc = false;
let _auditCharts = [];
let _auditBound = false;

/* ── Tiện ích ── */
function stageNameOf(id){
  const k = String(id || '');
  return stageMap[k] || (k ? 'Bước ' + k : EMPTY);
}

/* Vị trí của giai đoạn trong quy trình.
   Ưu tiên `stage_order` do Base trả về (meta.stage_order) — KHÔNG đoán theo
   con số đầu tên giai đoạn, vì quy trình có 2 giai đoạn cùng đánh số "6."
   ("6. Tổ Pháp Chế Kiểm Tra…" và "6. Chuyển phòng KTHT…"); đoán theo tên sẽ
   báo nhầm là "chuyển lại cùng bước". Chỉ khi thiếu stage_order mới đoán. */
function stageRank(id, name){
  const o = stageOrder[String(id || '')];
  if(o !== undefined && o !== null) return +o;
  const m = /^\s*(\d+)/.exec(String(name || ''));
  return m ? parseInt(m[1], 10) : NaN;
}

function moveDirOf(fromId, toId, fromName, toName){
  if(toName === 'Failed') return 'fail';
  if(fromName === 'Failed') return 'reopen';
  const a = stageRank(fromId, fromName), b = stageRank(toId, toName);
  if(isNaN(a) || isNaN(b)) return 'fwd';
  if(b > a) return 'fwd';
  if(b < a) return 'back';
  return 'same';
}

function fmtTs(t){
  const d = new Date(t * 1000), p = n => String(n).padStart(2, '0');
  return p(d.getDate()) + '/' + p(d.getMonth() + 1) + '/' + d.getFullYear() +
         ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
}

function fmtDayKey(t){
  const d = new Date(t * 1000), p = n => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}

function fmtDur(sec){
  if(!sec || sec <= 0) return '—';
  if(sec < 60) return sec + ' giây';
  if(sec < 3600) return Math.round(sec / 60) + ' phút';
  if(sec < 86400) return (sec / 3600).toFixed(1) + ' giờ';
  return (sec / 86400).toFixed(1) + ' ngày';
}

/* 'yyyy-mm-dd' → mốc unix đầu ngày; isEnd = true thì lấy đầu ngày HÔM SAU
   để khoảng lọc bao trọn cả ngày "đến" */
function auditTs(s, isEnd){
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || ''));
  if(!m) return 0;
  const d = new Date(+m[1], +m[2] - 1, +m[3], 0, 0, 0, 0);
  return Math.floor(d.getTime() / 1000) + (isEnd ? 86400 : 0);
}

function dateInputVal(d){
  const p = n => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}

function dmy(isoDate){
  return String(isoDate || '').split('-').reverse().join('/');
}

/* Vài lượt chuyển Base KHÔNG trả về username, chỉ có mover_id dạng số
   (server.py:219 đã fallback sang mover_id). Ghi rõ "ID <số>" để người xem
   biết đó là mã nội bộ của Base chứ không phải tên đăng nhập bị lỗi. */
function auditUserLabel(u){
  return /^\d+$/.test(String(u)) ? 'ID ' + u : String(u);
}

/* Không tra được tổ cho mã số nội bộ — để trống thay vì gán nhầm Tổ 1 */
function auditTeamOf(u){
  return /^\d+$/.test(String(u)) ? EMPTY : RE.teamOf(u);
}

/* ── Dựng nhật ký từ cột "Lịch sử chuyển bước" (chạy 1 lần mỗi lần nạp dữ liệu) ── */
function buildMoveLog(){
  moveLog = [];
  const mvIdx = headers.findIndex(h => h.toLowerCase().includes('chuyển bước'));
  if(mvIdx < 0) return;

  const nameIdx = headers.findIndex(h => h.toLowerCase().includes('tên nhiệm vụ'));
  const jobIdx  = headers.findIndex(h => h.toLowerCase() === 'job id');
  const teamIdx = headers.indexOf(TEAM_COL);
  const stgIdx  = headers.findIndex(h => h.toLowerCase() === 'giai đoạn');
  const slaIdx  = ci('trạng thái sla');
  const linkIdx = headers.findIndex(h => h.toLowerCase().includes('link base'));

  rows.forEach((r, ri) => {
    let raw;
    try {
      raw = typeof r[mvIdx] === 'string' ? JSON.parse(r[mvIdx] || '[]') : (r[mvIdx] || []);
    } catch(e){ return; }
    if(!Array.isArray(raw) || raw.length < 2) return;

    const steps = raw.map(m => ({
      u:  String(m.u || '').trim(),
      s:  String(m.s || ''),
      st: parseInt(m.st, 10) || 0,
      et: parseInt(m.et, 10) || 0
    })).sort((a, b) => a.st - b.st);

    for(let i = 0; i < steps.length - 1; i++){
      const a = steps[i], b = steps[i + 1];
      const t = a.et > 0 ? a.et : b.st;
      if(!(t > 0)) continue;
      const fromName = stageNameOf(a.s), toName = stageNameOf(b.s);
      moveLog.push({
        t:      t,
        by:     a.u || AUDIT_UNKNOWN,
        recv:   b.u || AUDIT_UNKNOWN,
        from:   fromName,
        to:     toName,
        fromId: a.s,
        toId:   b.s,
        dir:    moveDirOf(a.s, b.s, fromName, toName),
        held: (a.st > 0 && t > a.st) ? (t - a.st) : 0,
        ri:   ri,
        row:  r,
        job:  jobIdx  >= 0 ? r[jobIdx]  : '',
        name: nameIdx >= 0 ? r[nameIdx] : '',
        team: teamIdx >= 0 ? r[teamIdx] : EMPTY,
        stg:  stgIdx  >= 0 ? r[stgIdx]  : '',
        sla:  slaIdx  >= 0 ? r[slaIdx]  : '',
        link: linkIdx >= 0 ? r[linkIdx] : ''
      });
    }
  });

  moveLog.sort((a, b) => b.t - a.t);
}

/* ── Lọc nhật ký ──────────────────────────────────────────────
   visSet  : tập hồ sơ còn lại sau BỘ LỌC CHUNG ở đầu trang
   skipKey : bỏ qua 1 tiêu chí — dùng khi đếm số lựa chọn cho chính
             dropdown đó (lọc chéo: các ô lọc song song vẫn thấy
             đúng số lượt còn lại của nhau)                       */
function auditEvents(visSet, skipKey){
  const t0 = auditTs(auditF.from, false);
  const t1 = auditTs(auditF.to, true);
  const q  = auditF.q.trim() ? auditF.q.trim().split(/\s+/).map(removeAccents) : null;

  return moveLog.filter(e => {
    if(visSet && !visSet.has(e.row)) return false;
    if(skipKey !== 'date'){
      if(t0 && e.t < t0) return false;
      if(t1 && e.t >= t1) return false;
    }
    if(skipKey !== 'stFrom' && auditF.stFrom && e.from !== auditF.stFrom) return false;
    if(skipKey !== 'stTo'   && auditF.stTo   && e.to   !== auditF.stTo)   return false;
    if(skipKey !== 'by'     && auditF.by     && e.by   !== auditF.by)     return false;
    if(skipKey !== 'recv'   && auditF.recv   && e.recv !== auditF.recv)   return false;
    if(skipKey !== 'dir'    && auditF.dir    && e.dir  !== auditF.dir)    return false;
    if(q){
      const hay = removeAccents([e.name, e.job, e.by, e.recv, e.from, e.to, e.team].join(' '));
      if(!q.every(tk => hay.includes(tk))) return false;
    }
    return true;
  });
}

/* Đổ lại <option> cho 1 dropdown, kèm số lượt của từng lựa chọn */
function fillAuditSelect(sel, key, visSet, pick, labelOf){
  const el = $(sel); if(!el) return;
  const cnt = new Map();
  auditEvents(visSet, key).forEach(e => {
    const v = pick(e);
    cnt.set(v, (cnt.get(v) || 0) + 1);
  });
  const total = [...cnt.values()].reduce((s, n) => s + n, 0);
  const list = [...cnt.entries()].sort((a, b) =>
    b[1] - a[1] || String(a[0]).localeCompare(String(b[0]), 'vi'));

  let html = '<option value="">— Tất cả (' + fmt(total) + ') —</option>' +
    list.map(([v, n]) => '<option value="' + escH(v) + '">' + escH(labelOf ? labelOf(v) : v) + ' (' + fmt(n) + ')</option>').join('');

  /* Lựa chọn đang chọn nhưng đã hết dữ liệu vẫn phải còn trong danh sách,
     nếu không trình duyệt tự nhảy về "Tất cả" và người dùng tưởng mất lọc */
  const cur = auditF[key];
  if(cur && !list.some(x => String(x[0]) === String(cur))){
    html += '<option value="' + escH(cur) + '">' + escH(labelOf ? labelOf(cur) : cur) + ' (0)</option>';
  }
  el.innerHTML = html;
  el.value = cur || '';
}

/* Gắn sự kiện cho các ô lọc — CHỈ 1 LẦN, để không mất con trỏ khi đang gõ */
function bindAuditControls(){
  if(_auditBound) return;
  _auditBound = true;

  const redraw = () => { auditPage = 1; renderAudit(filteredRows()); };

  [['#auditFrom', 'from'], ['#auditTo', 'to'], ['#auditStFrom', 'stFrom'],
   ['#auditStTo', 'stTo'], ['#auditBy', 'by'], ['#auditRecv', 'recv'],
   ['#auditDir', 'dir']].forEach(pair => {
    const el = $(pair[0]);
    if(el) el.onchange = () => { auditF[pair[1]] = el.value; redraw(); };
  });

  const q = $('#auditSearch');
  if(q) q.addEventListener('input', () => { auditF.q = q.value; auditPage = 1; renderAudit(filteredRows()); });

  const per = $('#auditPerSelect');
  if(per) per.onchange = () => { auditPer = parseInt(per.value, 10) || 0; auditPage = 1; renderAudit(filteredRows()); };

  const prev = $('#auditPrev'); if(prev) prev.onclick = () => { if(auditPage > 1){ auditPage--; renderAudit(filteredRows()); } };
  const next = $('#auditNext'); if(next) next.onclick = () => { auditPage++; renderAudit(filteredRows()); };

  const reset = $('#btnAuditReset');
  if(reset) reset.onclick = () => {
    auditF = { from: '', to: '', stFrom: '', stTo: '', by: '', recv: '', dir: '', q: '' };
    const s = $('#auditSearch'); if(s) s.value = '';
    auditPage = 1; renderAudit(filteredRows());
  };

  /* Nút khoảng nhanh: Hôm nay / 7 ngày / 30 ngày / Tháng này / Tất cả */
  $$('.audit-quick .btn[data-range]').forEach(b => {
    b.onclick = () => {
      const now = new Date(), kind = b.dataset.range;
      if(kind === 'all'){ auditF.from = ''; auditF.to = ''; }
      else if(kind === 'today'){ auditF.from = auditF.to = dateInputVal(now); }
      else if(kind === 'month'){
        auditF.from = dateInputVal(new Date(now.getFullYear(), now.getMonth(), 1));
        auditF.to   = dateInputVal(now);
      } else {
        const n = parseInt(kind, 10) || 7;
        auditF.from = dateInputVal(new Date(now.getTime() - (n - 1) * 86400000));
        auditF.to   = dateInputVal(now);
      }
      auditPage = 1; renderAudit(filteredRows());
    };
  });
}

/* Chart riêng của tab 7 — tự huỷ, không dùng chung mảng `charts` của render() */
function auditMkChart(host, span, title, make){
  const card = document.createElement('div');
  card.className = 'ccard ' + span;
  card.innerHTML = '<h3>' + title + '</h3><div class="cbox medium"><canvas></canvas></div>';
  host.appendChild(card);
  try { _auditCharts.push(make(card.querySelector('canvas'))); }
  catch(e){ console.error('auditMkChart error:', e); }
}

/* ═══ RENDER TAB 7 ═══ */
function renderAudit(data){
  const tbody = $('#auditTable tbody'); if(!tbody) return;
  bindAuditControls();

  _auditCharts.forEach(c => { try { if(c && c.destroy) c.destroy(); } catch(e){} });
  _auditCharts = [];

  const visSet = new Set(data);

  /* 1. Đổ lại các ô lọc (đếm chéo: mỗi ô hiện số còn lại theo các ô kia) */
  const fromEl = $('#auditFrom'); if(fromEl) fromEl.value = auditF.from;
  const toEl   = $('#auditTo');   if(toEl)   toEl.value   = auditF.to;
  const qEl    = $('#auditSearch'); if(qEl && qEl.value !== auditF.q) qEl.value = auditF.q;
  const perEl  = $('#auditPerSelect'); if(perEl) perEl.value = String(auditPer);

  fillAuditSelect('#auditStFrom', 'stFrom', visSet, e => e.from);
  fillAuditSelect('#auditStTo',   'stTo',   visSet, e => e.to);
  fillAuditSelect('#auditBy',     'by',     visSet, e => e.by,   auditUserLabel);
  fillAuditSelect('#auditRecv',   'recv',   visSet, e => e.recv, auditUserLabel);
  fillAuditSelect('#auditDir',    'dir',    visSet, e => e.dir,
                  v => (AUDIT_DIRS[v] ? AUDIT_DIRS[v].label : v));

  $$('.audit-quick .btn[data-range]').forEach(b => {
    b.classList.toggle('on', b.dataset.range === 'all' && !auditF.from && !auditF.to);
  });

  /* 2. Tập sự kiện cuối cùng */
  let evs = auditEvents(visSet, null);

  const badge = $('#countMoves'); if(badge) badge.textContent = fmt(evs.length);

  const rangeNote = $('#auditRangeNote');
  if(rangeNote){
    if(auditF.from || auditF.to){
      rangeNote.textContent = 'Khoảng lọc: ' + (auditF.from ? dmy(auditF.from) : 'đầu kỳ') +
                              ' → ' + (auditF.to ? dmy(auditF.to) : 'nay');
    } else if(evs.length){
      rangeNote.textContent = 'Toàn bộ: ' + fmtTs(evs[evs.length - 1].t).slice(0, 10) +
                              ' → ' + fmtTs(evs[0].t).slice(0, 10);
    } else {
      rangeNote.textContent = '';
    }
  }

  /* 3. Thẻ chỉ số tổng hợp */
  const hero = $('#auditHeroStats');
  if(hero){
    const movers = new Set(evs.map(e => e.by));
    const jobs   = new Set(evs.map(e => e.ri));
    const backs  = evs.filter(e => e.dir === 'back' || e.dir === 'fail').length;
    const days   = new Set(evs.map(e => fmtDayKey(e.t))).size;
    hero.innerHTML =
      '<div class="hero-card"><div class="stripe s-amber"></div><div class="value">' + fmt(evs.length) + '<small> lượt</small></div><div class="label">🔀 Tổng Lượt Chuyển Bước Trong Khoảng Lọc</div></div>' +
      '<div class="hero-card"><div class="stripe s-emerald"></div><div class="value">' + fmt(movers.size) + '<small> cán bộ</small></div><div class="label">👤 Số Cán Bộ Đã Thực Hiện Chuyển</div></div>' +
      '<div class="hero-card"><div class="stripe s-blue"></div><div class="value">' + fmt(jobs.size) + '<small> hs</small></div><div class="label">📁 Số Hồ Sơ Được Chuyển Bước</div></div>' +
      '<div class="hero-card"><div class="stripe s-red"></div><div class="value">' + fmt(backs) + '<small> lượt</small></div><div class="label">↩️ Lượt Trả Về Bước Trước / Failed</div></div>' +
      '<div class="hero-card"><div class="stripe s-violet"></div><div class="value">' + (days ? (evs.length / days).toFixed(1) : '0') + '<small> lượt/ngày</small></div><div class="label">📅 Nhịp Độ TB (' + fmt(days) + ' ngày có phát sinh)</div></div>';
  }

  /* 4. Biểu đồ: khối lượng theo ngày + top cán bộ chuyển */
  const grid = $('#auditChartGrid');
  if(grid){
    grid.innerHTML = '';

    const byDay = new Map();
    evs.forEach(e => { const k = fmtDayKey(e.t); byDay.set(k, (byDay.get(k) || 0) + 1); });
    const dayKeys = [...byDay.keys()].sort();

    auditMkChart(grid, 'col-8', '📅 Số Lượt Chuyển Bước Theo Ngày', ctx => new Chart(ctx, {
      type: 'bar',
      data: {
        labels: dayKeys.map(k => k.slice(8) + '/' + k.slice(5, 7)),
        datasets: [{ label: 'Lượt chuyển bước', data: dayKeys.map(k => byDay.get(k)), backgroundColor: '#6798ff', borderRadius: 3 }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false }, datalabels: { display: dayKeys.length <= 20 } },
        scales: { y: { beginAtZero: true }, x: { ticks: { maxRotation: 90, autoSkip: true, maxTicksLimit: 31 } } }
      }
    }));

    const byUser = new Map();
    evs.forEach(e => byUser.set(e.by, (byUser.get(e.by) || 0) + 1));
    const top = [...byUser.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);

    auditMkChart(grid, 'col-4', '🏆 Top 10 Cán Bộ Chuyển Bước Nhiều Nhất', ctx => new Chart(ctx, {
      type: 'bar',
      data: {
        labels: top.map(x => short(auditUserLabel(x[0]), 18)),
        datasets: [{ label: 'Lượt chuyển', data: top.map(x => x[1]), backgroundColor: '#10b981', borderRadius: 3 }]
      },
      options: {
        indexAxis: 'y', responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { x: { beginAtZero: true } }
      }
    }));
  }

  /* 5. Bảng nhật ký chi tiết — sắp xếp + phân trang */
  const SORTS = {
    t:    e => e.t,
    by:   e => removeAccents(e.by),
    from: e => { const r = stageRank(e.fromId, e.from); return isNaN(r) ? 999 : r; },
    to:   e => { const r = stageRank(e.toId, e.to);   return isNaN(r) ? 999 : r; },
    recv: e => removeAccents(e.recv),
    held: e => e.held,
    name: e => removeAccents(e.name),
    team: e => removeAccents(e.team)
  };
  const keyFn = SORTS[auditSort] || SORTS.t;
  evs = [...evs].sort((a, b) => {
    const va = keyFn(a), vb = keyFn(b);
    let c = (typeof va === 'number' && typeof vb === 'number')
      ? va - vb
      : String(va).localeCompare(String(vb), 'vi');
    if(c === 0) c = a.t - b.t;
    return auditAsc ? c : -c;
  });

  const per   = auditPer > 0 ? auditPer : Math.max(1, evs.length);
  const total = Math.max(1, Math.ceil(evs.length / per));
  if(auditPage > total) auditPage = total;
  const slice = evs.slice((auditPage - 1) * per, auditPage * per);

  const rc = $('#auditRowCount');
  if(rc) rc.textContent = '(' + fmt(evs.length) + ' lượt · ' + fmt(new Set(evs.map(e => e.ri)).size) + ' hồ sơ)';

  const COLS = [
    { k: 't',    t: 'Thời Điểm Chuyển' },
    { k: 'by',   t: 'Người Chuyển' },
    { k: 'from', t: 'Chuyển Từ Bước → Đến Bước' },
    { k: null,   t: 'Hướng Chuyển' },
    { k: 'recv', t: 'Người Nhận Bước Sau' },
    { k: 'held', t: 'Thời Gian Giữ Ở Bước Cũ' },
    { k: 'name', t: 'Hồ Sơ' },
    { k: 'team', t: 'Tổ / Phòng' }
  ];

  const thead = $('#auditTable thead');
  if(thead){
    thead.innerHTML = '<tr>' + COLS.map(c => {
      if(!c.k) return '<th style="cursor:default">' + escH(c.t) + '</th>';
      const act = auditSort === c.k;
      return '<th class="' + (act ? 'sorted' : '') + '" data-k="' + c.k + '">' + escH(c.t) +
             ' <span class="sa">' + (act ? (auditAsc ? '▲' : '▼') : '⇅') + '</span></th>';
    }).join('') + '</tr>';

    thead.querySelectorAll('th[data-k]').forEach(th => {
      th.onclick = () => {
        const k = th.dataset.k;
        if(auditSort === k) auditAsc = !auditAsc;
        else { auditSort = k; auditAsc = (k !== 't' && k !== 'held'); }
        renderAudit(filteredRows());
      };
    });
  }

  if(!slice.length){
    tbody.innerHTML = '<tr><td colspan="' + COLS.length + '" class="empty-msg">Không có lượt chuyển bước nào khớp bộ lọc đang chọn.</td></tr>';
  } else {
    tbody.innerHTML = slice.map(e => {
      const d = AUDIT_DIRS[e.dir] || AUDIT_DIRS.fwd;
      const ts = fmtTs(e.t);
      return '<tr onclick="window.openDetail(' + e.ri + ')" title="Bấm để xem chi tiết hồ sơ">' +
        '<td><div class="ts-cell">' + escH(ts.slice(11)) + '<small>' + escH(ts.slice(0, 10)) + '</small></div></td>' +
        '<td><div class="user-badge"><div class="avatar">' + escH(auditUserLabel(e.by).slice(0, 2).toUpperCase()) + '</div><b>' + escH(auditUserLabel(e.by)) + '</b></div></td>' +
        '<td><div class="flow"><span class="st-from">' + escH(e.from) + '</span><span class="arrow">→</span><span class="st-to">' + escH(e.to) + '</span></div></td>' +
        '<td><span class="badge ' + d.cls + '">' + d.label + '</span></td>' +
        '<td>' + escH(auditUserLabel(e.recv)) + '</td>' +
        '<td>' + escH(fmtDur(e.held)) + '</td>' +
        '<td>' + escH(short(e.name, 46)) + '</td>' +
        '<td><span class="badge b-active">' + escH(e.team) + '</span></td>' +
      '</tr>';
    }).join('');
  }

  const pi = $('#auditPageInfo');
  if(pi) pi.textContent = auditPer > 0
    ? 'Trang ' + fmt(auditPage) + ' / ' + fmt(total) + ' · ' + fmt(slice.length) + ' / ' + fmt(evs.length) + ' lượt'
    : 'Hiển thị tất cả ' + fmt(evs.length) + ' lượt';

  /* 6. Bảng tổng hợp trách nhiệm theo cán bộ chuyển bước */
  const ubody = $('#auditByUserTable tbody');
  if(ubody){
    const list = auditByUser(evs);
    ubody.innerHTML = list.length ? list.map(s =>
      '<tr>' +
        '<td><div class="user-badge"><div class="avatar">' + escH(auditUserLabel(s.user).slice(0, 2).toUpperCase()) + '</div><b>' + escH(auditUserLabel(s.user)) + '</b></div></td>' +
        '<td><span class="badge b-active">' + escH(auditTeamOf(s.user)) + '</span></td>' +
        '<td><b style="color:var(--color-blue-cornflower)">' + fmt(s.n) + '</b> lượt</td>' +
        '<td><b>' + fmt(s.jobs.size) + '</b> hs</td>' +
        '<td>' + fmt(s.fwd) + '</td>' +
        '<td>' + (s.back ? '<span class="badge b-warning">' + fmt(s.back) + '</span>' : '0') + '</td>' +
        '<td>' + escH(s.heldN ? fmtDur(Math.round(s.held / s.heldN)) : '—') + '</td>' +
        '<td><span style="font-family:var(--font-mono);font-size:12.5px">' + escH(fmtTs(s.last)) + '</span></td>' +
      '</tr>').join('')
    : '<tr><td colspan="8" class="empty-msg">Chưa có lượt chuyển bước nào trong khoảng lọc.</td></tr>';
  }

  /* 7. Nút xuất Excel — gắn lại mỗi lần render để luôn xuất ĐÚNG tập đang xem */
  const btnX = $('#btnAuditExport');
  if(btnX) btnX.onclick = () => exportAuditExcel(evs);
}

/* Gom nhật ký theo NGƯỜI CHUYỂN — dùng chung cho bảng web và sheet Excel */
function auditByUser(evs){
  const stat = new Map();
  evs.forEach(e => {
    if(!stat.has(e.by)){
      stat.set(e.by, { user: e.by, n: 0, fwd: 0, back: 0, jobs: new Set(), held: 0, heldN: 0, last: 0 });
    }
    const s = stat.get(e.by);
    s.n++;
    if(e.dir === 'back' || e.dir === 'fail') s.back++; else s.fwd++;
    s.jobs.add(e.ri);
    if(e.held > 0){ s.held += e.held; s.heldN++; }
    if(e.t > s.last) s.last = e.t;
  });
  return [...stat.values()].sort((a, b) => b.n - a.n || b.jobs.size - a.jobs.size);
}

/* ═══════════════════════════════════════════════════════════
   XUẤT EXCEL NHẬT KÝ — 3 sheet, theo quy ước mục 8 (report-engine.js)
     • NhatKyChuyenBuoc  — từng lượt chuyển (dòng 1 là tiêu đề cột)
     • TongHopNguoiChuyen — gom theo cán bộ chuyển bước
     • ThongTin           — đơn vị, thời điểm, TOÀN BỘ bộ lọc đang bật
   Thêm/bớt cột: sửa AUDIT_EXPORT_COLUMNS bên dưới, không đụng bộ dựng.
   ═══════════════════════════════════════════════════════════ */
const AUDIT_EXPORT_COLUMNS = [
  { title: 'STT',                     type: 'int',      wch: 6,  get: (e, i) => i + 1 },
  { title: 'Thời điểm chuyển',        type: 'datetime', wch: 18, get: e => fmtTs(e.t) },
  { title: 'Ngày chuyển',             type: 'date',     wch: 13, get: e => fmtTs(e.t).slice(0, 10) },
  { title: 'Giờ chuyển',              type: 'text',     wch: 9,  get: e => fmtTs(e.t).slice(11) },
  { title: 'Người chuyển',            type: 'text',     wch: 15, get: e => auditUserLabel(e.by) },
  { title: 'Tổ của người chuyển',     type: 'text',     wch: 14, get: e => auditTeamOf(e.by) },
  { title: 'Chuyển đi từ bước',       type: 'text',     wch: 34, get: e => e.from },
  { title: 'Chuyển đến bước',         type: 'text',     wch: 34, get: e => e.to },
  { title: 'Hướng chuyển',            type: 'text',     wch: 22, get: e => auditDirText(e.dir) },
  { title: 'Người nhận bước sau',     type: 'text',     wch: 15, get: e => auditUserLabel(e.recv) },
  { title: 'Thời gian giữ ở bước cũ', type: 'text',     wch: 18, get: e => fmtDur(e.held) },
  /* Phải trả về SỐ THẬT, không phải chuỗi: RE.xlNum đọc "0.970" theo kiểu
     nghìn của VN thành 970. Xem mục 8 của js/report-engine.js. */
  { title: 'Số ngày giữ ở bước cũ',   type: 'num',      wch: 15, get: e => e.held ? Math.round(e.held / 86400 * 1000) / 1000 : '' },
  { title: 'Job ID',                  type: 'text',     wch: 11, get: e => e.job },
  { title: 'Tên hồ sơ',               type: 'text',     wch: 42, get: e => e.name },
  { title: 'Tổ nghiệp vụ của hồ sơ',  type: 'text',     wch: 14, get: e => e.team },
  { title: 'Giai đoạn hiện tại',      type: 'text',     wch: 30, get: e => e.stg },
  { title: 'Trạng thái SLA',          type: 'text',     wch: 15, get: e => e.sla },
  { title: 'Link Base Workflow',      type: 'text',     wch: 38, get: e => e.link }
];

/* Nhãn hướng chuyển bỏ emoji để ô Excel sạch chữ */
function auditDirText(dir){
  const d = AUDIT_DIRS[dir];
  return d ? d.label.replace(/^\S+\s*/, '') : dir;
}

function exportAuditExcel(evs){
  if(!window.XLSX){ alert('Chưa nạp được thư viện Excel (libs/xlsx.full.min.js).'); return; }
  if(!evs || !evs.length){ alert('Không có lượt chuyển bước nào để xuất — hãy nới bộ lọc lại.'); return; }

  const wb = XLSX.utils.book_new();

  /* Sheet 1 — nhật ký chi tiết */
  const cols = AUDIT_EXPORT_COLUMNS.map(c => ({ title: c.title, type: c.type, wch: c.wch }));
  const body = evs.map((e, i) => AUDIT_EXPORT_COLUMNS.map(c => c.get(e, i)));
  XLSX.utils.book_append_sheet(wb, RE.xlSheet(cols, body), 'NhatKyChuyenBuoc');

  /* Sheet 2 — tổng hợp theo cán bộ chuyển bước */
  const uCols = [
    { title: 'STT',                     type: 'int',      wch: 6 },
    { title: 'Cán bộ chuyển bước',      type: 'text',     wch: 18 },
    { title: 'Tổ / Phòng',              type: 'text',     wch: 14 },
    { title: 'Số lượt chuyển',          type: 'int',      wch: 14 },
    { title: 'Số hồ sơ đã chuyển',      type: 'int',      wch: 16 },
    { title: 'Lượt chuyển tiếp',        type: 'int',      wch: 15 },
    { title: 'Lượt trả về / Failed',    type: 'int',      wch: 18 },
    { title: 'Số ngày giữ ở bước (TB)', type: 'num',      wch: 20 },
    { title: 'Lần chuyển gần nhất',     type: 'datetime', wch: 18 }
  ];
  const users = auditByUser(evs);
  const uBody = users.map((s, i) => [
    i + 1, auditUserLabel(s.user), auditTeamOf(s.user), s.n, s.jobs.size, s.fwd, s.back,
    s.heldN ? Math.round(s.held / s.heldN / 86400 * 100) / 100 : '', fmtTs(s.last)
  ]);
  XLSX.utils.book_append_sheet(wb, RE.xlSheet(uCols, uBody), 'TongHopNguoiChuyen');

  /* Sheet 3 — ThongTin: mô tả báo cáo + toàn bộ bộ lọc đang bật */
  const gInfo = Object.entries(filters)
    .filter(([_, v]) => v !== undefined && v !== null && String(v).trim() !== '')
    .map(([k, v]) => ['Lọc chung theo cột: ' + (headers[+k] || k), v]);

  XLSX.utils.book_append_sheet(wb, RE.xlInfoSheet([
    ['Đơn vị',                 'Ban Quản lý dự án đầu tư xây dựng phường Bình Quới'],
    ['Dự án',                  'Khu đô thị mới Bình Quới – Thanh Đa'],
    ['Nội dung file',          'Nhật ký chuyển bước hồ sơ bồi thường — truy vết ai chuyển, chuyển lúc nào'],
    ['Cách xác định người chuyển', 'Cán bộ phụ trách bước vừa hoàn tất (người bấm chuyển hồ sơ sang bước sau)'],
    ['Thời điểm xuất file',    RE.xlNow()],
    ['Nguồn dữ liệu',          META.source || 'Base Workflow'],
    ['Base cập nhật lúc',      META.updated || ''],
    ['Số lượt trong file',     evs.length],
    ['Số hồ sơ liên quan',     new Set(evs.map(e => e.ri)).size],
    ['Số cán bộ chuyển bước',  users.length],
    ['Lọc từ ngày',            auditF.from ? dmy(auditF.from) : '(không giới hạn)'],
    ['Lọc đến ngày',           auditF.to   ? dmy(auditF.to)   : '(không giới hạn)'],
    ['Lọc chuyển đi từ bước',  auditF.stFrom || '(tất cả)'],
    ['Lọc chuyển đến bước',    auditF.stTo   || '(tất cả)'],
    ['Lọc người chuyển',       auditF.by     || '(tất cả)'],
    ['Lọc người nhận',         auditF.recv   || '(tất cả)'],
    ['Lọc hướng chuyển',       auditF.dir ? auditDirText(auditF.dir) : '(tất cả)'],
    ['Từ khoá tìm kiếm',       auditF.q.trim() || '(không)']
  ].concat(gInfo.length ? gInfo : [['Bộ lọc chung đầu trang', 'Không lọc — toàn bộ hồ sơ']])), 'ThongTin');

  RE.xlSave(wb, 'NhatKyChuyenBuoc_BinhQuoiThanhDa');
}

function removeAccents(str){
  return String(str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .toLowerCase();
}

/* ── Main Data Table ── */
const tsEl = $('#tableSearch');
if(tsEl) tsEl.addEventListener('input', e => { tableQuery = e.target.value; page = 1; renderTable(filteredRows()); });
const prevBtn = $('#prevPage'); if(prevBtn) prevBtn.addEventListener('click', () => { if(page > 1){ page--; renderTable(filteredRows()); } });
const nextBtn = $('#nextPage'); if(nextBtn) nextBtn.addEventListener('click', () => { page++; renderTable(filteredRows()); });

function renderTable(data){
  if(tableQuery && tableQuery.trim()){
    const tokens = tableQuery.trim().split(/\s+/).map(t => removeAccents(t));
    data = data.filter(r => {
      const fullRowStr = removeAccents(r.join(' '));
      return tokens.every(tk => fullRowStr.includes(tk));
    });
  }
  const show = headers.map((_, i) => i).filter(i => rows.some(r => r[i] !== '') && !headers[i].includes('Link Base') && !headers[i].includes('chuyển bước'));

  if(sortCol >= 0 && show.includes(sortCol)){
    const nameI = headers.findIndex(h => h.toLowerCase().includes('tên'));
    data = [...data].sort((a, b) => {
      let va = a[sortCol], vb = b[sortCol];
      if(sortCol === nameI){
        const ma = va.match(/^\s*(\d+)/), mb = vb.match(/^\s*(\d+)/);
        const numA = ma ? parseInt(ma[1]) : 999999;
        const numB = mb ? parseInt(mb[1]) : 999999;
        if(numA !== numB) return sortAsc ? numA - numB : numB - numA;
      }
      const na = parseFloat(va.replace(/[^\d,.-]/g, '').replace(',', '.')), nb = parseFloat(vb.replace(/[^\d,.-]/g, '').replace(',', '.'));
      if(!isNaN(na) && !isNaN(nb)) return sortAsc ? na - nb : nb - na;
      return sortAsc ? va.localeCompare(vb, 'vi') : vb.localeCompare(va, 'vi');
    });
  }

  const tp = Math.max(1, Math.ceil(data.length / PER)); if(page > tp) page = tp;
  const slice = data.slice((page - 1) * PER, page * PER);
  const stI = ci('trạng thái');

  const rc = $('#rowCount'); if(rc) rc.textContent = `(${fmt(data.length)} dòng · ${pct(data.length, rows.length)})`;
  const thead = $('#dataTable thead');
  if(!thead) return;

  thead.innerHTML = '<tr>' + show.map(i => {
    const act = sortCol === i;
    return `<th class="${act ? 'sorted' : ''}" data-ci="${i}">${escH(headers[i])} <span class="sa">${act ? (sortAsc ? '▲' : '▼') : '⇅'}</span></th>`;
  }).join('') + '</tr>';

  thead.querySelectorAll('th').forEach(th => {
    th.onclick = () => {
      const c = +th.dataset.ci;
      if(sortCol === c) sortAsc = !sortAsc; else { sortCol = c; sortAsc = true; }
      renderTable(filteredRows());
    };
  });

  const tbody = $('#dataTable tbody');
  if(!slice.length){
    tbody.innerHTML = `<tr><td colspan="${show.length}" class="empty-msg">Không có dòng nào khớp với từ khóa tìm kiếm.</td></tr>`;
  } else {
    tbody.innerHTML = slice.map(r => {
      const rIdx = rows.indexOf(r);
      return `<tr onclick="window.openDetail(${rIdx})" title="Bấm để xem chi tiết hồ sơ">` + show.map(i => {
        let v = escH(r[i]);
        if(i === stI && r[i]){
          const s = r[i].toLowerCase();
          if(s === 'active') v = '<span class="badge b-active">Đang xử lý</span>';
          else if(s === 'done' || s === 'finished') v = '<span class="badge b-done">Hoàn thành</span>';
        }
        return `<td>${v}</td>`;
      }).join('') + '</tr>';
    }).join('');
  }
}

/* ── Modal Detail Popup View ── */
window.openDetail = function(rIdx){
  const r = rows[rIdx]; if(!r) return;
  const modal = $('#detailModal'); if(!modal) return;

  const nameIdx = headers.findIndex(h => h.toLowerCase().includes('tên') || h.toLowerCase().includes('job'));
  const jobName = nameIdx >= 0 ? r[nameIdx] : 'Hồ Sơ #' + (rIdx + 1);

  const title = $('#modalTitle'); if(title) title.textContent = jobName;
  const sub = $('#modalSub'); if(sub) sub.textContent = `Chi tiết chỉ số KPI & Tiến độ pháp lý đất đai (${rIdx + 1} / ${rows.length})`;

  const grid = $('#modalGrid');
  if(grid){
    let html = '';
    headers.forEach((h, i) => {
      if(h.includes('chuyển bước')) return;
      html += `<div class="detail-item"><div class="d-label">${escH(h)}</div><div class="d-val">${escH(r[i] || '—')}</div></div>`;
    });
    grid.innerHTML = html;
  }

  const timeline = $('#modalTimeline');
  if(timeline){
    const movesIdx = headers.findIndex(h => h.toLowerCase().includes('chuyển bước'));
    let tlHtml = '';
    if(movesIdx >= 0 && r[movesIdx]){
      try {
        const moves = typeof r[movesIdx] === 'string' ? JSON.parse(r[movesIdx] || '[]') : (r[movesIdx] || []);
        if(moves.length){
          moves.forEach(m => {
            /* Base KHÔNG trả khoá `sn` (tên giai đoạn) trong lịch sử chuyển
               bước — chỉ có `s` = mã giai đoạn. Phải tra qua stageMap, nếu
               không mọi dòng đều hiện trơ chữ "Bước". */
            const stName = stageNameOf(m.s);
            const dtStr = m.st ? new Date(parseInt(m.st, 10) * 1000).toLocaleString('vi') : '—';
            /* `d` là hạn SLA cấu hình sẵn của giai đoạn, không phải thời gian
               thực. Thời gian thực = et - st (xem mục 6.1 của CLAUDE.md). */
            const st = parseInt(m.st, 10) || 0, et = parseInt(m.et, 10) || 0;
            const held = (st > 0 && et > st) ? fmtDur(et - st) : (et ? '—' : 'đang ở bước này');
            tlHtml += `<li class="tl-item">
              <div class="tl-title"><b>${escH(stName)}</b> · <small>${dtStr}</small></div>
              <div class="tl-desc">Phụ trách: <b>${escH(auditUserLabel(m.u || 'Cán bộ'))}</b> | Giữ: <b>${escH(held)}</b></div>
            </li>`;
          });
        }
      } catch(e){}
    }
    timeline.innerHTML = tlHtml || '<li class="tl-item">Chưa có lịch sử chuyển bước.</li>';
  }

  const linkBase = $('#modalLinkBase');
  if(linkBase){
    const linkIdx = headers.findIndex(h => h.toLowerCase().includes('link base'));
    if(linkIdx >= 0 && r[linkIdx] && r[linkIdx].startsWith('http')){
      linkBase.href = r[linkIdx]; linkBase.style.display = 'inline-flex';
    } else {
      linkBase.style.display = 'none';
    }
  }

  modal.classList.remove('hidden');
};

const mClose = $('#modalClose'); if(mClose) mClose.onclick = () => { $('#detailModal').classList.add('hidden'); };
const mBtnClose = $('#modalBtnClose'); if(mBtnClose) mBtnClose.onclick = () => { $('#detailModal').classList.add('hidden'); };

/* ── Live Data Engine ── */
function tryLoadLocalCache(){
  try {
    const raw = localStorage.getItem('kpi_cache_v2');
    if(raw){
      const d = JSON.parse(raw);
      if(d && d.headers && d.rows && d.rows.length > 0){
        applyData(d.headers, d.rows, d.meta ? d.meta.stage_map : {}, d.meta ? d.meta.stage_order : {});
        const fn = $('#fileName'); if(fn){ fn.textContent = '● TỨC THÌ (CACHE)'; fn.className = 'fbadge live'; }
        const s = fmtMeta(d); updateConn(true, '⚡ KẾT NỐI TỨC THÌ · ' + fmt(d.rows.length) + ' hồ sơ');
        const mi = $('#metaInfo'); if(mi) mi.textContent = s;
        return true;
      }
    }
  } catch(e){ console.warn('[Cache Local] Fail:', e); }
  return false;
}

async function loadLive(force){
  if(liveLoading) return;
  liveLoading = true;
  if(_liveRetryTimer){ clearTimeout(_liveRetryTimer); _liveRetryTimer = null; }

  if(force){
    updateConn(true, '⚡ Đang đồng bộ trực tiếp từ Base Workflow API...');
  } else if(rows.length === 0){
    updateConn(true, '⏳ Đang nạp dữ liệu...');
  }

  try {
    let d = null;
    try {
      const res = await fetch('/api/data' + (force ? '?force=1' : ''), { cache: 'no-store' });
      if(res.ok) d = await res.json();
    } catch(e){}

    if(!d || !d.headers || !d.rows || d.rows.length === 0){
      const resStatic = await fetch('cache_payload.json');
      if(resStatic.ok) d = await resStatic.json();
    }

    if(!d || !d.headers || !d.rows || d.rows.length === 0){
      throw new Error((d && d.error) || 'Không thể nạp dữ liệu...');
    }

    try { localStorage.setItem('kpi_cache_v2', JSON.stringify(d)); } catch(e){}

    applyData(d.headers, d.rows, d.meta ? d.meta.stage_map : {}, d.meta ? d.meta.stage_order : {});
    const fn = $('#fileName'); if(fn){ fn.textContent = '● BASE LIVE'; fn.className = 'fbadge live'; }
    const s = fmtMeta(d);
    updateConn(true, '⚡ KẾT NỐI TRỰC TIẾP · ' + fmt(d.rows.length) + ' hồ sơ');
    const mi = $('#metaInfo'); if(mi) mi.textContent = s;

  } catch(err){
    console.warn('[KPI Live] Fetch error:', err.message);
    if(rows.length === 0){
      updateConn(false, '⏳ Đang chờ dữ liệu... Thử lại sau 2s');
      _liveRetryTimer = setTimeout(() => { liveLoading = false; loadLive(false); }, 2000);
    }
  } finally {
    liveLoading = false;
  }
}

function setAuto(on){
  if(autoTimer){ clearInterval(autoTimer); autoTimer = null; }
  // Đã tắt tự động làm mới theo yêu cầu
}

/* ── Initialization ── */
const btnR = $('#btnRefresh'); if(btnR) btnR.addEventListener('click', () => loadLive(true));
const btnP = $('#btnPrint');
if(btnP){
  btnP.addEventListener('click', () => {
    const oldTitle = document.title;
    document.title = '';
    
    // Tạo chuỗi Ngày giờ (VD: 13:07 29/7/26) và chèn vào tiêu đề trang đầu
    const now = new Date();
    const timeStr = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
    const dayStr = now.getDate();
    const monthStr = now.getMonth() + 1;
    const yearStr = String(now.getFullYear()).slice(-2);
    const dateTag = `${timeStr} ${dayStr}/${monthStr}/${yearStr}`;

    const metaEl = $('#printReportMeta');
    if(metaEl){
      metaEl.innerHTML = `Dự án: Khu đô thị mới Bình Quới – Thanh Đa &nbsp;&nbsp;·&nbsp;&nbsp; <span>Thời gian lập: ${dateTag}</span>`;
    }

    window.print();
    setTimeout(() => { document.title = oldTitle; }, 500);
  });
}
/* ═══════════════════════════════════════════════════════════
   ⭐ XUẤT EXCEL DASHBOARD — CẤU HÌNH CỘT NGAY Ở ĐÂY
   ═══════════════════════════════════════════════════════════
   File xuất ra gồm 2 sheet:
     • "DuLieuKPI" — bảng dữ liệu SẠCH: dòng 1 là tiêu đề cột, dữ liệu
       từ dòng 2, không gộp ô, không chèn dòng tiêu đề báo cáo phía trên
       ⇒ mở lên là lọc / sắp xếp / PivotTable được ngay.
     • "ThongTin" — đơn vị, dự án, thời điểm xuất, nguồn dữ liệu và
       BỘ LỌC đang bật. Mọi thứ mô tả báo cáo dồn hết vào sheet này.

   Mỗi dòng dưới đây = 1 CỘT trong file Excel:
     match : từ khoá dò tên cột của Base (khớp đúng hệt trước, rồi mới
             khớp chứa từ khoá) — Base đổi thứ tự cột vẫn chạy đúng
     title : tiêu đề in ra Excel (bỏ trống = giữ nguyên tên của Base)
     type  : kiểu ô — quyết định file có "sạch" hay không
             (bỏ trống) = chữ
             'int'      = số nguyên       → SUM / lọc số được
             'num'      = số thập phân
             'pct'      = phần trăm thật  (92% lưu là 0,92)
             'date'     = ngày            → sắp xếp theo ngày được
             'datetime' = ngày + giờ
             ⚠ Ô nào không đúng kiểu (vd số thửa "MP15") thì tự giữ
               nguyên chữ, không bị đọc sai thành số.
     wch   : độ rộng cột (số ký tự); bỏ trống = tự canh theo nội dung

   Cột nào Base có mà chưa khai ở đây sẽ tự được NỐI VÀO CUỐI dạng chữ
   ⇒ Base thêm trường mới cũng không mất dữ liệu.
   ═══════════════════════════════════════════════════════════ */
const EXPORT_SKIP = ['chuyển bước'];        // cột không xuất (JSON lịch sử, rất dài)

const EXPORT_COLUMNS = [
  { match: 'job id',             title: 'Job ID',                            wch: 11 },
  { match: 'tên nhiệm vụ',       title: 'Tên hồ sơ',                         wch: 42 },
  { match: 'tổ/phòng',           title: 'Tổ nghiệp vụ',                      wch: 14 },
  { match: 'phụ trách',          title: 'Cán bộ phụ trách',                  wch: 15 },
  { match: 'người tạo',          title: 'Người tạo',                         wch: 14 },
  { match: 'giai đoạn',          title: 'Giai đoạn',                         wch: 26 },
  { match: 'trạng thái',         title: 'Trạng thái công việc',              wch: 15 },
  { match: 'trạng thái sla',     title: 'Trạng thái SLA',                    wch: 15 },
  { match: 'deadline',           title: 'Deadline giai đoạn', type: 'datetime', wch: 18 },
  { match: 'bắt đầu giai đoạn',  title: 'Bắt đầu giai đoạn',  type: 'datetime', wch: 18 },
  { match: 'ngày tạo',           title: 'Ngày tạo hồ sơ',     type: 'datetime', wch: 18 },
  { match: 'cập nhật lần cuối',  title: 'Cập nhật lần cuối',  type: 'datetime', wch: 18 },
  { match: '% checklist',        title: '% Checklist',        type: 'pct',      wch: 12 },
  { match: 'số gđ đã qua',       title: 'Số giai đoạn đã qua', type: 'int',     wch: 12 },
  { match: 'hiện trạng',         title: 'Hiện trạng đất',                    wch: 26 },
  { match: 'gcn',                title: 'GCN',                               wch: 18 },
  { match: 'tặng',               title: 'Pháp lý tặng, cho, chuyển nhượng',  wch: 36 },
  { match: 'tách thửa',          title: 'Tách thửa',                         wch: 18 },
  { match: 'loại đất',           title: 'Loại đất',                          wch: 20 },
  { match: 'loại hồ sơ',         title: 'Loại hồ sơ',                        wch: 18 },
  { match: 'số nhà',             title: 'Số nhà',                            wch: 16 },
  { match: 'tên đường',          title: 'Tên đường',                         wch: 20 },
  { match: 'khu phố',            title: 'Khu phố',                           wch: 12 },
  { match: 'phường',             title: 'Phường',                            wch: 14 },
  { match: 'số tờ',              title: 'Số tờ',              type: 'int',     wch: 8 },
  { match: 'số thửa',            title: 'Số thửa',            type: 'int',     wch: 9 },
  { match: 'một phần',           title: 'Một phần (m2)',      type: 'num',     wch: 13 },
  { match: 'toàn phần',          title: 'Toàn phần (m2)',     type: 'num',     wch: 13 },
  { match: 'thông báo thu hồi',  title: 'Thông báo thu hồi đất',             wch: 20 },
  { match: 'ngày kiểm',          title: 'Ngày kiểm đếm',      type: 'date',    wch: 14 },
  { match: 'vướng mắc',          title: 'Nhóm vướng mắc, khó khăn',          wch: 30 },
  { match: 'nhóm vấn đề',        title: 'Nhóm vấn đề cần giải quyết',        wch: 30 },
  { match: 'nhãn',               title: 'Nhãn',                              wch: 16 },
  { match: 'người theo dõi',     title: 'Người theo dõi',                    wch: 24 },
  { match: 'link base',          title: 'Link Base Workflow',                wch: 38 }
];

/* Dò cột theo tên: khớp ĐÚNG HỆT trước, không có mới khớp chứa từ khoá.
   Mỗi cột của Base chỉ dùng 1 lần để không sinh 2 cột trùng dữ liệu. */
function matchHeader(key, used){
  const k = String(key).toLowerCase();
  let i = headers.findIndex((h, idx) => !used.has(idx) && h.toLowerCase() === k);
  if(i < 0) i = headers.findIndex((h, idx) => !used.has(idx) && h.toLowerCase().includes(k));
  return i;
}

/* Danh sách cột thực tế của file = STT + cột khai ở trên + cột Base còn lại */
function buildExportPlan(){
  const used = new Set();
  const plan = [{ title: 'STT', type: 'int', wch: 6, idx: -1 }];

  EXPORT_COLUMNS.forEach(c => {
    const i = matchHeader(c.match, used);
    if(i < 0) return;                       // Base không có cột này → bỏ qua
    used.add(i);
    plan.push({ title: c.title || headers[i], type: c.type || 'text', wch: c.wch, idx: i });
  });

  headers.forEach((h, i) => {
    if(used.has(i)) return;
    if(EXPORT_SKIP.some(k => h.toLowerCase().includes(k))) return;
    plan.push({ title: h, type: 'text', idx: i });
  });
  return plan;
}

const btnE = $('#btnExport');
if(btnE){
  btnE.onclick = () => {
    if(!window.XLSX){ alert('Chưa nạp được thư viện Excel (libs/xlsx.full.min.js).'); return; }
    if(!rows.length) return;

    /* Xuất ĐÚNG tập hồ sơ đang thấy trên bảng: bộ lọc + ô tìm kiếm */
    let data = filteredRows();
    const q = tableQuery.trim();
    if(q){
      const tokens = q.split(/\s+/).map(t => removeAccents(t));
      data = data.filter(r => {
        const hay = removeAccents(r.join(' '));
        return tokens.every(t => hay.includes(t));
      });
    }

    const plan = buildExportPlan();
    const cols = plan.map(c => ({ title: c.title, type: c.type, wch: c.wch }));
    const body = data.map((r, i) => plan.map(c => (c.idx < 0 ? i + 1 : r[c.idx])));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, RE.xlSheet(cols, body), 'DuLieuKPI');

    /* Bộ lọc đang bật ghi vào sheet ThongTin, không chèn lên đầu bảng dữ liệu */
    const fInfo = Object.entries(filters)
      .filter(([_, v]) => v !== undefined && v !== null && String(v).trim() !== '')
      .map(([k, v]) => ['Lọc theo cột: ' + (headers[+k] || k), v]);

    XLSX.utils.book_append_sheet(wb, RE.xlInfoSheet([
      ['Đơn vị',                'Ban Quản lý dự án đầu tư xây dựng phường Bình Quới'],
      ['Dự án',                 'Khu đô thị mới Bình Quới – Thanh Đa'],
      ['Nội dung file',         'Dữ liệu KPI hồ sơ bồi thường theo bộ lọc đang xem'],
      ['Thời điểm xuất file',   RE.xlNow()],
      ['Nguồn dữ liệu',         META.source || 'Base Workflow'],
      ['Base cập nhật lúc',     META.updated || ''],
      ['Tổng hồ sơ toàn dự án', rows.length],
      ['Số hồ sơ trong file',   body.length],
      ['Số cột trong file',     cols.length],
      ['Từ khoá tìm kiếm',      q || '(không)']
    ].concat(fInfo.length ? fInfo : [['Bộ lọc đang áp dụng', 'Không lọc — toàn bộ hồ sơ']])), 'ThongTin');

    RE.xlSave(wb, 'BaoCaoKPI_BinhQuoiThanhDa');
  };
}
function initRealtimeStream(){
  if(!window.EventSource) return;
  try {
    const es = new EventSource('/api/stream');
    es.onmessage = function(e){
      try {
        const d = JSON.parse(e.data);
        if(d && d.type === 'update'){
          console.log('⚡ [Realtime SSE] Nhận tín hiệu dữ liệu mới từ máy chủ!');
          loadLive(false);
        }
      } catch(err){}
    };
    es.onerror = function(){
      // Auto reconnect on drop
    };
  } catch(e){}
}

setupQuickFilters();
tryLoadLocalCache();
loadLive(false);
setAuto(false);
initRealtimeStream();

