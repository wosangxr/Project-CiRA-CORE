# 📊 Smart AI Exam Integrity CCTV Dashboard — Technical Diagrams
### CPE-447 Project: CiRA CORE & AI Edge Computing Architecture

Clean technical diagrams focused strictly on active features: **Smartphone Detection**, **Suspicious Head Movement (>2.5s)**, and **10-Second MP4 Video Evidence Clips**.

---

## 1. System Architecture Diagram

```mermaid
flowchart TD
    subgraph Layer1["1. Hardware & Video Ingestion Layer"]
        CCTV1["CCTV IP Camera 1<br/>(RTSP Stream H.264)"]
        CCTV2["CCTV IP Camera 2<br/>(RTSP Stream H.264)"]
        RPI["Raspberry Pi 4 / 5<br/>(Broadcom ARM64 SoC)"]
        CCTV1 -->|RTSP / TCP Port 554| RPI
        CCTV2 -->|RTSP / TCP Port 554| RPI
    end

    subgraph Layer2["2. Edge AI & Computer Vision Layer (CiRA CORE / YOLOv8)"]
        CV["OpenCV (cv2)<br/>Video Ingestion & Frame Preprocessing"]
        YOLO["YOLOv8n Deep Learning Model<br/>(Ultralytics Engine)"]
        Behavior["Temporal Behavior Analysis<br/>(Sustained Threshold Filter)"]
        
        RPI --> CV
        CV -->|RGB Frame 640x640| YOLO
        YOLO -->|Bounding Box & Class Conf| Behavior
        
        Behavior --> D1["Smartphone Detection<br/>(class: cell phone)"]
        Behavior --> D2["Suspicious Head Yaw Deviation<br/>(Head Turned &gt; 2.5s)"]
    end

    subgraph Layer3["3. Backend, Storage & Daemon Layer"]
        Flask["Flask REST API Server<br/>(Python 3 / Threaded)"]
        DB[("SQLite3 Database<br/>(detections.db)")]
        Storage["Evidence Storage<br/>(snapshots/*.mp4 Video Clips)"]
        Systemd["Linux systemd Service<br/>(Auto-boot on Power On)"]
        
        Behavior -->|Log Incident Timestamp & Confidence| DB
        Behavior -->|Buffer & Encode 10s MP4 Video Clip| Storage
        Behavior -->|Real-time Alert Event Dispatch| Flask
        Systemd -->|Daemon Lifecycle Management| Flask
    end

    subgraph Layer4["4. Web Management & Presentation Layer"]
        mDNS["Avahi mDNS Zeroconf<br/>(http://raspberrypi.local:5000)"]
        Auth["Session Authentication Guard<br/>(Local / Session Token Store)"]
        UI["Real-Time CCTV Dashboard<br/>(HTML5 / CSS3 / ES6 JavaScript)"]
        EvidenceModal["Evidence Video Player Modal<br/>(HTML5 Video API)"]
        LogoutModal["Custom Confirmation Dialog<br/>(DOM Modal Component)"]
        
        Flask --> mDNS
        mDNS --> Auth
        Auth --> UI
        UI --> EvidenceModal
        UI --> LogoutModal
        
        ProctorClient["Proctor Terminal Devices<br/>(Mobile / Tablet / PC Browser)"]
        UI -.->|HTTP / MJPEG Video Feeds| ProctorClient
    end
```

---

## 2. Sequence Diagram: AI Incident Detection & Proctor Alerting Flow

```mermaid
sequenceDiagram
    autonumber
    actor Examinee as Examinee (Student)
    participant CCTV as CCTV IP Camera
    participant OpenCV as OpenCV Pipeline
    participant YOLO as YOLOv8 Inference Engine
    participant Behavior as Behavior Verification Logic
    participant Backend as Flask API & SQLite DB
    participant UI as Proctor Web Dashboard
    actor Proctor as Exam Proctor (Teacher)

    Examinee->>CCTV: Suspicious Action (Using Phone / Looking Away)
    CCTV->>OpenCV: RTSP Stream (H.264 Video Frames)
    OpenCV->>YOLO: Frame Preprocessing (Resize 640x640, BGR to RGB)
    YOLO->>Behavior: Detect Objects & Bounding Boxes (Conf >= 0.18)
    Behavior->>Behavior: Verify Sustained Duration (Duration >= 2.5s)
    Note over Behavior: Violation Confirmed: Cheating Alert Triggered

    par Asynchronous Video Evidence Archiving
        Behavior->>Backend: Write Incident Metadata to SQLite Database
        Behavior->>Backend: Encode & Save 10-Second MP4 Video Clip
    and Real-Time Alert Broadcast
        Backend->>UI: Emit Live Alert Event (Camera ID, Violation Type)
        UI->>UI: Flash Red Camera Boundary & Play Audio Alert
    end

    UI->>Proctor: Display Live Alarm & Incident Badge on Dashboard
    Proctor->>UI: Click Incident in History Table
    UI->>Proctor: Open Evidence Player Modal (Playback 10s MP4 Video Clip)
```

---

## 3. Hardware & Network Deployment Diagram (Edge AI Plug-and-Play)

```mermaid
flowchart LR
    subgraph PowerStation["Power Supply Unit"]
        PSU["5V / 3A USB-C Power Adapter"]
    end

    subgraph EdgeNode["Edge AI Processing Node"]
        RPI["Raspberry Pi 4 / 5<br/>(Quad-Core ARM Cortex)"]
        OS["Raspberry Pi OS (64-bit Debian)"]
        AutoService["systemd Daemon<br/>(Auto-boot on Power On)"]
        mDNS["Avahi Zeroconf<br/>(raspberrypi.local:5000)"]
        
        RPI --- OS
        OS --- AutoService
        OS --- mDNS
    end

    subgraph VideoSource["Exam Hall Video Acquisition"]
        CAM["CCTV IP Camera / USB Cam<br/>(RTSP Protocol H.264)"]
    end

    subgraph LocalLAN["Local Area Network (LAN)"]
        Router["Wi-Fi Access Point / Router<br/>(Zero External Internet Required)"]
    end

    subgraph ClientDevices["Proctor Monitoring Terminals"]
        Mobile["Smartphones (iOS / Android)"]
        PC["Laptop / Command PC"]
        Tablet["iPad / Tablets"]
    end

    PSU -->|DC 5V / 3A| RPI
    CAM -->|RTSP Stream| Router
    RPI <-->|Gigabit Ethernet / Wi-Fi| Router
    Router <-->|http://raspberrypi.local:5000| Mobile
    Router <-->|http://raspberrypi.local:5000| Laptop
    Router <-->|http://raspberrypi.local:5000| Tablet
```

---

## 4. Project File Architecture & Component Interaction Diagram

```mermaid
flowchart TD
    subgraph SCRIPT["🚀 Startup & Deployment Layer"]
        start_sh["start.sh<br/>(Raspberry Pi Auto-Boot Script)"]
        start_bat["start.bat<br/>(Windows One-Click Launcher)"]
        sync_py["sync_to_pi.py / upload_to_board.bat<br/>(Automated SSH/SFTP Deployment)"]
    end

    subgraph BACKEND["🧠 Core Processing & AI Engine"]
        cfg["camera_config.json<br/>(CCTV RTSP Configuration)"]
        yolo_pt["yolov8n.pt<br/>(YOLOv8 Phone & Head Movement Detection)"]
        server_py["server.py<br/>(Flask Server, AI Loop & CCTV Stream Handler)"]
        
        cfg -->|Reads RTSP Stream URLs| server_py
        yolo_pt -->|Loads Model Weights| server_py
        start_sh -->|Executes Server| server_py
        start_bat -->|Executes Server| server_py
    end

    subgraph STORAGE["💾 Data & Evidence Storage Layer"]
        db[("detections.db<br/>(SQLite Incident Logs)")]
        snapshots["snapshots/<br/>(Recorded 10s MP4 Video Clips)"]
        
        server_py -->|Write Incident Records| db
        server_py -->|Save 10s Video Buffer Clip| snapshots
    end

    subgraph FRONTEND["🖥️ Web Dashboard & UI Layer"]
        login_html["admin_login.html / login.html<br/>(Administrator Login Portal)"]
        index_html["index.html<br/>(Main CCTV Monitoring Dashboard)"]
        app_js["app.js<br/>(Frontend Logic & Real-time Polling)"]
        style_css["style.css<br/>(Dark Glassmorphism Theme)"]
        
        login_html -->|Auth Request /api/admin/login| server_py
        server_py -->|Validate Token & Redirect| index_html
        index_html -->|Apply Styling| style_css
        index_html -->|Execute Client Logic| app_js
        app_js -->|Poll API & Fetch Live Stream Feeds| server_py
        app_js -->|Read 10s Video Clips for Playback| snapshots
    end

    sync_py -.->|Deploy Backend Code via SSH| BACKEND
    sync_py -.->|Deploy UI Assets via SSH| FRONTEND
```
