import paramiko
import sys
import os

files_to_sync = ['index.html', 'admin_login.html', 'login.html', 'app.js', 'server.py', 'style.css', 'start.sh']
base_dir = r'C:\Users\WOSAN\Downloads\DASHBOARDCCTV\DASHBOARDCCTV'
remote_dir = '/home/tuna/exam_dashboard'

def try_sync(ip):
    print(f"Connecting to Pi at {ip}...")
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        ssh.connect(ip, username='tuna', password='Tuna1234', timeout=3)
        print(f"Connected to {ip}!")
        sftp = ssh.open_sftp()
        for fname in files_to_sync:
            local_path = os.path.join(base_dir, fname)
            remote_path = f"{remote_dir}/{fname}"
            if os.path.exists(local_path):
                print(f"Uploading {fname} -> {remote_path}...")
                sftp.put(local_path, remote_path)
        sftp.close()
        print("Restarting exam_dashboard service...")
        stdin, stdout, stderr = ssh.exec_command("echo Tuna1234 | sudo -S systemctl restart exam_dashboard.service")
        stdout.channel.recv_exit_status()
        print("Service restarted successfully!")
        ssh.close()
        return True
    except Exception as e:
        print(f"Failed on {ip}: {e}")
        return False

if __name__ == '__main__':
    # Try known IP first
    if try_sync('10.114.70.249'):
        sys.exit(0)
    print("Could not reach 10.114.70.249. Please check if Raspberry Pi is powered on and connected to Wi-Fi.")
