# 🎓 Smart AI Exam Integrity CCTV Dashboard
### CPE-447 Project: CiRA CORE & AI Edge Computing

ระบบเฝ้าระวังและตรวจจับพฤติกรรมทุจริตในห้องสอบแบบอัตโนมัติด้วย AI ผ่านกล้อง CCTV แบบเรียลไทม์ พร้อมเว็บแดชบอร์ดบริหารจัดการ ออกแบบมาเพื่อทำงานแบบ **Standalone (Plug & Play)** บนบอร์ด **Raspberry Pi** โดยสมบูรณ์

---

## 🌟 ฟีเจอร์หลัก (Key Features)

1. **AI Real-time Proctoring & Behavior Detection:**
   - ตรวจจับพฤติกรรมต้องสงสัย เช่น การก้มมองหรือใช้โทรศัพท์มือถือ (Phone Detection)
   - ตรวจจับการเปิดเอกสาร/หนังสือแอบดู (Book Detection)
   - ตรวจจับทิศทางการหันศีรษะที่ผิดปกติเป็นเวลานาน (Suspicious Head Turning > 45°)
   - ตรวจสอบโซนที่นั่งนักศึกษา (Seat ROI Mapping)

2. **CCTV Stream & Live Feeds:**
   - รองรับกล้อง CCTV ผ่านโปรโตคอล RTSP และกล้อง Web Camera (USB)
   - สตรีมภาพสดความละเอียดสูงพร้อม AI Bounding Box & Status Indicator
   - บันทึกภาพเหตุการณ์ (Snapshot Evidence) อัตโนมัติลงฐานข้อมูลทันทีเมื่อพบการทุจริต

3. **Web Management Dashboard:**
   - ระบบยืนยันตัวตน Admin Authentication พร้อมสิทธิ์การเข้าถึงปลอดภัย
   - หน้าแดชบอร์ดสรุปสถิติ (Total Cheating Incidents, Risk Level, Seat Heatmap)
   - ระบบดูหลักฐานย้อนหลัง (Evidence Modal Player) พร้อมข้อมูลเวลาและประเภทความผิด
   - หน้าต่างป๊อปอัปยืนยันการออกจากระบบ (Custom Logout Confirmation Modal)

4. **Standalone Edge Computing (Raspberry Pi Auto-Boot):**
   - รองรับการทำงานแบบเสียบปลั๊กไฟแล้วเริ่มทำงานทันที (Auto-start via `systemd`)
   - เข้าใช้งานผ่านชื่อเครื่องได้ทันทีไม่ต้องง้อเลข IP: `http://raspberrypi.local:5000`
   - ระบบเชื่อมต่อท่อสัญญาณออนไลน์ (Cloudflare Tunnel) อัตโนมัติ

---

## 📂 โครงสร้างโปรเจกต์ (Project Structure)

```text
├── server.py              # Flask Backend, AI Detection Loop & CCTV Stream Handler
├── app.js                 # Frontend Application Logic & Real-time Dashboard Polling
├── index.html             # Main CCTV Monitoring & History Dashboard UI
├── admin_login.html       # Administrator Login Portal
├── login.html             # Login Interface
├── style.css              # Custom Dark/Light Glassmorphism Stylesheet
├── camera_config.json     # Camera RTSP URLs and Configuration
├── yolov8n.pt             # Pre-trained YOLOv8 Model Weights
├── start.sh               # Startup Script for Linux / Raspberry Pi
├── start.bat              # One-Click Launcher for Windows
├── sync_to_pi.py          # Development Deployment & Sync Tool
├── upload_to_board.bat    # Windows Batch Sync Helper
├── snapshots/             # Recorded Incident Snapshot Evidence Storage
└── README.md              # Project Documentation
```

---

## 🚀 วิธีการติดตั้งและใช้งาน (Installation & Usage)

### 1. บน Raspberry Pi (Linux)

#### ติดตั้ง Dependencies:
```bash
sudo apt update && sudo apt install -y python3-pip python3-opencv avahi-daemon
pip3 install -r requirements.txt
# หรือติดตั้งแพ็กเกจหลัก:
pip3 install flask opencv-python ultralytics paramiko requests
```

#### เริ่มทำงานด้วยตนเอง:
```bash
chmod +x start.sh
./start.sh
```

#### ตั้งค่าให้ทำงานอัตโนมัติเมื่อเปิดเครื่อง (Auto-boot via systemd):
สร้างไฟล์ `/etc/systemd/system/exam_dashboard.service`:
```ini
[Unit]
Description=Smart AI Exam Integrity CCTV Dashboard
After=network.target

[Service]
Type=simple
User=tuna
WorkingDirectory=/home/tuna/exam_dashboard
ExecStart=/usr/bin/python3 /home/tuna/exam_dashboard/server.py
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
```
เปิดใช้งาน Service:
```bash
sudo systemctl daemon-reload
sudo systemctl enable exam_dashboard.service
sudo systemctl start exam_dashboard.service
```

---

### 2. บนระบบ Windows (Development Mode)

1. ดับเบิลคลิกที่ไฟล์ **`start.bat`**
2. ระบบจะเริ่มทำงานทั้ง Flask Server, โมเดล AI และเปิดหน้าเว็บให้โดยอัตโนมัติ

---

## 🔑 ข้อมูลเข้าสู่ระบบเริ่มต้น (Default Credentials)

- **URL เข้าใช้งาน:** `http://raspberrypi.local:5000` (หรือ `http://localhost:5000`)
- **ชื่อผู้ใช้งาน (Username):** `admin`
- **รหัสผ่าน (Password):** `admin123` หรือ `admin1234`

---

## 👥 ผู้พัฒนา (Developers)
- **รายวิชา:** CPE-447 CiRA CORE & AI Edge Computing Project
- **GitHub Repository:** [https://github.com/wosangxr/CPE-447_Project-CiRA-CORE](https://github.com/wosangxr/CPE-447_Project-CiRA-CORE)
