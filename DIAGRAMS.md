# 📊 แผนภาพระบบ Smart AI Exam Integrity CCTV Dashboard
### CPE-447 Project: CiRA CORE & AI Edge Computing

เอกสารนี้รวบรวมไดอะแกรมสำคัญ 3 รูปแบบ สำหรับนำไปใช้งานใน **สไลด์พรีเซนเทชัน (PowerPoint / Canva)** และ **เล่มรายงานโครงงาน (Project Report)**

---

## 1. System Architecture Diagram (สถาปัตยกรรมระบบโดยรวม)
แผนภาพแสดงโครงสร้างการทำงานทั้ง 4 เลเยอร์ ตั้งแต่การรับสัญญาณภาพ AI ตรวจจับ ฐานข้อมูล จนถึงแดชบอร์ดแสดงผล

```mermaid
flowchart TD
    subgraph Layer1["1. เลเยอร์ฮาร์ดแวร์ & เซนเซอร์ (Hardware Layer)"]
        cam1["📹 กล้อง CCTV RTSP ตัวที่ 1 (ห้องสอบ)"]
        cam2["📹 กล้อง CCTV RTSP ตัวที่ 2 (มุมกว้าง)"]
        rpi["🎛️ บอร์ด Raspberry Pi 4/5 (Edge Computing)"]
        cam1 -->|RTSP Stream H.264| rpi
        cam2 -->|RTSP Stream H.264| rpi
    end

    subgraph Layer2["2. เลเยอร์การประมวลผล AI (Edge AI Engine)"]
        cv["OpenCV Video Ingestion & Frame Processing"]
        yolo["YOLOv8 AI Inference Engine"]
        logic["ระบบประเมินพฤติกรรม (Behavior Logic & Temporal Filter)"]
        roi["Seat Zone ROI Mapping (พิกัดโซนที่นั่งสอบ)"]
        
        rpi --> cv
        cv --> yolo
        yolo --> logic
        roi --> logic
        
        logic --> detPhone["📱 ตรวจจับการใช้มือถือ (Phone Detection)"]
        logic --> detBook["📖 ตรวจจับการเปิดเอกสาร (Book/Note Detection)"]
        logic --> detHead["👀 ตรวจจับการหันศีรษะผิดปกติ (> 45° ต่อเนื่อง 2.5s)"]
    end

    subgraph Layer3["3. เลเยอร์เซิร์ฟเวอร์ & ฐานข้อมูล (Backend & Storage)"]
        flask["Flask Application Server (Port 5000)"]
        db[("SQLite Database: detections.db")]
        storage["คลังหลักฐาน snapshots/ (MP4 Video & JPG)"]
        systemd["Linux systemd Service (Auto-Boot on Power)"]
        
        logic -->|บันทึกประวัติการโกง| db
        logic -->|บันทึกคลิปหลักฐาน 10 วินาที| storage
        logic -->|แจ้งเตือนแบบเรียลไทม์| flask
        systemd -->|สั่งรันระบบอัตโนมัติเมื่อเสียบไฟ| flask
    end

    subgraph Layer4["4. เลเยอร์การแสดงผล & ส่วนติดต่อผู้ใช้ (Dashboard & UI Layer)"]
        mdns["mDNS Resolver (http://raspberrypi.local:5000)"]
        auth["ระบบความปลอดภัย (Admin Auth Guard)"]
        dash["หน้าจอเฝ้าระวังเรียลไทม์ (Live CCTV Dashboard)"]
        modalEv["หน้าต่างดูหลักฐานย้อนหลัง (Evidence Player Modal)"]
        modalLog["หน้าต่างป๊อปอัปยืนยันออกจากระบบ (Logout Modal)"]
        
        flask --> mdns
        mdns --> auth
        auth --> dash
        dash --> modalEv
        dash --> modalLog
        
        proctorPhone["📱 สมาร์ทโฟนผู้คุมสอบ"]
        proctorPC["💻 คอมพิวเตอร์ห้องควบคุม"]
        
        dash -.->|เปิดดูผ่าน Wi-Fi ในห้องสอบ| proctorPhone
        dash -.->|เปิดดูผ่าน Wi-Fi ในห้องสอบ| proctorPC
    end
```

---

## 2. Sequence Diagram (ขั้นตอนการทำงานเมื่อ AI ตรวจพบการโกง)
แสดงลำดับการส่งข้อมูลแบบเรียลไทม์ ตั้งแต่นักศึกษามีพฤติกรรมต้องสงสัย จนถึงอาจารย์เปิดดูคลิปหลักฐาน

```mermaid
sequenceDiagram
    autonumber
    actor Student as นักศึกษาในห้องสอบ
    participant Cam as กล้อง CCTV RTSP
    participant AI as โมเดล AI (YOLOv8)
    participant Server as Backend & DB (Raspberry Pi)
    participant UI as เว็บแดชบอร์ด
    actor Proctor as อาจารย์ผู้คุมสอบ

    Student->>Cam: แสดงพฤติกรรม (เช่น หยิบมือถือ / หันมองเพื่อน)
    Cam->>AI: ส่งเฟรมภาพวิดีโอต่อเนื่อง (Real-time Stream)
    AI->>AI: ตรวจจับวัตถุและวิเคราะห์ตำแหน่ง (Bounding Box)
    AI->>AI: ตรวจสอบเงื่อนไขพฤติกรรมและระยะเวลา (> 2.5 วินาที)
    Note over AI: ยืนยันพฤติกรรมทุจริต (Cheating Confirmed)
    
    par การบันทึกหลักฐาน
        AI->>Server: สั่งแคปเจอร์ภาพนิ่งและตัดคลิปวิดีโอ 10 วินาที
        Server->>Server: บันทึกลง SQLite DB (เวลา, เลขที่นั่ง, ประเภทพฤติกรรม)
    and การแจ้งเตือนทันที
        Server->>UI: ส่งข้อมูลแจ้งเตือน (Real-time Alert Event)
        UI->>UI: ขึ้นกรอบสีแดงรอบกล้อง + กะพริบแจ้งเตือนที่โต๊ะสอบ
    end

    UI->>Proctor: แจ้งเตือนบนหน้าจอแดชบอร์ดทันที
    Proctor->>UI: กดคลิกที่รายการเพื่อดูหลักฐาน (Evidence Modal)
    UI->>Proctor: เล่นวิดีโอหลักฐานพร้อมระบุชื่อและที่นั่งสอบชัดเจน
```

---

## 3. Deployment & Plug-and-Play Diagram (ผังการเชื่อมต่อติดตั้งจริง)
แสดงการเชื่อมต่อแบบ Standalone Box โดยมี Raspberry Pi เป็นศูนย์กลาง เสียบไฟแล้วใช้งานได้ทันที

```mermaid
flowchart LR
    subgraph PowerStation["⚡ ระบบจ่ายไฟ"]
        Adapter["อะแดปเตอร์ / Power Bank (5V 3A)"]
    end

    subgraph EdgeDevice["🎛️ กล่องประมวลผลอัจฉริยะ (Edge AI Box)"]
        Pi["บอร์ด Raspberry Pi 4/5"]
        AutoBoot["ระบบเปิดเครื่องอัตโนมัติ (Auto-Boot Systemd)"]
        mDNS["ชื่อโดเมนเครื่อง: http://raspberrypi.local:5000"]
        Pi --- AutoBoot
        Pi --- mDNS
    end

    subgraph Cameras["📹 กล้องในห้องสอบ"]
        CCTV["กล้องวงจรปิด CCTV IP Camera (RTSP)"]
    end

    subgraph LocalNetwork["📶 เครือข่ายภายใน"]
        Router["Wi-Fi Router ห้องสอบ / Hotspot มือถือ"]
    end

    subgraph UserDevices["👥 อุปกรณ์สำหรับอาจารย์ผู้คุมสอบ"]
        Mobile["📱 สมาร์ทโฟน (iOS / Android)"]
        Laptop["💻 คอมพิวเตอร์โน้ตบุ๊ก"]
        Tablet["📟 ไอแพด / แท็บเล็ต"]
    end

    Adapter -->|สาย USB-C| Pi
    CCTV -->|เชื่อมต่อสัญญาณภาพ| Router
    Pi <-->|เชื่อมต่อเครือข่าย| Router
    Router <-->|พิมพ์ http://raspberrypi.local:5000| Mobile
    Router <-->|พิมพ์ http://raspberrypi.local:5000| Laptop
    Router <-->|พิมพ์ http://raspberrypi.local:5000| Tablet
```

---

### 💡 คำแนะนำสำหรับการนำไปใช้พรีเซนต์:
1. **ภาพที่ 1 (System Architecture):** เหมาะสำหรับสไลด์ที่อธิบาย **ภาพรวมโครงสร้างระบบ (System Overview / Methodology)** แสดงความครอบคลุมทั้งฮาร์ดแวร์และซอฟต์แวร์
2. **ภาพที่ 2 (Sequence Diagram):** เหมาะสำหรับอธิบาย **ขั้นตอนการทำงานของ AI (AI Processing & Verification Flow)** แสดงให้เห็นว่าระบบบันทึกหลักฐานได้อย่างแม่นยำอย่างไร
3. **ภาพที่ 3 (Deployment Diagram):** เหมาะสำหรับสไลด์ **การนำไปใช้งานจริง (Implementation & Demo)** เพื่อเน้นย้ำจุดเด่นที่เป็นระบบ Plug & Play เสียบปลั๊กปุ๊บ ใช้งานได้ทันที
