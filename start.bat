@echo off
cd /d "%~dp0"
title Smart AI Exam Integrity - Unified CCTV System
echo ===================================================================
echo  Smart AI Exam Integrity CCTV Dashboard v2.0.0
echo  [ Unified All-In-One System: Server + AI CCTV + Public Link ]
echo ===================================================================
echo.
echo [*] Starting Unified Server on http://localhost:5000 ...
echo [*] Automatic Public Online Link will be generated...
echo.
python server.py
pause
