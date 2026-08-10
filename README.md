# BangPhanLoaiTrangThaiHoSo

Bảng Phân Loại Trạng Thái Hồ Sơ & Executive BI Dashboard - Dự án Bình Quới Thanh Đa.

## Tài liệu

- **[CLAUDE.md](CLAUDE.md)** — Tóm tắt toàn bộ dự án: kiến trúc, luồng dữ liệu, schema 40 cột, logic nghiệp vụ, cạm bẫy đã biết. **Đọc file này trước khi sửa code.**
- [DESIGN.md](DESIGN.md) — Spec design system Dovetail (màu, typography, component).
- [HUONG-DAN.txt](HUONG-DAN.txt) — Hướng dẫn cho người dùng cuối (chạy `start.bat`, mở firewall, đổi port).

## Chạy nhanh

```bash
python server.py
```

Mở `http://localhost:8080` (hoặc double-click `start.bat`). Chỉ đồng bộ dữ liệu không mở server: `python server.py --sync`.

| Trang | Nội dung |
|---|---|
| `/` | Dashboard KPI 6 tab (tổng quan, KPI cán bộ theo tháng, pháp lý, tổ, trễ hạn, danh sách) |
| `/bangbaocao` | Bảng web tra cứu phân loại pháp lý: bấm danh mục để liệt kê hồ sơ, tìm kiếm không cần gõ dấu, in A4 ngang |
