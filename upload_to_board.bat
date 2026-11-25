@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ========================================================
echo   Smart AI Exam Integrity - อัปโหลดไฟล์โปรเจกต์ลงบอร์ด
echo ========================================================
echo.

set DEFAULT_IP=10.114.70.249
set DEFAULT_USER=tuna
set DEFAULT_PATH=~/DASHBOARDCCTV

echo กำหนดการเชื่อมต่อ:
echo  - ผู้ใช้ (User): %DEFAULT_USER%
echo  - บอร์ดเริ่มต้น: %DEFAULT_IP% หรือ raspberrypi.local
echo  - โฟลเดอร์บนบอร์ด: %DEFAULT_PATH%
echo.

set /p BOARD_TARGET="กรอก IP บอร์ด หรือ Hostname (กด Enter เพื่อใช้ %DEFAULT_IP%): "
if "%BOARD_TARGET%"=="" set BOARD_TARGET=%DEFAULT_IP%

echo.
echo [*] กำลังอัปโหลดไฟล์ระบบล่าสุดลงบอร์ด (%DEFAULT_USER%@%BOARD_TARGET%:%DEFAULT_PATH%/)...
echo     - admin_login.html (หน้าล็อกอินแอดมิน)
echo     - index.html (หน้าแดชบอร์ดพร้อม Auth Guard)
echo     - server.py (Backend Server พร้อม API /login)
echo     - style.css ^& app.js
echo.

scp -o ConnectTimeout=5 admin_login.html index.html server.py style.css app.js %DEFAULT_USER%@%BOARD_TARGET%:%DEFAULT_PATH%/

if errorlevel 1 (
    echo.
    echo ========================================================
    echo  [!] การอัปโหลดไม่สำเร็จ กรุณาตรวจสอบ:
    echo      1. บอร์ดเปิดเครื่องและต่อเน็ตเวิร์กอยู่หรือไม่
    echo      2. IP ถูกต้องหรือไม่ (ที่มหาวิทยาลัยมักเป็น 10.114.70.249 หรือ raspberrypi.local)
    echo      3. คอมพิวเตอร์ของคุณต่อ Wi-Fi วงเดียวกับบอร์ดหรือไม่
    echo ========================================================
) else (
    echo.
    echo ========================================================
    echo  [✓] อัปโหลดไฟล์ลงบอร์ดสำเร็จเรียบร้อย!
    echo ========================================================
    echo.
    set /p RESTART="ต้องการสั่งเริ่มเซิร์ฟเวอร์บนบอร์ดใหม่ทันทีหรือไม่? (Y/N): "
    if /i "%RESTART%"=="Y" (
        echo กำลังสั่งรันเซิร์ฟเวอร์บนบอร์ด...
        ssh %DEFAULT_USER%@%BOARD_TARGET% "pkill -f server.py; cd %DEFAULT_PATH% && nohup python3 server.py > server.log 2>&1 &"
        echo [✓] สั่งเริ่มเซิร์ฟเวอร์เรียบร้อย เข้าใช้งานได้ที่: http://%BOARD_TARGET%:5000
    )
)
echo.
pause
