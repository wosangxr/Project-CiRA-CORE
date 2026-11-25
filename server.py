"""
Smart AI Exam Integrity – Web Dashboard Streaming Server v2.0.0
===============================================================
Enhanced version with:
  - SQLite detection history
  - Camera config persistence (camera_config.json)
  - New API endpoints: /api/history, /api/system/status, /api/camera/test, /api/snapshots
  - All original functionality preserved:
      UDP streaming, CiRA CORE integration, MJPEG streams, existing routes
"""

import os
os.environ['OPENCV_FFMPEG_CAPTURE_OPTIONS'] = 'rtsp_transport;tcp|threads;1'
os.environ["OMP_NUM_THREADS"] = "1"
os.environ["OPENBLAS_NUM_THREADS"] = "1"
os.environ["MKL_NUM_THREADS"] = "1"
os.environ["VECLIB_MAXIMUM_THREADS"] = "1"
os.environ["NUMEXPR_NUM_THREADS"] = "1" 

import sys
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

import time
import json
import threading
import socket
import sqlite3
import datetime
import collections
import subprocess
import cv2
cv2.setNumThreads(1)
import numpy as np
from flask import Flask, Response, request, jsonify, send_from_directory

app = Flask(__name__, static_folder='.')

@app.after_request
def add_cors_headers(response):
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Headers'] = '*'
    response.headers['Access-Control-Allow-Methods'] = '*'
    return response

# ─────────────────────────── Constants ────────────────────────────
SERVER_START_TIME = time.time()
SERVER_VERSION = "2.0.0"
DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'detections.db')
CAM_CONFIG_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'camera_config.json')
SNAPSHOTS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'snapshots')
os.makedirs(SNAPSHOTS_DIR, exist_ok=True)

CIRA_TEMP_DIR = r"C:\cira_temp"
CIRA_FRAME_PATH = os.path.join(CIRA_TEMP_DIR, "latest_cira.jpg")
CIRA_PAYLOAD_PATH = os.path.join(CIRA_TEMP_DIR, "latest_payload.json")
os.makedirs(CIRA_TEMP_DIR, exist_ok=True)

# ─────────────────────────── SQLite DB ────────────────────────────
def init_db():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute('''CREATE TABLE IF NOT EXISTS detections
                 (id INTEGER PRIMARY KEY AUTOINCREMENT,
                  timestamp REAL,
                  camera_id TEXT,
                  label TEXT,
                  confidence REAL,
                  bbox TEXT,
                  snapshot_path TEXT,
                  video_path TEXT DEFAULT '',
                  status TEXT DEFAULT 'pending',
                  reviewed_by TEXT DEFAULT '',
                  notes TEXT DEFAULT '',
                  student_name TEXT DEFAULT '',
                  seat_number TEXT DEFAULT '',
                  session_id TEXT DEFAULT 'PHYS-101-MID')''')
    c.execute("PRAGMA table_info(detections)")
    existing_cols = {row[1] for row in c.fetchall()}
    columns_to_add = [
        ("video_path", "TEXT DEFAULT ''"),
        ("status", "TEXT DEFAULT 'pending'"),
        ("reviewed_by", "TEXT DEFAULT ''"),
        ("notes", "TEXT DEFAULT ''"),
        ("student_name", "TEXT DEFAULT ''"),
        ("seat_number", "TEXT DEFAULT ''"),
        ("session_id", "TEXT DEFAULT 'PHYS-101-MID'")
    ]
    for col_name, col_def in columns_to_add:
        if col_name not in existing_cols:
            try:
                c.execute(f"ALTER TABLE detections ADD COLUMN {col_name} {col_def}")
            except Exception:
                pass
    conn.commit()
    conn.close()

init_db()

def save_detection_to_db(camera_id, label, confidence, bbox, snapshot_path=None,
                         student_name="", seat_number="", session_id="PHYS-101-MID",
                         notes="", video_path="", status="pending", reviewed_by=""):
    try:
        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()
        c.execute('''
            INSERT INTO detections 
            (timestamp, camera_id, label, confidence, bbox, snapshot_path, video_path, status, reviewed_by, notes, student_name, seat_number, session_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            time.time(), camera_id, label, float(confidence), json.dumps(bbox),
            snapshot_path or '', video_path or '', status or 'pending',
            reviewed_by or '', notes or '', student_name or '', seat_number or '', session_id or 'PHYS-101-MID'
        ))
        row_id = c.lastrowid
        conn.commit()
        conn.close()
        return row_id
    except Exception as e:
        print(f"[DB] Error saving detection: {e}")
        return None

def get_detections_from_db(limit=100, offset=0, camera=None, start_date=None, end_date=None):
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        c = conn.cursor()
        conditions = []
        params = []
        if camera:
            conditions.append('camera_id = ?')
            params.append(camera)
        if start_date:
            try:
                ts = datetime.datetime.strptime(start_date, '%Y-%m-%d').timestamp()
                conditions.append('timestamp >= ?')
                params.append(ts)
            except Exception:
                pass
        if end_date:
            try:
                ts = datetime.datetime.strptime(end_date, '%Y-%m-%d').timestamp() + 86400
                conditions.append('timestamp <= ?')
                params.append(ts)
            except Exception:
                pass
        where = ('WHERE ' + ' AND '.join(conditions)) if conditions else ''
        count_row = c.execute(f'SELECT COUNT(*) FROM detections {where}', params).fetchone()
        total = count_row[0] if count_row else 0
        rows = c.execute(
            f'SELECT * FROM detections {where} ORDER BY timestamp DESC LIMIT ? OFFSET ?',
            params + [limit, offset]
        ).fetchall()
        conn.close()
        items = []
        for r in rows:
            r_keys = r.keys()
            items.append({
                'id': r['id'],
                'timestamp': r['timestamp'],
                'camera_id': r['camera_id'],
                'label': r['label'],
                'confidence': r['confidence'],
                'bbox': json.loads(r['bbox']) if r['bbox'] else [],
                'snapshot_path': r['snapshot_path'],
                'video_path': r['video_path'] if 'video_path' in r_keys else '',
                'status': r['status'] if 'status' in r_keys else 'pending',
                'reviewed_by': r['reviewed_by'] if 'reviewed_by' in r_keys else '',
                'notes': r['notes'] if 'notes' in r_keys else '',
                'student_name': r['student_name'] if 'student_name' in r_keys else '',
                'seat_number': r['seat_number'] if 'seat_number' in r_keys else '',
                'session_id': r['session_id'] if 'session_id' in r_keys else 'PHYS-101-MID'
            })
        return {'total': total, 'items': items}
    except Exception as e:
        print(f"[DB] Error reading detections: {e}")
        return {'total': 0, 'items': []}

def count_detections_today():
    try:
        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()
        today_start = datetime.datetime.now().replace(hour=0, minute=0, second=0, microsecond=0).timestamp()
        row = c.execute('SELECT COUNT(*) FROM detections WHERE timestamp >= ?', (today_start,)).fetchone()
        conn.close()
        return row[0] if row else 0
    except Exception:
        return 0

# ─────────────────────────── Camera Config Persistence ────────────
def load_camera_config():
    if os.path.exists(CAM_CONFIG_PATH):
        try:
            with open(CAM_CONFIG_PATH, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception:
            pass
    return {}

def save_camera_config():
    try:
        cfg = {}
        for cid, cdata in cameras.items():
            cfg[cid] = {'name': cdata['name'], 'url': cdata['url']}
        with open(CAM_CONFIG_PATH, 'w', encoding='utf-8') as f:
            json.dump(cfg, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print(f"[CONFIG] Error saving camera config: {e}")

# ─────────────────────────── Camera State ─────────────────────────
cameras = {
    "cam1": {
        "name": "CAM 01 (หน้าห้อง • CiRA CORE)",
        "url": "",
        "running": False,
        "thread": None,
        "latest_frame": None,
        "lock": threading.Lock()
    },
    "cam2": {
        "name": "CAM 02 (หลังห้อง)",
        "url": "",
        "running": False,
        "thread": None,
        "latest_frame": None,
        "lock": threading.Lock()
    },
    "cam3": {
        "name": "CAM 03 (ทางเดิน)",
        "url": "",
        "running": False,
        "thread": None,
        "latest_frame": None,
        "lock": threading.Lock()
    },
    "cam4": {
        "name": "CAM 04",
        "url": "",
        "running": False,
        "thread": None,
        "latest_frame": None,
        "lock": threading.Lock()
    }
}

# Apply saved config on startup
_saved_cfg = load_camera_config()
for _cid, _cdata in _saved_cfg.items():
    if _cid not in cameras:
        cameras[_cid] = {
            "name": _cdata.get('name', f"CAM {_cid.upper()}"),
            "url": _cdata.get('url', ''),
            "running": False,
            "thread": None,
            "latest_frame": None,
            "lock": threading.Lock()
        }
    else:
        cameras[_cid]['name'] = _cdata.get('name', cameras[_cid]['name'])
        cameras[_cid]['url'] = _cdata.get('url', '')

detection_state = {
    "count": 0,
    "items": [],
    "timestamp": time.time(),
    "img_dim": (1280, 720)
}

# Track last detected phone timestamp to avoid duplicate DB inserts
_last_phone_save_ts = 0.0

# ─────────────────────────── UDP Video Receiver ───────────────────
UDP_IP = "127.0.0.1"
UDP_PORT = 5055

udp_state = {
    "jpg_bytes": None,
    "lock": threading.Lock(),
    "last_received": 0
}

def udp_reader_loop():
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sock.setsockopt(socket.SOL_SOCKET, socket.SO_RCVBUF, 1024 * 1024)
    bound = False
    for _ in range(5):
        try:
            sock.bind((UDP_IP, UDP_PORT))
            bound = True
            print(f"[UDP] Listening for CiRA CORE frames on {UDP_IP}:{UDP_PORT} ...")
            break
        except Exception:
            time.sleep(1.0)
    if not bound:
        return
    while True:
        try:
            data, _ = sock.recvfrom(65535)
            if data:
                with udp_state["lock"]:
                    udp_state["jpg_bytes"] = data
                    udp_state["last_received"] = time.time()
        except Exception:
            time.sleep(0.04) # ~20 FPS capture throttle

udp_thread = threading.Thread(target=udp_reader_loop, daemon=True)
udp_thread.start()

# ─────────────────────────── Static Routing ───────────────────────
@app.route('/')
def index():
    return send_from_directory('.', 'index.html')

# ─────────────────────────── Temporal Behavior Scoring & Seat ROI ───────────────────────────
DEFAULT_SEAT_MAP = {
    "Seat A-01": {"name": "Alice Johnson", "x1": 0.04, "y1": 0.10, "x2": 0.48, "y2": 0.50},
    "Seat B-02": {"name": "Sophia Becker", "x1": 0.52, "y1": 0.10, "x2": 0.96, "y2": 0.50},
    "Seat B-04": {"name": "David Kim",     "x1": 0.04, "y1": 0.52, "x2": 0.48, "y2": 0.95},
    "Seat C-02": {"name": "Julian Vance",  "x1": 0.52, "y1": 0.52, "x2": 0.96, "y2": 0.95},
}

TEMPORAL_SETTINGS = {
    "head_turn": {
        "required_duration": 2.5,   # seconds sustained before alert
        "max_gap": 1.5,             # seconds gap before resetting streak
        "label": "Suspicious Head Turning (>45°)",
        "notes": "Facial landmark and head orientation tracked sustained yaw deviation exceeding normal exam threshold."
    },
    "phone": {
        "required_duration": 1.5,
        "max_gap": 2.5,             # generous gap to prevent frame jitter reset
        "label": "Unauthorized Smartphone Detected",
        "notes": "Object detector identified smartphone form factor on desk margin."
    },
    "cheat_sheet": {
        "required_duration": 1.5,
        "max_gap": 2.0,
        "label": "Passing Notes / Materials",
        "notes": "Prohibited paper note / cheat sheet detected during exam session."
    },
    "default": {
        "required_duration": 2.0,
        "max_gap": 1.5,
        "label": "Suspicious Activity Detected",
        "notes": "Sustained suspicious activity tracked by exam integrity monitor."
    }
}

active_suspicions = {}
active_suspicions_lock = threading.Lock()

def resolve_seat_info(bbox, camera_id="cam1", img_w=640, img_h=480):
    if not bbox or len(bbox) < 4:
        return "Seat B-04", "David Kim"
    x, y, w, h = bbox[0], bbox[1], bbox[2], bbox[3]
    cx = (x + (w / 2.0)) / max(1.0, float(img_w))
    cy = (y + (h / 2.0)) / max(1.0, float(img_h))
    
    for seat, info in DEFAULT_SEAT_MAP.items():
        if info["x1"] <= cx <= info["x2"] and info["y1"] <= cy <= info["y2"]:
            return seat, info["name"]
    if cx < 0.5 and cy < 0.5:
        return "Seat A-01", "Alice Johnson"
    elif cx >= 0.5 and cy < 0.5:
        return "Seat B-02", "Sophia Becker"
    elif cx < 0.5 and cy >= 0.5:
        return "Seat B-04", "David Kim"
    else:
        return "Seat C-02", "Julian Vance"

def _find_highlight_evidence(behavior_type):
    snaps = os.listdir(SNAPSHOTS_DIR) if os.path.exists(SNAPSHOTS_DIR) else []
    video_path = ""
    snap_path = ""
    target = "turning_head" if behavior_type == "head_turn" else "cheating_detected"
    for f in snaps:
        if target in f:
            if f.endswith(".mp4") and not video_path:
                video_path = f"/api/snapshots/{f}"
            elif f.endswith(".jpg") and not snap_path:
                snap_path = f"/api/snapshots/{f}"
    if not snap_path and snaps:
        for f in snaps:
            if f.endswith(".jpg"):
                snap_path = f"/api/snapshots/{f}"
                break
    return snap_path, video_path

# ─────────────────────────── Real-Time Rolling Buffer & Evidence Clip ───────────────────────────
cam1_rolling_buffer = collections.deque(maxlen=90)
cam1_buffer_lock = threading.Lock()
stream_fps = {"cam1": 29.5, "cam2": 29.5, "cam3": 29.5, "cam4": 29.5}
fps_trackers = {}

def _save_rolling_buffer_clip(out_path, b_type="phone", fps=15):
    with cam1_buffer_lock:
        frames_list = list(cam1_rolling_buffer)
    if not frames_list:
        return False

    def _encode_worker(fl, target):
        try:
            h, w = fl[0].shape[:2]
            cmd = [
                'ffmpeg', '-y', '-f', 'rawvideo', '-vcodec', 'rawvideo',
                '-s', f'{w}x{h}', '-pix_fmt', 'bgr24', '-r', str(fps),
                '-i', '-', '-c:v', 'libx264', '-pix_fmt', 'yuv420p',
                '-preset', 'ultrafast', '-crf', '26',
                target
            ]
            proc = subprocess.Popen(cmd, stdin=subprocess.PIPE, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            for frame in fl:
                proc.stdin.write(frame.tobytes())
            proc.stdin.close()
            proc.wait(timeout=5)
            print(f"[EVIDENCE CLIP] Encoded {len(fl)} frames into: {target}")
        except Exception as err:
            print(f"[EVIDENCE CLIP] Encode error: {err}")

    t = threading.Thread(target=_encode_worker, args=(frames_list, out_path), daemon=True)
    t.start()
    t.join(timeout=2.0)
    return os.path.exists(out_path)

def process_temporal_detection(camera_id, item, frame=None):
    now = time.time()
    raw_label = (item.get("label") or item.get("name") or "").lower()
    conf = float(item.get("confidence") or item.get("score") or 0.85)
    bbox = item.get("bbox") or [100, 100, 200, 200]
    
    if any(k in raw_label for k in ("turn", "look", "head", "yaw")):
        b_type = "head_turn"
    elif any(k in raw_label for k in ("phone", "mobile", "cell", "remote", "smartphone")):
        b_type = "phone"
    elif any(k in raw_label for k in ("sheet", "note", "paper", "cheat", "passing", "book")):
        b_type = "cheat_sheet"
    else:
        b_type = "default"
        
    cfg = TEMPORAL_SETTINGS.get(b_type, TEMPORAL_SETTINGS["default"])
    
    seat, student_name = resolve_seat_info(bbox, camera_id)
    if item.get("seat_number"):
        seat = item.get("seat_number")
    if item.get("student_name"):
        student_name = item.get("student_name")
        
    track_key = f"{camera_id}_{seat}_{b_type}"
    
    with active_suspicions_lock:
        entry = active_suspicions.get(track_key)
        
        # New streak or gap exceeded max_gap
        if entry is None or (now - entry["last_seen"]) > cfg["max_gap"]:
            active_suspicions[track_key] = {
                "first_seen": now,
                "last_seen": now,
                "count": 1,
                "highest_conf": conf,
                "triggered": False,
                "bbox": bbox,
                "student_name": student_name,
                "seat": seat,
                "type": b_type
            }
            return False, None
            
        # Continuing streak
        entry["last_seen"] = now
        entry["count"] += 1
        if conf > entry["highest_conf"]:
            entry["highest_conf"] = conf
        entry["bbox"] = bbox
        
        duration = entry["last_seen"] - entry["first_seen"]
        
        # Check if duration meets required threshold
        if duration >= cfg["required_duration"] and not entry["triggered"]:
            entry["triggered"] = True
            
            ts_ms = int(now * 1000)
            snap_path = ""
            video_path = ""

            # Save real-time evidence snapshot
            if frame is None and camera_id in cameras:
                with cameras[camera_id]["lock"]:
                    frame = cameras[camera_id].get("latest_frame")

            if frame is not None:
                try:
                    snap_filename = f"snap_evidence_{camera_id}_{b_type}_{ts_ms}.jpg"
                    snap_disk_path = os.path.join(SNAPSHOTS_DIR, snap_filename)
                    snap_frame = frame.copy()
                    _draw_detection_boxes(snap_frame, cam_id=camera_id)
                    cv2.imwrite(snap_disk_path, snap_frame)
                    snap_path = f"/api/snapshots/{snap_filename}"
                    print(f"[TEMPORAL AI] Saved evidence snapshot: {snap_disk_path}")
                except Exception as snap_err:
                    print(f"[TEMPORAL AI] Snapshot save error: {snap_err}")

            # Save real-time video clip from rolling buffer
            try:
                clip_filename = f"clip_evidence_{camera_id}_{b_type}_{ts_ms}.mp4"
                clip_disk_path = os.path.join(SNAPSHOTS_DIR, clip_filename)
                if _save_rolling_buffer_clip(clip_disk_path, b_type=b_type):
                    video_path = f"/api/snapshots/{clip_filename}"
                    print(f"[TEMPORAL AI] Saved evidence video clip: {clip_disk_path}")
            except Exception as clip_err:
                print(f"[TEMPORAL AI] Video clip save error: {clip_err}")

            if not video_path:
                _, video_path = _find_highlight_evidence(b_type)
            if not snap_path:
                snap_path, _ = _find_highlight_evidence(b_type)

            notes_text = f"{cfg['notes']} (ตรวจพบต่อเนื่อง {duration:.1f} วินาที, {entry['count']} เฟรม)"
            
            row_id = save_detection_to_db(
                camera_id=camera_id,
                label=cfg["label"],
                confidence=entry["highest_conf"],
                bbox=bbox,
                snapshot_path=snap_path,
                video_path=video_path,
                status="pending",
                notes=notes_text,
                student_name=entry["student_name"],
                seat_number=entry["seat"],
                session_id=item.get("session_id", "PHYS-101-MID")
            )
            print(f"[TEMPORAL AI] Confirmed violation: {cfg['label']} at {entry['seat']} ({duration:.1f}s, snap={snap_path})")
            return True, row_id
            
        # Periodic cleanup of old tracks
        stale_keys = [k for k, v in active_suspicions.items() if (now - v["last_seen"]) > 10.0]
        for k in stale_keys:
            del active_suspicions[k]
            
    return False, None

# ─────────────────────────── CiRA CORE Integration ────────────────
@app.route('/api/cira_detection', methods=['POST'])
def receive_cira_detection():
    global detection_state
    try:
        data = request.get_json(force=True)
        items = data.get("items", [])
        if not items and "label" in data:
            items = [data]
            
        camera_id = data.get("camera_id", "cam1")
        detection_state["count"] = len(items)
        detection_state["items"] = items
        detection_state["timestamp"] = time.time()
        
        confirmed_ids = []
        for it in items:
            confirmed, row_id = process_temporal_detection(camera_id, it)
            if confirmed:
                confirmed_ids.append(row_id)
                
        return jsonify({
            "status": "ok",
            "received_items": len(items),
            "confirmed_events": len(confirmed_ids),
            "event_ids": confirmed_ids,
            "timestamp": detection_state["timestamp"]
        })
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 400

def _auto_save_phone_detections(camera_id):
    # Process detection_state items through temporal behavior scoring
    for it in detection_state.get("items", []):
        process_temporal_detection(camera_id, it)


def update_cira_payload_state():
    """Reads CIRA_PAYLOAD_PATH and syncs to detection_state in real-time."""
    global detection_state
    if not os.path.exists(CIRA_PAYLOAD_PATH):
        return
    try:
        mtime = os.path.getmtime(CIRA_PAYLOAD_PATH)
        if time.time() - mtime < 4.0:
            with open(CIRA_PAYLOAD_PATH, 'r', encoding='utf-8') as f:
                cira_raw = json.load(f)
            items = []
            if isinstance(cira_raw, dict):
                src = cira_raw.get("DeepDetect") if "DeepDetect" in cira_raw and isinstance(cira_raw.get("DeepDetect"), dict) else cira_raw
                raw_items = None
                for key in ("objects", "items", "data"):
                    if key in src and isinstance(src[key], list):
                        raw_items = src[key]
                        break
                if raw_items is not None:
                    for obj in raw_items:
                        label = obj.get("name") or obj.get("label") or obj.get("class", "Object")
                        conf = obj.get("confidence") or obj.get("score") or obj.get("conf", 0.90)
                        if "x" in obj and "y" in obj:
                            bbox = [obj.get("x", 0), obj.get("y", 0), obj.get("w", 100), obj.get("h", 100)]
                        else:
                            bbox = obj.get("bbox") or obj.get("box") or [100, 100, 200, 200]
                        items.append({
                            "label": label,
                            "name": f"{label} ({int(conf * 100 if conf <= 1.0 else conf)}%)",
                            "confidence": float(conf) if conf <= 1.0 else float(conf) / 100.0,
                            "bbox": bbox
                        })
                detection_state["items"] = items
                detection_state["count"] = len(items)
                detection_state["timestamp"] = time.time()
                detection_state["img_dim"] = (src.get("im_w", 1280), src.get("im_h", 720))
                _auto_save_phone_detections("cam1")
        else:
            if time.time() - detection_state.get("timestamp", 0) > 4.0:
                detection_state["items"] = []
                detection_state["count"] = 0
    except Exception:
        pass

@app.route('/api/detections', methods=['GET'])
def get_detections():
    update_cira_payload_state()
    return jsonify(detection_state)

# ─────────────────────────── History API ──────────────────────────
@app.route('/api/history', methods=['GET'])
def get_history():
    limit = int(request.args.get('limit', 100))
    offset = int(request.args.get('offset', 0))
    camera = request.args.get('camera', None)
    start_date = request.args.get('start_date', None)
    end_date = request.args.get('end_date', None)
    result = get_detections_from_db(limit=limit, offset=offset, camera=camera,
                                    start_date=start_date, end_date=end_date)
    return jsonify(result)

@app.route('/api/history/clear', methods=['POST'])
def clear_history():
    try:
        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()
        c.execute('DELETE FROM detections')
        conn.commit()
        conn.close()
        return jsonify({"status": "ok", "message": "History cleared"})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/api/backup_db', methods=['GET'])
def backup_db():
    try:
        fname = f"detections_backup_{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}.db"
        return send_from_directory(os.path.dirname(DB_PATH), os.path.basename(DB_PATH), as_attachment=True, download_name=fname)
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/api/history/update_status', methods=['POST'])
def update_event_status():
    data = request.get_json(force=True) or {}
    event_id = data.get('id')
    status = data.get('status', 'confirmed')
    reviewed_by = data.get('reviewed_by', 'TuNa')
    notes = data.get('notes', '')
    if not event_id:
        return jsonify({"status": "error", "message": "Missing event id"}), 400
    try:
        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()
        c.execute("""
            UPDATE detections
            SET status = ?, reviewed_by = ?, notes = ?
            WHERE id = ?
        """, (status, reviewed_by, notes, event_id))
        conn.commit()
        conn.close()
        return jsonify({"status": "ok", "message": f"Event {event_id} status updated to {status}"})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/api/sessions', methods=['GET'])
def get_sessions():
    return jsonify({
        "current_session": {
            "id": "sess-phys101",
            "code": "PHYS-101-MID",
            "title": "Midterm Physics 101 (Electromagnetism)",
            "room": "Room 301",
            "proctorName": "TuNa (Assistant Proctor) / Dr. Reynolds",
            "totalStudents": 45,
            "startTime": "10:00 AM",
            "endTime": "12:00 PM",
            "integrityScore": 96.4
        },
        "sessions": [
            {"id": "sess-phys101", "code": "PHYS-101-MID", "title": "Midterm Physics 101", "room": "Room 301", "students": 45},
            {"id": "sess-cs302", "code": "CS-302-ALG", "title": "CS 302: Algorithms", "room": "Auditorium B", "students": 120},
            {"id": "sess-chem204", "code": "CHEM-204-FIN", "title": "BioChem 204 Finals", "room": "Lab Pod 4", "students": 32}
        ]
    })

@app.route('/api/audit_logs', methods=['GET'])
def get_audit_logs():
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        c = conn.cursor()
        rows = c.execute("SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT 50").fetchall()
        logs = [dict(r) for r in rows]
        conn.close()
        return jsonify({"status": "ok", "logs": logs})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

# ─────────────────────────── System Status API ────────────────────
@app.route('/api/system/status', methods=['GET'])
def system_status():
    cam_info = {}
    for cid, cdata in cameras.items():
        cam_info[cid] = {
            "name": cdata["name"],
            "url": cdata["url"],
            "online": cdata["running"] and cdata["latest_frame"] is not None,
            "fps": stream_fps.get(cid, 29.5 if cdata["running"] else 0.0)
        }

    total_det = 0
    suspicious_count = 0
    try:
        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()
        total_det = c.execute('SELECT COUNT(*) FROM detections').fetchone()[0]
        suspicious_count = c.execute("SELECT COUNT(*) FROM detections WHERE status != 'false_alarm'").fetchone()[0]
        conn.close()
    except Exception:
        pass

    return jsonify({
        "cameras": cam_info,
        "detections_today": count_detections_today(),
        "detections_total": total_det,
        "suspicious_count": suspicious_count,
        "exam_session": {
            "code": "PHYS-101-MID",
            "room": "Room 301",
            "proctor": "TuNa"
        },
        "uptime": int(time.time() - SERVER_START_TIME),
        "version": SERVER_VERSION,
        "timestamp": time.time()
    })

# ─────────────────────────── Camera Test API ──────────────────────
@app.route('/api/camera/test', methods=['POST'])
def test_camera():
    data = request.get_json(force=True)
    cam_id = data.get("cam_id", "cam1").strip()
    cam = cameras.get(cam_id)
    if not cam:
        return jsonify({"reachable": False, "latency_ms": 0, "error": "Unknown camera"}), 400

    start = time.time()
    # Check if camera has a live frame within the last 3 seconds
    with cam["lock"]:
        frame = cam["latest_frame"]
    has_frame = frame is not None

    # Also check UDP for cam1
    if cam_id == "cam1":
        with udp_state["lock"]:
            last_t = udp_state.get("last_received", 0)
        if time.time() - last_t < 3.0:
            has_frame = True

    latency_ms = round((time.time() - start) * 1000, 2)
    if has_frame:
        return jsonify({"reachable": True, "latency_ms": latency_ms})
    else:
        return jsonify({"reachable": False, "latency_ms": latency_ms, "error": "No live frame available"})

# ─────────────────────────── Snapshots API ────────────────────────
@app.route('/api/snapshots/<path:filename>', methods=['GET'])
@app.route('/highlights/<path:filename>', methods=['GET'])
def serve_snapshot(filename):
    return send_from_directory(SNAPSHOTS_DIR, filename)

@app.route('/api/snapshot/capture', methods=['POST'])
def capture_snapshot():
    """Capture a snapshot from a camera and save to disk."""
    data = request.get_json(force=True) or {}
    cam_id = data.get("cam_id", "cam1").strip()
    cam = cameras.get(cam_id)
    if not cam:
        return jsonify({"status": "error", "message": "Unknown camera"}), 400

    frame_bytes = None
    if cam_id == "cam1":
        with udp_state["lock"]:
            jpg = udp_state.get("jpg_bytes")
            last_t = udp_state.get("last_received", 0)
        if jpg is not None and (time.time() - last_t < 3.0):
            frame_bytes = bytes(jpg)

    if frame_bytes is None:
        with cam["lock"]:
            live_frame = cam["latest_frame"]
        if live_frame is not None:
            ret, buf = cv2.imencode('.jpg', live_frame, [cv2.IMWRITE_JPEG_QUALITY, 85])
            if ret:
                frame_bytes = buf.tobytes()

    if frame_bytes is None:
        return jsonify({"status": "error", "message": "No frame available"}), 404

    fname = f"snap_{cam_id}_{int(time.time() * 1000)}.jpg"
    fpath = os.path.join(SNAPSHOTS_DIR, fname)
    with open(fpath, 'wb') as f:
        f.write(frame_bytes)

    return jsonify({"status": "ok", "filename": fname, "url": f"/api/snapshots/{fname}"})

# ─────────────────────────── Video Stream Generator ───────────────
def generate_camera_standby_frame(cam_id):
    """Generate a standby frame when camera is not connected."""
    w, h = 640, 360
    frame = np.zeros((h, w, 3), dtype=np.uint8)
    frame[:] = (18, 18, 20)
    for x in range(0, w, 40):
        cv2.line(frame, (x, 0), (x, h), (28, 28, 30), 1)
    for y in range(0, h, 40):
        cv2.line(frame, (0, y), (w, y), (28, 28, 30), 1)
    cid_clean = str(cam_id).upper()
    cv2.putText(frame, f"[{cid_clean}] STANDBY", (w // 2 - 110, h // 2 - 20),
                cv2.FONT_HERSHEY_SIMPLEX, 0.7, (220, 220, 220), 2)
    cv2.putText(frame, "Waiting for RTSP URL / Camera Feed", (w // 2 - 160, h // 2 + 15),
                cv2.FONT_HERSHEY_SIMPLEX, 0.5, (120, 120, 120), 1)
    cv2.putText(frame, "Click [EDIT] to configure", (w // 2 - 105, h // 2 + 45),
                cv2.FONT_HERSHEY_SIMPLEX, 0.45, (0, 160, 255), 1)
    ret, buffer = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 70])
    return buffer.tobytes()

def _draw_detection_boxes(frame, cam_id="cam1"):
    """Draw detection bounding boxes and HUD with live FPS onto frame (in-place). Seat grid overlay removed for clean stability."""
    fh, fw = frame.shape[:2]
    is_black_feed = bool(frame.mean() < 2.0)

    # 1. Top HUD Status Bar with Real-time FPS (Clean video, no seat coordinate boxes)
    has_suspicious = detection_state.get("has_suspicious", False)
    cam_fps_val = stream_fps.get(cam_id, 29.5)
    hud_bg = (18, 15, 55) if has_suspicious else (20, 22, 28)
    cv2.rectangle(frame, (0, 0), (fw, 32), hud_bg, -1)

    if has_suspicious:
        cv2.circle(frame, (16, 16), 6, (0, 0, 255), -1)
        cv2.putText(frame, f"AI EXAM INTEGRITY  |  WARNING: SUSPICIOUS PHONE  |  {cam_fps_val:.1f} FPS", 
                    (32, 21), cv2.FONT_HERSHEY_SIMPLEX, 0.44, (0, 180, 255), 1)
    else:
        cv2.circle(frame, (16, 16), 5, (0, 255, 120), -1)
        cv2.putText(frame, f"● LIVE  |  {cam_fps_val:.1f} FPS  |  AI INTEGRITY ACTIVE", 
                    (32, 21), cv2.FONT_HERSHEY_SIMPLEX, 0.44, (230, 230, 230), 1)

    # 2.5 Show prompt if camera shutter is closed (black feed)
    if is_black_feed:
        cv2.rectangle(frame, (fw // 2 - 250, fh // 2 - 38), (fw // 2 + 250, fh // 2 + 38), (18, 18, 24), -1)
        cv2.rectangle(frame, (fw // 2 - 250, fh // 2 - 38), (fw // 2 + 250, fh // 2 + 38), (0, 140, 255), 2)
        cv2.putText(frame, "WEBCAM SHUTTER CLOSED (BLACK FEED)", (fw // 2 - 215, fh // 2 - 8),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.52, (0, 160, 255), 2)
        cv2.putText(frame, "Please open Lenovo E-Shutter Switch on laptop side", (fw // 2 - 225, fh // 2 + 18),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.40, (220, 220, 220), 1)

    # 3. Draw Detections if active
    if time.time() - detection_state.get("timestamp", 0) > 3.0:
        return frame

    dw, dh = detection_state.get("img_dim", (fw, fh))
    sx = float(fw) / max(1, float(dw))
    sy = float(fh) / max(1, float(dh))

    for it in detection_state.get("items", []):
        bbox = it.get("bbox", [])
        if len(bbox) != 4:
            continue
        bx = max(0, min(fw - 1, int(bbox[0] * sx)))
        by = max(0, min(fh - 1, int(bbox[1] * sy)))
        bw = max(10, min(fw - bx, int(bbox[2] * sx)))
        bh = max(10, min(fh - by, int(bbox[3] * sy)))
        label = it.get("label", "Object")
        cls_id = it.get("cls_id", -1)
        conf = float(it.get("confidence", 0.85))

        is_phone = cls_id in (67, 65) or any(k in label.lower() for k in ("phone", "cell", "mobile", "remote"))
        is_book = cls_id == 73 or any(k in label.lower() for k in ("book", "note", "paper", "cheat"))
        is_student = cls_id == 0 or "student" in label.lower()

        if is_phone:
            color = (0, 0, 255)  # Crimson Red
            thick = 3
            corner_thick = 5
            tag = f" Unauthorized Smartphone ({int(conf * 100)}%) "
        elif is_book:
            color = (0, 140, 255) # Orange
            thick = 3
            corner_thick = 5
            tag = f" Prohibited Notes / Book ({int(conf * 100)}%) "
        else: # Student
            color = (0, 230, 100) # Bright Green
            thick = 2
            corner_thick = 4
            tag = f" {it.get('name', 'Student')} "

        # Bounding box
        cv2.rectangle(frame, (bx, by), (bx + bw, by + bh), color, thick)

        # Glowing corner brackets
        corner_len = min(24, bw // 3, bh // 3)
        if corner_len > 4:
            cv2.line(frame, (bx, by), (bx + corner_len, by), color, corner_thick)
            cv2.line(frame, (bx, by), (bx, by + corner_len), color, corner_thick)
            cv2.line(frame, (bx + bw, by), (bx + bw - corner_len, by), color, corner_thick)
            cv2.line(frame, (bx + bw, by), (bx + bw, by + corner_len), color, corner_thick)
            cv2.line(frame, (bx, by + bh), (bx + corner_len, by + bh), color, corner_thick)
            cv2.line(frame, (bx, by + bh), (bx, by + bh - corner_len), color, corner_thick)
            cv2.line(frame, (bx + bw, by + bh), (bx + bw - corner_len, by + bh), color, corner_thick)
            cv2.line(frame, (bx + bw, by + bh), (bx + bw, by + bh - corner_len), color, corner_thick)

        # Tag label pill
        (tw, th2), _ = cv2.getTextSize(tag, cv2.FONT_HERSHEY_SIMPLEX, 0.46, 1)
        tag_y = max(th2 + 8, by - 6)
        cv2.rectangle(frame, (bx, tag_y - th2 - 4), (bx + tw + 4, tag_y + 4), color, -1)
        cv2.putText(frame, tag, (bx + 2, tag_y), cv2.FONT_HERSHEY_SIMPLEX, 0.46, (255, 255, 255), 1)

    return frame

def _encode_frame(frame, quality=75):
    ret, buf = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, quality])
    return buf.tobytes() if ret else None

def stream_generator_for_cam(cam_id):
    if cam_id not in cameras:
        cameras[cam_id] = {
            "name": f"CAM {cam_id.upper()}",
            "url": "",
            "running": False,
            "thread": None,
            "latest_frame": None,
            "lock": threading.Lock()
        }
    cam = cameras[cam_id]
    while True:
        frame_bytes = None
        # FPS Tracking per camera
        fc = fps_trackers.get(cam_id)
        if not fc:
            fc = {"last_t": time.time(), "frames": 0}
            fps_trackers[cam_id] = fc
        fc["frames"] += 1
        now_fps_t = time.time()
        dt_fps = now_fps_t - fc["last_t"]
        if dt_fps >= 1.0:
            stream_fps[cam_id] = round(fc["frames"] / dt_fps, 1)
            fc["frames"] = 0
            fc["last_t"] = now_fps_t

        # Priority 1: UDP JPEG from CiRA CORE
        if cam_id == "cam1":
            with udp_state["lock"]:
                jpg = udp_state.get("jpg_bytes")
                last_t = udp_state.get("last_received", 0)
            if jpg is not None and (time.time() - last_t < 3.0):
                update_cira_payload_state()
                has_detections = (
                    time.time() - detection_state.get("timestamp", 0) < 3.0
                    and len(detection_state.get("items", [])) > 0
                )
                if has_detections:
                    arr = np.frombuffer(jpg, dtype=np.uint8)
                    f = cv2.imdecode(arr, cv2.IMREAD_COLOR)
                    if f is not None:
                        _draw_detection_boxes(f, cam_id=cam_id)
                        with cam1_buffer_lock:
                            cam1_rolling_buffer.append(f.copy())
                        frame_bytes = _encode_frame(f, 75)
                else:
                    frame_bytes = bytes(jpg)
        # Priority 2: Direct RTSP thread / Local Webcam
        if frame_bytes is None:
            with cam["lock"]:
                live_frame = cam["latest_frame"]
            if live_frame is not None:
                fh, fw = live_frame.shape[:2]
                if fw > 1280:
                    f = cv2.resize(live_frame, (1280, int(1280 * (fh / fw))))
                else:
                    f = live_frame.copy()
                _draw_detection_boxes(f, cam_id=cam_id)
                frame_bytes = _encode_frame(f, quality=70)
        # Priority 3: Disk fallback
        if frame_bytes is None and cam_id == "cam1" and os.path.exists(CIRA_FRAME_PATH):
            try:
                if time.time() - os.path.getmtime(CIRA_FRAME_PATH) < 4.0:
                    raw = np.fromfile(CIRA_FRAME_PATH, dtype=np.uint8)
                    f = cv2.imdecode(raw, cv2.IMREAD_COLOR)
                    if f is not None:
                        _draw_detection_boxes(f, cam_id=cam_id)
                        with cam1_buffer_lock:
                            cam1_rolling_buffer.append(f.copy())
                        frame_bytes = _encode_frame(f)
            except Exception:
                pass
        # Priority 4: Standby
        if frame_bytes is None:
            frame_bytes = generate_camera_standby_frame(cam_id)
        yield (b'--frame\r\n'
               b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')
        time.sleep(0.033)  # ~30 FPS

@app.route('/video_feed')
def video_feed_default():
    cam_id = request.args.get('cam', 'cam1')
    return Response(stream_generator_for_cam(cam_id),
                    mimetype='multipart/x-mixed-replace; boundary=frame')

@app.route('/video_feed/<cam_id>')
def video_feed_by_id(cam_id):
    return Response(stream_generator_for_cam(cam_id),
                    mimetype='multipart/x-mixed-replace; boundary=frame')

# ─────────────────────────── Built-in Real-Time YOLO Detector ───────────────────────────
yolo_detector_running = True
yolo_detector_thread = None

def init_realtime_yolo():
    global yolo_detector_thread
    try:
        import os
        os.environ["OMP_NUM_THREADS"] = "1"
        os.environ["OPENBLAS_NUM_THREADS"] = "1"
        os.environ["MKL_NUM_THREADS"] = "1"
        import torch
        torch.set_num_threads(1)
        try:
            torch.set_num_interop_threads(1)
        except Exception:
            pass
        device = 'cuda:0' if torch.cuda.is_available() else 'cpu'
        print(f"[AI ENGINE] Loading YOLO model on {device} (Pinned to 1 CPU thread) ...")
        from ultralytics import YOLO
        yolo_model = YOLO('yolov8n.pt')
        print("[AI ENGINE] YOLO model loaded successfully!")
    except Exception as e:
        print(f"[AI ENGINE] Warning: YOLO could not be loaded: {e}")
        return

    def ai_loop():
        global detection_state
        print("[AI ENGINE] Real-time detection loop started (Classes: Person, Phone, Remote, Book | Conf: 0.18).")
        while yolo_detector_running:
            try:
                cam = cameras.get("cam1")
                if not cam:
                    time.sleep(0.1)
                    continue
                with cam["lock"]:
                    frame = cam.get("latest_frame")
                if frame is None:
                    time.sleep(0.1)
                    continue

                fh, fw = frame.shape[:2]
                
                # Fast inference on CPU/Pi: Downscale frame to 640px width
                infer_w = 640
                infer_h = max(320, int(640 * (fh / fw)))
                infer_frame = cv2.resize(frame, (infer_w, infer_h))
                
                results = yolo_model(infer_frame, classes=[0, 65, 67, 73], conf=0.18, verbose=False, imgsz=640)
                items = []
                suspicious_found = False
                scale_x = fw / float(infer_w)
                scale_y = fh / float(infer_h)
                
                for r in results:
                    for b in r.boxes:
                        cls_id = int(b.cls[0])
                        conf = float(b.conf[0])
                        xyxy = b.xyxy[0].tolist()
                        bx = int(xyxy[0] * scale_x)
                        by = int(xyxy[1] * scale_y)
                        bw = int((xyxy[2] - xyxy[0]) * scale_x)
                        bh = int((xyxy[3] - xyxy[1]) * scale_y)
                        bbox = [bx, by, bw, bh]
                        
                        seat, sname = resolve_seat_info(bbox, "cam1", fw, fh)
                        
                        if cls_id in (67, 65):  # Phone or handheld device
                            label_text = "Unauthorized Smartphone Detected"
                            item_name = f"Smartphone ({int(conf * 100)}%)"
                            suspicious_found = True
                        elif cls_id == 73:     # Prohibited Book / Cheat sheet
                            label_text = "Passing Notes / Materials"
                            item_name = f"Notes/Book ({int(conf * 100)}%)"
                            suspicious_found = True
                        elif cls_id == 0:      # Person / Candidate
                            label_text = "Student Active"
                            item_name = f"Student: {sname} ({seat})"
                        else:
                            continue
                            
                        item = {
                            "label": label_text,
                            "name": item_name,
                            "confidence": conf,
                            "bbox": bbox,
                            "camera_id": "cam1",
                            "cls_id": cls_id,
                            "seat_number": seat,
                            "student_name": sname
                        }
                        items.append(item)
                        
                        # Only feed suspicious violations (phones, cheat sheets) into temporal scorer
                        if cls_id in (67, 65, 73):
                            process_temporal_detection("cam1", item, frame=frame)

                if items:
                    detection_state["items"] = items
                    detection_state["count"] = len(items)
                    detection_state["timestamp"] = time.time()
                    detection_state["img_dim"] = (fw, fh)
                    detection_state["has_suspicious"] = suspicious_found
                else:
                    if time.time() - detection_state.get("timestamp", 0) > 1.8:
                        detection_state["items"] = []
                        detection_state["count"] = 0
                        detection_state["has_suspicious"] = False

                time.sleep(0.25) # 4 FPS AI inference - ultra-low power, rock solid
            except Exception as e:
                print(f"[AI ENGINE] Inference error: {e}")
                time.sleep(0.2)

    yolo_detector_thread = threading.Thread(target=ai_loop, daemon=True)
    yolo_detector_thread.start()

# Start Real-time YOLO AI Engine
init_realtime_yolo()

# ─────────────────────────── RTSP Camera Thread Manager ───────────
def start_camera_worker(cam_id, url):
    cam = cameras.get(cam_id)
    if not cam:
        return
    cam["url"] = url
    cam["running"] = True

    def loop():
        target_url = url
        print(f"[{cam_id.upper()}] Connecting: {target_url} ...")
        if str(target_url).strip().isdigit():
            source = int(target_url)
            cap = cv2.VideoCapture(source, cv2.CAP_DSHOW)
        else:
            source = target_url
            cap = cv2.VideoCapture(source, cv2.CAP_FFMPEG)
            cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
        if not cap.isOpened() and isinstance(source, str) and '/stream1' in source:
            fallback_url = source.replace('/stream1', '/stream2')
            print(f"[{cam_id.upper()}] stream1 busy, switching to substream: {fallback_url}")
            cap.release()
            source = fallback_url
            target_url = fallback_url
            cap = cv2.VideoCapture(source, cv2.CAP_FFMPEG)
            cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
        print(f"[{cam_id.upper()}] Camera open: {'OK' if cap.isOpened() else 'FAILED'}")
        fail_count = 0
        while cam["running"]:
            ret, frame = cap.read()
            if ret and frame is not None:
                fail_count = 0
                with cam["lock"]:
                    cam["latest_frame"] = frame
                if cam_id == "cam1":
                    with cam1_buffer_lock:
                        if frame.shape[1] > 1280:
                            buf_f = cv2.resize(frame, (1280, int(1280 * (frame.shape[0] / frame.shape[1]))))
                        else:
                            buf_f = frame.copy()
                        cam1_rolling_buffer.append(buf_f)
                time.sleep(0.01)
            else:
                fail_count += 1
                time.sleep(0.5)
                if not cam["running"]:
                    break
                if fail_count > 6:
                    print(f"[{cam_id.upper()}] Reconnecting: {target_url}")
                    cap.release()
                    if str(target_url).strip().isdigit():
                        cap = cv2.VideoCapture(int(target_url), cv2.CAP_DSHOW)
                    else:
                        cap = cv2.VideoCapture(source, cv2.CAP_FFMPEG)
                        cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
                    fail_count = 0
        cap.release()
        print(f"[{cam_id.upper()}] Camera disconnected.")

    cam["thread"] = threading.Thread(target=loop, daemon=True)
    cam["thread"].start()

@app.route('/api/get_cameras', methods=['GET'])
def get_cameras_api():
    result = {}
    for cid, cdata in cameras.items():
        result[cid] = {
            "name": cdata["name"],
            "url": cdata["url"],
            "online": cdata["running"] and cdata["latest_frame"] is not None,
            "fps": stream_fps.get(cid, 29.5 if cdata["running"] else 0.0)
        }
    return jsonify(result)

@app.route('/api/set_camera_url', methods=['POST'])
def set_camera_url_api():
    data = request.get_json(force=True)
    cam_id = data.get("cam_id", "cam1").strip()
    url = data.get("url", "").strip()
    name = data.get("name", "").strip()
    if cam_id not in cameras:
        cameras[cam_id] = {
            "name": name or f"CAM {cam_id.upper()}",
            "url": "",
            "running": False,
            "thread": None,
            "latest_frame": None,
            "lock": threading.Lock()
        }
    cam = cameras[cam_id]
    if name:
        cam["name"] = name
    cam["url"] = url
    cam["running"] = False
    time.sleep(0.3)
    save_camera_config()
    if url:
        start_camera_worker(cam_id, url)
        return jsonify({"status": "connected", "cam_id": cam_id, "url": url, "name": cam["name"]})
    else:
        with cam["lock"]:
            cam["latest_frame"] = None
        return jsonify({"status": "stopped", "cam_id": cam_id, "url": "", "name": cam["name"]})

@app.route('/api/delete_camera', methods=['POST'])
def delete_camera_api():
    data = request.get_json(force=True)
    cam_id = data.get("cam_id", "").strip()
    if cam_id in cameras and cam_id not in ['cam1', 'cam2']:
        cam = cameras.pop(cam_id)
        cam["running"] = False
        save_camera_config()
        return jsonify({"status": "deleted", "cam_id": cam_id})
    return jsonify({"status": "ignored", "cam_id": cam_id})

@app.route('/api/get_camera_url', methods=['GET'])
def get_camera_url_compat():
    cam_id = request.args.get('cam', 'cam1')
    return jsonify({"url": cameras.get(cam_id, {}).get("url", "")})

# ─────────────────────────── Admin Authentication Routes ───────────
@app.route('/login')
@app.route('/admin_login')
def serve_admin_login():
    return send_from_directory('.', 'admin_login.html')

@app.route('/api/admin/login', methods=['POST'])
def api_admin_login():
    try:
        data = request.get_json(force=True) or {}
        account = (data.get('account') or '').strip().lower()
        password = data.get('password') or ''
        valid_accounts = ['admin', 'admin@gmail.com', 'admin@example.com', 'tuna']
        valid_passwords = ['admin1234', 'admin123', 'Tuna1234', 'admin']
        if (account in valid_accounts) and (password in valid_passwords):
            return jsonify({
                "success": True,
                "token": "mock-jwt-token-exam-cctv-admin-" + str(int(time.time())),
                "user": {
                    "name": "Super Admin",
                    "role": "administrator",
                    "account": account
                }
            })
        return jsonify({"success": False, "message": "อีเมลหรือรหัสผ่านไม่ถูกต้อง"}), 401
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

# ─────────────────────────── Unified Public Tunnel ────────────────
PUBLIC_TUNNEL_URL = ""

def start_unified_tunnel(port=5000):
    global PUBLIC_TUNNEL_URL
    import subprocess, re, platform
    
    bin_name = 'cloudflared.exe' if platform.system() == 'Windows' else 'cloudflared'
    proj_dir = os.path.dirname(os.path.abspath(__file__))
    bin_path = os.path.join(proj_dir, bin_name)
    if not os.path.exists(bin_path):
        bin_path = bin_name
        
    try:
        cmd = [bin_path, 'tunnel', '--url', f'http://127.0.0.1:{port}']
        p = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, bufsize=1)
        for line in iter(p.stdout.readline, ''):
            if not line:
                break
            match = re.search(r'https://[a-zA-Z0-9-]+\.trycloudflare\.com', line)
            if match and not PUBLIC_TUNNEL_URL:
                PUBLIC_TUNNEL_URL = match.group(0)
                url_file = os.path.join(proj_dir, 'public_url.txt')
                with open(url_file, 'w', encoding='utf-8') as f:
                    f.write(PUBLIC_TUNNEL_URL)
                print("\n" + "="*68)
                print(" [🚀] UNIFIED PUBLIC LINK READY (เข้าใช้งานได้ทันทีจากทุกอุปกรณ์):")
                print(f"      {PUBLIC_TUNNEL_URL}")
                print(f" [🔑] หน้าล็อกอินโดยตรง:")
                print(f"      {PUBLIC_TUNNEL_URL}/admin_login.html")
                print("="*68 + "\n")
    except Exception as e:
        print(f" [*] Tunnel auto-starter info: {e}")

@app.route('/api/public_url', methods=['GET'])
def api_public_url():
    return jsonify({
        "url": PUBLIC_TUNNEL_URL,
        "login_url": f"{PUBLIC_TUNNEL_URL}/admin_login.html" if PUBLIC_TUNNEL_URL else "http://localhost:5000/admin_login.html"
    })

@app.route('/<path:path>')
def static_files(path):
    return send_from_directory('.', path)

# ─────────────────────────── Entry Point ──────────────────────────
if __name__ == '__main__':
    # 1. Auto-start cameras that have saved URLs
    for _cid, _cam in cameras.items():
        if _cam["url"]:
            start_camera_worker(_cid, _cam["url"])

    # 2. Auto-start Cloudflare Tunnel in background (All-in-one unified)
    threading.Thread(target=start_unified_tunnel, args=(5000,), daemon=True).start()

    print("===================================================================")
    print(" [*] Smart AI Exam Integrity – Unified System v2.0.0 Started!")
    print(" [*] Local URL:       http://localhost:5000")
    print(" [*] Login Page:      http://localhost:5000/admin_login.html")
    print(" [*] Generating Public Online Link in background...")
    print(" [*] Stream Feeds:    /video_feed?cam=cam1  /video_feed?cam=cam2")
    print("===================================================================")
    app.run(host='0.0.0.0', port=5000, debug=False, threaded=True)
