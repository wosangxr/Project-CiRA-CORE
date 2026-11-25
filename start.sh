#!/bin/bash
cd "$(dirname "$0")"
echo "====================================================="
echo " Smart AI Exam Integrity Dashboard v2.0.0"
echo " Starting server on http://0.0.0.0:5000"
echo "====================================================="
python3 server.py
