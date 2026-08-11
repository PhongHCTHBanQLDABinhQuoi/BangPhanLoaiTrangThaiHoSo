# CLAUDE.md — Bảng Đánh Giá KPI Hồ Sơ Pháp Lý (Bình Quới – Thanh Đa)

> File này được Claude Code tự nạp mỗi session. Đọc file này là hiểu toàn bộ dự án, không cần đọc lại 4.100 dòng code.

---

## 1. Dự án này là gì?

**Executive BI Dashboard 1 trang (SPA)** theo dõi & đánh giá KPI tiến độ xử lý **hồ sơ bồi thường – giải phóng mặt bằng** cho Dự án Khu đô thị mới **Bình Quới – Thanh Đa**, của **Ban QLDA ĐTXD phường Bình Quới**.

- **Nguồn dữ liệu duy nhất:** Base Workflow (`workflow.base.vn`), workflow ID `16526` — quy trình 8 giai đoạn bồi thường.
- **Quy mô hiện tại:** ~2.225 hồ sơ, 40 cột dữ liệu, 3 tổ nghiệp vụ, ~80 cán bộ.
- **Người dùng:** Ban Giám đốc + Phòng HCTH + 3 Tổ nghiệp vụ bồi thường. Hiển thị trên **màn hình wallboard 1024×768** và in báo cáo A4 ngang có chữ ký.
- **Không có framework, không có build step.** Vanilla JS + Python stdlib thuần. Mở `index.html` là chạy.

---

## 2. Kiến trúc & luồng dữ liệu

Dự án có **2 chế độ chạy song song**, dùng chung 1 frontend:

```
                        ┌──────────────────────────┐
                        │  Base Workflow ExtAPI    │
                        │  /extapi/v1/workflow/jobs│
                        └────────────┬─────────────┘
                                     │ POST (4 luồng song song, 100 job/trang)
                                     ▼
                        ┌──────────────────────────┐
                        │ server.py build_payload()│
                        │ chuẩn hoá → 40 cột       │
                        └────────────┬─────────────┘
                                     ▼
                        ┌──────────────────────────┐
                        │   cache_payload.json     │  ← "single source of truth" (~2.9 MB)
                        └────┬────────────────┬────┘
              CHẾ ĐỘ A       │                │      CHẾ ĐỘ B
        (LAN nội bộ)         ▼                ▼   (GitHub Pages, tĩnh)
        server.py :8080  /api/data      fetch('cache_payload.json')
        RAM + gzip + SSE                 (không có server)
                        └────────┬───────┘
                                 ▼
                 index.html + js/app.js + css/dovetail.css
                 (localStorage 'kpi_cache_v2' để hiện tức thì)
```

### Chế độ A — Máy chủ nội bộ (LAN)
`start.bat` → `python server.py` → mở `http://localhost:8080` và `http://<LAN-IP>:8080`.
- Nạp `cache_payload.json` vào RAM **trước khi** mở port ⇒ phản hồi < 1ms.
- Nền: tự refresh API mỗi **1800s** (`CACHE_SECONDS`).
- `POST /api/webhook` → Base gọi vào để đồng bộ realtime.
- `GET /api/stream` (SSE) → server đẩy tín hiệu, frontend tự `loadLive()`.
- **Single-flight lock**: 100 người bấm "Đồng bộ" cùng lúc chỉ tạo **1** lần gọi API, phần còn lại chờ kết quả gộp.

### Chế độ B — GitHub Pages (tĩnh, không server)
`.github/workflows/sync_base.yml` chạy **cron `*/30 * * * *`**, gọi `python server.py --sync`, ghi lại `cache_payload.json` rồi tự commit `⚡ Tự động đồng bộ dữ liệu Base Workflow [skip ci]`.
Frontend `fetch('/api/data')` thất bại → **tự fallback** sang `fetch('cache_payload.json')`.
⇒ Trên Pages: **không có** SSE, webhook, nút force-sync (nút vẫn hiện nhưng chỉ nạp lại file tĩnh).

**Hệ quả quan trọng:** mọi commit của GitHub Actions đều thay đổi `cache_payload.json`. Khi làm việc với git, file này gần như **luôn dirty** — đừng nhầm đó là thay đổi của mình. `git status` đầu session thường thấy `M cache_payload.json`.

---

## 3. Bản đồ file

| File | Dòng | Vai trò |
|---|---:|---|
| `server.py` | ~670 | Backend: gọi Base API, chuẩn hoá dữ liệu, HTTP server, cache RAM/đĩa/gzip, SSE, webhook, route `/bangbaocao`. Có mode CLI `--sync`/`--once`. |
| `index.html` | ~344 | Dashboard: khung 6 tab + modal chi tiết + **template in báo cáo** (`#printReportWrapper`). Chỉ là skeleton, mọi nội dung do JS bơm vào. |
| **`js/report-engine.js`** | ~420 | ⭐ **LÕI NGHIỆP VỤ DÙNG CHUNG** cho cả 2 trang: `TEAM_MAP`/`resolveTeam`/`enrichTeam`, `normGCN`, **`TREE_SPEC`** (cây phân loại pháp lý), `classifyRows()`, `loadPayload()`. **Nguồn sự thật duy nhất** — sửa ở đây là sửa cho cả dashboard lẫn trang báo cáo. |
| `js/app.js` | ~1.400 | Logic riêng của dashboard: filter engine, 13 hàm render, KPI tháng, export Excel, print. Gọi lõi qua `RE.*`. |
| `report-table.html` | ~150 | **Trang `/bangbaocao`** — bảng WEB tra cứu phân loại pháp lý, 2 chế độ xem. Xem mục 7. |
| `js/report-table.js` | ~570 | Logic trang tra cứu. **`CATALOG_COLUMNS` + `RECORD_COLUMNS` ở đầu file = nơi thêm cột mới.** |
| `css/report-table.css` | ~180 | Chỉ phần RIÊNG của trang tra cứu (dòng bấm được, tag danh mục, sticky header). Nền tảng dùng chung `dovetail.css`. |
| `css/dovetail.css` | 1.482 | Design system Dovetail (dark) + layout wallboard + **print engine A4 landscape** + responsive 1024×768. Dùng cho **cả 2 trang**. |
| `.claude/launch.json` | — | Cấu hình để Claude Code / IDE tự khởi động server (`python server.py`, port 8080). |
| `cache_payload.json` | — | Snapshot dữ liệu (~2,9 MB, 2.225 hồ sơ). Do Actions tự cập nhật. |
| `DESIGN.md` | — | Spec design system Dovetail gốc (token màu, typography, do/don't). Tham chiếu khi thêm UI mới. |
| `HUONG-DAN.txt` | — | Hướng dẫn cho **người dùng cuối** (không phải dev): cách bấm start.bat, mở firewall, đổi port. |
| `libs/` | — | Chart.js 4.4.1 + chartjs-plugin-datalabels 2.2.0 + SheetJS 0.18.5, **đóng gói offline**, có fallback CDN trong `<head>`. |
| `start.bat` | — | Double-click để chạy server (tự dò `py` rồi `python`). |

Không có `package.json`, `requirements.txt`, test, linter. Python **stdlib thuần** (`urllib`, `http.server`, `gzip`, `ThreadPoolExecutor`).

**Thứ tự nạp script bắt buộc:** `js/report-engine.js` phải nạp **TRƯỚC** `js/app.js` và `js/report-table.js` (cả hai đọc `window.ReportEngine` ngay ở dòng đầu).

### Hai trang HTML
| Trang | URL | Dùng chung | Riêng |
|---|---|---|---|
| Dashboard KPI | `/` | `report-engine.js`, `dovetail.css` | `app.js`, Chart.js |
| Bảng tra cứu pháp lý | `/bangbaocao` | `report-engine.js`, `dovetail.css` | `report-table.js`, `report-table.css` |

Đi qua lại giữa 2 trang: nút **📄 Bảng Báo Cáo** trên topbar dashboard, và nút **‹ Dashboard** trên topbar trang tra cứu.

---

## 4. Schema dữ liệu — 40 cột

`cache_payload.json` = `{ headers: string[40], rows: string[][], meta: {...} }`. **Mọi ô đều là string.**

**17 cột cố định** (`FIXED_HEADERS_DISPLAY` trong `server.py:46`):

| # | Cột | Ghi chú |
|--:|---|---|
| 0 | Job ID | |
| 1 | Tên nhiệm vụ | Format `<STT>/KP<17\|18\|19>/BQLDA<tên hộ dân>` → **dùng để suy ra Tổ** |
| 2 | Giai đoạn | 1 trong 8 giai đoạn (+ `Failed`) |
| 3 | Trạng thái | `active` / `done` / `finished` |
| 4 | Người phụ trách | username Base, vd `phucvt` |
| 5–6 | Ngày tạo / Cập nhật lần cuối | `dd/mm/yyyy HH:MM` |
| 7 | Người tạo | |
| 8–9 | Deadline giai đoạn / Bắt đầu giai đoạn | |
| 10 | % Checklist | vd `67%` |
| 11 | Số GĐ đã qua | |
| 12–13 | Người theo dõi / Nhãn | |
| 14 | **Trạng thái SLA** | `Đúng hạn` \| `Sắp đến hạn` \| `Trễ N ngày` |
| 15 | Link Base Workflow | |
| 16 | **Lịch sử chuyển bước** | **JSON string** — xem mục 5.3 |

**23 cột custom field** (tự sinh từ form Base, thứ tự theo lần gặp đầu tiên — **có thể đổi nếu Base thêm field**):

`17` NHÓM VỀ HIỆN TRẠNG · `18` NHÓM CÓ GCN/KHÔNG CÓ GCN · `19` NHÓM PHÁP LÝ TẶNG, CHO, CHUYỂN NHƯỢNG · `20` NHÓM TÁCH THỬA/ KHÔNG TÁCH THỬA · `21` NHÓM CÁC VƯỚNG MẮC/ KHÓ KHĂN · `22–27` Số nhà, Tên đường, Khu phố, Phường, Số tờ, Số thửa · `28` Thông báo thu hồi đất · `29` Loại đất · `30–31` Một phần (m2), Toàn phần (m2) · `32–36` Nhóm 1 ĐIỀU TRA XÁC MINH KIỂM ĐẾM, Nhóm 2 PHÁP LÝ, Nhóm 3 TÀI SẢN, Nhóm 4 Người dân, Nhóm 5 ĐO ĐẠC · `37` Ngày kiểm điếm · `38` Nhóm vấn đề cần giải quyết · `39` Loại hồ sơ

**+1 cột do frontend tự thêm:** `Tổ/Phòng` (index 40) — xem 5.1.

### 8 giai đoạn quy trình (`meta.stage_map`)
1. Ban Hành TB Thu Hồi Đất · 2. Xác Minh, Kiểm Đếm · 3. Số Hóa, Hồ Sơ, Pháp Lý · 4. Kiểm Tra Bản Vẽ · 5. Nhận Định Hồ Sơ Pháp Lý · 6. Tổ Pháp Chế Kiểm Tra Nhận Định · 7. Chuyển phòng KTHT nhận định · 8. Phòng KTHTĐT đã có ý kiến (+ `Failed`)

### `meta`
`count`, `total_reported`, `active_count`, `done_count`, `overdue_count`, `stage_map`, `updated` (giờ VN), `source`.

**⚠️ Cách truy cột trong app.js:** không hardcode index — dùng `ci('từ khoá')` (tìm header chứa keyword, lowercase) hoặc `headers.indexOf(TEAM_COL)`. Ví dụ: `ci('trạng thái sla')`, `ci('gcn')`, `ci('giai đoạn')`, `ci('pháp lý tặng')`.

---

## 5. Logic nghiệp vụ cốt lõi (phần dễ sai nhất — đọc kỹ)

### 5.1 Suy ra Tổ/Phòng — `resolveTeam()` (`app.js:38`)
Base **không có** field Tổ. Frontend tự suy theo thứ tự ưu tiên:
1. **Mã khu phố trong Tên nhiệm vụ** (ưu tiên cao nhất): `KP17` → **Tổ NV BT 1**, `KP18` → **Tổ NV BT 2**, `KP19` → **Tổ NV BT 3**.
2. Tra `TEAM_MAP` (`app.js:18`) — bảng hardcode **~80 username → tổ** — theo *Người phụ trách*.
3. Rồi theo *Người tạo*.
4. Fallback cuối: **Tổ NV BT 1** (`TEAM_OTHER`).

> Cán bộ mới vào phải **thêm username vào `TEAM_MAP`**, nếu không sẽ bị gom sai vào Tổ 1.

### 5.2 Chuẩn hoá GCN — `normGCN()` (`app.js:185`)
Dữ liệu Base nhập tay không đồng nhất, nên gom về 3 nhóm: chứa `KHÔNG`/`CHƯA` → **KHÔNG CÓ GCN**; chứa `CÓ GCN`/`CÓ` → **CÓ GCN**; còn lại → **CHƯA XÁC ĐỊNH**. Thứ tự kiểm tra `KHÔNG` **trước** `CÓ` là bắt buộc (vì "KHÔNG CÓ GCN" chứa cả hai).
Cột GCN được **filter strict bằng `normGCN`**, khác mọi cột khác (so sánh `===` lowercase).

### 5.3 `Lịch sử chuyển bước` — JSON string, khoá viết tắt
`server.py:219` nén mỗi bước thành: `u` (username), `s` (stage_id), `st` (stage_start, unix), `et` (stage_end), `p` (past 0/1), `d` (duration, **giây**).
Frontend `JSON.parse` cột này ở **4 chỗ**: month picker, `renderStageBottlenecks`, `renderMonthlyKPI`, modal timeline. Luôn bọc `try/catch`.
Đổi ngày: `d / 86400`. Gom theo tháng: `new Date(st*1000)` → key `YYYY-MM`.

### 5.4 SLA (tính ở **backend**, `server.py:233`)
So `stage_deadline` với thời điểm build. Chỉ áp dụng cho hồ sơ **chưa** `done`/`finished`.
- quá hạn → `Trễ N ngày` (`N = floor((now-deadline)/86400) + 1`) → tăng `overdue_count`
- còn < 2 ngày → `Sắp đến hạn`
- còn lại → `Đúng hạn`

⚠️ SLA là **snapshot tại lúc sync**, không tính lại ở client. Frontend nhận diện trễ hạn bằng `.startsWith('Trễ')`.

### 5.5 Cây phân loại pháp lý — `TREE_SPEC` (`report-engine.js`, ~140 dòng)
Đây là **tài sản nghiệp vụ quan trọng nhất**: cây 4 cấp, 6 mục La Mã (I–VI), phản chiếu đúng biểu mẫu báo cáo giấy của cơ quan.

- **Trục phân loại:** Hiện trạng (Nông nghiệp / Đất ở / Nhà trên đất NN / Nhà trên đất ở / HTX giao khoán / Cơ quan tổ chức) × **Có/Chưa GCN** × **Tặng cho–chuyển nhượng giấy tay trước/sau 01/7/2014** × **Có/Không tách thửa**.
- Mốc **01/7/2014** là mốc pháp lý Luật Đất đai — quyết định đủ/không đủ điều kiện bồi thường.
- Thuật toán (`classifyRows()`): mỗi hồ sơ duyệt qua `leafNodes` (node có hàm `match`), **lấy match ĐẦU TIÊN** rồi **cộng dồn ngược lên cha** qua `parentMap` ⇒ cấp cha tự có tổng.
- Có **fallback heuristic** cho hồ sơ không khớp leaf nào — gán vào nhánh "CÓ TÁCH THỬA" gần nhất để **không mất hồ sơ** khỏi tổng.
- `classifyRows()` trả về **`nodeRows` = danh sách CHỈ SỐ DÒNG** của từng node (không phải con số đếm sẵn) ⇒ trang gọi có thể đếm theo **bất kỳ điều kiện nào**. Đây là lý do thêm cột mới ở trang `/bangbaocao` rất dễ.
- Trên dashboard, kết quả bơm vào **cả 2** `tbody`: `#legalHierarchyTable` (màn hình) và `#printHierarchyTable` (bản in) — cùng 1 chuỗi HTML.
- Cột: TỔNG CỘNG + 3 tổ (KP17/KP18/KP19), có % ở cấp 1–2 và dòng TỔNG CỘNG.
- **Số liệu thực tế đã kiểm (10/08/2026, dữ liệu live 2.224 hồ sơ):** 2.220 hồ sơ vào được cây — **4 hồ sơ bị loại** vì cột *NHÓM VỀ HIỆN TRẠNG* trống/không nhận diện được. Dashboard **im lặng** bỏ 4 hồ sơ này; trang `/bangbaocao` **có cảnh báo** số lượng ở thanh trạng thái. (Con số tổng thay đổi từng lần sync — đừng coi là hằng số.)

### 5.6 KPI cán bộ theo tháng — `renderMonthlyKPI()` (`app.js:1252`)
Gom theo *Người phụ trách*, đếm **số lượt chuyển bước** có `st` rơi vào tháng đã chọn.
- Điểm: `score = monthMoves * 10 - monthOverdue * 15`
- Xếp loại: `score >= 50` → 🏆 **Xuất Sắc** · `score < 0` → 🚨 **Cần Đôn Đốc** · còn lại → 🟢 **Hoàn Thành**
- Tỷ lệ đúng hạn: `(monthMoves - monthOverdue) / monthMoves`
- Thời gian xử lý TB: `durSum / durCount / 86400` ngày

### 5.7 Ma trận rủi ro pháp lý — `renderLegalRiskTable()` (`app.js:887`)
4 tier: **Tier 1** Không GCN + chuyển nhượng **sau** 01/7/2014 (❌ không đủ ĐK) · **Tier 2** Không GCN, còn lại (⚠️ cần thẩm tra) · **Tier 3** Có GCN (✅ đủ ĐK) · **Tier 4** đang rà soát.

### 5.8 Bottleneck giai đoạn — `renderStageBottlenecks()` (`app.js:841`)
Cảnh báo theo tỷ lệ trễ: `≥30%` 🚨 Nghiêm Trọng · `10–30%` ⚠️ Cần Đôn Đốc · `<10%` 🟢 An Toàn.

---

## 6. Giao diện — 6 tab

| Tab | Nội dung | Hàm render chính |
|---|---|---|
| **1. Tổng Quan KPI** | **Wallboard 1 màn hình, không scroll** — 5 KPI tile + grid 3 cột (28%/44%/28%): donut SLA & GCN · bar 8 giai đoạn & 3 tổ · nhận xét tự động + funnel bấm-để-lọc | `renderKPI`, `renderOverviewCharts`, `renderInsights`, `renderFunnel` |
| **2. Đánh Giá KPI Cán Bộ Theo Tháng** | Chọn tháng → 4 hero stat + bar Top 10 + bảng ma trận đánh giá cán bộ | `renderMonthlyKPI` |
| **3. Pháp Lý & Hiện Trạng** | 3 donut + pivot SLA×Giai đoạn + **bảng cây phân loại pháp lý** + bảng 4 tier rủi ro | `renderDonuts`, `renderStageCross`, `renderLegalReport`, `renderLegalRiskTable` |
| **4. Khối Lượng Theo Tổ** | Bar ngang theo Tổ + Top 15 cán bộ | `renderDeep` |
| **5. Tiến Độ & Trễ Hạn** | Bảng bottleneck 8 giai đoạn + danh sách 30 hồ sơ trễ cần đôn đốc | `renderStageBottlenecks`, `renderSLATable` |
| **6. Danh Sách Chi Tiết** | Bảng đầy đủ: search bỏ dấu (multi-token AND), sort mọi cột (số/chuỗi/STT), phân trang 20 dòng, click mở modal | `renderTable`, `window.openDetail` |

### Cơ chế chung
- **`render()`** (`app.js:391`) = orchestrator: destroy hết chart cũ → gọi **13 hàm render** trong `try/catch` riêng ⇒ 1 hàm lỗi không làm chết cả trang. Xem lỗi ở Console.
- **Filter bar** (`buildFilterBar`) tự sinh 9 dropdown: Giai đoạn, Tổ/Phòng, Trạng thái, Trạng thái SLA, Người phụ trách, Hiện trạng, GCN, Pháp lý tặng cho, Tách thửa. Mọi filter là **AND**, chia sẻ **1 state `filters` toàn cục** cho cả 6 tab.
- **Quick filter:** 🔴 Chỉ xem Trễ Hạn SLA · ⚠️ Chỉ xem Không GCN · 🔄 Xóa toàn bộ lọc.
- **In báo cáo** (`#btnPrint`): xoá `document.title` (bỏ header trình duyệt), chèn timestamp, `window.print()`. CSS `@media print` ẩn toàn bộ UI, chỉ hiện `#printReportWrapper` — **A4 landscape**, Times New Roman 11pt, có 3 ô chữ ký (Người lập / Phụ trách phòng / Giám đốc).
- **Export Excel** (SheetJS): xuất **đúng tập đang lọc**, bỏ cột `Lịch sử chuyển bước`, tên file `BaoCao_KPI_BinhQuoiThanhDa_<YYYY-MM-DD>.xlsx`.
- **Auto-refresh đã bị TẮT có chủ ý** — `setAuto()` (`app.js:1566`) là no-op. Chỉ cập nhật khi bấm nút hoặc nhận SSE.

### Design system
Theo `DESIGN.md` — **Dovetail dark**: canvas `#0a0a0a` → section `#141414` → card `#1e1e1e` → viền `#313131`. Accent **duy nhất** `#6798ff` (cornflower). Font Inter + JetBrains Mono (số liệu, eyebrow). **Radius 8px, không dùng shadow/gradient** — phân tầng bằng tone. Responsive breakpoint quan trọng: `@media (max-width:1024px), (max-height:768px)` (`dovetail.css:1348`) — tối ưu riêng cho màn hình wallboard.

---

## 7. Trang `/bangbaocao` — bảng WEB tra cứu phân loại pháp lý

Trang riêng, độc lập với dashboard, để **tra cứu và liệt kê hồ sơ** theo danh mục pháp lý. Truy cập: `/bangbaocao` (có server) hoặc `/report-table.html` (GitHub Pages).

### Hai chế độ xem (2 tab)

**Tab 1 — 📚 Danh Mục Phân Loại**
**76 danh mục** của `TREE_SPEC` (cấp I–VI, thụt lề 4 cấp) + 1 dòng TỔNG CỘNG. Cột: danh mục → **Trường hợp** → TỔNG CỘNG → 3 Tổ → nút Hồ sơ. Có % ở cấp 1–2. Mỗi danh mục **có hồ sơ** hiện nút `Xem N hồ sơ ›` — bấm là **nhảy sang Tab 2, lọc đúng danh mục đó** (kể cả toàn bộ danh mục con). Có checkbox *Ẩn danh mục không có hồ sơ* (76 → 52 danh mục với dữ liệu hiện tại).

### Cột "Trường hợp" — đánh số TH tự động
Nằm **ngay kế bên cột danh mục**. Không lấy từ dữ liệu Base, **tự sinh từ cấu trúc cây**:

> Đi từ mục lớn xuống dần. Mục nào **KHÔNG còn mục con** thì chính mục đó là **một trường hợp** → đánh `TH1`, `TH2`, `TH3`… tuần tự theo thứ tự bảng. Mục nào **còn mục con** thì chỉ là tiêu đề nhóm → **để trống**.

Cây hiện tại ⇒ **47 trường hợp / 76 dòng** (29 dòng là tiêu đề nhóm). Vài mốc để đối chiếu:

| Dòng | Trường hợp |
|---|---|
| `I` → `1. CÓ GCN` (còn mục con) | *(trống)* |
| `I.1.a` a) KHÔNG TẶNG CHO CHUYỂN NHƯỢNG | **TH1** |
| `I.1.b.1` / `I.1.b.2` | **TH2** / **TH3** |
| `V.` ĐẤT HỢP TÁC XÃ GIAO KHOÁN — **mục lớn nhưng không có mục con** | **TH45** |
| `VI.1` / `VI.2` | **TH46** / **TH47** |

Cấu hình trong `js/report-table.js`:
- `CASE_AUTO` — IIFE tự tính, node nào không xuất hiện trong `parentMap` với vai trò cha thì là lá ⇒ được số. **Thêm/bớt nhánh trong `TREE_SPEC` thì số TH tự đánh lại**, không phải sửa gì.
- `CASE_PREFIX` — mặc định `'TH'`; đổi thành `'Trường hợp '` nếu muốn ghi đầy đủ.
- `CASE_OVERRIDE` — ghi đè thủ công cho riêng vài dòng, khoá là mã danh mục. Mặc định rỗng. **Gõ sai mã thì ô im lặng trống, không báo lỗi.**
- `CASE_HEADER`, `CASE_WIDTH` — tiêu đề & độ rộng cột.
- `caseLabelOf(nodeId)` = `OVERRIDE || AUTO || ''`.

Cột này **tự động có trong bản in A4 và file Excel xuất ra**.

### 7.1 Nhóm trường hợp (Tab 3)

Cấu hình ở mảng **`GROUP_SPEC`** trong `js/report-table.js` — chỉ cần liệt kê **số TH**, hệ thống tự quy ra mã danh mục rồi cộng hồ sơ:

```js
{ key:'n2', title:'Nhóm 2',
  desc:'Chưa cấp GCN + tặng cho, chuyển nhượng giấy tay SAU 01/7/2014',
  th: [9, 10, 19, 20, 31, 32, 43, 44],
  rule: f => f.mucChinh && f.chuaGCN && f.sau && !f.khongTang }
```

Phân nhóm hiện tại (chốt 10/08/2026):

| Nhóm | Số TH | Trường hợp | Quy luật |
|---|--:|---|---|
| **Nhóm 1** | 20 | 1, 6, 7, 8, 11, 16, 17, 18, 21, 22, 27, 28, 29, 30, 33, 34, 39, 40, 41, 42 | Không tặng cho chuyển nhượng (mọi hiện trạng) **+** tặng cho giấy tay **TRƯỚC** 01/7/2014 mà **chưa** cấp GCN |
| **Nhóm 2** | 8 | 9, 10, 19, 20, 31, 32, **43, 44** | **Chưa** cấp GCN **+** tặng cho, chuyển nhượng giấy tay **SAU** 01/7/2014 |
| **Nhóm 3** | 16 | 2, 3, 4, 5, 12, 13, 14, 15, 23, 24, 25, 26, 35, 36, 37, 38 | **Đã có** GCN **+** tặng cho, chuyển nhượng giấy tay (cả trước và sau) |
| *Nhóm khác (để riêng)* | 3 | 45, 46, 47 | Mục **V** (đất HTX giao khoán) và **VI** (đất cơ quan tổ chức) — chờ xếp nhóm sau |

**Tự kiểm tra phân nhóm (`auditNhom()` + `thFlags()`).** Mỗi nhóm khai báo thêm `rule(f)`; hệ thống đọc **tiêu đề trên đường dẫn** của từng TH để suy ra đặc điểm pháp lý (`mucChinh`, `khongTang`, `chuaGCN`, `coGCN`, `truoc`, `sau`) rồi đối chiếu:
- TH thoả `rule` mà **chưa** được liệt kê → báo *"còn thiếu"*
- TH được liệt kê mà **không** thoả `rule` → báo *"không khớp quy luật"*
- TH nằm ở 2 nhóm, hoặc TH không tồn tại → báo trùng/sai

Kết quả hiện lên đầu Tab 3 (đỏ = lỗi, xanh dương = thông tin, xanh lá = đã kiểm sạch). **Không cần dò tay khi `TREE_SPEC` thay đổi.** Nhờ cơ chế này mà phát hiện được TH43/TH44 bị bỏ sót khỏi Nhóm 2 lúc đầu.

**Bất biến đã kiểm:** tổng hồ sơ 4 nhóm = tổng hồ sơ trong cây, từng Tổ cũng khớp, **không hồ sơ nào bị đếm 2 lần** (các node của nhóm đều là lá nên rời nhau). Xuất Excel ở Tab 3 ra **2 sheet**: `TongHopNhom` + `ChiTietTruongHop`.

**Tab 2 — 📋 Liệt Kê Theo Hồ Sơ**
Bảng chi tiết từng hồ sơ: tên hộ dân (link mở Base ↗), Tổ, cán bộ, giai đoạn, SLA (badge tự tô màu), hiện trạng, GCN, pháp lý, tách thửa, số tờ, số thửa, khu phố, và **mã danh mục pháp lý** đã được phân loại (hover xem đường dẫn đầy đủ). Sort mọi cột (ô trống luôn xuống cuối), phân trang 50/100/200/tất cả.

**Tab 3 — 🗂️ Liệt Kê Theo Nhóm**
Gom 47 trường hợp thành **Nhóm 1 / 2 / 3** (+ nhóm phụ *Nhóm khác (để riêng)* cho TH chưa xếp). Gồm bảng tổng hợp nhóm (số TH + hồ sơ + 3 Tổ + %) và bảng chi tiết từng TH trong mỗi nhóm kèm **đường dẫn danh mục đầy đủ**. Bấm `Xem N hồ sơ ›` ở cấp nhóm hoặc cấp từng TH → nhảy sang Tab 2 đã lọc. Xem mục 7.1.

### Cơ chế lọc — một tập dữ liệu, ba bảng
Mọi bộ lọc (ô tìm kiếm + Tổ + SLA + Giai đoạn + danh mục/nhóm đang drill) dồn về **một tập chỉ số dòng duy nhất** (`computeVisible()`), rồi **cả 3 bảng đều render từ tập đó**. Nghĩa là gõ tìm kiếm thì **số trong bảng danh mục và bảng nhóm cũng đổi theo** — số liệu 3 tab luôn khớp nhau. Ưu tiên gốc lọc: `fNhom` > `fNode` > toàn bộ.

- Ô tìm kiếm: **không cần gõ dấu**, nhiều từ khoá = AND, quét **toàn bộ 41 cột** (tìm được cả Job ID, số tờ, số thửa, tên hộ dân, username cán bộ…).
- Filter SLA gộp mọi biến thể `Trễ N ngày` thành một lựa chọn **Trễ**.
- Nút `🖨️ In Bảng Danh Mục` in Tab 1 ra **A4 ngang có 3 ô chữ ký** (dùng lại `@media print` của `dovetail.css`, tự bỏ cột nút bấm).
- Nút `⬇️ Xuất Excel` xuất **đúng tab đang xem** (danh mục hoặc danh sách hồ sơ đang lọc).

### ⭐ Thêm cột mới — mở `js/report-table.js`, sửa ở đầu file

Hai mảng cấu hình, mỗi mảng có sẵn **ví dụ comment** bên trên để copy:

| Mảng | Dùng cho | Cách thêm |
|---|---|---|
| `CATALOG_COLUMNS` | cột số ở Tab 1 | thêm 1 object `{ key, title, width, pct, match }`. `match: r => điều_kiện` quyết định hồ sơ nào được đếm; `match: null` = đếm tất cả. |
| `RECORD_COLUMNS` | cột ở Tab 2 | thêm 1 object `{ title, col, width, kind }`. `col` là tên trong `C.*`. |

Trong `match` dùng `r[C.<tên>]` để lấy giá trị ô — bảng `C` được dò **theo tên header** (hàm `buildColIndex`) nên không vỡ khi Base đổi thứ tự cột. Cần cột Base chưa có trong `C` thì thêm 1 dòng vào `buildColIndex`.

Ví dụ thêm cột "đếm hồ sơ trễ hạn trong từng danh mục pháp lý":
```js
{ key:'tre', title:'Trễ hạn SLA', width:'105px', pct:'row',
  match: r => r[C.sla].startsWith('Trễ') },
```

`kind` của `RECORD_COLUMNS`: bỏ trống = chữ thường · `'name'` = in đậm + link Base · `'badge'` = viên nhãn · `'sla'` = tự tô màu theo trạng thái · `'num'` = canh giữa font mono · `'node'` = mã danh mục (cột tính toán, không lấy từ dữ liệu).

**Sao thêm cột dễ:** `classifyRows()` trả về `nodeRows` = **danh sách chỉ số dòng** của từng danh mục, không phải con số đếm sẵn ⇒ đếm lại theo bất kỳ điều kiện nào cũng được, không phải sửa engine.

---

## 8. Lệnh thường dùng

```bash
python server.py
```

```bash
python server.py --sync
```

```bash
git pull --rebase
```

- `python server.py` → server LAN cổng **8080** (đổi `PORT` ở `server.py:42`). Hoặc double-click `start.bat`.
- `python server.py --sync` → chỉ đồng bộ & ghi `cache_payload.json` rồi thoát (đúng lệnh Actions dùng).
- `git pull --rebase` → **luôn pull trước khi làm việc**, vì Actions commit mỗi 30 phút.
- Chạy tay Actions: tab **Actions** trên GitHub → *Tự động đồng bộ dữ liệu Base Workflow* → **Run workflow**.

---

## 9. Cạm bẫy & nợ kỹ thuật đã biết

**Bảo mật — cần xử lý:**
1. 🔴 **`ACCESS_TOKEN_V2` hardcode ở `server.py:37` và đã commit vào repo GitHub.** Nếu repo là public thì token đang bị lộ. Nên chuyển sang GitHub Secret + `os.environ` và **revoke token cũ** trên Base. `HUONG-DAN.txt` mục 7 cũng dặn không gửi `server.py` ra ngoài.

**Bug/nợ đã xác nhận khi đọc code:**
2. **Modal timeline luôn hiện chữ "Bước"** thay vì tên giai đoạn — `app.js` đọc `m.sn`, nhưng `server.py:219` **không** ghi khoá `sn` (chỉ có `u,s,st,et,p,d`). Muốn sửa: map `m.s` → `stageMap[m.s]`. Biến `stageMap` đã được nạp nhưng **hiện chưa dùng ở đâu cả**.
3. **`renderNote()` bị định nghĩa 2 lần** trong `app.js`. Bản sau thắng ⇒ bản đầu (hiện chip filter + nút bỏ lọc) là **code chết**.
4. **`server.py` trùng định nghĩa**: `_cache` (dòng 64 & 300), `load_disk_cache` (68 & 345), `save_disk_cache` (81 & 358). Bản sau thắng — bản đầu là dư thừa, sửa nhớ sửa **bản dòng 300+**.
5. **`renderLegalRiskTable` so sánh chuỗi thô** (`r[gcnIdx] === 'KHÔNG CÓ GCN'`) thay vì `normGCN()` ⇒ có thể đếm thiếu khi Base nhập biến thể khác. Các chỗ khác đều đã dùng `normGCN`.
6. `filteredRows()` chạy **O(rows × filters)** mỗi lần render, và `render()` dựng lại **toàn bộ 13 khối + mọi chart**. Với 2.225 dòng vẫn ổn; nếu vượt ~10.000 dòng sẽ thấy lag.
7. `rows.indexOf(r)` trong `renderTable`/`renderSLATable` là **O(n)** mỗi dòng để lấy index cho modal.

**Lưu ý vận hành:**
8. Thứ tự **23 cột custom** phụ thuộc thứ tự gặp field trong dữ liệu Base ⇒ **đừng bao giờ hardcode index cột**, luôn dùng `ci()`.
9. `cache_payload.json` gần như luôn `M` trong `git status` do Actions. Đừng commit đè mà không pull.
10. Trên GitHub Pages: SSE + webhook + force-sync **không hoạt động**; dữ liệu trễ tối đa 30 phút.
11. `localStorage['kpi_cache_v2']` giữ payload để hiện tức thì. Nếu người dùng báo "số liệu cũ" → **hard reload** (Ctrl+Shift+R) hoặc clear localStorage.
12. Tab 1 dùng `height: calc(100vh - 165px); overflow: hidden` — thêm phần tử vào tab này sẽ **bị cắt**, không tự scroll. Đây là chủ ý (wallboard 1 màn hình).

---

## 10. Quy ước khi sửa code

- **Toàn bộ text UI, comment, commit message: tiếng Việt.** Tên biến/hàm: tiếng Anh.
- Không thêm framework, không thêm build step, không thêm dependency ngoài. Giữ nguyên triết lý **zero-build, chạy bằng double-click**.
- Thêm thư viện mới → tải vào `libs/`, khai báo trong `LIB_SOURCES` (`server.py:54`) **và** thêm fallback CDN `document.write` trong `<head>`.
- **Logic nghiệp vụ dùng chung phải để ở `js/report-engine.js`**, không copy sang `app.js` hay `report-table.js`. Engine không được khai báo biến toàn cục nào ngoài `window.ReportEngine` (nếu không sẽ đụng `const` của `app.js` → SyntaxError cả trang). **Thêm hàm mới vào engine thì nhớ thêm vào khối `return {...}` ở cuối** — quên là trang gọi sẽ ném `TypeError: RE.xxx is not a function` và mọi thứ phía sau đứng im.
- Thêm khối render mới trên dashboard → viết hàm `renderXxx(data)` rồi thêm 1 dòng `try{...}catch{}` vào `render()` trong `app.js`.
- Thêm cột vào trang tra cứu → chỉ sửa `CATALOG_COLUMNS` / `RECORD_COLUMNS` trong `js/report-table.js`, **không** sửa engine.
- Màu sắc/khoảng cách: dùng CSS variable của Dovetail, **đừng hardcode hex mới**. Đọc `DESIGN.md` phần *Do's and Don'ts* trước khi thêm UI.
- Sửa cây phân loại pháp lý → chỉ sửa `TREE_SPEC`; nhớ **bản in dùng chung dữ liệu**, phải kiểm tra cả Print Preview.
- Thay đổi cấu trúc payload ở `server.py` → phải chạy `python server.py --sync` và kiểm tra lại cả 6 tab, vì frontend dò cột theo tên header.

---

## 11. Bối cảnh

- Repo: `PhongHCTHBanQLDABinhQuoi/BangPhanLoaiTrangThaiHoSo` · nhánh `main` (không có nhánh phụ, deploy trực tiếp).
- Lịch sử commit: 2 commit tính năng gần nhất là **redesign Tab 1 thành wallboard 1 màn hình** và **thêm data label % + tối ưu layout 1024×768**; phần còn lại là commit tự động của Actions.
- Ngoài repo còn có bản Google Apps Script dùng chung token với `server.py` (theo `HUONG-DAN.txt` mục 8) — đổi token phải đổi **cả hai nơi**.
