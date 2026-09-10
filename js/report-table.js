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

/* ═══════════════════════════════════════════════════════════
   ⭐ CỘT CỦA FILE EXCEL "DANH SÁCH HỒ SƠ" — THÊM/BỚT CỘT Ở ĐÂY
   ═══════════════════════════════════════════════════════════
   Bảng trên web (RECORD_COLUMNS ở trên) chỉ hiện 13 cột cho vừa màn
   hình; file Excel thì xuất ĐẦY ĐỦ. Mỗi dòng dưới đây = 1 CỘT trong file.

     title : tiêu đề cột trong Excel
     col   : tên trong C.*  (vd 'sothua' → lấy r[C.sothua])
     type  : kiểu ô trong Excel, quyết định file có "sạch" hay không
             (bỏ trống)  = chữ
             'int'       = số nguyên   → SUM / lọc số được
             'num'       = số thập phân
             'pct'       = phần trăm thật (92% lưu là 0,92)
             'date'      = ngày          → sắp xếp theo ngày được
             'datetime'  = ngày + giờ
             ⚠ Ô nào không đúng kiểu (vd số thửa "MP15") thì tự giữ
               nguyên chữ, không bị đọc sai thành số.
     wch   : độ rộng cột (số ký tự)
     calc  : cột TÍNH TOÁN, không lấy từ Base:
             'stt'  = số thứ tự
             'ma'   = mã danh mục pháp lý (vd I.1.b.2)
             'th'   = số trường hợp (vd TH3)
             'path' = đường dẫn danh mục đầy đủ

   Muốn bỏ cột nào thì thêm // ở đầu dòng.
   ═══════════════════════════════════════════════════════════ */
const EXPORT_RECORD_COLUMNS = [
  { title: 'STT',                                  calc: 'stt',  type: 'int', wch: 6 },
  { title: 'Job ID',                               col: 'jobid',              wch: 11 },
  { title: 'Tên hồ sơ',                            col: 'name',               wch: 42 },
  { title: 'Tổ nghiệp vụ',                         col: 'team',               wch: 14 },
  { title: 'Cán bộ phụ trách',                     col: 'owner',              wch: 15 },
  { title: 'Giai đoạn',                            col: 'stage',              wch: 26 },
  { title: 'Trạng thái SLA',                       col: 'sla',                wch: 15 },
  { title: 'Deadline giai đoạn',                   col: 'deadline', type: 'datetime', wch: 18 },
  { title: 'Cập nhật lần cuối',                    col: 'updated',  type: 'datetime', wch: 18 },
  { title: '% Checklist',                          col: 'checklist', type: 'pct',     wch: 12 },
  { title: 'Hiện trạng đất',                       col: 'ht',                 wch: 26 },
  { title: 'GCN',                                  col: 'gcn',                wch: 18 },
  { title: 'Pháp lý tặng, cho, chuyển nhượng',     col: 'pl',                 wch: 36 },
  { title: 'Tách thửa',                            col: 'tt',                 wch: 18 },
  { title: 'Loại đất',                             col: 'loaidat',            wch: 20 },
  { title: 'Loại hồ sơ',                           col: 'loaihoso',           wch: 18 },
  { title: 'Số nhà',                               col: 'sonha',              wch: 16 },
  { title: 'Tên đường',                            col: 'duong',              wch: 20 },
  { title: 'Khu phố',                              col: 'khupho',             wch: 12 },
  { title: 'Số tờ',                                col: 'soto',    type: 'int', wch: 8 },
  { title: 'Số thửa',                              col: 'sothua',  type: 'int', wch: 9 },
  { title: 'Một phần (m2)',                        col: 'motphan', type: 'num', wch: 13 },
  { title: 'Toàn phần (m2)',                       col: 'toanphan', type: 'num', wch: 13 },
  { title: 'Ngày kiểm đếm',                        col: 'ngaykd',  type: 'date', wch: 14 },
  { title: 'Vướng mắc, khó khăn',                  col: 'vuongmac',           wch: 30 },
  { title: 'Mã danh mục pháp lý',                  calc: 'ma',                wch: 15 },
  { title: 'Trường hợp',                           calc: 'th',                wch: 12 },
  { title: 'Danh mục pháp lý (đường dẫn đầy đủ)',  calc: 'path',              wch: 72 },
  { title: 'Link Base Workflow',                   col: 'link',               wch: 38 }
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
const CASE_HEADER = 'TRƯỜNG HỢP';
const CASE_WIDTH  = '108px';
const CASE_PREFIX = 'TH';   // đổi thành 'Trường hợp ' nếu muốn ghi đầy đủ

/* Ghi đè thủ công cho riêng một số dòng (nếu cần khác số tự động).
   Khoá là mã danh mục trong TREE_SPEC. Để rỗng = dùng hết số tự động.
   Ví dụ:   'V': 'TH45 (giao khoán)',
            'VI.1': '—',            */
const CASE_OVERRIDE = {
};

/* Danh sách mã danh mục là "lá" (không còn mục con), theo đúng thứ tự bảng.
   Vị trí trong mảng chính là số trường hợp: CASE_LEAF_IDS[0] = TH1 */
const CASE_LEAF_IDS = (function(){
  const hasChild = {};
  RE.TREE_SPEC.forEach(n => { if(n.p) hasChild[n.p] = true; });
  return RE.TREE_SPEC.filter(n => !hasChild[n.id]).map(n => n.id);
})();

const CASE_COUNT = CASE_LEAF_IDS.length;

const CASE_AUTO = (function(){
  const map = {};
  CASE_LEAF_IDS.forEach((id, i) => { map[id] = CASE_PREFIX + (i + 1); });
  return map;
})();

function caseLabelOf(nodeId){
  return CASE_OVERRIDE[nodeId] || CASE_AUTO[nodeId] || '';
}

/* Số trường hợp → mã danh mục.  caseNumToNode(3) === 'I.1.b.2' */
function caseNumToNode(num){ return CASE_LEAF_IDS[num - 1] || null; }

/* ═══════════════════════════════════════════════════════════
   ⭐ TAB 3 — NHÓM TRƯỜNG HỢP
   ═══════════════════════════════════════════════════════════
   Gom các trường hợp (TH) thành nhóm. Chỉ cần liệt kê SỐ TH, hệ thống
   tự quy ra danh mục pháp lý rồi cộng số hồ sơ tương ứng.

   Thêm/sửa nhóm: sửa mảng GROUP_SPEC bên dưới.
   TH nào không nằm trong nhóm nào sẽ tự động dồn vào một nhóm phụ
   "Chưa phân nhóm" (hiện rõ trên bảng để không bị thất lạc hồ sơ).
   Hệ thống tự kiểm: TH trùng ở 2 nhóm hoặc TH không tồn tại đều báo
   cảnh báo ngay trên bảng.
   ═══════════════════════════════════════════════════════════ */
const GROUP_SPEC = [
  {
    key: 'n1',
    title: 'Nhóm 1',
    desc: 'Không tặng cho chuyển nhượng (mọi hiện trạng) + tặng cho giấy tay TRƯỚC 01/7/2014 mà chưa cấp GCN',
    cases: [1, 6, 7, 8, 11, 16, 17, 18, 21, 22, 27, 28, 29, 30, 33, 34, 39, 40, 41, 42],
    rule: f => f.isMain && (f.noTransfer || (f.noGCN && f.before))
  },
  {
    key: 'n2',
    title: 'Nhóm 2',
    desc: 'Chưa cấp GCN + tặng cho, chuyển nhượng giấy tay SAU 01/7/2014',
    cases: [9, 10, 19, 20, 31, 32, 43, 44],
    rule: f => f.isMain && f.noGCN && f.after && !f.noTransfer
  },
  {
    key: 'n3',
    title: 'Nhóm 3',
    desc: 'Đã có GCN + tặng cho, chuyển nhượng giấy tay (cả trước và sau 01/7/2014)',
    cases: [2, 3, 4, 5, 12, 13, 14, 15, 23, 24, 25, 26, 35, 36, 37, 38],
    rule: f => f.isMain && f.hasGCN && !f.noTransfer && (f.before || f.after)
  }
];

/* TH45 (HTX giao khoán), TH46–TH47 (đất cơ quan tổ chức) — thuộc mục V và VI,
   không nằm trong 4 hiện trạng đất dân cư nên để riêng, sẽ bổ sung nhóm sau. */
const GROUP_REST_TITLE = 'Nhóm khác (để riêng)';

/* Dựng danh sách nhóm đầy đủ + tự kiểm tra */
const GROUP_WARNINGS = [];
const GROUP_ALL = (function(){
  const seen = {};
  const list = GROUP_SPEC.map(g => {
    const caseSorted = g.cases.slice().sort((a, b) => a - b);
    caseSorted.forEach(num => {
      if(num < 1 || num > CASE_COUNT){
        GROUP_WARNINGS.push(`${g.title}: TH${num} không tồn tại (chỉ có TH1–TH${CASE_COUNT})`);
      } else if(seen[num]){
        GROUP_WARNINGS.push(`TH${num} bị xếp vào cả ${seen[num]} và ${g.title}`);
      } else {
        seen[num] = g.title;
      }
    });
    const valid = caseSorted.filter(n => n >= 1 && n <= CASE_COUNT);
    return { key: g.key, title: g.title, desc: g.desc, rule: g.rule, cases: valid,
             nodes: valid.map(caseNumToNode).filter(Boolean) };
  });

  const rest = [];
  for(let i = 1; i <= CASE_COUNT; i++) if(!seen[i]) rest.push(i);
  if(rest.length){
    list.push({
      key: '_rest', title: GROUP_REST_TITLE, isRest: true,
      desc: 'Các trường hợp chưa được xếp vào Nhóm 1/2/3 — cần bổ sung',
      cases: rest, nodes: rest.map(caseNumToNode).filter(Boolean)
    });
  }
  return list;
})();

const GROUP_BY_KEY = {};
GROUP_ALL.forEach(g => GROUP_BY_KEY[g.key] = g);


/* ═══ TRẠNG THÁI ═══ */
let HEADERS = [];
let ROWS = [];
let META = {};
let CLS = null;                 // kết quả classifyRows trên TOÀN BỘ hồ sơ
let NODE_BY_ID = {};            // id → node trong TREE_SPEC

let search = '';
let fTeam = '', fSla = '', fStage = '', fNode = '', fGroup = '';
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
function groupRowIdx(g){
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
  if(fGroup && GROUP_BY_KEY[fGroup]){
    base = groupRowIdx(GROUP_BY_KEY[fGroup]);
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
    `<th class="bbc-th-h" style="width:${CASE_WIDTH}">${RE.escH(CASE_HEADER)}</th>` +
    CATALOG_COLUMNS.map(c => `<th class="num" style="width:${c.width || 'auto'}">${RE.escH(c.title)}</th>`).join('') +
    '<th class="bbc-act-h">Hồ sơ</th>' +
    '</tr>';

  /* ── TBODY ── */
  let html = '';
  const excelRows = [];      // dữ liệu thô cho file Excel — mỗi dòng 1 object

  RE.TREE_SPEC.forEach(n => {
    const idxList = (CLS.nodeRows[n.id] || []).filter(i => visSet.has(i));
    const rowTotal = idxList.length;
    if(hideZero && rowTotal === 0) return;

    const showPct = (n.lvl === 1 || n.lvl === 2);
    const caseLabel = caseLabelOf(n.id);
    const counts = [];

    const cells = CATALOG_COLUMNS.map(col => {
      const val = countCol(col, idxList);
      counts.push(val);

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
      <td class="bbc-th-col">${RE.escH(caseLabel)}</td>${cells}${actCell}</tr>`;

    excelRows.push({
      id: n.id, lvl: n.lvl, title: n.title, path: nodePath(n.id, ' > '),
      caseLabel: caseLabel, counts: counts, rowTotal: rowTotal
    });
  });

  /* ── DÒNG TỔNG CỘNG ── */
  const grandLabel = 'TỔNG CỘNG HỒ SƠ BỒI THƯỜNG DỰ ÁN';
  const grandCounts = [];
  const grandCells = CATALOG_COLUMNS.map(col => {
    const val = countCol(col, inTree);
    grandCounts.push(val);
    return `<td class="num"><b>${RE.fmt(val)}</b><span class="pct-badge"> (${(val / denom * 100).toFixed(1)}%)</span></td>`;
  }).join('');

  html += `<tr class="total-row"><td><b>${grandLabel}</b></td><td class="bbc-th-col"></td>${grandCells}<td class="bbc-act"></td></tr>`;

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
    `(${RE.fmt(CASE_COUNT)} trường hợp · ${RE.fmt(inTree.length)} hồ sơ trong bảng` +
    (outOfTree > 0 ? ` · ${RE.fmt(outOfTree)} hồ sơ chưa xác định hiện trạng nên không vào danh mục` : '') +
    ` · tổng dự án ${RE.fmt(denomAll)})`;

  /* Bản in dùng chung số liệu */
  renderPrintTable(theadHtml, html);
  CATALOG_EXCEL = {
    rows: excelRows,                 // từng dòng danh mục
    totalLabel: grandLabel,          // dòng TỔNG CỘNG để riêng, luôn nằm cuối
    totalCounts: grandCounts,
    denom: denom,                    // mẫu số tính % (hồ sơ trong bảng)
    inTree: inTree.length
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
let GROUP_EXCEL = null;

function renderGroups(){
  const visSet = new Set(VISIBLE);
  const inTree = VISIBLE.filter(i => CLS.nodeIdByRow[i] !== null);
  const denom = inTree.length > 0 ? inTree.length : 1;

  /* Chỉ số dòng của 1 nhóm, giới hạn trong tập đang hiển thị */
  const idxOf = g => groupRowIdx(g).filter(i => visSet.has(i));

  /* ── Cảnh báo cấu hình (TH trùng / không tồn tại / chưa phân nhóm) ── */
  const warnBox = $('#groupWarn');
  const restGroup = GROUP_ALL.find(g => g.isRest);
  const errors = GROUP_WARNINGS.concat(GROUP_AUDIT);
  let html = '';

  if(errors.length){
    html += `<div class="group-warn">⚠️ ${errors.join('<br>')}</div>`;
  }
  if(restGroup){
    html += `<div class="group-info">ℹ️ <b>${restGroup.cases.length}</b> trường hợp đang để riêng, ` +
      `chưa xếp vào Nhóm 1/2/3: <b>${restGroup.cases.map(n => CASE_PREFIX + n).join(', ')}</b> ` +
      `— thuộc mục V (đất Hợp tác xã giao khoán) và VI (đất cơ quan tổ chức).</div>`;
  }
  if(!errors.length){
    html += `<div class="group-ok">✓ Đã tự kiểm: ${RE.fmt(CASE_COUNT - (restGroup ? restGroup.cases.length : 0))}` +
      ` trường hợp của Nhóm 1/2/3 khớp đúng quy luật, không trùng nhau, không thiếu.</div>`;
  }
  warnBox.innerHTML = html;

  /* ── BẢNG TỔNG HỢP NHÓM ── */
  const sumBody = [];        // dữ liệu thô cho sheet "TongHopNhom"

  let sumHtml = '<tr>' +
    '<th class="group-name-h">NHÓM</th>' +
    '<th class="num" style="width:120px">SỐ TRƯỜNG HỢP</th>' +
    CATALOG_COLUMNS.map(c => `<th class="num" style="width:${c.width || 'auto'}">${RE.escH(c.title)}</th>`).join('') +
    '<th class="bbc-act-h">Hồ sơ</th></tr>';
  $('#groupSummaryTable thead').innerHTML = sumHtml;

  let bodyHtml = '';
  GROUP_ALL.forEach(g => {
    const idxList = idxOf(g);
    const counts = [];

    const cells = CATALOG_COLUMNS.map(col => {
      const val = countCol(col, idxList);
      counts.push(val);
      if(!val) return '<td class="num bbc-zero">0</td>';
      const p = (val / denom * 100).toFixed(1);
      return `<td class="num"><b>${RE.fmt(val)}</b><span class="pct-badge"> (${p}%)</span></td>`;
    }).join('');

    const act = idxList.length
      ? `<td class="bbc-act"><button class="bbc-drill" data-group="${RE.escH(g.key)}" title="Liệt kê ${idxList.length} hồ sơ của ${RE.escH(g.title)}">Xem ${RE.fmt(idxList.length)} hồ sơ ›</button></td>`
      : '<td class="bbc-act"></td>';

    bodyHtml += `<tr class="group-row${g.isRest ? ' group-rest' : ''}${fGroup === g.key ? ' bbc-active-node' : ''}">
      <td class="group-name">
        <b>${RE.escH(g.title)}</b>
        <div class="group-desc">${RE.escH(g.desc || '')}</div>
        <div class="group-thlist">${g.cases.map(n => CASE_PREFIX + n).join(' · ')}</div>
      </td>
      <td class="num"><b>${g.cases.length}</b></td>${cells}${act}</tr>`;

    sumBody.push({
      title: g.title, desc: g.desc || '', caseCount: g.cases.length,
      caseList: g.cases.map(n => CASE_PREFIX + n).join(', '),
      counts: counts, rowTotal: idxList.length
    });
  });

  /* Dòng tổng của bảng nhóm */
  const totCases = GROUP_ALL.reduce((s, g) => s + g.cases.length, 0);
  const totCounts = [];
  const totCells = CATALOG_COLUMNS.map(col => {
    const val = countCol(col, inTree);
    totCounts.push(val);
    return `<td class="num"><b>${RE.fmt(val)}</b><span class="pct-badge"> (${(val / denom * 100).toFixed(1)}%)</span></td>`;
  }).join('');
  bodyHtml += `<tr class="total-row"><td><b>TỔNG CỘNG</b></td>
    <td class="num"><b>${totCases}</b></td>${totCells}<td class="bbc-act"></td></tr>`;

  $('#groupSummaryTable tbody').innerHTML = bodyHtml;

  /* ── BẢNG CHI TIẾT TỪNG NHÓM ── */
  const detBody = [];        // dữ liệu thô cho sheet "ChiTietTruongHop"
  let detHtml = '';

  GROUP_ALL.forEach(g => {
    const gIdx = idxOf(g);

    detHtml += `<div class="group-block${g.isRest ? ' group-block-rest' : ''}">
      <div class="group-block-hdr">
        <h4>${RE.escH(g.title)}</h4>
        <span class="group-block-meta">${g.cases.length} trường hợp · <b>${RE.fmt(gIdx.length)}</b> hồ sơ</span>
        <span class="group-block-desc">${RE.escH(g.desc || '')}</span>
      </div>
      <div class="tscroll group-block-scroll">
      <table class="dt group-detail">
        <thead><tr>
          <th style="width:${CASE_WIDTH}">${RE.escH(CASE_HEADER)}</th>
          <th class="group-path-h">DANH MỤC PHÁP LÝ (đường dẫn đầy đủ)</th>
          ${CATALOG_COLUMNS.map(c => `<th class="num" style="width:${c.width || 'auto'}">${RE.escH(c.title)}</th>`).join('')}
          <th class="bbc-act-h">Hồ sơ</th>
        </tr></thead>
        <tbody>`;

    g.cases.forEach(num => {
      const nodeId = caseNumToNode(num);
      if(!nodeId) return;
      const idxList = (CLS.nodeRows[nodeId] || []).filter(i => visSet.has(i));
      const label = CASE_PREFIX + num;
      const path = nodePath(nodeId);
      const counts = [];

      const cells = CATALOG_COLUMNS.map(col => {
        const val = countCol(col, idxList);
        counts.push(val);
        return val ? `<td class="num">${RE.fmt(val)}</td>` : '<td class="num bbc-zero">0</td>';
      }).join('');

      const act = idxList.length
        ? `<td class="bbc-act"><button class="bbc-drill" data-node="${RE.escH(nodeId)}" title="Liệt kê ${idxList.length} hồ sơ">Xem ${RE.fmt(idxList.length)} ›</button></td>`
        : '<td class="bbc-act"></td>';

      detHtml += `<tr>
        <td class="bbc-th-col">${RE.escH(label)}</td>
        <td class="group-path"><code>${RE.escH(nodeId)}</code> ${RE.escH(path)}</td>
        ${cells}${act}</tr>`;

      detBody.push({
        group: g.title, caseLabel: label, nodeId: nodeId,
        path: nodePath(nodeId, ' > '), counts: counts, rowTotal: idxList.length
      });
    });

    detHtml += '</tbody></table></div></div>';
  });

  $('#groupDetailBox').innerHTML = detHtml;

  /* Bấm "Xem hồ sơ" ở cả 2 bảng */
  $$('#view-group .bbc-drill').forEach(b => {
    b.onclick = ev => {
      ev.stopPropagation();
      if(b.dataset.group) drillGroup(b.dataset.group);
      else if(b.dataset.node) drillTo(b.dataset.node);
    };
  });

  $('#groupNote').textContent =
    `(${GROUP_ALL.length} nhóm · ${RE.fmt(CASE_COUNT)} trường hợp · ${RE.fmt(inTree.length)} hồ sơ)`;

  GROUP_EXCEL = {
    sumBody: sumBody, detBody: detBody,
    totCases: totCases, totCounts: totCounts,
    denom: denom, inTree: inTree.length
  };
}

function drillGroup(key){
  fGroup = key;
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
function caseFlags(nodeId){
  const parts = nodePathParts(nodeId);
  const root = (parts[0] || '').toUpperCase();
  const s = parts.join(' | ').toUpperCase();
  return {
    isMain:     /^(I|II|III|IV)\./.test(root),   // chỉ 4 mục hiện trạng đất dân cư
    noTransfer: s.includes('KHÔNG TẶNG'),
    noGCN:      s.includes('CHƯA CẤP GCN'),
    hasGCN:     s.includes('CÓ GCN') && !s.includes('CHƯA CẤP GCN'),
    before:     s.includes('TRƯỚC 01/7/2014'),
    after:      s.includes('SAU 01/7/2014')
  };
}

let GROUP_AUDIT = [];

function auditGroups(){
  GROUP_AUDIT = [];
  const assigned = {};
  GROUP_ALL.forEach(g => g.cases.forEach(n => assigned[n] = g));

  GROUP_ALL.forEach(g => {
    if(typeof g.rule !== 'function') return;
    const missing = [], extra = [];
    for(let num = 1; num <= CASE_COUNT; num++){
      const nodeId = caseNumToNode(num);
      if(!nodeId) continue;
      let matched = false;
      try { matched = !!g.rule(caseFlags(nodeId)); } catch(e){ continue; }
      const isListed = g.cases.includes(num);
      if(matched && !isListed) missing.push(num);
      if(!matched && isListed) extra.push(num);
    }
    if(missing.length){
      GROUP_AUDIT.push(`<b>${g.title}</b> theo quy luật còn thiếu: ` +
        missing.map(n => `${CASE_PREFIX}${n} (${assigned[n] ? 'đang ở ' + assigned[n].title : 'chưa xếp'})`).join(', '));
    }
    if(extra.length){
      GROUP_AUDIT.push(`<b>${g.title}</b> có trường hợp không khớp quy luật: ` +
        extra.map(n => CASE_PREFIX + n).join(', '));
    }
  });
}

/* ═══ DRILL: bấm danh mục → liệt kê hồ sơ ═══ */
function drillTo(nodeId){
  fNode = nodeId;
  fGroup = '';
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
  if(fGroup && GROUP_BY_KEY[fGroup]){
    const g = GROUP_BY_KEY[fGroup];
    chips.push(`<b>${RE.escH(g.title)}</b> (${g.cases.length} trường hợp: ${RE.escH(g.cases.map(n => CASE_PREFIX + n).join(', '))})
      <button class="bbc-chip-x" id="btnClearGroup" title="Bỏ lọc nhóm">✕</button>`);
  }
  if(fNode){
    chips.push(`Danh mục <code>${RE.escH(fNode)}</code> (${RE.escH(caseLabelOf(fNode) || '—')}): <b>${RE.escH(nodePath(fNode))}</b>
      <button class="bbc-chip-x" id="btnClearNode" title="Bỏ lọc danh mục">✕</button>`);
  }

  if(!chips.length){
    box.innerHTML = `<div class="note-banner">⚡ Đang xem <b>tất cả ${RE.fmt(ROWS.length)}</b> hồ sơ dự án</div>`;
  } else {
    box.innerHTML = `<div class="note-banner">🔍 <b>${RE.fmt(VISIBLE.length)}</b> / ${RE.fmt(ROWS.length)} hồ sơ · ${chips.join(' · ')}</div>`;
    const bx = $('#btnClearNode');
    if(bx) bx.onclick = () => { fNode = ''; page = 1; refresh(); };
    const bn = $('#btnClearGroup');
    if(bn) bn.onclick = () => { fGroup = ''; page = 1; refresh(); };
  }
}

/* ═══ VÒNG RENDER ═══ */
function refresh(){
  computeVisible();
  renderNote();
  renderCatalog();
  renderGroups();
  renderRecords();
  $('#cntCat').textContent = RE.fmt(RE.TREE_SPEC.length);
  $('#cntRec').textContent = RE.fmt(VISIBLE.length);
  $('#cntGroup').textContent = RE.fmt(GROUP_ALL.length);
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

    auditGroups();   // cần NODE_BY_ID để đọc đường dẫn danh mục
    buildFilters();
    refresh();

    setConn(true, `⚡ ${RE.fmt(ROWS.length)} hồ sơ · ${META.source || 'Base Workflow'}`);
    $('#metaInfo').textContent = `Cập nhật: ${META.updated || '—'} · ${RE.fmt(ROWS.length)} hồ sơ`;
  } catch(err){
    console.error('[report-table] Lỗi nạp dữ liệu:', err);
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
  search = ''; fTeam = ''; fSla = ''; fStage = ''; fNode = ''; fGroup = '';
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

/* ═══════════════════════════════════════════════════════════
   XUẤT EXCEL — xuất đúng chế độ (tab) đang xem
   ═══════════════════════════════════════════════════════════
   Quy ước dựng file nằm ở js/report-engine.js mục 8 (RE.xlSheet):
     • Dòng 1 = tiêu đề cột, dữ liệu từ dòng 2, KHÔNG gộp ô, KHÔNG
       chèn dòng "BÁO CÁO…" phía trên ⇒ lọc / sắp xếp / pivot được ngay.
     • MỖI Ô MỘT GIÁ TRỊ: trên web ghi "123 (45,2%)" trong một ô thì
       ra Excel tách thành 2 CỘT — cột số và cột %.
     • Số ra số, % ra phần trăm thật, ngày ra ngày; ô trống là ô rỗng.
     • Thông tin báo cáo + bộ lọc đang bật nằm ở sheet "ThongTin".
   ═══════════════════════════════════════════════════════════ */

/* Với mỗi cột trong CATALOG_COLUMNS sinh ra 1 cột SỐ + 1 cột % đi kèm.
   Thêm cột mới ở CATALOG_COLUMNS là file Excel tự có thêm 2 cột. */
function metricCols(){
  const out = [];
  CATALOG_COLUMNS.forEach(c => {
    out.push({ title: c.title, type: 'int', wch: 15 });
    if(c.pct){
      out.push({
        title: c.pct === 'overall' ? '% trên tổng bảng' : '% ' + c.title,
        type: 'pct', wch: 14
      });
    }
  });
  return out;
}

/* Mảng số đếm → mảng giá trị xen kẽ [số, %, số, %…] khớp metricCols().
   rowTotal = tổng của chính dòng đó (mẫu số cho pct:'row')
   denom    = tổng hồ sơ trong bảng (mẫu số cho pct:'overall') */
function metricVals(counts, rowTotal, denom){
  const out = [];
  CATALOG_COLUMNS.forEach((c, i) => {
    const val = counts[i];
    out.push(val);
    if(c.pct){
      const base = c.pct === 'overall' ? denom : rowTotal;
      out.push(base > 0 ? val / base : null);
    }
  });
  return out;
}

/* Lấy giá trị 1 ô cho file Excel danh sách hồ sơ (EXPORT_RECORD_COLUMNS) */
function exportCellValue(rowIdx, cd, stt){
  if(cd.calc === 'stt') return stt;
  if(cd.calc){
    const id = CLS.nodeIdByRow[rowIdx];
    if(!id) return '';
    if(cd.calc === 'ma')   return id;
    if(cd.calc === 'th')   return caseLabelOf(id);
    if(cd.calc === 'path') return nodePath(id, ' > ');
    return '';
  }
  const ci = C[cd.col];
  return (ci >= 0 && ci !== undefined) ? ROWS[rowIdx][ci] : '';
}

/* Sheet "ThongTin" — mô tả file: đơn vị, thời điểm, nguồn, bộ lọc đang bật */
function infoSheet(noiDung, extra){
  const f = [];
  if(search.trim()) f.push('Từ khoá tìm kiếm: ' + search.trim());
  if(fTeam)  f.push('Tổ: ' + fTeam);
  if(fSla)   f.push('Trạng thái SLA: ' + fSla);
  if(fStage) f.push('Giai đoạn: ' + fStage);
  if(fNode)  f.push('Danh mục: ' + fNode + ' — ' + nodePath(fNode, ' > '));
  if(fGroup && GROUP_BY_KEY[fGroup]) f.push('Nhóm: ' + GROUP_BY_KEY[fGroup].title);

  return RE.xlInfoSheet([
    ['Đơn vị',                 'Ban Quản lý dự án đầu tư xây dựng phường Bình Quới'],
    ['Dự án',                  'Khu đô thị mới Bình Quới – Thanh Đa'],
    ['Nội dung file',          noiDung],
    ['Thời điểm xuất file',    RE.xlNow()],
    ['Nguồn dữ liệu',          META.source || 'Base Workflow'],
    ['Base cập nhật lúc',      META.updated || ''],
    ['Tổng hồ sơ toàn dự án',  ROWS.length],
    ['Hồ sơ khớp bộ lọc',      VISIBLE.length],
    ['Bộ lọc đang áp dụng',    f.length ? f.join('   |   ') : 'Không lọc — toàn bộ hồ sơ']
  ].concat(extra || []));
}

$('#btnExcel').onclick = () => {
  if(!window.XLSX){ alert('Chưa nạp được thư viện Excel (libs/xlsx.full.min.js).'); return; }
  const onRecords = !$('#view-records').classList.contains('hidden');
  const onGroup   = !$('#view-group').classList.contains('hidden');
  const wb = XLSX.utils.book_new();

  /* ── TAB 3: NHÓM TRƯỜNG HỢP → 2 sheet số liệu + 1 sheet thông tin ── */
  if(onGroup){
    if(!GROUP_EXCEL) return;
    const G = GROUP_EXCEL;

    /* Sheet 1: mỗi NHÓM 1 dòng. Diễn giải và danh sách TH tách riêng 2 cột */
    const sumCols = [
      { title: 'STT',                   type: 'int', wch: 6 },
      { title: 'NHÓM',                               wch: 16 },
      { title: 'DIỄN GIẢI NHÓM',                     wch: 62 },
      { title: 'SỐ TRƯỜNG HỢP',         type: 'int', wch: 15 },
      { title: 'DANH SÁCH TRƯỜNG HỢP',               wch: 48 }
    ].concat(metricCols());

    const sumRows = G.sumBody.map((g, i) =>
      [i + 1, g.title, g.desc, g.caseCount, g.caseList]
        .concat(metricVals(g.counts, g.rowTotal, G.denom)));
    sumRows.push([null, 'TỔNG CỘNG', null, G.totCases, null]
      .concat(metricVals(G.totCounts, G.inTree, G.denom)));

    XLSX.utils.book_append_sheet(wb,
      RE.xlSheet(sumCols, sumRows, { skipLastInFilter: true }), 'TongHopNhom');

    /* Sheet 2: mỗi TRƯỜNG HỢP 1 dòng, mã danh mục và đường dẫn tách 2 cột */
    const detCols = [
      { title: 'STT',                                  type: 'int', wch: 6 },
      { title: 'NHÓM',                                              wch: 16 },
      { title: 'TRƯỜNG HỢP',                                        wch: 13 },
      { title: 'MÃ DANH MỤC',                                       wch: 14 },
      { title: 'DANH MỤC PHÁP LÝ (ĐƯỜNG DẪN ĐẦY ĐỦ)',               wch: 72 }
    ].concat(metricCols());

    const detRows = G.detBody.map((d, i) =>
      [i + 1, d.group, d.caseLabel, d.nodeId, d.path]
        .concat(metricVals(d.counts, d.rowTotal, G.denom)));

    XLSX.utils.book_append_sheet(wb, RE.xlSheet(detCols, detRows), 'ChiTietTruongHop');
    XLSX.utils.book_append_sheet(wb,
      infoSheet('Bảng nhóm trường hợp — tổng hợp theo nhóm và chi tiết từng trường hợp',
        [['Số nhóm', G.sumBody.length], ['Số trường hợp', CASE_COUNT]]), 'ThongTin');

    RE.xlSave(wb, 'BangBaoCao_NhomTruongHop');
    return;
  }

  /* ── TAB 2: DANH SÁCH HỒ SƠ ── */
  if(onRecords){
    const cols = EXPORT_RECORD_COLUMNS.map(c =>
      ({ title: c.title, type: c.type || 'text', wch: c.wch }));
    const rows = RECORD_EXCEL_LIST.map((idx, i) =>
      EXPORT_RECORD_COLUMNS.map(cd => exportCellValue(idx, cd, i + 1)));

    XLSX.utils.book_append_sheet(wb, RE.xlSheet(cols, rows), 'HoSo');
    XLSX.utils.book_append_sheet(wb,
      infoSheet('Danh sách hồ sơ theo bộ lọc đang xem',
        [['Số hồ sơ trong file', rows.length], ['Số cột trong file', cols.length]]), 'ThongTin');

    RE.xlSave(wb, 'BangBaoCao_DanhSachHoSo');
    return;
  }

  /* ── TAB 1: DANH MỤC PHÂN LOẠI PHÁP LÝ ──
     Cây phân loại trên web thụt đầu dòng để thấy cấp; ra Excel không thụt
     được nên tách hẳn thành 3 cột: CẤP + MÃ DANH MỤC + ĐƯỜNG DẪN ĐẦY ĐỦ. */
  if(!CATALOG_EXCEL) return;
  const K = CATALOG_EXCEL;
  const catCols = [
    { title: 'STT',                                 type: 'int', wch: 6 },
    { title: 'CẤP',                                 type: 'int', wch: 6 },
    { title: 'MÃ DANH MỤC',                                      wch: 14 },
    { title: 'TRƯỜNG HỢP',                                       wch: 13 },
    { title: 'DANH MỤC PHÂN LOẠI PHÁP LÝ HỒ SƠ',                 wch: 58 },
    { title: 'ĐƯỜNG DẪN ĐẦY ĐỦ',                                 wch: 72 }
  ].concat(metricCols());

  const catRows = K.rows.map((r, i) =>
    [i + 1, r.lvl, r.id, r.caseLabel, r.title, r.path]
      .concat(metricVals(r.counts, r.rowTotal, K.denom)));
  catRows.push([null, null, null, null, K.totalLabel, null]
    .concat(metricVals(K.totalCounts, K.inTree, K.denom)));

  XLSX.utils.book_append_sheet(wb,
    RE.xlSheet(catCols, catRows, { skipLastInFilter: true }), 'DanhMuc');
  XLSX.utils.book_append_sheet(wb,
    infoSheet('Bảng danh mục phân loại pháp lý hồ sơ',
      [['Số dòng danh mục', K.rows.length], ['Số trường hợp', CASE_COUNT]]), 'ThongTin');

  RE.xlSave(wb, 'BangBaoCao_DanhMucPhapLy');
};

/* ═══ KHỞI ĐỘNG ═══ */
load(false);
