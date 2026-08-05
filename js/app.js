/* ═══════════════════════════════════════════════════════════
   DOVETAIL APPLICATION ENGINE — EXECUTIVE BI & STAFF EVALUATION
   (Modular Frontend Application Logic)
   ═══════════════════════════════════════════════════════════ */

"use strict";

/* ── DOM Selectors & Palette ── */
const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);

const PAL = ['#6798ff','#10b981','#3b82f6','#ef4444','#8b5cf6','#0ea5e9','#d97706','#14b8a6','#f97316','#a78bfa','#ec4899','#f43f5e'];
const EMPTY = '(Chưa phân loại)';
const PRIORITY = ['giai đoạn','tổ/phòng','trạng thái','trạng thái sla','người phụ trách','giao cho','nhóm về hiện trạng','nhóm có gcn/không có gcn','nhóm pháp lý tặng, cho, chuyển nhượng','nhóm tách thửa/ không tách thửa','người tạo','nhãn'];

const TEAM_COL = 'Tổ/Phòng';
const TEAM_OTHER = 'Tổ NV BT 1';
const TEAM_MAP = {
  tuancq:'Tổ NV BT 1',linhpta:'Tổ NV BT 1',tuyennt:'Tổ NV BT 1',vinhdhd:'Tổ NV BT 1',minhth:'Tổ NV BT 1',oanhdck:'Tổ NV BT 1',
  thuonghh:'Tổ NV BT 1',tanhv:'Tổ NV BT 1',chaundm:'Tổ NV BT 1',thachhq:'Tổ NV BT 1',tungnm:'Tổ NV BT 1',nhutnu:'Tổ NV BT 1',truongtt:'Tổ NV BT 1',
  hientt:'Tổ NV BT 1',nhivty:'Tổ NV BT 1',anhvpm:'Tổ NV BT 1',dunglq:'Tổ NV BT 1',tanhn:'Tổ NV BT 1',linhhk:'Tổ NV BT 1',thotm:'Tổ NV BT 1',
  thutna:'Tổ NV BT 2',vittb:'Tổ NV BT 2',haola:'Tổ NV BT 2',giangnpt:'Tổ NV BT 2',tuanla:'Tổ NV BT 2',nhanvt:'Tổ NV BT 2',
  nganntt:'Tổ NV BT 2',phuongll:'Tổ NV BT 2',nguyennnt:'Tổ NV BT 2',tungnt:'Tổ NV BT 2',huyhbm:'Tổ NV BT 2',trinhdtt:'Tổ NV BT 2',nganmnk:'Tổ NV BT 2',thamhth:'Tổ NV BT 2',
  tramlp:'Tổ NV BT 2',phuclv:'Tổ NV BT 2',khanhld:'Tổ NV BT 2',huongdnt:'Tổ NV BT 2',kietnt:'Tổ NV BT 2',thuynt:'Tổ NV BT 2',
  kimnta:'Tổ NV BT 2',dungpv:'Tổ NV BT 2',thanhnhh:'Tổ NV BT 2',oanhnth:'Tổ NV BT 2',giaotnh:'Tổ NV BT 2',nguyethhx:'Tổ NV BT 2',tudtq:'Tổ NV BT 2',
  nghiadt:'Tổ NV BT 3',hainv:'Tổ NV BT 3',thinhpn:'Tổ NV BT 3',thuongctm:'Tổ NV BT 3',hungtnn:'Tổ NV BT 3',baohlq:'Tổ NV BT 3',
  phucvt:'Tổ NV BT 3',trailq:'Tổ NV BT 3',khanhptv:'Tổ NV BT 3',trucplx:'Tổ NV BT 3',baotd:'Tổ NV BT 3',quannm:'Tổ NV BT 3',
  nhunt:'Tổ NV BT 3',daivv:'Tổ NV BT 3',trungnq:'Tổ NV BT 3',tailt:'Tổ NV BT 3',lamdtt:'Tổ NV BT 3',quyendtt:'Tổ NV BT 3',trannn:'Tổ NV BT 3',hattn:'Tổ NV BT 3',
  lybtt:'Tổ NV BT 3',bichln:'Tổ NV BT 3',thanhlt:'Tổ NV BT 3',minhltn:'Tổ NV BT 3'
};

function teamOf(u){
  u = String(u || '').trim().toLowerCase();
  if(!u) return EMPTY;
  return TEAM_MAP[u] || TEAM_OTHER;
}

function resolveTeam(jobName, gcUser, ntUser){
  const name = String(jobName || '').toUpperCase();
  if(name.includes('KP17') || name.includes('KP 17') || name.includes('/KP17/')){
    return 'Tổ NV BT 1';
  }
  if(name.includes('KP18') || name.includes('KP 18') || name.includes('/KP18/')){
    return 'Tổ NV BT 2';
  }
  if(name.includes('KP19') || name.includes('KP 19') || name.includes('/KP19/')){
    return 'Tổ NV BT 3';
  }
  const t1 = teamOf(gcUser);
  if(t1 === 'Tổ NV BT 1' || t1 === 'Tổ NV BT 2' || t1 === 'Tổ NV BT 3') return t1;
  const t2 = teamOf(ntUser);
  if(t2 === 'Tổ NV BT 1' || t2 === 'Tổ NV BT 2' || t2 === 'Tổ NV BT 3') return t2;
  return 'Tổ NV BT 1';
}

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
    }
  };
});

/* ── Data Engine & Filtering ── */
function applyData(hdrs, rws, stgMap){
  headers = hdrs.map(h => String(h).trim() || '(cột)');
  rows = (rws || []).map(r => headers.map((_, i) => String(r[i] ?? '').trim()));
  stageMap = stgMap || {};
  enrichTeam();
  detectFilterCols();
  filters = {};
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
  const gc = headers.findIndex(h => h.toLowerCase().includes('phụ trách') || h.toLowerCase().includes('giao cho'));
  const nt = headers.findIndex(h => h.toLowerCase().includes('người tạo'));
  const nameIdx = headers.findIndex(h => h.toLowerCase().includes('tên nhiệm vụ') || h.toLowerCase().includes('tên'));

  const ti = headers.indexOf(TEAM_COL);
  if(ti >= 0){
    rows.forEach(r => {
      const jobName = nameIdx >= 0 ? r[nameIdx] : '';
      const gcUser = gc >= 0 ? r[gc] : '';
      const ntUser = nt >= 0 ? r[nt] : '';
      r[ti] = resolveTeam(jobName, gcUser, ntUser);
    });
  } else {
    headers.push(TEAM_COL);
    rows.forEach(r => {
      const jobName = nameIdx >= 0 ? r[nameIdx] : '';
      const gcUser = gc >= 0 ? r[gc] : '';
      const ntUser = nt >= 0 ? r[nt] : '';
      r.push(resolveTeam(jobName, gcUser, ntUser));
    });
  }
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

function normGCN(str){
  const s = String(str || '').trim().toUpperCase();
  if(!s || s === '(CHƯA XÁC ĐỊNH)' || s === 'EMPTY') return 'CHƯA XÁC ĐỊNH';
  if(s.includes('KHÔNG') || s.includes('CHƯA')) return 'KHÔNG CÓ GCN';
  if(s.includes('CÓ GCN') || s.includes('CÓ')) return 'CÓ GCN';
  return 'CHƯA XÁC ĐỊNH';
}

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

  const htIdx = headers.findIndex(h => h.toLowerCase().includes('hiện trạng'));
  const gcnIdx = headers.findIndex(h => h.toLowerCase().includes('gcn'));
  const plIdx = headers.findIndex(h => h.toLowerCase().includes('tặng') || h.toLowerCase().includes('chuyển nhượng'));
  const ttIdx = headers.findIndex(h => h.toLowerCase().includes('tách thửa'));
  const teamIdx = headers.indexOf(TEAM_COL);

  const TEAMS = ['Tổ NV BT 1', 'Tổ NV BT 2', 'Tổ NV BT 3'];

  function htIs(ht, term){
    if(term === 'NÔNG NGHIỆP') return ht === 'ĐẤT NÔNG NGHIỆP' || (ht.includes('NÔNG NGHIỆP') && !ht.includes('NHÀ'));
    if(term === 'ĐẤT Ở') return ht === 'ĐẤT Ở' || (ht.includes('ĐẤT Ở') && !ht.includes('NHÀ') && !ht.includes('NÔNG NGHIỆP'));
    if(term === 'NHÀ Ở TRÊN ĐẤT NÔNG NGHIỆP') return ht === 'CÓ NHÀ Ở TRÊN ĐẤT NÔNG NGHIỆP' || (ht.includes('NHÀ') && ht.includes('NÔNG NGHIỆP'));
    if(term === 'NHÀ Ở TRÊN ĐẤT Ở') return ht === 'CÓ NHÀ Ở TRÊN ĐẤT Ở' || (ht.includes('NHÀ') && ht.includes('ĐẤT Ở') && !ht.includes('NÔNG NGHIỆP'));
    return ht.includes(term);
  }

  function gcnIs(gcn, isYes){
    if(isYes) return gcn.includes('CÓ GCN') && !gcn.includes('KHÔNG');
    return gcn.includes('KHÔNG') || gcn.includes('CHƯA');
  }

  function plIs(pl, term){
    if(term === 'KHÔNG TẶNG') return pl.includes('KHÔNG TẶNG') || pl.includes('KHÔNG TẶNG/CHO');
    return pl.includes(term);
  }

  function ttIs(tt, isYes){
    if(isYes) return tt.includes('CÓ TÁCH') || tt.includes('TÁCH THỬA');
    return !tt.includes('CÓ TÁCH') && !tt.includes('TÁCH THỬA');
  }

  const TREE_SPEC = [
    // Section I
    { id: "I", p: null, lvl: 1, title: "I. HIỆN TRẠNG LÀ ĐẤT NÔNG NGHIỆP" },
    { id: "I.1", p: "I", lvl: 2, title: "1. CÓ GCN" },
    { id: "I.1.a", p: "I.1", lvl: 3, title: "a) KHÔNG TẶNG CHO CHUYỂN NHƯỢNG",
      match: (ht, gcn, pl, tt) => htIs(ht, 'NÔNG NGHIỆP') && gcnIs(gcn, true) && plIs(pl, 'KHÔNG TẶNG') },
    { id: "I.1.b", p: "I.1", lvl: 3, title: "b) TẶNG, CHO, CHUYỂN NHƯỢNG GIẤY TAY, VI BẰNG TRƯỚC 01/7/2014" },
    { id: "I.1.b.1", p: "I.1.b", lvl: 4, title: "- KHÔNG TÁCH THỬA",
      match: (ht, gcn, pl, tt) => htIs(ht, 'NÔNG NGHIỆP') && gcnIs(gcn, true) && plIs(pl, 'TRƯỚC 01/7/2014') && ttIs(tt, false) },
    { id: "I.1.b.2", p: "I.1.b", lvl: 4, title: "- CÓ TÁCH THỬA",
      match: (ht, gcn, pl, tt) => htIs(ht, 'NÔNG NGHIỆP') && gcnIs(gcn, true) && plIs(pl, 'TRƯỚC 01/7/2014') && ttIs(tt, true) },
    { id: "I.1.c", p: "I.1", lvl: 3, title: "c) TẶNG, CHO, CHUYỂN NHƯỢNG GIẤY TAY, VI BẰNG SAU 01/7/2014" },
    { id: "I.1.c.1", p: "I.1.c", lvl: 4, title: "- KHÔNG TÁCH THỬA",
      match: (ht, gcn, pl, tt) => htIs(ht, 'NÔNG NGHIỆP') && gcnIs(gcn, true) && plIs(pl, 'SAU 01/7/2014') && ttIs(tt, false) },
    { id: "I.1.c.2", p: "I.1.c", lvl: 4, title: "- CÓ TÁCH THỬA",
      match: (ht, gcn, pl, tt) => htIs(ht, 'NÔNG NGHIỆP') && gcnIs(gcn, true) && plIs(pl, 'SAU 01/7/2014') && ttIs(tt, true) },

    { id: "I.2", p: "I", lvl: 2, title: "2. CHƯA CẤP GCN" },
    { id: "I.2.a", p: "I.2", lvl: 3, title: "a) KHÔNG TẶNG CHO CHUYỂN NHƯỢNG",
      match: (ht, gcn, pl, tt) => htIs(ht, 'NÔNG NGHIỆP') && gcnIs(gcn, false) && plIs(pl, 'KHÔNG TẶNG') },
    { id: "I.2.b", p: "I.2", lvl: 3, title: "b) TẶNG, CHO, CHUYỂN NHƯỢNG GIẤY TAY, VI BẰNG TRƯỚC 01/7/2014" },
    { id: "I.2.b.1", p: "I.2.b", lvl: 4, title: "- KHÔNG TÁCH THỬA",
      match: (ht, gcn, pl, tt) => htIs(ht, 'NÔNG NGHIỆP') && gcnIs(gcn, false) && plIs(pl, 'TRƯỚC 01/7/2014') && ttIs(tt, false) },
    { id: "I.2.b.2", p: "I.2.b", lvl: 4, title: "- CÓ TÁCH THỬA",
      match: (ht, gcn, pl, tt) => htIs(ht, 'NÔNG NGHIỆP') && gcnIs(gcn, false) && plIs(pl, 'TRƯỚC 01/7/2014') && ttIs(tt, true) },
    { id: "I.2.c", p: "I.2", lvl: 3, title: "c) TẶNG, CHO, CHUYỂN NHƯỢNG GIẤY TAY, VI BẰNG SAU 01/7/2014" },
    { id: "I.2.c.1", p: "I.2.c", lvl: 4, title: "- KHÔNG TÁCH THỬA",
      match: (ht, gcn, pl, tt) => htIs(ht, 'NÔNG NGHIỆP') && gcnIs(gcn, false) && plIs(pl, 'SAU 01/7/2014') && ttIs(tt, false) },
    { id: "I.2.c.2", p: "I.2.c", lvl: 4, title: "- CÓ TÁCH THỬA",
      match: (ht, gcn, pl, tt) => htIs(ht, 'NÔNG NGHIỆP') && gcnIs(gcn, false) && plIs(pl, 'SAU 01/7/2014') && ttIs(tt, true) },

    // Section II
    { id: "II", p: null, lvl: 1, title: "II. HIỆN TRẠNG LÀ ĐẤT Ở" },
    { id: "II.1", p: "II", lvl: 2, title: "1. CÓ GCN" },
    { id: "II.1.a", p: "II.1", lvl: 3, title: "a) KHÔNG TẶNG CHO CHUYỂN NHƯỢNG",
      match: (ht, gcn, pl, tt) => htIs(ht, 'ĐẤT Ở') && gcnIs(gcn, true) && plIs(pl, 'KHÔNG TẶNG') },
    { id: "II.1.b", p: "II.1", lvl: 3, title: "b) TẶNG, CHO, CHUYỂN NHƯỢNG GIẤY TAY, VI BẰNG TRƯỚC 01/7/2014" },
    { id: "II.1.b.1", p: "II.1.b", lvl: 4, title: "- KHÔNG TÁCH THỬA",
      match: (ht, gcn, pl, tt) => htIs(ht, 'ĐẤT Ở') && gcnIs(gcn, true) && plIs(pl, 'TRƯỚC 01/7/2014') && ttIs(tt, false) },
    { id: "II.1.b.2", p: "II.1.b", lvl: 4, title: "- CÓ TÁCH THỬA",
      match: (ht, gcn, pl, tt) => htIs(ht, 'ĐẤT Ở') && gcnIs(gcn, true) && plIs(pl, 'TRƯỚC 01/7/2014') && ttIs(tt, true) },
    { id: "II.1.c", p: "II.1", lvl: 3, title: "c) TẶNG, CHO, CHUYỂN NHƯỢNG GIẤY TAY, VI BẰNG SAU 01/7/2014" },
    { id: "II.1.c.1", p: "II.1.c", lvl: 4, title: "- KHÔNG TÁCH THỬA",
      match: (ht, gcn, pl, tt) => htIs(ht, 'ĐẤT Ở') && gcnIs(gcn, true) && plIs(pl, 'SAU 01/7/2014') && ttIs(tt, false) },
    { id: "II.1.c.2", p: "II.1.c", lvl: 4, title: "- CÓ TÁCH THỬA",
      match: (ht, gcn, pl, tt) => htIs(ht, 'ĐẤT Ở') && gcnIs(gcn, true) && plIs(pl, 'SAU 01/7/2014') && ttIs(tt, true) },

    { id: "II.2", p: "II", lvl: 2, title: "2. CHƯA CẤP GCN" },
    { id: "II.2.a", p: "II.2", lvl: 3, title: "a) KHÔNG TẶNG CHO CHUYỂN NHƯỢNG",
      match: (ht, gcn, pl, tt) => htIs(ht, 'ĐẤT Ở') && gcnIs(gcn, false) && plIs(pl, 'KHÔNG TẶNG') },
    { id: "II.2.b", p: "II.2", lvl: 3, title: "b) TẶNG, CHO, CHUYỂN NHƯỢNG GIẤY TAY, VI BẰNG TRƯỚC 01/7/2014" },
    { id: "II.2.b.1", p: "II.2.b", lvl: 4, title: "- KHÔNG TÁCH THỬA",
      match: (ht, gcn, pl, tt) => htIs(ht, 'ĐẤT Ở') && gcnIs(gcn, false) && plIs(pl, 'TRƯỚC 01/7/2014') && ttIs(tt, false) },
    { id: "II.2.b.2", p: "II.2.b", lvl: 4, title: "- CÓ TÁCH THỬA",
      match: (ht, gcn, pl, tt) => htIs(ht, 'ĐẤT Ở') && gcnIs(gcn, false) && plIs(pl, 'TRƯỚC 01/7/2014') && ttIs(tt, true) },
    { id: "II.2.c", p: "II.2", lvl: 3, title: "c) TẶNG, CHO, CHUYỂN NHƯỢNG GIẤY TAY, VI BẰNG SAU 01/7/2014" },
    { id: "II.2.c.1", p: "II.2.c", lvl: 4, title: "- KHÔNG TÁCH THỬA",
      match: (ht, gcn, pl, tt) => htIs(ht, 'ĐẤT Ở') && gcnIs(gcn, false) && plIs(pl, 'SAU 01/7/2014') && ttIs(tt, false) },
    { id: "II.2.c.2", p: "II.2.c", lvl: 4, title: "- CÓ TÁCH THỬA",
      match: (ht, gcn, pl, tt) => htIs(ht, 'ĐẤT Ở') && gcnIs(gcn, false) && plIs(pl, 'SAU 01/7/2014') && ttIs(tt, true) },

    // Section III
    { id: "III", p: null, lvl: 1, title: "III. HIỆN TRẠNG CÓ NHÀ Ở TRÊN ĐẤT NÔNG NGHIỆP" },
    { id: "III.1", p: "III", lvl: 2, title: "1. CÓ GCN" },
    { id: "III.1.a", p: "III.1", lvl: 3, title: "a) KHÔNG TẶNG CHO CHUYỂN NHƯỢNG XÂY DỰNG TRƯỚC 01/7/2014",
      match: (ht, gcn, pl, tt) => htIs(ht, 'NHÀ Ở TRÊN ĐẤT NÔNG NGHIỆP') && gcnIs(gcn, true) && plIs(pl, 'KHÔNG TẶNG') && plIs(pl, 'TRƯỚC 01/7/2014') },
    { id: "III.1.b", p: "III.1", lvl: 3, title: "b) KHÔNG TẶNG CHO CHUYỂN NHƯỢNG XÂY DỰNG SAU 01/7/2014",
      match: (ht, gcn, pl, tt) => htIs(ht, 'NHÀ Ở TRÊN ĐẤT NÔNG NGHIỆP') && gcnIs(gcn, true) && plIs(pl, 'KHÔNG TẶNG') && plIs(pl, 'SAU 01/7/2014') },
    { id: "III.1.c", p: "III.1", lvl: 3, title: "c) TẶNG, CHO, CHUYỂN NHƯỢNG GIẤY TAY, VI BẰNG XÂY DỰNG TRƯỚC 01/7/2014" },
    { id: "III.1.c.1", p: "III.1.c", lvl: 4, title: "- KHÔNG TÁCH THỬA",
      match: (ht, gcn, pl, tt) => htIs(ht, 'NHÀ Ở TRÊN ĐẤT NÔNG NGHIỆP') && gcnIs(gcn, true) && !plIs(pl, 'KHÔNG TẶNG') && plIs(pl, 'TRƯỚC 01/7/2014') && ttIs(tt, false) },
    { id: "III.1.c.2", p: "III.1.c", lvl: 4, title: "- CÓ TÁCH THỬA",
      match: (ht, gcn, pl, tt) => htIs(ht, 'NHÀ Ở TRÊN ĐẤT NÔNG NGHIỆP') && gcnIs(gcn, true) && !plIs(pl, 'KHÔNG TẶNG') && plIs(pl, 'TRƯỚC 01/7/2014') && ttIs(tt, true) },
    { id: "III.1.d", p: "III.1", lvl: 3, title: "d) TẶNG, CHO, CHUYỂN NHƯỢNG GIẤY TAY, VI BẰNG XÂY DỰNG SAU 01/7/2014" },
    { id: "III.1.d.1", p: "III.1.d", lvl: 4, title: "- KHÔNG TÁCH THỬA",
      match: (ht, gcn, pl, tt) => htIs(ht, 'NHÀ Ở TRÊN ĐẤT NÔNG NGHIỆP') && gcnIs(gcn, true) && !plIs(pl, 'KHÔNG TẶNG') && plIs(pl, 'SAU 01/7/2014') && ttIs(tt, false) },
    { id: "III.1.d.2", p: "III.1.d", lvl: 4, title: "- CÓ TÁCH THỬA",
      match: (ht, gcn, pl, tt) => htIs(ht, 'NHÀ Ở TRÊN ĐẤT NÔNG NGHIỆP') && gcnIs(gcn, true) && !plIs(pl, 'KHÔNG TẶNG') && plIs(pl, 'SAU 01/7/2014') && ttIs(tt, true) },

    { id: "III.2", p: "III", lvl: 2, title: "2. CHƯA CẤP GCN" },
    { id: "III.2.a", p: "III.2", lvl: 3, title: "a) KHÔNG TẶNG CHO CHUYỂN NHƯỢNG XÂY DỰNG TRƯỚC 01/7/2014",
      match: (ht, gcn, pl, tt) => htIs(ht, 'NHÀ Ở TRÊN ĐẤT NÔNG NGHIỆP') && gcnIs(gcn, false) && plIs(pl, 'KHÔNG TẶNG') && plIs(pl, 'TRƯỚC 01/7/2014') },
    { id: "III.2.b", p: "III.2", lvl: 3, title: "b) KHÔNG TẶNG CHO CHUYỂN NHƯỢNG XÂY DỰNG SAU 01/7/2014",
      match: (ht, gcn, pl, tt) => htIs(ht, 'NHÀ Ở TRÊN ĐẤT NÔNG NGHIỆP') && gcnIs(gcn, false) && plIs(pl, 'KHÔNG TẶNG') && plIs(pl, 'SAU 01/7/2014') },
    { id: "III.2.c", p: "III.2", lvl: 3, title: "c) TẶNG, CHO, CHUYỂN NHƯỢNG GIẤY TAY, VI BẰNG XÂY DỰNG TRƯỚC 01/7/2014" },
    { id: "III.2.c.1", p: "III.2.c", lvl: 4, title: "- KHÔNG TÁCH THỬA",
      match: (ht, gcn, pl, tt) => htIs(ht, 'NHÀ Ở TRÊN ĐẤT NÔNG NGHIỆP') && gcnIs(gcn, false) && !plIs(pl, 'KHÔNG TẶNG') && plIs(pl, 'TRƯỚC 01/7/2014') && ttIs(tt, false) },
    { id: "III.2.c.2", p: "III.2.c", lvl: 4, title: "- CÓ TÁCH THỬA",
      match: (ht, gcn, pl, tt) => htIs(ht, 'NHÀ Ở TRÊN ĐẤT NÔNG NGHIỆP') && gcnIs(gcn, false) && !plIs(pl, 'KHÔNG TẶNG') && plIs(pl, 'TRƯỚC 01/7/2014') && ttIs(tt, true) },
    { id: "III.2.d", p: "III.2", lvl: 3, title: "d) TẶNG, CHO, CHUYỂN NHƯỢNG GIẤY TAY, VI BẰNG XÂY DỰNG SAU 01/7/2014" },
    { id: "III.2.d.1", p: "III.2.d", lvl: 4, title: "- KHÔNG TÁCH THỬA",
      match: (ht, gcn, pl, tt) => htIs(ht, 'NHÀ Ở TRÊN ĐẤT NÔNG NGHIỆP') && gcnIs(gcn, false) && !plIs(pl, 'KHÔNG TẶNG') && plIs(pl, 'SAU 01/7/2014') && ttIs(tt, false) },
    { id: "III.2.d.2", p: "III.2.d", lvl: 4, title: "- CÓ TÁCH THỬA",
      match: (ht, gcn, pl, tt) => htIs(ht, 'NHÀ Ở TRÊN ĐẤT NÔNG NGHIỆP') && gcnIs(gcn, false) && !plIs(pl, 'KHÔNG TẶNG') && plIs(pl, 'SAU 01/7/2014') && ttIs(tt, true) },

    // Section IV
    { id: "IV", p: null, lvl: 1, title: "IV. HIỆN TRẠNG CÓ NHÀ Ở TRÊN ĐẤT Ở" },
    { id: "IV.1", p: "IV", lvl: 2, title: "1. CÓ GCN" },
    { id: "IV.1.a", p: "IV.1", lvl: 3, title: "a) KHÔNG TẶNG CHO CHUYỂN NHƯỢNG XÂY DỰNG TRƯỚC 01/7/2014",
      match: (ht, gcn, pl, tt) => htIs(ht, 'NHÀ Ở TRÊN ĐẤT Ở') && gcnIs(gcn, true) && plIs(pl, 'KHÔNG TẶNG') && plIs(pl, 'TRƯỚC 01/7/2014') },
    { id: "IV.1.b", p: "IV.1", lvl: 3, title: "b) KHÔNG TẶNG CHO CHUYỂN NHƯỢNG XÂY DỰNG SAU 01/7/2014",
      match: (ht, gcn, pl, tt) => htIs(ht, 'NHÀ Ở TRÊN ĐẤT Ở') && gcnIs(gcn, true) && plIs(pl, 'KHÔNG TẶNG') && plIs(pl, 'SAU 01/7/2014') },
    { id: "IV.1.c", p: "IV.1", lvl: 3, title: "c) TẶNG, CHO, CHUYỂN NHƯỢNG GIẤY TAY, VI BẰNG XÂY DỰNG TRƯỚC 01/7/2014" },
    { id: "IV.1.c.1", p: "IV.1.c", lvl: 4, title: "- KHÔNG TÁCH THỬA",
      match: (ht, gcn, pl, tt) => htIs(ht, 'NHÀ Ở TRÊN ĐẤT Ở') && gcnIs(gcn, true) && !plIs(pl, 'KHÔNG TẶNG') && plIs(pl, 'TRƯỚC 01/7/2014') && ttIs(tt, false) },
    { id: "IV.1.c.2", p: "IV.1.c", lvl: 4, title: "- CÓ TÁCH THỬA",
      match: (ht, gcn, pl, tt) => htIs(ht, 'NHÀ Ở TRÊN ĐẤT Ở') && gcnIs(gcn, true) && !plIs(pl, 'KHÔNG TẶNG') && plIs(pl, 'TRƯỚC 01/7/2014') && ttIs(tt, true) },
    { id: "IV.1.d", p: "IV.1", lvl: 3, title: "d) TẶNG, CHO, CHUYỂN NHƯỢNG GIẤY TAY, VI BẰNG XÂY DỰNG SAU 01/7/2014" },
    { id: "IV.1.d.1", p: "IV.1.d", lvl: 4, title: "- KHÔNG TÁCH THỬA",
      match: (ht, gcn, pl, tt) => htIs(ht, 'NHÀ Ở TRÊN ĐẤT Ở') && gcnIs(gcn, true) && !plIs(pl, 'KHÔNG TẶNG') && plIs(pl, 'SAU 01/7/2014') && ttIs(tt, false) },
    { id: "IV.1.d.2", p: "IV.1.d", lvl: 4, title: "- CÓ TÁCH THỬA",
      match: (ht, gcn, pl, tt) => htIs(ht, 'NHÀ Ở TRÊN ĐẤT Ở') && gcnIs(gcn, true) && !plIs(pl, 'KHÔNG TẶNG') && plIs(pl, 'SAU 01/7/2014') && ttIs(tt, true) },

    { id: "IV.2", p: "IV", lvl: 2, title: "2. CHƯA CẤP GCN" },
    { id: "IV.2.a", p: "IV.2", lvl: 3, title: "a) KHÔNG TẶNG CHO CHUYỂN NHƯỢNG XÂY DỰNG TRƯỚC 01/7/2014",
      match: (ht, gcn, pl, tt) => htIs(ht, 'NHÀ Ở TRÊN ĐẤT Ở') && gcnIs(gcn, false) && plIs(pl, 'KHÔNG TẶNG') && plIs(pl, 'TRƯỚC 01/7/2014') },
    { id: "IV.2.b", p: "IV.2", lvl: 3, title: "b) KHÔNG TẶNG CHO CHUYỂN NHƯỢNG XÂY DỰNG SAU 01/7/2014",
      match: (ht, gcn, pl, tt) => htIs(ht, 'NHÀ Ở TRÊN ĐẤT Ở') && gcnIs(gcn, false) && plIs(pl, 'KHÔNG TẶNG') && plIs(pl, 'SAU 01/7/2014') },
    { id: "IV.2.c", p: "IV.2", lvl: 3, title: "c) TẶNG, CHO, CHUYỂN NHƯỢNG GIẤY TAY, VI BẰNG XÂY DỰNG TRƯỚC 01/7/2014" },
    { id: "IV.2.c.1", p: "IV.2.c", lvl: 4, title: "- KHÔNG TÁCH THỬA",
      match: (ht, gcn, pl, tt) => htIs(ht, 'NHÀ Ở TRÊN ĐẤT Ở') && gcnIs(gcn, false) && !plIs(pl, 'KHÔNG TẶNG') && plIs(pl, 'TRƯỚC 01/7/2014') && ttIs(tt, false) },
    { id: "IV.2.c.2", p: "IV.2.c", lvl: 4, title: "- CÓ TÁCH THỬA",
      match: (ht, gcn, pl, tt) => htIs(ht, 'NHÀ Ở TRÊN ĐẤT Ở') && gcnIs(gcn, false) && !plIs(pl, 'KHÔNG TẶNG') && plIs(pl, 'TRƯỚC 01/7/2014') && ttIs(tt, true) },
    { id: "IV.2.d", p: "IV.2", lvl: 3, title: "d) TẶNG, CHO, CHUYỂN NHƯỢNG GIẤY TAY, VI BẰNG SAU 01/7/2014" },
    { id: "IV.2.d.1", p: "IV.2.d", lvl: 4, title: "- KHÔNG TÁCH THỬA",
      match: (ht, gcn, pl, tt) => htIs(ht, 'NHÀ Ở TRÊN ĐẤT Ở') && gcnIs(gcn, false) && !plIs(pl, 'KHÔNG TẶNG') && plIs(pl, 'SAU 01/7/2014') && ttIs(tt, false) },
    { id: "IV.2.d.2", p: "IV.2.d", lvl: 4, title: "- CÓ TÁCH THỬA",
      match: (ht, gcn, pl, tt) => htIs(ht, 'NHÀ Ở TRÊN ĐẤT Ở') && gcnIs(gcn, false) && !plIs(pl, 'KHÔNG TẶNG') && plIs(pl, 'SAU 01/7/2014') && ttIs(tt, true) },

    // Section V
    { id: "V", p: null, lvl: 1, title: "V. ĐẤT HỢP TÁC XÃ GIAO KHOÁN",
      match: (ht, gcn, pl, tt) => ht.includes('HỢP TÁC XÃ') || ht.includes('HTX') },

    // Section VI
    { id: "VI", p: null, lvl: 1, title: "VI. ĐẤT CƠ QUAN TỔ CHỨC" },
    { id: "VI.1", p: "VI", lvl: 2, title: "1. CÓ GCN",
      match: (ht, gcn, pl, tt) => (ht.includes('CƠ QUAN') || ht.includes('TỔ CHỨC')) && gcnIs(gcn, true) },
    { id: "VI.2", p: "VI", lvl: 2, title: "2. CHƯA CẤP GCN",
      match: (ht, gcn, pl, tt) => (ht.includes('CƠ QUAN') || ht.includes('TỔ CHỨC')) && gcnIs(gcn, false) }
  ];

  // Parent mapping and counters
  const parentMap = {};
  const counts = {};
  TREE_SPEC.forEach(n => {
    parentMap[n.id] = n.p;
    counts[n.id] = {};
    TEAMS.forEach(t => counts[n.id][t] = 0);
  });

  const leafNodes = TREE_SPEC.filter(n => typeof n.match === 'function');

  data.forEach(r => {
    const ht = (htIdx >= 0 ? r[htIdx] : '').trim().toUpperCase();
    const gcn = (gcnIdx >= 0 ? r[gcnIdx] : '').trim().toUpperCase();
    const pl = (plIdx >= 0 ? r[plIdx] : '').trim().toUpperCase();
    const tt = (ttIdx >= 0 ? r[ttIdx] : '').trim().toUpperCase();
    const tm = (teamIdx >= 0 ? r[teamIdx] : EMPTY).trim() || EMPTY;
    const teamKey = TEAMS.includes(tm) ? tm : 'Khác/Chưa xác định';

    let matchedId = null;
    for(const leaf of leafNodes){
      if(leaf.match(ht, gcn, pl, tt)){
        matchedId = leaf.id;
        break;
      }
    }

    if(!matchedId){
      if(htIs(ht, 'NÔNG NGHIỆP')){
        const isGcn = gcnIs(gcn, true);
        if(pl.includes('TRƯỚC 01/7/2014')) matchedId = isGcn ? 'I.1.b.2' : 'I.2.b.2';
        else if(pl.includes('SAU 01/7/2014')) matchedId = isGcn ? 'I.1.c.2' : 'I.2.c.2';
        else matchedId = isGcn ? 'I.1.a' : 'I.2.a';
      } else if(htIs(ht, 'ĐẤT Ở')){
        const isGcn = gcnIs(gcn, true);
        if(pl.includes('TRƯỚC 01/7/2014')) matchedId = isGcn ? 'II.1.b.2' : 'II.2.b.2';
        else if(pl.includes('SAU 01/7/2014')) matchedId = isGcn ? 'II.1.c.2' : 'II.2.c.2';
        else matchedId = isGcn ? 'II.1.a' : 'II.2.a';
      } else if(htIs(ht, 'NHÀ Ở TRÊN ĐẤT NÔNG NGHIỆP')){
        matchedId = gcnIs(gcn, true) ? 'III.1.c.2' : 'III.2.c.2';
      } else if(htIs(ht, 'NHÀ Ở TRÊN ĐẤT Ở')){
        matchedId = gcnIs(gcn, true) ? 'IV.1.c.2' : 'IV.2.c.2';
      } else if(ht.includes('HỢP TÁC XÃ') || ht.includes('HTX')){
        matchedId = 'V';
      } else if(ht.includes('CƠ QUAN') || ht.includes('TỔ CHỨC')){
        matchedId = gcnIs(gcn, true) ? 'VI.1' : 'VI.2';
      }
    }

    if(matchedId){
      let curr = matchedId;
      while(curr){
        if(counts[curr] && counts[curr][teamKey] !== undefined){
          counts[curr][teamKey]++;
        }
        curr = parentMap[curr];
      }
    }
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
            const dtStr = m.st ? new Date(m.st * 1000).toLocaleString('vi') : '—';
            const durDays = m.d ? (m.d / 86400).toFixed(1) + ' ngày' : '—';
            tlHtml += `<li class="tl-item">
              <div class="tl-title"><b>${escH(m.sn || 'Bước')}</b> · <small>${dtStr}</small></div>
              <div class="tl-desc">Thực hiện: <b>${escH(m.u || 'Cán bộ')}</b> | Giữ: <b>${durDays}</b></div>
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
        applyData(d.headers, d.rows, d.meta ? d.meta.stage_map : {});
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

    applyData(d.headers, d.rows, d.meta ? d.meta.stage_map : {});
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
const btnE = $('#btnExport');
if(btnE){
  btnE.onclick = () => {
    if(!rows.length) return;
    const data = filteredRows();
    const sheetData = data.map(r => {
      const obj = {};
      headers.forEach((h, i) => { if(!h.includes('chuyển bước')) obj[h] = r[i] || ''; });
      return obj;
    });
    const ws = XLSX.utils.json_to_sheet(sheetData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'DuLieuKPI');
    XLSX.writeFile(wb, 'BaoCao_KPI_BinhQuoiThanhDa_' + new Date().toISOString().slice(0, 10) + '.xlsx');
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

