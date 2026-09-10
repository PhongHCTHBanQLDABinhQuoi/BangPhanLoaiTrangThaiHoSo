/* ═══════════════════════════════════════════════════════════
   REPORT ENGINE — LÕI NGHIỆP VỤ DÙNG CHUNG
   ═══════════════════════════════════════════════════════════
   File này chứa TOÀN BỘ logic nghiệp vụ dùng chung giữa:
     • index.html   (dashboard 6 tab)      → js/app.js
     • report-table.html (trang bảng báo cáo) → js/report-table.js

   ⚠️ ĐÂY LÀ NGUỒN SỰ THẬT DUY NHẤT của cây phân loại pháp lý
      (TREE_SPEC) và của cách suy ra Tổ/Phòng. Sửa ở đây là
      sửa cho cả 2 trang — đừng copy sang chỗ khác.

   Không khai báo biến toàn cục nào ngoài `window.ReportEngine`.
   ═══════════════════════════════════════════════════════════ */

"use strict";

window.ReportEngine = (function () {

  /* ═══ 1. HẰNG SỐ & TỔ/PHÒNG ═══ */

  const EMPTY = '(Chưa phân loại)';
  const TEAM_COL = 'Tổ/Phòng';
  const TEAM_OTHER = 'Tổ NV BT 1';
  const TEAMS = ['Tổ NV BT 1', 'Tổ NV BT 2', 'Tổ NV BT 3'];

  /* Bảng tra username Base → Tổ nghiệp vụ.
     Cán bộ mới vào PHẢI thêm vào đây, nếu không sẽ bị gom sai vào Tổ 1. */
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

  /* Ưu tiên: mã khu phố trong Tên nhiệm vụ → TEAM_MAP theo Người phụ trách
     → TEAM_MAP theo Người tạo → fallback Tổ 1 */
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
    if(TEAMS.includes(t1)) return t1;
    const t2 = teamOf(ntUser);
    if(TEAMS.includes(t2)) return t2;
    return 'Tổ NV BT 1';
  }

  /* Thêm (hoặc ghi đè) cột "Tổ/Phòng" vào headers + rows. Trả về index cột đó.
     Mutate trực tiếp headers/rows để cả 2 trang dùng chung một cách. */
  function enrichTeam(headers, rows){
    const gc = headers.findIndex(h => h.toLowerCase().includes('phụ trách') || h.toLowerCase().includes('giao cho'));
    const nt = headers.findIndex(h => h.toLowerCase().includes('người tạo'));
    const nameIdx = headers.findIndex(h => h.toLowerCase().includes('tên nhiệm vụ') || h.toLowerCase().includes('tên'));

    let ti = headers.indexOf(TEAM_COL);
    if(ti < 0){ headers.push(TEAM_COL); ti = headers.length - 1; }

    rows.forEach(r => {
      r[ti] = resolveTeam(
        nameIdx >= 0 ? r[nameIdx] : '',
        gc >= 0 ? r[gc] : '',
        nt >= 0 ? r[nt] : ''
      );
    });
    return ti;
  }

  /* ═══ 2. CHUẨN HOÁ GCN ═══
     Dữ liệu Base nhập tay không đồng nhất → gom về 3 nhóm.
     Thứ tự kiểm tra KHÔNG trước CÓ là BẮT BUỘC ("KHÔNG CÓ GCN" chứa cả hai). */
  function normGCN(str){
    const s = String(str || '').trim().toUpperCase();
    if(!s || s === '(CHƯA XÁC ĐỊNH)' || s === 'EMPTY') return 'CHƯA XÁC ĐỊNH';
    if(s.includes('KHÔNG') || s.includes('CHƯA')) return 'KHÔNG CÓ GCN';
    if(s.includes('CÓ GCN') || s.includes('CÓ')) return 'CÓ GCN';
    return 'CHƯA XÁC ĐỊNH';
  }

  /* ═══ 3. CÁC HÀM SO KHỚP TIÊU CHÍ PHÁP LÝ ═══ */

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

  /* ═══ 4. CÂY PHÂN LOẠI PHÁP LÝ (TREE_SPEC) ═══
     Cây 4 cấp, 6 mục La Mã — phản chiếu đúng biểu mẫu báo cáo giấy của cơ quan.
       id    : mã node
       p     : id node cha (null = cấp 1)
       lvl   : cấp 1..4 (dùng để thụt lề + tô đậm)
       title : tiêu đề in ra
       match : CHỈ node lá mới có. Hồ sơ khớp node lá nào ĐẦU TIÊN thì
               được cộng dồn ngược lên toàn bộ node cha.
     Mốc 01/7/2014 là mốc pháp lý Luật Đất đai — quyết định đủ/không đủ
     điều kiện bồi thường. */
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

  /* ═══ 5. PHÂN LOẠI HỒ SƠ VÀO CÂY ═══
     Trả về:
       nodeRows    : { nodeId: [chỉ số dòng, ...] }  ← đã cộng dồn cả node con
       nodeIdByRow : [ nodeId lá của từng dòng | null ]
       unmatched   : [ chỉ số dòng không khớp danh mục nào ]
       grandTotal  : số hồ sơ đã vào được cây
     Vì trả về CHỈ SỐ DÒNG (không phải con số đếm sẵn), trang gọi có thể
     đếm theo BẤT KỲ điều kiện nào → thêm cột mới rất dễ. */
  function classifyRows(headers, rows){
    const htIdx  = headers.findIndex(h => h.toLowerCase().includes('hiện trạng'));
    const gcnIdx = headers.findIndex(h => h.toLowerCase().includes('gcn'));
    const plIdx  = headers.findIndex(h => h.toLowerCase().includes('tặng') || h.toLowerCase().includes('chuyển nhượng'));
    const ttIdx  = headers.findIndex(h => h.toLowerCase().includes('tách thửa'));

    const parentMap = {};
    const nodeRows = {};
    TREE_SPEC.forEach(n => { parentMap[n.id] = n.p; nodeRows[n.id] = []; });

    const leafNodes = TREE_SPEC.filter(n => typeof n.match === 'function');
    const nodeIdByRow = new Array(rows.length).fill(null);
    const unmatched = [];

    rows.forEach((r, i) => {
      const ht  = (htIdx  >= 0 ? r[htIdx]  : '').trim().toUpperCase();
      const gcn = (gcnIdx >= 0 ? r[gcnIdx] : '').trim().toUpperCase();
      const pl  = (plIdx  >= 0 ? r[plIdx]  : '').trim().toUpperCase();
      const tt  = (ttIdx  >= 0 ? r[ttIdx]  : '').trim().toUpperCase();

      let matchedId = null;
      for(const leaf of leafNodes){
        if(leaf.match(ht, gcn, pl, tt)){ matchedId = leaf.id; break; }
      }

      /* Fallback heuristic: hồ sơ không khớp node lá nào vẫn phải được đếm,
         gán vào nhánh "CÓ TÁCH THỬA" gần nhất để KHÔNG mất hồ sơ khỏi tổng. */
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

      nodeIdByRow[i] = matchedId;
      if(!matchedId){ unmatched.push(i); return; }

      // Cộng dồn ngược lên toàn bộ node cha
      let curr = matchedId;
      while(curr){
        if(nodeRows[curr]) nodeRows[curr].push(i);
        curr = parentMap[curr];
      }
    });

    return {
      nodeRows: nodeRows,
      nodeIdByRow: nodeIdByRow,
      unmatched: unmatched,
      parentMap: parentMap,
      grandTotal: rows.length - unmatched.length,
      TREE_SPEC: TREE_SPEC,
      idx: { ht: htIdx, gcn: gcnIdx, pl: plIdx, tt: ttIdx }
    };
  }

  /* ═══ 6. TIỆN ÍCH ═══ */

  /* Bỏ dấu tiếng Việt để tìm kiếm không cần gõ dấu */
  function removeAccents(str){
    return String(str || '')
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .replace(/đ/g, 'd').replace(/Đ/g, 'D')
      .toLowerCase();
  }

  function fmt(n){ return (n || 0).toLocaleString('vi'); }
  function pct(n, total){ return (total ? (n / total * 100).toFixed(1) : '0.0') + '%'; }
  function escH(s){
    return String(s == null ? '' : s)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  /* Nạp payload: ưu tiên /api/data (có server.py), fallback cache_payload.json
     (GitHub Pages tĩnh). Trả về { headers, rows, meta }. */
  async function loadPayload(force){
    let d = null;
    try {
      const res = await fetch('/api/data' + (force ? '?force=1' : ''), { cache: 'no-store' });
      if(res.ok) d = await res.json();
    } catch(e){ /* không có server → fallback bên dưới */ }

    if(!d || !d.headers || !d.rows || !d.rows.length){
      const res2 = await fetch('cache_payload.json', { cache: force ? 'no-store' : 'default' });
      if(res2.ok) d = await res2.json();
    }

    if(!d || !d.headers || !d.rows || !d.rows.length){
      throw new Error('Không nạp được dữ liệu từ /api/data lẫn cache_payload.json');
    }

    // Chuẩn hoá: mọi ô về string đã trim, giống cách app.js làm
    const headers = d.headers.map(h => String(h).trim() || '(cột)');
    const rows = d.rows.map(r => headers.map((_, i) => String(r[i] ?? '').trim()));
    return { headers: headers, rows: rows, meta: d.meta || {} };
  }

  /* ═══════════════════════════════════════════════════════════
     ⭐ 8. BỘ DỰNG FILE EXCEL DÙNG CHUNG (RE.xl*)
     ═══════════════════════════════════════════════════════════
     QUY ƯỚC XUẤT EXCEL CỦA DỰ ÁN — áp dụng cho CẢ 2 trang:

       1. DÒNG 1 = TIÊU ĐỀ CỘT, dữ liệu bắt đầu từ DÒNG 2.
          KHÔNG chèn dòng "BÁO CÁO…", KHÔNG gộp ô (merge) phía trên.
          Thông tin báo cáo (đơn vị, thời điểm, bộ lọc) nằm ở sheet
          riêng tên "ThongTin" ⇒ bảng dữ liệu luôn lọc/sắp xếp/pivot được.

       2. MỖI Ô MỘT GIÁ TRỊ. Trên web hiển thị "123 (45,2%)" trong cùng
          một ô, nhưng ra Excel phải TÁCH THÀNH 2 CỘT: cột số và cột %.
          Không nhét 2 dữ kiện vào chung một ô.

       3. ĐÚNG KIỂU DỮ LIỆU: số ra số (cộng/SUM được), % ra phần trăm
          thật (0,452 định dạng 45,2%), ngày ra ngày (sắp xếp được),
          chữ ra chữ. Ô không có dữ liệu là ô RỖNG THẬT (không phải
          chuỗi rỗng hay dấu "—").

       4. Tự canh độ rộng cột và bật AutoFilter trên vùng dữ liệu.

     Cách dùng:
        const ws = RE.xlSheet(COLS, ROWS, { skipLastInFilter: true });
        RE.xlSave(wb, 'BangBaoCao_DanhMuc');
     ═══════════════════════════════════════════════════════════ */

  /* Định dạng số hiển thị trong Excel theo từng kiểu cột */
  const XL_FMT = {
    int:      '#,##0',
    num:      '#,##0.##',
    pct:      '0.0%',
    date:     'dd/mm/yyyy',
    datetime: 'dd/mm/yyyy hh:mm'
  };

  /* Chuỗi → số. Trả về null nếu KHÔNG phải số thật, để ô đó giữ nguyên
     chữ thay vì bị đọc sai (vd số thửa "MP15" phải giữ là chữ). */
  function xlNum(v){
    if(typeof v === 'number') return isFinite(v) ? v : null;
    let s = String(v == null ? '' : v).trim().replace(/\s+/g, '').replace(/%$/, '');
    if(!s) return null;
    let neg = false;
    if(s.charAt(0) === '-'){ neg = true; s = s.slice(1); }
    if(!/^[\d.,]+$/.test(s)) return null;              // có chữ cái → không phải số
    if(s.indexOf(',') >= 0){
      s = s.replace(/\./g, '').replace(',', '.');      // 1.234,5 (kiểu VN)
    } else if(/^\d{1,3}(\.\d{3})+$/.test(s)){
      s = s.replace(/\./g, '');                        // 1.234 = một nghìn hai trăm…
    }
    const n = parseFloat(s);
    if(!isFinite(n)) return null;
    return neg ? -n : n;
  }

  /* "10/08/2026 16:45" → số serial của Excel (sắp xếp / lọc theo ngày được).
     Trả về null nếu không đúng dạng ngày. */
  function xlDateSerial(v){
    const m = String(v == null ? '' : v).trim()
      .match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})(?:[ T](\d{1,2}):(\d{2}))?/);
    if(!m) return null;
    const d = +m[1], mo = +m[2], y = +m[3], hh = +(m[4] || 0), mi = +(m[5] || 0);
    if(mo < 1 || mo > 12 || d < 1 || d > 31) return null;
    const days = Math.floor(Date.UTC(y, mo - 1, d) / 86400000) + 25569;  // 25569 = 01/01/1970
    return days + (hh * 60 + mi) / 1440;
  }

  /* Dấu thời gian cho tên file: 26-08-2026_14h30 */
  function xlStamp(){
    const d = new Date(), p = n => String(n).padStart(2, '0');
    return p(d.getDate()) + '-' + p(d.getMonth() + 1) + '-' + d.getFullYear() +
           '_' + p(d.getHours()) + 'h' + p(d.getMinutes());
  }
  function xlNow(){
    const d = new Date(), p = n => String(n).padStart(2, '0');
    return p(d.getHours()) + ':' + p(d.getMinutes()) + ' ngày ' +
           p(d.getDate()) + '/' + p(d.getMonth() + 1) + '/' + d.getFullYear();
  }

  /* ── DỰNG 1 SHEET ──────────────────────────────────────────
     cols : [{ title, type, wch, maxw }]   type: text|int|num|pct|date|datetime
     rows : mảng các mảng giá trị THÔ, đúng thứ tự cols
     opts : { skipLastInFilter: true }  → dòng cuối là TỔNG CỘNG, không cho vào AutoFilter
  */
  function xlSheet(cols, rows, opts){
    opts = opts || {};
    const aoa = [cols.map(c => c.title)];
    const numFmt = [];                                  // ô nào cần gán định dạng số

    rows.forEach((r, ri) => {
      aoa.push(cols.map((c, ci) => {
        const raw = r[ci];
        const type = c.type || 'text';
        const asText = () => {
          const s = (raw == null) ? '' : String(raw).trim();
          return s === '' ? null : s;                   // ô trống = ô RỖNG THẬT
        };
        if(type === 'text') return asText();

        if(type === 'date' || type === 'datetime'){
          const sv = xlDateSerial(raw);
          if(sv == null) return asText();               // không phải ngày → giữ nguyên chữ
          numFmt.push({ r: ri + 1, c: ci, z: XL_FMT[type] });
          return sv;
        }

        let n = xlNum(raw);
        if(n == null) return asText();                  // không phải số → giữ nguyên chữ
        if(type === 'pct' && (String(raw).indexOf('%') >= 0 || n > 1.0000001)) n = n / 100;
        // số nguyên thì dùng mẫu số nguyên, tránh Excel hiện "110." thừa dấu chấm
        const z = (type === 'num' && n === Math.round(n)) ? XL_FMT.int : (XL_FMT[type] || XL_FMT.num);
        numFmt.push({ r: ri + 1, c: ci, z: z });
        return n;
      }));
    });

    const ws = XLSX.utils.aoa_to_sheet(aoa);

    numFmt.forEach(f => {
      const cell = ws[XLSX.utils.encode_cell({ r: f.r, c: f.c })];
      if(cell) cell.z = f.z;
    });

    /* Độ rộng cột: lấy theo cấu hình, không có thì tự canh theo nội dung */
    ws['!cols'] = cols.map((c, ci) => {
      if(c.wch) return { wch: c.wch };
      let w = String(c.title).length;
      for(let i = 0; i < rows.length; i++){
        const v = rows[i][ci];
        if(v == null) continue;
        const l = String(v).length;
        if(l > w) w = l;
      }
      return { wch: Math.max(8, Math.min(c.maxw || 45, w + 2)) };
    });

    /* AutoFilter trên vùng tiêu đề + dữ liệu (bỏ dòng TỔNG CỘNG nếu có) */
    const nData = rows.length - (opts.skipLastInFilter ? 1 : 0);
    if(nData > 0){
      ws['!autofilter'] = {
        ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: nData, c: cols.length - 1 } })
      };
    }
    return ws;
  }

  /* Sheet "ThongTin": 2 cột Mục | Nội dung. Mọi thứ mô tả báo cáo
     (đơn vị, thời điểm, bộ lọc đang bật…) dồn hết vào đây để bảng dữ
     liệu bên kia sạch tuyệt đối. pairs = [['Mục','Nội dung'], …] */
  function xlInfoSheet(pairs){
    const rows = pairs.filter(Boolean).map(p =>
      [p[0], typeof p[1] === 'number' ? p[1] : (p[1] == null ? '' : String(p[1]))]);
    const ws = XLSX.utils.aoa_to_sheet([['MỤC', 'NỘI DUNG']].concat(rows));
    ws['!cols'] = [{ wch: 34 }, { wch: 78 }];
    return ws;
  }

  /* Ghi file: <tên>_26-08-2026_14h30.xlsx */
  function xlSave(wb, prefix){
    XLSX.writeFile(wb, prefix + '_' + xlStamp() + '.xlsx');
  }

  /* ═══ EXPORT ═══ */
  return {
    EMPTY: EMPTY,
    TEAM_COL: TEAM_COL,
    TEAM_OTHER: TEAM_OTHER,
    TEAMS: TEAMS,
    TEAM_MAP: TEAM_MAP,
    teamOf: teamOf,
    resolveTeam: resolveTeam,
    enrichTeam: enrichTeam,
    normGCN: normGCN,
    htIs: htIs, gcnIs: gcnIs, plIs: plIs, ttIs: ttIs,
    TREE_SPEC: TREE_SPEC,
    classifyRows: classifyRows,
    fmt: fmt, pct: pct, escH: escH,
    removeAccents: removeAccents,
    loadPayload: loadPayload,
    /* Bộ dựng file Excel dùng chung — xem mục 8 */
    xlSheet: xlSheet,
    xlInfoSheet: xlInfoSheet,
    xlSave: xlSave,
    xlNum: xlNum,
    xlDateSerial: xlDateSerial,
    xlStamp: xlStamp,
    xlNow: xlNow
  };

})();
