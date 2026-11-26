# 🎓 Smart AI Exam Integrity CCTV Dashboard
### CPE-447 Project: CiRA CORE & AI Edge Computing

ระบบเฝ้าระวังและตรวจจับพฤติกรรมทุจริตในห้องสอบแบบอัตโนมัติด้วย AI ผ่านกล้อง CCTV แบบเรียลไทม์ พร้อมเว็บแดชบอร์ดบริหารจัดการ ออกแบบมาเพื่อทำงานแบบ **Standalone Edge AI (Plug & Play)** บนบอร์ด **Raspberry Pi 5** โดยสมบูรณ์

---

## 🌟 ฟีเจอร์หลัก (Key Features)

1. **AI Real-time Proctoring & Behavior Detection:**
   - ตรวจจับพฤติกรรมต้องสงสัย เช่น การก้มมองหรือใช้โทรศัพท์มือถือ (Phone Detection)
   - ตรวจจับการเปิดเอกสาร/หนังสือแอบดู (Book Detection)
   - ตรวจจับทิศทางการหันศีรษะที่ผิดปกติเป็นเวลานาน (Suspicious Head Turning > 2.5s)
   - ตรวจสอบโซนที่นั่งนักศึกษา (Seat ROI Mapping)
   - รองรับทั้งโมเดล **Darknet Custom Models** (strange / phone / normal) และ **YOLOv8**

2. **CCTV Stream & Live Feeds:**
   - รองรับกล้อง CCTV ผ่านโปรโตคอล RTSP และกล้อง Web Camera (USB)
   - สตรีมภาพสดความละเอียดสูงพร้อม AI Bounding Box & Status Indicator
   - บันทึกภาพเหตุการณ์ (Snapshot Evidence) อัตโนมัติลงฐานข้อมูลทันทีเมื่อพบการทุจริต

3. **ระบบคลิปวิดีโอไฮไลท์อัตโนมัติ (Highlight Recording):**
   - มี Rolling Buffer สำรองภาพสดล่วงหน้า 3-5 วินาที
   - ตัดคลิปวิดีโอสั้น (.mp4) บันทึกหลักฐานจังหวะทุจริตอัตโนมัติ
   - หน้าเว็บมีเครื่องเล่นวิดีโอ (Evidence Video Player Modal) สามารถกดเปิดดูคลิปย้อนหลังได้ทันที

4. **Web Management Dashboard:**
   - ระบบยืนยันตัวตน Admin Authentication พร้อมสิทธิ์การเข้าถึงปลอดภัย
   - หน้าแดชบอร์ดสรุปสถิติ (Total Cheating Incidents, Risk Level, Seat Heatmap)
   - ระบบดูหลักฐานย้อนหลังพร้อมข้อมูลเวลา ผู้กระทำผิด และประเภทข้อหา
   - หน้าต่างป๊อปอัปยืนยันการออกจากระบบ (Custom Logout Confirmation Modal)

5. **Standalone Edge Computing (Raspberry Pi Auto-Boot):**
   - รองรับการทำงานแบบเสียบปลั๊กไฟแล้วเริ่มทำงานทันที (Auto-start via `systemd`)
   - เข้าใช้งานผ่านชื่อเครื่องได้ทันทีไม่ต้องง้อเลข IP: `http://raspberrypi.local:5000`
   - ระบบเชื่อมต่อท่อสัญญาณออนไลน์ (Cloudflare Tunnel) อัตโนมัติ

---

## 🛠️ เทคโนโลยีที่ใช้ (Tech Stack & Tools)

* **Hardware:** Raspberry Pi 5 (Quad-Core ARM Cortex-A76 @ 2.4GHz, RAM 8GB), CCTV IP Camera (RTSP H.264)
* **OS & Environment:** Debian GNU/Linux 13 (Trixie) 64-bit, Linux `systemd`, Avahi mDNS
* **AI & Computer Vision:** CiRA CORE 1.9.4, Darknet Framework, YOLOv8 (Ultralytics), OpenCV (cv2 4.12.0), PyTorch 2.6.0
* **Backend:** Python 3.13.5, Flask 3.1.1, Threading, UDP Socket, Rolling Buffer
* **Database & Storage:** SQLite 3 (`detections.db`), Local MP4/JPEG Evidence Storage
* **Frontend:** HTML5, CSS3 (Modern Dark Glassmorphism), Vanilla JavaScript (ES6+), HTML5 Video API
* **Network & Tunneling:** RTSP (Port 554), MJPEG, Cloudflare Tunnel (`cloudflared`), XRDP (Remote Desktop)

---

## 📂 โครงสร้างโปรเจกต์ (Project Structure)

```text
├── server.py              # Flask Backend, AI Detection Loop & CCTV Stream Handler
├── app.js                 # Frontend Application Logic & Real-time Dashboard Polling
├── index.html             # Main CCTV Monitoring & History Dashboard UI
├── admin_login.html       # Administrator Login Portal
├── login.html             # Login Interface
├── style.css              # Custom Dark Glassmorphism Stylesheet
├── camera_config.json     # Camera RTSP URLs and Configuration
├── yolov8n.pt             # Pre-trained YOLOv8 Model Weights
├── cira_flows/            # CiRA CORE Flow Projects (.npj)
│   ├── 447.npj            # Original CiRA CORE Project Flow
│   └── 447_pi.npj         # Raspberry Pi Optimized Flow
├── models/                # Custom Trained AI Models
│   ├── mm/                # Model 1 (Monitor, phone, normal)
│   │   ├── obj.names
│   │   ├── test.cfg
│   │   └── train.weights
│   └── mo_strange/        # Model 2 (strange, phone, normal)
│       ├── obj.names
│       ├── test.cfg
│       └── train.weights
├── start.sh               # Startup Script for Linux / Raspberry Pi
├── start.bat              # One-Click Launcher for Windows
├── sync_to_pi.py          # Automated SSH/SFTP Deployment Tool
├── snapshots/             # Recorded Incident Evidence (JPG & MP4)
├── DIAGRAMS.md            # Technical Architecture & Sequence Diagrams
└── README.md              # Project Documentation
```

---

## 🚀 วิธีการติดตั้งและใช้งาน (Installation & Usage)

### 1. บน Raspberry Pi (Linux)

#### ติดตั้ง Dependencies:
```bash
sudo apt update && sudo apt install -y python3-pip python3-opencv avahi-daemon
pip3 install flask opencv-python ultralytics paramiko requests
```

#### เริ่มทำงานด้วยตนเอง:
```bash
chmod +x start.sh
./start.sh
```

#### ตั้งค่าให้ทำงานอัตโนมัติเมื่อเปิดเครื่อง (Auto-boot via systemd):
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

### 3. การเปิดใช้งานกับโปรแกรม CiRA CORE

1. เปิดโปรแกรม **CiRA CORE**
2. กดปุ่ม **`Open Project`** แล้วเลือกไฟล์ `cira_flows/447_pi.npj` (บน Pi) หรือ `cira_flows/447.npj` (บน Windows)
3. กดปุ่ม **`Run`** เพื่อเริ่มการตรวจจับและส่งผลเข้า Dashboard

---

## 🔑 ข้อมูลเข้าสู่ระบบเริ่มต้น (Default Credentials)

- **URL เข้าใช้งาน:** `http://raspberrypi.local:5000` (หรือ `http://localhost:5000`)
- **ชื่อผู้ใช้งาน (Username):** `admin` หรือ `tuna`
- **รหัสผ่าน (Password):** `admin1234` หรือ `Tuna1234`

---

## 👥 ผู้พัฒนา (Developers)
- **รายวิชา:** CPE-447 CiRA CORE & AI Edge Computing Project
- **GitHub Repository:** [https://github.com/wosangxr/CPE-447_Project-CiRA-CORE](https://github.com/wosangxr/CPE-447_Project-CiRA-CORE)
