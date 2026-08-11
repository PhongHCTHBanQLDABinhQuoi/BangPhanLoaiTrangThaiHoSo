# -*- coding: utf-8 -*-
"""
=======================================================================
  MÁY CHỦ EXECUTIVE BI DASHBOARD SIÊU TỐC - BÌNH QUỚI THANH ĐA
  (TỐI ƯU HÓA ĐỒNG BỘ ỔN ĐỊNH VÀ BỘ ĐỆM ĐĨA < 1MS)
=======================================================================
"""

import json
import socket
import threading
import time
import urllib.request
import urllib.parse
import os
import sys
import math
import gzip
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone, timedelta
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

if sys.stdout and hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass
if sys.stderr and hasattr(sys.stderr, 'reconfigure'):
    try:
        sys.stderr.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

# ----------------------------------------------------------------------
# CẤU HÌNH
# ----------------------------------------------------------------------
ACCESS_TOKEN_V2 = "11836~YYEkzFCdqh2rl0G2kgDNWFzUlBfzVE2Ynf01bvh0qxm5Ws0q_9o8gaHoKNF_-VNQUE69iQZymyDyEfmzEfr2zgsThCymrAN0d8kEjji4sVe6UWWTJt3eKXgZE5c2w9ojLnuCQPXHWDZPIpVIQe4ORw"
WORKFLOW_ID = "16526"
API_URL = "https://workflow.base.vn/extapi/v1/workflow/jobs"
PAGE_LIMIT = 100

PORT = 8080
CACHE_SECONDS = 1800  # Cập nhật API 30 phút một lần (1800 giây)
VN_TZ = timezone(timedelta(hours=7))

FIXED_HEADERS_DISPLAY = [
    "Job ID", "Tên nhiệm vụ", "Giai đoạn", "Trạng thái",
    "Người phụ trách", "Ngày tạo", "Cập nhật lần cuối",
    "Người tạo", "Deadline giai đoạn", "Bắt đầu giai đoạn",
    "% Checklist", "Số GĐ đã qua", "Người theo dõi", "Nhãn",
    "Trạng thái SLA", "Link Base Workflow", "Lịch sử chuyển bước"
]

LIB_SOURCES = {
    "chart.umd.min.js": "https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js",
    "chartjs-plugin-datalabels.min.js": "https://cdnjs.cloudflare.com/ajax/libs/chartjs-plugin-datalabels/2.2.0/chartjs-plugin-datalabels.min.js",
    "xlsx.full.min.js": "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js",
}

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
LIB_DIR = os.path.join(BASE_DIR, "libs")
CACHE_FILE = os.path.join(BASE_DIR, "cache_payload.json")

_cache = {"ts": 0, "payload": None, "error": None, "is_fetching": False}
_cache_lock = threading.Lock()


def load_disk_cache():
    if os.path.exists(CACHE_FILE):
        try:
            with open(CACHE_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                if data and "headers" in data and "rows" in data and len(data["rows"]) > 0:
                    print("  [disk] Đã nạp %d hồ sơ từ đĩa cache_payload.json" % len(data["rows"]))
                    return data
        except Exception as e:
            print("  [disk] Không nạp được đĩa cache: %s" % e)
    return None


def save_disk_cache(payload):
    if not payload or not payload.get("rows"):
        return
    try:
        with open(CACHE_FILE, "w", encoding="utf-8") as f:
            json.dump(payload, f, ensure_ascii=False)
        print("  [disk] Đã cập nhật đĩa cache_payload.json (%d hồ sơ)" % len(payload["rows"]))
    except Exception as e:
        print("  [disk] Lỗi lưu đĩa cache: %s" % e)


def _post_base(page):
    data = urllib.parse.urlencode({
        "access_token_v2": ACCESS_TOKEN_V2,
        "id": WORKFLOW_ID,
        "page_id": page,
        "limit": PAGE_LIMIT,
    }).encode("utf-8")
    req = urllib.request.Request(
        API_URL, data=data, method="POST",
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    with urllib.request.urlopen(req, timeout=25) as r:
        return json.loads(r.read().decode("utf-8"))


def _extract_custom_fields(job):
    result = {}
    for f in (job.get("form") or []):
        if f.get("type") in ("title", "file", "filebox"):
            continue
        name = f.get("name")
        if not name:
            continue
        v = f.get("value")
        result[name] = v if v is not None else ""
    return result


def _fmt_date(unix_str):
    try:
        if unix_str in (None, "", "0", 0):
            return ""
        dt = datetime.fromtimestamp(int(unix_str), VN_TZ)
        return dt.strftime("%d/%m/%Y %H:%M")
    except Exception:
        return ""


def fetch_all_jobs_parallel():
    """Tải dữ liệu song song an toàn từ Base API"""
    first_page = _post_base(0)
    if first_page.get("code") != 1:
        raise RuntimeError("Base API lỗi trang 0: %s" % json.dumps(first_page)[:200])

    total_items = int(first_page.get("total_items") or 0)
    items_per_page = int(first_page.get("items_per_page") or PAGE_LIMIT)
    all_jobs_dict = {}

    page_0_jobs = first_page.get("jobs") or []
    for idx, jb in enumerate(page_0_jobs):
        all_jobs_dict[idx] = jb

    if total_items > len(page_0_jobs) and items_per_page > 0:
        total_pages = math.ceil(total_items / items_per_page)
        
        def fetch_page_worker(p_id):
            try:
                time.sleep((p_id % 4) * 0.08)
                res = _post_base(p_id)
                if res.get("code") == 1:
                    return p_id, res.get("jobs") or []
            except Exception as e:
                print("  [parallel] Thử lại trang %d: %s" % (p_id, e))
                try:
                    time.sleep(0.5)
                    res = _post_base(p_id)
                    if res.get("code") == 1:
                        return p_id, res.get("jobs") or []
                except Exception:
                    pass
            return p_id, []

        with ThreadPoolExecutor(max_workers=4) as executor:
            future_to_page = {executor.submit(fetch_page_worker, p): p for p in range(1, total_pages)}
            for future in as_completed(future_to_page):
                p_id, jobs = future.result()
                base_idx = p_id * items_per_page
                for idx, jb in enumerate(jobs):
                    all_jobs_dict[base_idx + idx] = jb

    sorted_keys = sorted(all_jobs_dict.keys())
    all_jobs = [all_jobs_dict[k] for k in sorted_keys]
    return all_jobs, total_items


def build_payload():
    start_t = time.time()
    all_jobs, total_reported = fetch_all_jobs_parallel()
    now_ts = time.time()

    custom_names = []
    seen = set()
    for job in all_jobs:
        for name in _extract_custom_fields(job).keys():
            if name not in seen:
                seen.add(name)
                custom_names.append(name)

    headers = FIXED_HEADERS_DISPLAY + custom_names

    rows = []
    overdue_count = 0
    active_count = 0
    done_count = 0
    stage_map = {}

    for job in all_jobs:
        stage = job.get("stage_export") or {}
        if isinstance(stage, dict) and stage.get("id") and stage.get("name"):
            stage_map[str(stage["id"])] = stage["name"]

        state = str(job.get("state", "") or "").lower()
        if state in ("done", "finished"):
            done_count += 1
        else:
            active_count += 1

        # Checklist completion
        todos = job.get("todos") or []
        done_todos = sum(1 for t in todos if str(t.get("status")) == "1")
        total_todos = len(todos)
        checklist_pct = ("%d%%" % round(done_todos / total_todos * 100)) if total_todos else ""

        # Moves history
        moves_raw = job.get("moves") or []
        stages_passed = sum(1 for m in moves_raw if m.get("past"))
        moves_parsed = []
        for m in moves_raw:
            moves_parsed.append({
                "u": m.get("username", "") or m.get("mover_id", ""),
                "s": str(m.get("stage_id", "")),
                "st": m.get("stage_start", 0),
                "et": m.get("stage_end", 0),
                "p": m.get("past", 0),
                "d": m.get("duration", 0)
            })

        # Followers & Tags
        followers_list = [f for f in (job.get("followers") or []) if f and str(f).strip()]
        tags_list = job.get("tags") or []

        # SLA Status Calculation
        stage_dl = job.get("stage_deadline")
        sla_status = "Đúng hạn"
        if stage_dl and str(stage_dl) != "0" and state not in ("done", "finished"):
            try:
                dl_ts = float(stage_dl)
                if dl_ts < now_ts:
                    diff_days = int((now_ts - dl_ts) / 86400) + 1
                    sla_status = "Trễ %d ngày" % diff_days
                    overdue_count += 1
                elif (dl_ts - now_ts) < 2 * 86400:
                    sla_status = "Sắp đến hạn"
            except Exception:
                pass

        job_id = str(job.get("id", ""))
        link_base = "https://workflow.base.vn/job/%s" % job_id if job_id else ""

        fixed = [
            job_id,
            job.get("name", "") or "",
            stage.get("name", "") if isinstance(stage, dict) else "",
            job.get("state", "") or "",
            job.get("username", "") or "",
            _fmt_date(job.get("since")),
            _fmt_date(job.get("last_update")),
            job.get("creator_username", "") or "",
            _fmt_date(stage_dl),
            _fmt_date(job.get("stage_start")),
            checklist_pct,
            str(stages_passed),
            ", ".join(str(f) for f in followers_list),
            ", ".join(str(t) if isinstance(t, str) else json.dumps(t, ensure_ascii=False) for t in tags_list),
            sla_status,
            link_base,
            json.dumps(moves_parsed, ensure_ascii=False)
        ]
        cf = _extract_custom_fields(job)
        custom = []
        for name in custom_names:
            v = cf.get(name, "")
            if v is None:
                v = ""
            if isinstance(v, list):
                v = ", ".join(str(x) for x in v)
            custom.append(v if isinstance(v, str) else str(v))
        rows.append([str(x) if x is not None else "" for x in fixed] + custom)

    elapsed = time.time() - start_t
    print("  [parallel] Đã nạp thành công %d hồ sơ trong %.2f giây" % (len(rows), elapsed))

    return {
        "headers": headers,
        "rows": rows,
        "meta": {
            "count": len(rows),
            "total_reported": total_reported,
            "active_count": active_count,
            "done_count": done_count,
            "overdue_count": overdue_count,
            "stage_map": stage_map,
            "updated": datetime.now(VN_TZ).strftime("%d/%m/%Y %H:%M:%S"),
            "source": "Base Workflow (API Song Song)",
        },
    }


_cache = {"ts": 0, "payload": None, "json_bytes": None, "gzip_bytes": None, "error": None, "is_fetching": False}
_single_flight_event = threading.Event()
_single_flight_event.set()

_sse_clients = []
_sse_lock = threading.Lock()


def broadcast_update():
    with _sse_lock:
        clients = list(_sse_clients)
    if not clients:
        return
    msg = ("data: %s\n\n" % json.dumps({"type": "update", "ts": time.time()})).encode("utf-8")
    dead = []
    for wfile in clients:
        try:
            wfile.write(msg)
            wfile.flush()
        except Exception:
            dead.append(wfile)
    if dead:
        with _sse_lock:
            for d in dead:
                if d in _sse_clients:
                    _sse_clients.remove(d)


def set_cache_payload(payload, err=None):
    if not payload:
        return
    try:
        encoded = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        compressed = gzip.compress(encoded)
        with _cache_lock:
            _cache["payload"] = payload
            _cache["json_bytes"] = encoded
            _cache["gzip_bytes"] = compressed
            _cache["ts"] = time.time()
            _cache["error"] = err
        broadcast_update()
    except Exception as e:
        print("  [cache] Lỗi encode/compress json: %s" % e)


def load_disk_cache():
    if os.path.exists(CACHE_FILE):
        try:
            with open(CACHE_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                if data and "headers" in data and "rows" in data and len(data["rows"]) > 0:
                    print("  [disk] Đã nạp %d hồ sơ từ đĩa cache_payload.json" % len(data["rows"]))
                    return data
        except Exception as e:
            print("  [disk] Không nạp được đĩa cache: %s" % e)
    return None


def save_disk_cache(payload):
    if not payload or not payload.get("rows"):
        return
    try:
        with open(CACHE_FILE, "w", encoding="utf-8") as f:
            json.dump(payload, f, ensure_ascii=False)
        print("  [disk] Đã cập nhật đĩa cache_payload.json (%d hồ sơ)" % len(payload["rows"]))
    except Exception as e:
        print("  [disk] Lỗi lưu đĩa cache: %s" % e)


def refresh_cache_in_background():
    with _cache_lock:
        if _cache["is_fetching"]:
            return
        _cache["is_fetching"] = True
        _single_flight_event.clear()

    try:
        payload = build_payload()
        set_cache_payload(payload)
        save_disk_cache(payload)
    except Exception as e:
        print("  [bg] Lỗi cập nhật API: %s" % e)
        with _cache_lock:
            _cache["error"] = str(e)
    finally:
        with _cache_lock:
            _cache["is_fetching"] = False
        _single_flight_event.set()


def get_cached_payload(force=False):
    """Phản hồi tức thì < 1ms cho GET thường, và gộp nhiều yêu cầu đồng bộ khi 100 người dùng bấm force=True"""
    if force:
        already_fetching = False
        with _cache_lock:
            if _cache["is_fetching"]:
                already_fetching = True

        if already_fetching:
            print("  [SingleFlight] Đang có luồng đồng bộ API đang chạy, cho người dùng chờ kết quả gộp...")
            _single_flight_event.wait(timeout=25)
            with _cache_lock:
                return _cache["payload"], _cache["json_bytes"], _cache["gzip_bytes"], _cache["error"]

        print("  [API] Nhận yêu cầu ÉP ĐỒNG BỘ TRỰC TIẾP từ Base Workflow API...")
        refresh_cache_in_background()
        with _cache_lock:
            return _cache["payload"], _cache["json_bytes"], _cache["gzip_bytes"], _cache["error"]

    with _cache_lock:
        payload = _cache["payload"]
        json_bytes = _cache["json_bytes"]
        gzip_bytes = _cache["gzip_bytes"]
        err = _cache["error"]

    if json_bytes is None:
        disk_p = load_disk_cache()
        if disk_p:
            set_cache_payload(disk_p)
            with _cache_lock:
                return _cache["payload"], _cache["json_bytes"], _cache["gzip_bytes"], None

    return payload, json_bytes, gzip_bytes, err


def _bg_loop():
    while True:
        try:
            time.sleep(CACHE_SECONDS)
            refresh_cache_in_background()
        except Exception:
            pass


def ensure_lib(name):
    path = os.path.join(LIB_DIR, name)
    if os.path.exists(path) and os.path.getsize(path) > 1000:
        return path
    os.makedirs(LIB_DIR, exist_ok=True)
    url = LIB_SOURCES.get(name)
    if not url:
        return None
    try:
        with urllib.request.urlopen(url, timeout=30) as r:
            data = r.read()
        with open(path, "wb") as f:
            f.write(data)
        print("   [libs] Đã tải %s (%d KB)" % (name, len(data) // 1024))
        return path
    except Exception as e:
        print("   [libs] Không tải được %s: %s" % (name, e))
        return None


def prefetch_libs():
    for name in LIB_SOURCES:
        ensure_lib(name)


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def _send(self, code, body, ctype="text/html; charset=utf-8", extra=None):
        if isinstance(body, str):
            body = body.encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Cache-Control", "no-store")
        if extra:
            for k, v in extra.items():
                self.send_header(k, v)
        self.end_headers()
        try:
            self.wfile.write(body)
        except Exception:
            pass

    def do_GET(self):
        path = self.path.split("?", 1)[0]
        accept_encoding = self.headers.get("Accept-Encoding", "")

        if path in ("/", "/index.html"):
            fp = os.path.join(BASE_DIR, "index.html")
            with open(fp, "rb") as f:
                self._send(200, f.read())
            return

        # Trang bảng web tra cứu phân loại pháp lý.
        # Dạng có dấu / ở cuối phải chuyển hướng, nếu không các đường dẫn
        # tương đối (css/, js/, cache_payload.json) sẽ hỏng.
        if path in ("/bangbaocao/", "/report-table/"):
            self.send_response(301)
            self.send_header("Location", "/bangbaocao")
            self.send_header("Content-Length", "0")
            self.end_headers()
            return

        if path in ("/bangbaocao", "/bangbaocao.html", "/report-table", "/report-table.html"):
            fp = os.path.join(BASE_DIR, "report-table.html")
            if os.path.exists(fp):
                with open(fp, "rb") as f:
                    self._send(200, f.read())
            else:
                self._send(404, "Không tìm thấy report-table.html")
            return

        if path == "/api/stream":
            self.send_response(200)
            self.send_header("Content-Type", "text/event-stream")
            self.send_header("Cache-Control", "no-cache")
            self.send_header("Connection", "keep-alive")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            with _sse_lock:
                _sse_clients.append(self.wfile)
            try:
                while True:
                    time.sleep(15)
                    self.wfile.write(b":ping\n\n")
                    self.wfile.flush()
            except Exception:
                with _sse_lock:
                    if self.wfile in _sse_clients:
                        _sse_clients.remove(self.wfile)
            return

        if path == "/api/data":
            force = "force=1" in self.path
            payload, json_bytes, gzip_bytes, err = get_cached_payload(force=force)
            if json_bytes is None:
                self._send(530, json.dumps({"error": "Đang đồng bộ dữ liệu ban đầu từ Base... tự động thử lại sau vài giây"}),
                           ctype="application/json; charset=utf-8")
                return

            if "gzip" in accept_encoding and gzip_bytes is not None:
                self._send(200, gzip_bytes, ctype="application/json; charset=utf-8",
                           extra={"Content-Encoding": "gzip"})
            else:
                self._send(200, json_bytes, ctype="application/json; charset=utf-8")
            return

        if path == "/cache_payload.json":
            fp = os.path.join(BASE_DIR, "cache_payload.json")
            if os.path.exists(fp):
                with open(fp, "rb") as f:
                    self._send(200, f.read(), ctype="application/json; charset=utf-8")
                return

        if path.startswith("/css/"):
            rel_path = path.lstrip("/")
            fp = os.path.join(BASE_DIR, rel_path.replace("/", os.sep))
            if os.path.exists(fp) and os.path.isfile(fp):
                with open(fp, "rb") as f:
                    self._send(200, f.read(), ctype="text/css; charset=utf-8")
                return
            self._send(404, "CSS file not found")
            return

        if path.startswith("/js/"):
            rel_path = path.lstrip("/")
            fp = os.path.join(BASE_DIR, rel_path.replace("/", os.sep))
            if os.path.exists(fp) and os.path.isfile(fp):
                with open(fp, "rb") as f:
                    self._send(200, f.read(), ctype="application/javascript; charset=utf-8")
                return
            self._send(404, "JS file not found")
            return

        if path.startswith("/libs/"):
            name = os.path.basename(path)
            fp = ensure_lib(name)
            if fp and os.path.exists(fp):
                with open(fp, "rb") as f:
                    self._send(200, f.read(), ctype="application/javascript; charset=utf-8",
                               extra={"Cache-Control": "public, max-age=86400"})
            else:
                self._send(404, "// không tải được thư viện: " + name,
                           ctype="application/javascript; charset=utf-8")
            return

        if path == "/healthz":
            self._send(200, "ok", ctype="text/plain")
            return

        self._send(404, "Not found")

    def do_POST(self):
        path = self.path.split("?", 1)[0]
        if path in ("/api/webhook", "/api/base-webhook"):
            length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(length) if length > 0 else b""
            print("  [Realtime Webhook] Nhận tín hiệu biến động dữ liệu trực tiếp từ Base Workflow!")
            threading.Thread(target=refresh_cache_in_background).start()
            self._send(200, json.dumps({"status": "received", "message": "Realtime sync triggered"}), ctype="application/json")
            return
        self._send(404, "Not found")


def get_lan_ip():
    ip = "127.0.0.1"
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
    except Exception:
        pass
    return ip


def _init_bg():
    try:
        print("  [1/2] Kiểm tra thư viện biểu đồ...")
        prefetch_libs()
        print("  [2/2] Luồng đồng bộ ngầm Base Workflow đang hoạt động...")
    except Exception as e:
        print("  Lỗi khởi tạo bg: %s" % e)


def main():
    print("=" * 68)
    print("  MÁY CHỦ EXECUTIVE BI DASHBOARD SIÊU TỐC - BÌNH QUỚI THANH ĐA")
    print("=" * 68)

    # Nạp đĩa cache vào RAM ngay lập tức trước khi mở cổng HTTP
    disk_p = load_disk_cache()
    if disk_p:
        set_cache_payload(disk_p)
        print("  ⚡ [RAM PRE-WARM] Đã nạp %d hồ sơ vào bộ nhớ RAM! Phản hồi tức thì < 1ms." % len(disk_p.get("rows", [])))
    else:
        print("  ⚡ [KHỞI TẠO BAN ĐẦU] Đang đồng bộ dữ liệu ban đầu từ Base Workflow API...")
        try:
            p = build_payload()
            set_cache_payload(p)
            save_disk_cache(p)
            print("  ⚡ [KHỞI TẠO XONG] Đã nạp %d hồ sơ!" % len(p.get("rows", [])))
        except Exception as e:
            print("  [Lỗi nạp ban đầu]: %s" % e)

    t_init = threading.Thread(target=_init_bg, daemon=True)
    t_init.start()

    t_loop = threading.Thread(target=_bg_loop, daemon=True)
    t_loop.start()

    ip = get_lan_ip()
    print("-" * 68)
    print("  MÁY CHỦ ĐANG CHẠY. Địa chỉ truy cập trên thiết bị CÙNG WiFi/LAN:")
    print()
    print("     👉 Máy này            :  http://localhost:%d" % PORT)
    print("     👉 Điện thoại/Máy khác:  http://%s:%d" % (ip, PORT))
    print()
    print("  * Nhấn Ctrl + C để dừng máy chủ.")
    print("=" * 68)

    server = ThreadingHTTPServer(("0.0.0.0", PORT), Handler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n  Đã dừng máy chủ. Tạm biệt!")
        server.shutdown()


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] in ("--sync", "--once"):
        print("⚡ [SYNC ONLY] Đang nạp dữ liệu từ Base Workflow API...")
        try:
            p = build_payload()
            save_disk_cache(p)
            print("⚡ [SYNC OK] Đã cập nhật cache_payload.json thành công (%d hồ sơ)!" % len(p.get("rows", [])))
            sys.exit(0)
        except Exception as e:
            print("❌ [SYNC ERROR]: %s" % e)
            sys.exit(1)
    main()
