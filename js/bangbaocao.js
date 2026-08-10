/* ═══════════════════════════════════════════════════════════
   TRANG BẢNG BÁO CÁO  (/bangbaocao)
   Bảng WEB tra cứu phân loại pháp lý hồ sơ, 2 chế độ:
     1. Danh mục phân loại — bấm 1 danh mục để liệt kê hồ sơ trong đó
     2. Liệt kê theo hồ sơ — bảng chi tiết, tìm kiếm / sắp xếp / phân trang
   Lõi nghiệp vụ (cây phân loại, suy ra Tổ) nằm ở js/report-engine.js
   ═══════════════════════════════════════════════════════════ */

"use strict";

const RE = window.ReportEngine;
const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);

/* ═══════════════════════════════════════════════════════════
   ⭐ CHỈ SỐ CỘT DỮ LIỆU — dùng trong mọi cấu hình cột bên dưới
   Dò tự động theo TÊN header nên không sợ Base đổi thứ tự cột.
   Muốn dùng thêm cột nào của Base thì thêm 1 dòng vào đây.
   ═══════════════════════════════════════════════════════════ */
const C = {};

function buildColIndex(headers){
  const find = kw => headers.findIndex(h => h.toLowerCase().includes(kw));
  C.team     = headers.indexOf(RE.TEAM_COL);            // Tổ/Phòng (do engine thêm)
  C.jobid    = find('job id');
  C.name     = find('tên nhiệm vụ');
  C.stage    = find('giai đoạn');
  C.state    = headers.findIndex(h => h.toLowerCase() === 'trạng thái');
  C.owner    = find('phụ trách');
  C.creator  = find('người tạo');
  C.sla      = find('trạng thái sla');
  C.deadline = find('deadline giai đoạn');
  C.updated  = find('cập nhật lần cuối');
  C.checklist= find('% checklist');
  C.link     = find('link base');
  C.ht       = find('hiện trạng');
  C.gcn      = find('gcn');
  C.pl       = find('tặng');
  C.tt       = find('tách thửa');
  C.vuongmac = find('vướng mắc');
  C.sonha    = find('số nhà');
  C.duong    = find('tên đường');
  C.khupho   = find('khu phố');
  C.soto     = find('số tờ');
  C.sothua   = find('số thửa');
  C.loaidat  = find('loại đất');
  C.motphan  = find('một phần');
  C.toanphan = find('toàn phần');
  C.ngaykd   = find('ngày kiểm');
  C.loaihoso = find('loại hồ sơ');
}

/* ═══════════════════════════════════════════════════════════
   ⭐ CỘT CỦA BẢNG DANH MỤC (chế độ 1) — THÊM CỘT MỚI Ở ĐÂY
   ═══════════════════════════════════════════════════════════
     key   : mã cột (duy nhất, không dấu)
     title : tiêu đề cột
     width : độ rộng ('110px' hoặc bỏ trống)
     match : hàm quyết định 1 hồ sơ có được ĐẾM vào cột này
             • null       → đếm TẤT CẢ hồ sơ trong danh mục
             • r => đk    → chỉ đếm hồ sơ thoả điều kiện
     pct   : 'overall' = % so với tổng toàn dự án
             'row'     = % so với cột TỔNG CỘNG của chính dòng đó
             bỏ trống  = không hiện %

   ── VÍ DỤ THÊM CỘT (bỏ // là dùng được ngay) ──
   // { key:'tre', title:'Trễ hạn SLA', width:'105px', pct:'row',
   //   match: r => r[C.sla].startsWith('Trễ') },
   // { key:'kogcn', title:'Chưa có GCN', width:'105px', pct:'row',
   //   match: r => RE.normGCN(r[C.gcn]) === 'KHÔNG CÓ GCN' },
   // { key:'gd8', title:'Đã xong GĐ 8', width:'105px', pct:'row',
   //   match: r => r[C.stage].startsWith('8.') },
   ═══════════════════════════════════════════════════════════ */
const CATALOG_COLUMNS = [
  { key: 'total', title: 'TỔNG CỘNG',        width: '96px',  pct: 'overall', match: null },
  { key: 'to1',   title: 'Tổ NV BT 1 (KP17)', width: '118px', pct: 'row', match: r => r[C.team] === 'Tổ NV BT 1' },
  { key: 'to2',   title: 'Tổ NV BT 2 (KP18)', width: '118px', pct: 'row', match: r => r[C.team] === 'Tổ NV BT 2' },
  { key: 'to3',   title: 'Tổ NV BT 3 (KP19)', width: '118px', pct: 'row', match: r => r[C.team] === 'Tổ NV BT 3' }
];

/* ═══════════════════════════════════════════════════════════
   ⭐ CỘT CỦA BẢNG LIỆT KÊ HỒ SƠ (chế độ 2) — THÊM CỘT MỚI Ở ĐÂY
   ═══════════════════════════════════════════════════════════
     title : tiêu đề cột
     col   : tên trong C.* (ví dụ 'sothua' → lấy r[C.sothua])
     width : độ rộng
     kind  : cách hiển thị — bỏ trống = chữ thường
             'name'  = tên hồ sơ, in đậm + link mở Base
             'badge' = viên nhãn xanh
             'sla'   = tự tô màu theo Đúng hạn / Sắp đến hạn / Trễ
             'num'   = canh giữa, font mono
             'node'  = mã danh mục pháp lý đã phân loại (cột tính toán)
     Muốn bỏ cột nào thì thêm // ở đầu dòng.
   ═══════════════════════════════════════════════════════════ */
const RECORD_COLUMNS = [
  { title: 'Tên hồ sơ',        col: 'name',    width: '300px', kind: 'name' },
  { title: 'Tổ',               col: 'team',    width: '112px', kind: 'badge' },
  { title: 'Cán bộ',           col: 'owner',   width: '92px' },
  { title: 'Giai đoạn',        col: 'stage',   width: '185px' },
  { title: 'Trạng thái SLA',   col: 'sla',     width: '112px', kind: 'sla' },
  { title: 'Hiện trạng',       col: 'ht',      width: '175px' },
  { title: 'GCN',              col: 'gcn',     width: '120px' },
  { title: 'Pháp lý tặng/cho', col: 'pl',      width: '230px' },
  { title: 'Tách thửa',        col: 'tt',      width: '135px' },
  { title: 'Số tờ',            col: 'soto',    width: '68px',  kind: 'num' },
  { title: 'Số thửa',          col: 'sothua',  width: '72px',  kind: 'num' },
  { title: 'Khu phố',          col: 'khupho',  width: '80px',  kind: 'num' },
  { title: 'Danh mục pháp lý', col: null,      width: '150px', kind: 'node' }
  // { title: 'Vướng mắc',     col: 'vuongmac', width: '200px' },
  // { title: '% Checklist',   col: 'checklist', width: '90px', kind: 'num' },
  // { title: 'Deadline GĐ',   col: 'deadline', width: '130px' },
];

const TITLE_COL_HEADER = 'STT / DANH MỤC PHÂN LOẠI PHÁP LÝ HỒ SƠ';

/* ═══════════════════════════════════════════════════════════
   ⭐ CỘT "TRƯỜNG HỢP" — nảm ngay kế bên cột danh mục
   ═══════════════════════════════════════════════════════════
   CÁCH ĐÁNH SỐ — TỰ ĐỘNG, không phải điền tay:
   Đi từ mục lớn xuống dần. Mục nào KHÔNG còn mục con thì chính mục đó
   là MỘT trường hợp → đánh TH1, TH2, TH3… theo đúng thứ tự trên bảng.
   Mục nào còn mục con thì chỉ là tiêu đề nhóm → để trống.

   Theo cây hiện tại:
     I. HIỆN TRẠNG LÀ ĐẤT NÔNG NGHIỆP     (có mục con → trống)
       1. CÓ GCN                          (có mục con → trống)
         a) KHÔNG TẶNG CHO CHUYỂN NHƯỢNG  → TH1
         b) TẶNG, CHO… TRƯỚC 01/7/2014    (có mục con → trống)
           - KHÔNG TÁCH THỬA              → TH2
           - CÓ TÁCH THỬA                 → TH3
     …
     V. ĐẤT HỢP TÁC XÃ GIAO KHOÁN         → TH45  (mục lớn nhưng không có mục con)
     VI. ĐẤT CƠ QUAN TỔ CHỨC              (có mục con → trống)
       1. CÓ GCN                          → TH46
       2. CHƯA CẤP GCN                     → TH47

   Cây hiện tại cho ra 47 trường hợp / 76 dòng. Thêm hay bớt nhánh trong
   TREE_SPEC thì số TH TỰ ĐỘNG đánh lại, không cần sửa gì ở đây.
   ═══════════════════════════════════════════════════════════ */
const TRUONG_HOP_HEADER = 'TRƯỜNG HỢP';
const TRUONG_HOP_WIDTH  = '108px';
const TRUONG_HOP_PREFIX = 'TH';   // đổi thành 'Trường hợp ' nếu muốn ghi đầy đủ

/* Ghi đè thủ công cho riêng một số dòng (nếu cần khác số tự động).
   Khoá là mã danh mục trong TREE_SPEC. Để rỗng = dùng hết số tự động.
   Ví dụ:   'V': 'TH45 (giao khoán)',
            'VI.1': '—',            */
const TRUONG_HOP_OVERRIDE = {
};

/* Danh sách mã danh mục là "lá" (không còn mục con), theo đúng thứ tự bảng.
   Vị trí trong mảng chính là số trường hợp: TH_LEAF_IDS[0] = TH1 */
const TH_LEAF_IDS = (function(){
  const hasChild = {};
  RE.TREE_SPEC.forEach(n => { if(n.p) hasChild[n.p] = true; });
  return RE.TREE_SPEC.filter(n => !hasChild[n.id]).map(n => n.id);
})();

const TRUONG_HOP_COUNT = TH_LEAF_IDS.length;

const TRUONG_HOP_AUTO = (function(){
  const map = {};
  TH_LEAF_IDS.forEach((id, i) => { map[id] = TRUONG_HOP_PREFIX + (i + 1); });
  return map;
})();

function truongHopOf(nodeId){
  return TRUONG_HOP_OVERRIDE[nodeId] || TRUONG_HOP_AUTO[nodeId] || '';
}

/* Số trường hợp → mã danh mục.  thNumToNode(3) === 'I.1.b.2' */
function thNumToNode(num){ return TH_LEAF_IDS[num - 1] || null; }

/* ═══════════════════════════════════════════════════════════
   ⭐ TAB 3 — NHÓM TRƯỜNG HỢP
   ═══════════════════════════════════════════════════════════
   Gom các trường hợp (TH) thành nhóm. Chỉ cần liệt kê SỐ TH, hệ thống
   tự quy ra danh mục pháp lý rồi cộng số hồ sơ tương ứng.

   Thêm/sửa nhóm: sửa mảng NHOM_SPEC bên dưới.
   TH nào không nằm trong nhóm nào sẽ tự động dồn vào một nhóm phụ
   "Chưa phân nhóm" (hiện rõ trên bảng để không bị thất lạc hồ sơ).
   Hệ thống tự kiểm: TH trùng ở 2 nhóm hoặc TH không tồn tại đều báo
   cảnh báo ngay trên bảng.
   ═══════════════════════════════════════════════════════════ */
const NHOM_SPEC = [
  {
    key: 'n1',
    title: 'Nhóm 1',
    desc: 'Không tặng cho chuyển nhượng (mọi hiện trạng) + tặng cho giấy tay TRƯỚC 01/7/2014 mà chưa cấp GCN',
    th: [1, 6, 7, 8, 11, 16, 17, 18, 21, 22, 27, 28, 29, 30, 33, 34, 39, 40, 41, 42],
    rule: f => f.mucChinh && (f.khongTang || (f.chuaGCN && f.truoc))
  },
  {
    key: 'n2',
    title: 'Nhóm 2',
    desc: 'Chưa cấp GCN + tặng cho, chuyển nhượng giấy tay SAU 01/7/2014',
    th: [9, 10, 19, 20, 31, 32, 43, 44],
    rule: f => f.mucChinh && f.chuaGCN && f.sau && !f.khongTang
  },
  {
    key: 'n3',
    title: 'Nhóm 3',
    desc: 'Đã có GCN + tặng cho, chuyển nhượng giấy tay (cả trước và sau 01/7/2014)',
    th: [2, 3, 4, 5, 12, 13, 14, 15, 23, 24, 25, 26, 35, 36, 37, 38],
    rule: f => f.mucChinh && f.coGCN && !f.khongTang && (f.truoc || f.sau)
  }
];

/* TH45 (HTX giao khoán), TH46–TH47 (đất cơ quan tổ chức) — thuộc mục V và VI,
   không nằm trong 4 hiện trạng đất dân cư nên để riêng, sẽ bổ sung nhóm sau. */
const NHOM_REST_TITLE = 'Nhóm khác (để riêng)';

/* Dựng danh sách nhóm đầy đủ + tự kiểm tra */
const NHOM_WARNINGS = [];
const NHOM_ALL = (function(){
  const seen = {};
  const list = NHOM_SPEC.map(g => {
    const thSorted = g.th.slice().sort((a, b) => a - b);
    thSorted.forEach(num => {
      if(num < 1 || num > TRUONG_HOP_COUNT){
        NHOM_WARNINGS.push(`${g.title}: TH${num} không tồn tại (chỉ có TH1–TH${TRUONG_HOP_COUNT})`);
      } else if(seen[num]){
        NHOM_WARNINGS.push(`TH${num} bị xếp vào cả ${seen[num]} và ${g.title}`);
      } else {
        seen[num] = g.title;
      }
    });
    const valid = thSorted.filter(n => n >= 1 && n <= TRUONG_HOP_COUNT);
    return { key: g.key, title: g.title, desc: g.desc, rule: g.rule, th: valid,
             nodes: valid.map(thNumToNode).filter(Boolean) };
  });

  const rest = [];
  for(let i = 1; i <= TRUONG_HOP_COUNT; i++) if(!seen[i]) rest.push(i);
  if(rest.length){
    list.push({
      key: '_rest', title: NHOM_REST_TITLE, isRest: true,
      desc: 'Các trường hợp chưa được xếp vào Nhóm 1/2/3 — cần bổ sung',
      th: rest, nodes: rest.map(thNumToNode).filter(Boolean)
    });
  }
  return list;
})();

const NHOM_BY_KEY = {};
NHOM_ALL.forEach(g => NHOM_BY_KEY[g.key] = g);


/* ═══ TRẠNG THÁI ═══ */
let HEADERS = [];
let ROWS = [];
let META = {};
let CLS = null;                 // kết quả classifyRows trên TOÀN BỘ hồ sơ
let NODE_BY_ID = {};            // id → node trong TREE_SPEC

let search = '';
let fTeam = '', fSla = '', fStage = '', fNode = '', fNhom = '';
let page = 1, PER = 50;
let sortCol = -1, sortAsc = true;
let hideZero = false;
let VISIBLE = [];               // chỉ số dòng đang hiển thị

/* ═══════════════════════════════════════════════════════════
   LỌC & TÌM KIẾM
   Mọi bộ lọc dồn về 1 tập chỉ số dòng → CẢ 2 bảng đều theo tập này,
   nên số ở bảng danh mục luôn khớp với danh sách hồ sơ.
   ═══════════════════════════════════════════════════════════ */
/* Tất cả chỉ số dòng thuộc 1 nhóm (các node của nhóm đều là lá nên không trùng) */
function nhomRowIdx(g){
  const out = [];
  g.nodes.forEach(id => {
    const list = CLS.nodeRows[id] || [];
    for(const i of list) out.push(i);
  });
  return out;
}

function computeVisible(){
  // Gốc: đang lọc theo nhóm > theo danh mục > toàn bộ
  let base;
  if(fNhom && NHOM_BY_KEY[fNhom]){
    base = nhomRowIdx(NHOM_BY_KEY[fNhom]);
  } else if(fNode && CLS.nodeRows[fNode]){
    base = CLS.nodeRows[fNode];
  } else {
    base = ROWS.map((_, i) => i);
  }

  const tokens = search.trim() ? RE.removeAccents(search).split(/\s+/).filter(Boolean) : [];

  VISIBLE = base.filter(i => {
    const r = ROWS[i];
    if(fTeam && r[C.team] !== fTeam) return false;
    if(fStage && r[C.stage] !== fStage) return false;
    if(fSla){
      if(fSla === 'Trễ'){ if(!r[C.sla].startsWith('Trễ')) return false; }
      else if(r[C.sla] !== fSla) return false;
    }
    if(tokens.length){
      const hay = RE.removeAccents(r.join(' '));
      for(const t of tokens){ if(!hay.includes(t)) return false; }
    }
    return true;
  });
}

/* Đếm số hồ sơ của một cột cấu hình trong một tập chỉ số dòng.
   Dùng chung cho bảng danh mục (Tab 1) và bảng nhóm (Tab 3). */
function countCol(col, idxList){
  if(!col.match) return idxList.length;
  let n = 0;
  for(const i of idxList){
    try { if(col.match(ROWS[i])) n++; } catch(e){ /* match lỗi → bỏ qua dòng */ }
  }
  return n;
}

/* ═══ BẢNG DANH MỤC (chế độ 1) ═══ */
function renderCatalog(){
  const visSet = new Set(VISIBLE);
  const denomAll = CLS.grandTotal > 0 ? CLS.grandTotal : 1;

  /* Tổng của mỗi cột trên tập đang hiển thị (để tính % và dòng tổng) */
  const inTree = VISIBLE.filter(i => CLS.nodeIdByRow[i] !== null);
  const denom = inTree.length > 0 ? inTree.length : 1;

  /* ── THEAD ── */
  const theadHtml = '<tr>' +
    `<th class="bbc-title-h">${RE.escH(TITLE_COL_HEADER)}</th>` +
    `<th class="bbc-th-h" style="width:${TRUONG_HOP_WIDTH}">${RE.escH(TRUONG_HOP_HEADER)}</th>` +
    CATALOG_COLUMNS.map(c => `<th class="num" style="width:${c.width || 'auto'}">${RE.escH(c.title)}</th>`).join('') +
    '<th class="bbc-act-h">Hồ sơ</th>' +
    '</tr>';

  /* ── TBODY ── */
  let html = '';
  const excelRows = [];

  RE.TREE_SPEC.forEach(n => {
    const idxList = (CLS.nodeRows[n.id] || []).filter(i => visSet.has(i));
    const rowTotal = idxList.length;
    if(hideZero && rowTotal === 0) return;

    const showPct = (n.lvl === 1 || n.lvl === 2);
    const truongHop = truongHopOf(n.id);
    const excelRow = [n.title, truongHop];

    const cells = CATALOG_COLUMNS.map(col => {
      const val = countCol(col, idxList);
      excelRow.push(val);

      if(!val) return '<td class="num bbc-zero">0</td>';

      let inner;
      if(showPct && col.pct === 'overall'){
        inner = `<b>${RE.fmt(val)}</b><span class="pct-badge"> (${(val / denom * 100).toFixed(1)}%)</span>`;
      } else if(showPct && col.pct === 'row' && rowTotal > 0){
        inner = `${RE.fmt(val)}<span class="pct-sub"> (${(val / rowTotal * 100).toFixed(1)}%)</span>`;
      } else if(col.key === 'total'){
        inner = `<b>${RE.fmt(val)}</b>`;
      } else {
        inner = RE.fmt(val);
      }
      return `<td class="num">${inner}</td>`;
    }).join('');

    const actCell = rowTotal
      ? `<td class="bbc-act"><button class="bbc-drill" data-node="${RE.escH(n.id)}" title="Liệt kê ${rowTotal} hồ sơ thuộc: ${RE.escH(nodePath(n.id))}">Xem ${RE.fmt(rowTotal)} hồ sơ ›</button></td>`
      : '<td class="bbc-act"></td>';

    html += `<tr class="lvl-${n.lvl}${fNode === n.id ? ' bbc-active-node' : ''}" data-node="${RE.escH(n.id)}">
      <td class="title-col">${RE.escH(n.title)}</td>
      <td class="bbc-th-col">${RE.escH(truongHop)}</td>${cells}${actCell}</tr>`;

    excelRows.push(excelRow);
  });

  /* ── DÒNG TỔNG CỘNG ── */
  const grandLabel = 'TỔNG CỘNG HỒ SƠ BỒI THƯỜNG DỰ ÁN';
  const grandExcel = [grandLabel, ''];
  const grandCells = CATALOG_COLUMNS.map(col => {
    const val = countCol(col, inTree);
    grandExcel.push(val);
    return `<td class="num"><b>${RE.fmt(val)}</b><span class="pct-badge"> (${(val / denom * 100).toFixed(1)}%)</span></td>`;
  }).join('');

  html += `<tr class="total-row"><td><b>${grandLabel}</b></td><td class="bbc-th-col"></td>${grandCells}<td class="bbc-act"></td></tr>`;
  excelRows.push(grandExcel);

  // +3 = cột danh mục + cột Trường hợp + cột hành động "Hồ sơ"
  const colCount = CATALOG_COLUMNS.length + 3;
  $('#catalogTable thead').innerHTML = theadHtml;
  $('#catalogTable tbody').innerHTML = html || `<tr><td colspan="${colCount}" class="empty-msg">Không có danh mục nào khớp bộ lọc.</td></tr>`;

  /* Bấm nút "Xem N hồ sơ" → nhảy sang chế độ 2, lọc theo danh mục */
  $$('#catalogTable .bbc-drill').forEach(b => {
    b.onclick = ev => {
      ev.stopPropagation();
      drillTo(b.dataset.node);
    };
  });

  /* Bấm cả dòng cũng drill (nếu dòng có hồ sơ) */
  $$('#catalogTable tbody tr[data-node]').forEach(tr => {
    tr.onclick = () => {
      if(tr.querySelector('.bbc-drill')) drillTo(tr.dataset.node);
    };
  });

  const outOfTree = VISIBLE.length - inTree.length;
  $('#catNote').textContent =
    `(${RE.fmt(TRUONG_HOP_COUNT)} trường hợp · ${RE.fmt(inTree.length)} hồ sơ trong bảng` +
    (outOfTree > 0 ? ` · ${RE.fmt(outOfTree)} hồ sơ chưa xác định hiện trạng nên không vào danh mục` : '') +
    ` · tổng dự án ${RE.fmt(denomAll)})`;

  /* Bản in dùng chung số liệu */
  renderPrintTable(theadHtml, html);
  CATALOG_EXCEL = {
    head: [TITLE_COL_HEADER, TRUONG_HOP_HEADER].concat(CATALOG_COLUMNS.map(c => c.title)),
    body: excelRows
  };
}

let CATALOG_EXCEL = null;

function renderPrintTable(theadHtml, bodyHtml){
  const th = $('#printCatalogTable thead');
  const tb = $('#printCatalogTable tbody');
  if(!th || !tb) return;
  // Bản in bỏ cột hành động "Hồ sơ"
  th.innerHTML = theadHtml.replace(/<th class="bbc-act-h">.*?<\/th>/, '');
  tb.innerHTML = bodyHtml.replace(/<td class="bbc-act">.*?<\/td>/g, '');
}

/* ═══════════════════════════════════════════════════════════
   BẢNG NHÓM TRƯỜNG HỢP (chế độ 3)
   Bảng tổng hợp 3 nhóm + bảng chi tiết từng TH trong mỗi nhóm
   ═══════════════════════════════════════════════════════════ */
let NHOM_EXCEL = null;

function renderNhom(){
  const visSet = new Set(VISIBLE);
  const inTree = VISIBLE.filter(i => CLS.nodeIdByRow[i] !== null);
  const denom = inTree.length > 0 ? inTree.length : 1;

  /* Chỉ số dòng của 1 nhóm, giới hạn trong tập đang hiển thị */
  const idxOf = g => nhomRowIdx(g).filter(i => visSet.has(i));

  /* ── Cảnh báo cấu hình (TH trùng / không tồn tại / chưa phân nhóm) ── */
  const warnBox = $('#nhomWarn');
  const restGroup = NHOM_ALL.find(g => g.isRest);
  const loi = NHOM_WARNINGS.concat(NHOM_AUDIT);
  let html = '';

  if(loi.length){
    html += `<div class="nhom-warn">⚠️ ${loi.join('<br>')}</div>`;
  }
  if(restGroup){
    html += `<div class="nhom-info">ℹ️ <b>${restGroup.th.length}</b> trường hợp đang để riêng, ` +
      `chưa xếp vào Nhóm 1/2/3: <b>${restGroup.th.map(n => TRUONG_HOP_PREFIX + n).join(', ')}</b> ` +
      `— thuộc mục V (đất Hợp tác xã giao khoán) và VI (đất cơ quan tổ chức).</div>`;
  }
  if(!loi.length){
    html += `<div class="nhom-ok">✓ Đã tự kiểm: ${RE.fmt(TRUONG_HOP_COUNT - (restGroup ? restGroup.th.length : 0))}` +
      ` trường hợp của Nhóm 1/2/3 khớp đúng quy luật, không trùng nhau, không thiếu.</div>`;
  }
  warnBox.innerHTML = html;

  /* ── BẢNG TỔNG HỢP NHÓM ── */
  const sumHead = ['NHÓM', 'SỐ TRƯỜNG HỢP'].concat(CATALOG_COLUMNS.map(c => c.title));
  const sumBody = [];

  let sumHtml = '<tr>' +
    '<th class="nhom-name-h">NHÓM</th>' +
    '<th class="num" style="width:120px">SỐ TRƯỜNG HỢP</th>' +
    CATALOG_COLUMNS.map(c => `<th class="num" style="width:${c.width || 'auto'}">${RE.escH(c.title)}</th>`).join('') +
    '<th class="bbc-act-h">Hồ sơ</th></tr>';
  $('#nhomSummaryTable thead').innerHTML = sumHtml;

  let bodyHtml = '';
  NHOM_ALL.forEach(g => {
    const idxList = idxOf(g);
    const row = [g.title, g.th.length];

    const cells = CATALOG_COLUMNS.map(col => {
      const val = countCol(col, idxList);
      row.push(val);
      if(!val) return '<td class="num bbc-zero">0</td>';
      const p = (val / denom * 100).toFixed(1);
      return `<td class="num"><b>${RE.fmt(val)}</b><span class="pct-badge"> (${p}%)</span></td>`;
    }).join('');

    const act = idxList.length
      ? `<td class="bbc-act"><button class="bbc-drill" data-nhom="${RE.escH(g.key)}" title="Liệt kê ${idxList.length} hồ sơ của ${RE.escH(g.title)}">Xem ${RE.fmt(idxList.length)} hồ sơ ›</button></td>`
      : '<td class="bbc-act"></td>';

    bodyHtml += `<tr class="nhom-row${g.isRest ? ' nhom-rest' : ''}${fNhom === g.key ? ' bbc-active-node' : ''}">
      <td class="nhom-name">
        <b>${RE.escH(g.title)}</b>
        <div class="nhom-desc">${RE.escH(g.desc || '')}</div>
        <div class="nhom-thlist">${g.th.map(n => TRUONG_HOP_PREFIX + n).join(' · ')}</div>
      </td>
      <td class="num"><b>${g.th.length}</b></td>${cells}${act}</tr>`;

    sumBody.push(row);
  });

  /* Dòng tổng của bảng nhóm */
  const totRow = ['TỔNG CỘNG', NHOM_ALL.reduce((s, g) => s + g.th.length, 0)];
  const totCells = CATALOG_COLUMNS.map(col => {
    const val = countCol(col, inTree);
    totRow.push(val);
    return `<td class="num"><b>${RE.fmt(val)}</b><span class="pct-badge"> (${(val / denom * 100).toFixed(1)}%)</span></td>`;
  }).join('');
  bodyHtml += `<tr class="total-row"><td><b>TỔNG CỘNG</b></td>
    <td class="num"><b>${totRow[1]}</b></td>${totCells}<td class="bbc-act"></td></tr>`;
  sumBody.push(totRow);

  $('#nhomSummaryTable tbody').innerHTML = bodyHtml;

  /* ── BẢNG CHI TIẾT TỪNG NHÓM ── */
  const detHead = ['NHÓM', TRUONG_HOP_HEADER, 'DANH MỤC PHÁP LÝ']
    .concat(CATALOG_COLUMNS.map(c => c.title));
  const detBody = [];
  let detHtml = '';

  NHOM_ALL.forEach(g => {
    const gIdx = idxOf(g);

    detHtml += `<div class="nhom-block${g.isRest ? ' nhom-block-rest' : ''}">
      <div class="nhom-block-hdr">
        <h4>${RE.escH(g.title)}</h4>
        <span class="nhom-block-meta">${g.th.length} trường hợp · <b>${RE.fmt(gIdx.length)}</b> hồ sơ</span>
        <span class="nhom-block-desc">${RE.escH(g.desc || '')}</span>
      </div>
      <div class="tscroll nhom-block-scroll">
      <table class="dt nhom-detail">
        <thead><tr>
          <th style="width:${TRUONG_HOP_WIDTH}">${RE.escH(TRUONG_HOP_HEADER)}</th>
          <th class="nhom-path-h">DANH MỤC PHÁP LÝ (đường dẫn đầy đủ)</th>
          ${CATALOG_COLUMNS.map(c => `<th class="num" style="width:${c.width || 'auto'}">${RE.escH(c.title)}</th>`).join('')}
          <th class="bbc-act-h">Hồ sơ</th>
        </tr></thead>
        <tbody>`;

    g.th.forEach(num => {
      const nodeId = thNumToNode(num);
      if(!nodeId) return;
      const idxList = (CLS.nodeRows[nodeId] || []).filter(i => visSet.has(i));
      const label = TRUONG_HOP_PREFIX + num;
      const path = nodePath(nodeId);
      const row = [g.title, label, path];

      const cells = CATALOG_COLUMNS.map(col => {
        const val = countCol(col, idxList);
        row.push(val);
        return val ? `<td class="num">${RE.fmt(val)}</td>` : '<td class="num bbc-zero">0</td>';
      }).join('');

      const act = idxList.length
        ? `<td class="bbc-act"><button class="bbc-drill" data-node="${RE.escH(nodeId)}" title="Liệt kê ${idxList.length} hồ sơ">Xem ${RE.fmt(idxList.length)} ›</button></td>`
        : '<td class="bbc-act"></td>';

      detHtml += `<tr>
        <td class="bbc-th-col">${RE.escH(label)}</td>
        <td class="nhom-path"><code>${RE.escH(nodeId)}</code> ${RE.escH(path)}</td>
        ${cells}${act}</tr>`;

      detBody.push(row);
    });

    detHtml += '</tbody></table></div></div>';
  });

  $('#nhomDetailBox').innerHTML = detHtml;

  /* Bấm "Xem hồ sơ" ở cả 2 bảng */
  $$('#view-nhom .bbc-drill').forEach(b => {
    b.onclick = ev => {
      ev.stopPropagation();
      if(b.dataset.nhom) drillNhom(b.dataset.nhom);
      else if(b.dataset.node) drillTo(b.dataset.node);
    };
  });

  $('#nhomNote').textContent =
    `(${NHOM_ALL.length} nhóm · ${RE.fmt(TRUONG_HOP_COUNT)} trường hợp · ${RE.fmt(inTree.length)} hồ sơ)`;

  NHOM_EXCEL = { sumHead: sumHead, sumBody: sumBody, detHead: detHead, detBody: detBody };
}

function drillNhom(key){
  fNhom = key;
  fNode = '';
  page = 1;
  switchTab('view-records');
  refresh();
}

/* ═══ BẢNG LIỆT KÊ HỒ SƠ (chế độ 2) ═══ */
function cellValue(rowIdx, colDef){
  const r = ROWS[rowIdx];
  if(colDef.kind === 'node'){
    const id = CLS.nodeIdByRow[rowIdx];
    return id || '(chưa xác định)';
  }
  const ci = C[colDef.col];
  return (ci >= 0 && ci !== undefined) ? r[ci] : '';
}

function renderRecords(){
  let list = VISIBLE.slice();

  /* Sắp xếp */
  if(sortCol >= 0 && RECORD_COLUMNS[sortCol]){
    const cd = RECORD_COLUMNS[sortCol];
    list.sort((ia, ib) => {
      const va = String(cellValue(ia, cd)).trim();
      const vb = String(cellValue(ib, cd)).trim();

      // Ô trống luôn xuống cuối, dù sắp xếp tăng hay giảm
      if(!va && !vb) return 0;
      if(!va) return 1;
      if(!vb) return -1;

      const na = parseFloat(va.replace(/[^\d,.-]/g, '').replace(',', '.'));
      const nb = parseFloat(vb.replace(/[^\d,.-]/g, '').replace(',', '.'));
      if(!isNaN(na) && !isNaN(nb)) return sortAsc ? na - nb : nb - na;

      return sortAsc ? va.localeCompare(vb, 'vi') : vb.localeCompare(va, 'vi');
    });
  }

  const totalPages = Math.max(1, Math.ceil(list.length / PER));
  if(page > totalPages) page = totalPages;
  const slice = list.slice((page - 1) * PER, page * PER);

  /* THEAD */
  $('#recordTable thead').innerHTML = '<tr>' + RECORD_COLUMNS.map((c, i) => {
    const act = sortCol === i;
    return `<th class="${act ? 'sorted' : ''}" data-i="${i}" style="width:${c.width || 'auto'}">${RE.escH(c.title)} <span class="sa">${act ? (sortAsc ? '▲' : '▼') : '⇅'}</span></th>`;
  }).join('') + '</tr>';

  $$('#recordTable thead th').forEach(th => {
    th.onclick = () => {
      const i = +th.dataset.i;
      if(sortCol === i) sortAsc = !sortAsc; else { sortCol = i; sortAsc = true; }
      renderRecords();
    };
  });

  /* TBODY */
  const tb = $('#recordTable tbody');
  if(!slice.length){
    tb.innerHTML = `<tr><td colspan="${RECORD_COLUMNS.length}" class="empty-msg">Không có hồ sơ nào khớp điều kiện tìm kiếm.</td></tr>`;
  } else {
    tb.innerHTML = slice.map(i => {
      const r = ROWS[i];
      return '<tr>' + RECORD_COLUMNS.map(cd => {
        const v = cellValue(i, cd);
        return `<td${cd.kind === 'num' ? ' class="num"' : ''}>${formatCell(v, cd, r)}</td>`;
      }).join('') + '</tr>';
    }).join('');
  }

  /* Phân trang */
  $('#pageInfo').textContent = `Trang ${RE.fmt(page)} / ${RE.fmt(totalPages)} · ${RE.fmt(list.length)} hồ sơ`;
  $('#prevPage').disabled = page <= 1;
  $('#nextPage').disabled = page >= totalPages;
  $('#recNote').textContent = `(${RE.fmt(list.length)} hồ sơ · ${RECORD_COLUMNS.length} cột)`;
  RECORD_EXCEL_LIST = list;
}

let RECORD_EXCEL_LIST = [];

function formatCell(v, cd, r){
  const s = RE.escH(v);
  if(!v) return '<span class="bbc-empty">—</span>';

  if(cd.kind === 'name'){
    const link = C.link >= 0 ? r[C.link] : '';
    const inner = `<b>${s}</b>`;
    return link && link.startsWith('http')
      ? `<a class="bbc-joblink" href="${RE.escH(link)}" target="_blank" rel="noopener" title="Mở trên Base Workflow">${inner} ↗</a>`
      : inner;
  }
  if(cd.kind === 'badge') return `<span class="badge b-active">${s}</span>`;
  if(cd.kind === 'sla'){
    if(v.startsWith('Trễ')) return `<span class="badge b-overdue">${s}</span>`;
    if(v.includes('Sắp')) return `<span class="badge b-warning">${s}</span>`;
    return `<span class="badge b-ontime">${s}</span>`;
  }
  if(cd.kind === 'node'){
    return `<span class="bbc-nodetag" title="${RE.escH(nodePath(v))}">${s}</span>`;
  }
  return s;
}

/* Chuỗi tiêu đề từ mục lớn nhất xuống tới node, vd:
   ['II. HIỆN TRẠNG LÀ ĐẤT Ở', '2. CHƯA CẤP GCN', 'b) TẶNG…', '- CÓ TÁCH THỬA'] */
function nodePathParts(id){
  const parts = [];
  let cur = id;
  let guard = 0;
  while(cur && guard++ < 10){
    const n = NODE_BY_ID[cur];
    if(!n) break;
    parts.unshift(n.title);
    cur = n.p;
  }
  return parts;
}

/* Đường dẫn đầy đủ dạng chuỗi. Cần thiết vì tiêu đề node lá
   (vd "- CÓ TÁCH THỬA") tự nó vô nghĩa. */
function nodePath(id, sep){
  return nodePathParts(id).join(sep || ' › ');
}

/* ═══ TỰ KIỂM TRA PHÂN NHÓM ═══
   Đọc các tiêu đề trên đường dẫn của từng trường hợp để suy ra đặc điểm
   pháp lý, rồi đối chiếu với `rule` của từng nhóm. Nếu một TH thoả quy luật
   của nhóm nào mà chưa được liệt kê (hoặc bị liệt kê sai nhóm) thì báo ngay
   trên bảng — khỏi phải dò tay khi TREE_SPEC thay đổi. */
function thFlags(nodeId){
  const parts = nodePathParts(nodeId);
  const root = (parts[0] || '').toUpperCase();
  const s = parts.join(' | ').toUpperCase();
  return {
    mucChinh:  /^(I|II|III|IV)\./.test(root),   // chỉ 4 mục hiện trạng đất dân cư
    khongTang: s.includes('KHÔNG TẶNG'),
    chuaGCN:   s.includes('CHƯA CẤP GCN'),
    coGCN:     s.includes('CÓ GCN') && !s.includes('CHƯA CẤP GCN'),
    truoc:     s.includes('TRƯỚC 01/7/2014'),
    sau:       s.includes('SAU 01/7/2014')
  };
}

let NHOM_AUDIT = [];

function auditNhom(){
  NHOM_AUDIT = [];
  const assigned = {};
  NHOM_ALL.forEach(g => g.th.forEach(n => assigned[n] = g));

  NHOM_ALL.forEach(g => {
    if(typeof g.rule !== 'function') return;
    const thieu = [], thua = [];
    for(let num = 1; num <= TRUONG_HOP_COUNT; num++){
      const nodeId = thNumToNode(num);
      if(!nodeId) continue;
      let khop = false;
      try { khop = !!g.rule(thFlags(nodeId)); } catch(e){ continue; }
      const daXep = g.th.includes(num);
      if(khop && !daXep) thieu.push(num);
      if(!khop && daXep) thua.push(num);
    }
    if(thieu.length){
      NHOM_AUDIT.push(`<b>${g.title}</b> theo quy luật còn thiếu: ` +
        thieu.map(n => `${TRUONG_HOP_PREFIX}${n} (${assigned[n] ? 'đang ở ' + assigned[n].title : 'chưa xếp'})`).join(', '));
    }
    if(thua.length){
      NHOM_AUDIT.push(`<b>${g.title}</b> có trường hợp không khớp quy luật: ` +
        thua.map(n => TRUONG_HOP_PREFIX + n).join(', '));
    }
  });
}

/* ═══ DRILL: bấm danh mục → liệt kê hồ sơ ═══ */
function drillTo(nodeId){
  fNode = nodeId;
  fNhom = '';
  page = 1;
  switchTab('view-records');
  refresh();
}

/* ═══ BỘ LỌC DẠNG DROPDOWN ═══ */
function buildFilters(){
  function fill(sel, values, label, current){
    const el = $(sel);
    const total = ROWS.length;
    el.innerHTML = `<option value="">— ${label} (${RE.fmt(total)}) —</option>` +
      values.map(([v, n]) => `<option value="${RE.escH(v)}">${RE.escH(v)} (${RE.fmt(n)})</option>`).join('');
    el.value = current || '';
  }

  const count = ci => {
    const m = new Map();
    ROWS.forEach(r => { const v = r[ci] || '(trống)'; m.set(v, (m.get(v) || 0) + 1); });
    return [...m.entries()].sort((a, b) => String(a[0]).localeCompare(String(b[0]), 'vi', { numeric: true }));
  };

  fill('#filterTeam', count(C.team), 'Tất cả Tổ', fTeam);
  fill('#filterStage', count(C.stage), 'Tất cả giai đoạn', fStage);

  // SLA: gộp mọi biến thể "Trễ N ngày" thành 1 lựa chọn
  const slaMap = new Map();
  ROWS.forEach(r => {
    const v = r[C.sla].startsWith('Trễ') ? 'Trễ' : (r[C.sla] || '(trống)');
    slaMap.set(v, (slaMap.get(v) || 0) + 1);
  });
  fill('#filterSla', [...slaMap.entries()].sort((a, b) => b[1] - a[1]), 'Tất cả SLA', fSla);
}

/* ═══ CHIP TRẠNG THÁI LỌC ═══ */
function renderNote(){
  const box = $('#activeNote');
  const chips = [];
  if(search.trim()) chips.push(`Tìm: <b>${RE.escH(search.trim())}</b>`);
  if(fTeam) chips.push(`Tổ: <b>${RE.escH(fTeam)}</b>`);
  if(fStage) chips.push(`Giai đoạn: <b>${RE.escH(fStage)}</b>`);
  if(fSla) chips.push(`SLA: <b>${RE.escH(fSla === 'Trễ' ? 'Trễ hạn' : fSla)}</b>`);
  if(fNhom && NHOM_BY_KEY[fNhom]){
    const g = NHOM_BY_KEY[fNhom];
    chips.push(`<b>${RE.escH(g.title)}</b> (${g.th.length} trường hợp: ${RE.escH(g.th.map(n => TRUONG_HOP_PREFIX + n).join(', '))})
      <button class="bbc-chip-x" id="btnClearNhom" title="Bỏ lọc nhóm">✕</button>`);
  }
  if(fNode){
    chips.push(`Danh mục <code>${RE.escH(fNode)}</code> (${RE.escH(truongHopOf(fNode) || '—')}): <b>${RE.escH(nodePath(fNode))}</b>
      <button class="bbc-chip-x" id="btnClearNode" title="Bỏ lọc danh mục">✕</button>`);
  }

  if(!chips.length){
    box.innerHTML = `<div class="note-banner">⚡ Đang xem <b>tất cả ${RE.fmt(ROWS.length)}</b> hồ sơ dự án</div>`;
  } else {
    box.innerHTML = `<div class="note-banner">🔍 <b>${RE.fmt(VISIBLE.length)}</b> / ${RE.fmt(ROWS.length)} hồ sơ · ${chips.join(' · ')}</div>`;
    const bx = $('#btnClearNode');
    if(bx) bx.onclick = () => { fNode = ''; page = 1; refresh(); };
    const bn = $('#btnClearNhom');
    if(bn) bn.onclick = () => { fNhom = ''; page = 1; refresh(); };
  }
}

/* ═══ VÒNG RENDER ═══ */
function refresh(){
  computeVisible();
  renderNote();
  renderCatalog();
  renderNhom();
  renderRecords();
  $('#cntCat').textContent = RE.fmt(RE.TREE_SPEC.length);
  $('#cntRec').textContent = RE.fmt(VISIBLE.length);
  $('#cntNhom').textContent = RE.fmt(NHOM_ALL.length);
}

/* ═══ ĐỔI CHẾ ĐỘ XEM ═══ */
function switchTab(id){
  $$('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === id));
  $$('.tab-pane').forEach(p => p.classList.toggle('hidden', p.id !== id));
}

$$('.tab-btn').forEach(btn => {
  btn.onclick = () => switchTab(btn.dataset.tab);
});

/* ═══ NẠP DỮ LIỆU ═══ */
async function load(force){
  const setConn = (ok, msg) => {
    const d = $('#connDot'); if(d) d.className = 'dot ' + (ok ? 'on' : 'off');
    const t = $('#connText'); if(t) t.textContent = msg;
  };
  setConn(true, force ? '⚡ Đang đồng bộ Base Workflow...' : '⏳ Đang nạp dữ liệu...');

  try {
    const d = await RE.loadPayload(force);
    HEADERS = d.headers;
    ROWS = d.rows;
    META = d.meta;

    RE.enrichTeam(HEADERS, ROWS);
    buildColIndex(HEADERS);

    CLS = RE.classifyRows(HEADERS, ROWS);
    NODE_BY_ID = {};
    RE.TREE_SPEC.forEach(n => NODE_BY_ID[n.id] = n);

    auditNhom();     // cần NODE_BY_ID để đọc đường dẫn danh mục
    buildFilters();
    refresh();

    setConn(true, `⚡ ${RE.fmt(ROWS.length)} hồ sơ · ${META.source || 'Base Workflow'}`);
    $('#metaInfo').textContent = `Cập nhật: ${META.updated || '—'} · ${RE.fmt(ROWS.length)} hồ sơ`;
  } catch(err){
    console.error('[bangbaocao] Lỗi nạp dữ liệu:', err);
    setConn(false, '✕ Không nạp được dữ liệu');
    $('#recordTable tbody').innerHTML =
      `<tr><td class="empty-msg">Không nạp được dữ liệu.<br><small>${RE.escH(err.message)}</small></td></tr>`;
  }
}

/* ═══ SỰ KIỆN ═══ */
let _searchTimer = null;
$('#globalSearch').addEventListener('input', e => {
  search = e.target.value;
  clearTimeout(_searchTimer);
  _searchTimer = setTimeout(() => { page = 1; refresh(); }, 180);
});

$('#filterTeam').onchange  = e => { fTeam  = e.target.value; page = 1; refresh(); };
$('#filterSla').onchange   = e => { fSla   = e.target.value; page = 1; refresh(); };
$('#filterStage').onchange = e => { fStage = e.target.value; page = 1; refresh(); };

$('#btnResetFilters').onclick = () => {
  search = ''; fTeam = ''; fSla = ''; fStage = ''; fNode = ''; fNhom = '';
  page = 1; sortCol = -1; sortAsc = true;
  $('#globalSearch').value = '';
  buildFilters();
  refresh();
};

$('#chkHideZero').onchange = e => { hideZero = e.target.checked; renderCatalog(); };

$('#perPage').onchange = e => { PER = +e.target.value; page = 1; renderRecords(); };
$('#prevPage').onclick = () => { if(page > 1){ page--; renderRecords(); } };
$('#nextPage').onclick = () => { page++; renderRecords(); };

$('#btnReload').onclick = () => load(true);

$('#btnPrint').onclick = () => {
  const old = document.title;
  document.title = '';
  const d = new Date();
  const p = n => String(n).padStart(2, '0');
  const tag = `${p(d.getHours())}:${p(d.getMinutes())} ${d.getDate()}/${d.getMonth() + 1}/${String(d.getFullYear()).slice(-2)}`;
  $('#printReportMeta').innerHTML =
    `Dự án: Khu đô thị mới Bình Quới – Thanh Đa &nbsp;&nbsp;·&nbsp;&nbsp; <span>Thời gian lập: ${tag}</span>`;
  window.print();
  setTimeout(() => { document.title = old; }, 500);
};

/* Xuất Excel: xuất đúng chế độ đang xem */
$('#btnExcel').onclick = () => {
  if(!window.XLSX) return;
  const onRecords = !$('#view-records').classList.contains('hidden');
  const onNhom = !$('#view-nhom').classList.contains('hidden');
  const wb = XLSX.utils.book_new();
  let ws, name;

  /* Tab 3: xuất 2 sheet — tổng hợp nhóm + chi tiết từng trường hợp */
  if(onNhom){
    if(!NHOM_EXCEL) return;
    const wsSum = XLSX.utils.aoa_to_sheet([NHOM_EXCEL.sumHead].concat(NHOM_EXCEL.sumBody));
    wsSum['!cols'] = [{ wch: 16 }, { wch: 16 }].concat(CATALOG_COLUMNS.map(() => ({ wch: 16 })));
    XLSX.utils.book_append_sheet(wb, wsSum, 'TongHopNhom');

    const wsDet = XLSX.utils.aoa_to_sheet([NHOM_EXCEL.detHead].concat(NHOM_EXCEL.detBody));
    wsDet['!cols'] = [{ wch: 16 }, { wch: 10 }, { wch: 90 }].concat(CATALOG_COLUMNS.map(() => ({ wch: 16 })));
    XLSX.utils.book_append_sheet(wb, wsDet, 'ChiTietTruongHop');

    XLSX.writeFile(wb, 'BangBaoCao_Nhom_' + new Date().toISOString().slice(0, 10) + '.xlsx');
    return;
  }

  if(onRecords){
    const head = RECORD_COLUMNS.map(c => c.title);
    const body = RECORD_EXCEL_LIST.map(i => RECORD_COLUMNS.map(cd => cellValue(i, cd)));
    ws = XLSX.utils.aoa_to_sheet([head].concat(body));
    ws['!cols'] = RECORD_COLUMNS.map(c => ({ wch: Math.max(10, Math.min(45, parseInt(c.width) / 7 || 16)) }));
    name = 'HoSo';
  } else {
    if(!CATALOG_EXCEL) return;
    ws = XLSX.utils.aoa_to_sheet([CATALOG_EXCEL.head].concat(CATALOG_EXCEL.body));
    ws['!cols'] = [{ wch: 62 }, { wch: 22 }].concat(CATALOG_COLUMNS.map(() => ({ wch: 16 })));
    name = 'DanhMuc';
  }

  XLSX.utils.book_append_sheet(wb, ws, name);
  XLSX.writeFile(wb, `BangBaoCao_${name}_${new Date().toISOString().slice(0, 10)}.xlsx`);
};

/* ═══ KHỞI ĐỘNG ═══ */
load(false);
