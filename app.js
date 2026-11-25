/**







 * Smart AI Exam Integrity Dashboard – app.js







 * ==========================================







 * Production-ready, fully modular JavaScript.







 * All 6 pages + real-time polling + notifications + local storage.







 */















'use strict';















// ═══════════════════════════════════════════════







//  API Base URL







// ═══════════════════════════════════════════════







const API_BASE = window.location.protocol === 'file:' ? 'http://localhost:5000' : '';















// ═══════════════════════════════════════════════







//  App State







// ═══════════════════════════════════════════════







const AppState = {







  currentPage: 'dashboard',







  backendOnline: true,







  cameras: {},               // latest from /api/get_cameras







  detections: {},            // latest from /api/detections







  history: [],               // accumulated detection history (up to 500)







  detectionToday: 0,







  suspiciousCount: 0,







  chartData: new Array(12).fill(0), // last 12 half-hour buckets







  lastDetectionTs: 0,        // to detect new detections







  settings: {},







  pollIntervalMs: 1500,







};















// ═══════════════════════════════════════════════







//  Utility helpers







// ═══════════════════════════════════════════════







const $ = (id) => document.getElementById(id);







const setText = (id, v) => { const el = $(id); if (el) el.textContent = v; };







const setHTML = (id, v) => { const el = $(id); if (el) el.innerHTML = v; };















function formatTime(ts) {







  const d = ts ? new Date(ts * 1000) : new Date();







  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });







}







function formatDate(ts) {







  const d = ts ? new Date(ts * 1000) : new Date();







  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });







}







function formatDateTime(ts) {







  return `${formatDate(ts)}, ${formatTime(ts)}`;







}







function escapeHtml(str) {







  const d = document.createElement('div');







  d.appendChild(document.createTextNode(str || ''));







  return d.innerHTML;







}







function isPhone(label) {







  if (!label) return false;







  return /phone|cell|mobile|smartphone/i.test(label);







}







function isSuspicious(label) {







  if (!label) return false;







  return /phone|cell|mobile|cheat|turning|head|note|paper|earbud|audio|unauthorized|suspicious|gaze/i.test(label);







}















// ═══════════════════════════════════════════════







//  API Module







// ═══════════════════════════════════════════════







const API = {







  async _fetch(path, opts = {}) {







    try {







      const ctrl = new AbortController();







      const timer = setTimeout(() => ctrl.abort(), 5000);







      const res = await fetch(API_BASE + path, { signal: ctrl.signal, ...opts });







      clearTimeout(timer);







      if (!res.ok) throw new Error(`HTTP ${res.status}`);







      AppState.backendOnline = true;







      Banner.hide();







      return await res.json();







    } catch (e) {







      AppState.backendOnline = false;







      Banner.show();







      return null;







    }







  },















  getDetections() { return this._fetch('/api/detections'); },







  getCameras()    { return this._fetch('/api/get_cameras'); },







  getSystemStatus() { return this._fetch('/api/system/status'); },















  async setCameraUrl(camId, url, name) {







    return this._fetch('/api/set_camera_url', {







      method: 'POST',







      headers: { 'Content-Type': 'application/json' },







      body: JSON.stringify({ cam_id: camId, url, name }),







    });







  },















  async testCamera(camId) {







    return this._fetch('/api/camera/test', {







      method: 'POST',







      headers: { 'Content-Type': 'application/json' },







      body: JSON.stringify({ cam_id: camId }),







    });







  },















  getHistory(params = {}) {







    const q = new URLSearchParams(params).toString();







    return this._fetch('/api/history' + (q ? '?' + q : ''));







  },















  clearHistory() {







    return this._fetch('/api/history/clear', { method: 'POST' });







  },







};















// ═══════════════════════════════════════════════







//  Offline Banner







// ═══════════════════════════════════════════════







const Banner = {







  el: null,







  init() { this.el = $('offlineBanner'); },







  show(msg) {
    if (this.el) {
      if (msg) {
        this.el.textContent = msg;
      } else {
        const target = API_BASE || (window.location.protocol.startsWith('http') ? window.location.origin : 'http://localhost:5000');
        this.el.textContent = `⚠ Backend Offline — กำลังพยายามเชื่อมต่อไปยัง ${target} …`;
      }
      this.el.classList.add('visible');
    }
  },







  hide() { if (this.el) this.el.classList.remove('visible'); },







};















// ═══════════════════════════════════════════════







//  Navigation Module







// ═══════════════════════════════════════════════







const PAGE_META = {







  dashboard: { title: 'Dashboard',          subtitle: 'Smart AI Exam Integrity System' },







  cameras:   { title: 'Camera Management',  subtitle: 'Configure and manage IP cameras' },







  monitor:   { title: 'Live Monitoring',    subtitle: 'Real-time AI-powered surveillance' },







  history:   { title: 'Detection History',  subtitle: 'All captured detection events' },







  ai:        { title: 'AI Configuration',   subtitle: 'YOLO model and CiRA CORE settings' },







  settings:  { title: 'System Settings',    subtitle: 'Dashboard and system preferences' },







};















const Nav = {







  init() {







    // Support URL hash e.g. #cameras, #monitor, #history, etc.







    const hash = window.location.hash.replace('#', '');







    if (hash && PAGE_META[hash]) {







      this.navigate(hash, true);







    } else {







      const saved = localStorage.getItem('agy_page');







      if (saved && PAGE_META[saved]) this.navigate(saved, true);







      else this.navigate('dashboard', true);







    }







    window.addEventListener('hashchange', () => {







      const h = window.location.hash.replace('#', '');







      if (h && PAGE_META[h] && h !== AppState.currentPage) {







        this.navigate(h, true);







      }







    });







  },















  navigate(page, silent = false) {

    if (!PAGE_META[page]) return;

    if (AppState.currentPage === 'settings' && page !== 'settings') {
      try {
        if (typeof SettingsPage !== 'undefined' && SettingsPage.save) {
          SettingsPage.save(true);
        }
      } catch (e) {
        console.warn('Auto-save settings failed on navigate:', e);
      }
    }

    AppState.currentPage = page;







    if (window.location.hash !== `#${page}`) {







      window.location.hash = page;







    }















    // Hide all pages, show target







    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));







    const target = $(`page-${page}`);







    if (target) target.classList.add('active');















    // Update nav items







    document.querySelectorAll('.nav-item').forEach(el => {







      el.classList.toggle('active', el.dataset.page === page);







    });















    // Update topbar







    const meta = PAGE_META[page];







    setText('topbarTitle', meta.title);







    setText('topbarSubtitle', meta.subtitle);















    if (!silent) localStorage.setItem('agy_page', page);







    this.closeMobile();















    // Page-specific init







    if (page === 'cameras') CameraPage.onEnter();







    if (page === 'monitor') MonitorPage.onEnter();







    if (page === 'history') HistoryPage.render();







    if (page === 'ai')      AiPage.updateStatus();







    if (page === 'settings') SettingsPage.load();







  },















    toggleSidebar() {
    if (window.innerWidth <= 900) {
      this.toggleMobile();
      return;
    }
    const sidebar = $('sidebar');
    const mainContent = document.querySelector('.main-content');
    if (!sidebar) return;

    sidebar.classList.toggle('collapsed');
    const isCollapsed = sidebar.classList.contains('collapsed');
    if (mainContent) {
      mainContent.classList.toggle('sidebar-collapsed', isCollapsed);
    }
    localStorage.setItem('agy_sidebar_collapsed', isCollapsed ? '1' : '0');

    const icon = $('collapseBtnIcon');
    const label = $('collapseBtnLabel');
    const btn = $('sidebarCollapseBtn');

    if (icon) {
      icon.innerHTML = isCollapsed
        ? '<polyline points="9 18 15 12 9 6"/>'
        : '<polyline points="15 18 9 12 15 6"/>';
    }
    if (label) {
      label.textContent = isCollapsed ? 'ตรึงแถบเมนู (Pin)' : 'ย่อแถบเมนู (Auto)';
    }
    if (btn) {
      btn.title = isCollapsed ? 'ตรึงแถบเมนูค้างไว้ (Pin Sidebar)' : 'ย่อแถบเมนู (Auto-expand on hover)';
    }
  },



  toggleMobile() {







    $('sidebar').classList.toggle('mobile-open');







    $('sidebarOverlay').classList.toggle('visible');







  },







  closeMobile() {







    $('sidebar').classList.remove('mobile-open');







    $('sidebarOverlay').classList.remove('visible');







  },







};















// ═══════════════════════════════════════════════







//  Clock Module







// ═══════════════════════════════════════════════







const Clock = {







  init() {







    this.tick();







    setInterval(() => this.tick(), 1000);







  },







  tick() {







    const now = new Date();







    const time = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });







    setText('sidebarClock', time);







    setText('topbarClock', time);







  },







};















// ═══════════════════════════════════════════════







//  Notifications / Toasts







// ═══════════════════════════════════════════════







const Notifications = {







  container: null,







  audioCtx: null,















  init() {







    this.container = $('toastContainer');







  },















  showToast(title, msg, type = 'info', duration = null) {







    if (!AppState.settings.toastEnabled) return;







    const dur = duration ?? (parseInt(AppState.settings.toastDuration) || 5) * 1000;















    const icons = {







      danger:  '⚠️',







      success: '✅',







      warning: '🔔',







      info:    'ℹ️',







    };















    const toast = document.createElement('div');







    toast.className = `toast ${type}`;







    toast.innerHTML = `







      <div class="toast-icon">${icons[type] || 'ℹ️'}</div>







      <div class="toast-content">







        <div class="toast-title">${escapeHtml(title)}</div>







        <div class="toast-msg">${escapeHtml(msg)}</div>







      </div>







      <div class="toast-close" onclick="Notifications.dismiss(this.parentElement)">✕</div>







      <div class="toast-progress" style="animation-duration:${dur}ms"></div>







    `;







    this.container.appendChild(toast);















    // Update notification dot







    const dot = $('notifDot');







    if (dot) dot.style.display = 'block';















    setTimeout(() => this.dismiss(toast), dur);







  },















  dismiss(toast) {







    if (!toast || !toast.parentElement) return;







    toast.classList.add('dismissing');







    setTimeout(() => toast.remove(), 250);







  },















  playAlert() {







    if (AppState.settings.muteAll || !AppState.settings.alertSound) return;







    try {







      if (!this.audioCtx) this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();







      const ctx = this.audioCtx;















      const beep = (freq, startTime, dur) => {







        const osc = ctx.createOscillator();







        const gain = ctx.createGain();







        osc.connect(gain);







        gain.connect(ctx.destination);







        osc.type = 'sine';







        osc.frequency.setValueAtTime(freq, startTime);







        gain.gain.setValueAtTime(0.3, startTime);







        gain.gain.exponentialRampToValueAtTime(0.001, startTime + dur);







        osc.start(startTime);







        osc.stop(startTime + dur);







      };















      const now = ctx.currentTime;







      beep(880, now, 0.12);







      beep(1100, now + 0.15, 0.12);







      beep(880, now + 0.3, 0.2);







    } catch (e) {







      // Audio unavailable







    }







  },







};























// ═══════════════════════════════════════════════







//  Notification Dropdown (Exam Incidents Feed)







// ═══════════════════════════════════════════════







const NotifDropdown = {







  isOpen: false,















  init() {







    document.addEventListener('click', (e) => {







      const wrapper = document.querySelector('.notif-wrapper');







      if (this.isOpen && wrapper && !wrapper.contains(e.target)) {







        this.close();







      }







    });







    this.updateDot();







  },















  toggle(e) {







    if (e) e.stopPropagation();







    if (this.isOpen) {







      this.close();







    } else {







      this.open();







    }







  },















  open() {







    const el = $('notifDropdown');







    if (!el) return;







    this.render();







    el.style.display = 'block';







    this.isOpen = true;







    const dot = $('notifDot');







    if (dot) dot.style.display = 'none';







  },















  close() {







    const el = $('notifDropdown');







    if (el) el.style.display = 'none';







    this.isOpen = false;







  },















  updateDot() {







    const dot = $('notifDot');







    if (!dot) return;







    const hasPending = AppState.history && AppState.history.some(e => e.status === 'pending');







    dot.style.display = hasPending ? 'block' : 'none';







  },















  goToHistory() {







    this.close();







    Nav.navigate('history');







  },















  getIconForLabel(label) {







    const l = (label || '').toLowerCase();







    if (l.includes('phone') || l.includes('smartphone')) return '📱';







    if (l.includes('head') || l.includes('turn')) return '🔄';







    if (l.includes('earbud') || l.includes('headphone')) return '🎧';







    if (l.includes('note') || l.includes('book') || l.includes('paper') || l.includes('pass')) return '📝';







    return '⚠️';







  },















  render() {







    const list = $('notifList');







    if (!list) return;















    const items = (AppState.history || []).slice(0, 6);







    if (!items.length) {







      list.innerHTML = `<div class="notif-empty">







        <div style="font-size:1.6rem;margin-bottom:6px">📭</div>







        <div>ไม่มีเหตุการณ์ต้องสงสัยในห้องสอบ</div>







      </div>`;







      return;







    }















    list.innerHTML = items.map((e) => {







      const origIdx = AppState.history.indexOf(e);







      const icon = this.getIconForLabel(e.label);







      const camName = (AppState.cameras && AppState.cameras[e.camId] && AppState.cameras[e.camId].name) || e.camId || 'Cam';







      







      let badgeHtml = '';







      if (e.status === 'confirmed') {







        badgeHtml = `<span class="badge-confirmed" style="font-size:0.68rem;padding:2px 6px;">Confirmed</span>`;







      } else if (e.status === 'false_alarm') {







        badgeHtml = `<span class="badge-false-alarm" style="font-size:0.68rem;padding:2px 6px;">False Alarm</span>`;







      } else {







        badgeHtml = `<span class="badge-pending" style="font-size:0.68rem;padding:2px 6px;">Pending</span>`;







      }















      return `







        <div class="notif-item" onclick="NotifDropdown.close(); HistoryPage.openEvidenceModal(${origIdx});" title="คลิกเพื่อตรวจดูหลักฐาน">







          <div class="notif-item-top">







            <div class="notif-time-cam">







              <span style="color:var(--danger,#ef4444);font-size:0.65rem;">●</span>







              <span>${formatTime(e.ts)}</span>







              <span>•</span>







              <span>${escapeHtml(camName)}</span>







            </div>







            ${badgeHtml}







          </div>







          <div class="notif-item-label">







            <span>${icon}</span>







            <span>${escapeHtml(e.label || 'Detection Event')}</span>







          </div>







          <div class="notif-item-student">







            <span>👤</span>







            <span class="notif-student-name">${escapeHtml(e.student_name || 'Examinee')}</span>







            ${e.seat_number ? `<span class="notif-seat-tag">ที่นั่ง ${escapeHtml(e.seat_number)}</span>` : ''}







          </div>







        </div>







      `;







    }).join('');







  }







};















// ═══════════════════════════════════════════════







//  Dashboard Page







// ═══════════════════════════════════════════════







const DashboardPage = {







  update() {







    const cams = AppState.cameras;







    const activeIds = (typeof CameraPage !== 'undefined' && CameraPage.getActiveCameraIds) ? CameraPage.getActiveCameraIds() : ['cam1', 'cam2'];







    const realCams = activeIds.map(id => cams[id]).filter(Boolean);







    const total = activeIds.length;







    const active = realCams.filter(c => c.online).length;















    const detTotal = AppState.history.length;







    const suspiciousTotal = AppState.history.filter(e => isSuspicious(e.label) && e.status !== 'false_alarm').length;







    setText('statTotalCams', total);







    setText('statActiveCams', active || '0');







    setText('statDetectionsToday', detTotal || AppState.detectionToday || '0');







    setText('statSuspicious', suspiciousTotal || AppState.suspiciousCount || '0');







    setText('statActiveTrend', active > 0 ? `${active} of ${total} streaming` : 'No active streams');















    this.renderCamStatus();







    this.renderRecentDetections();







    this.renderChart();







  },















  renderCamStatus() {







    const list = $('dashCamStatusList');







    if (!list) return;







    const cams = AppState.cameras;







    if (!Object.keys(cams).length) {







      list.innerHTML = `<div class="empty-state" style="padding:20px"><p>No cameras configured</p></div>`;







      return;







    }















    const activeIds = (typeof CameraPage !== 'undefined' && CameraPage.getActiveCameraIds) ? CameraPage.getActiveCameraIds() : ['cam1', 'cam2'];







    list.innerHTML = Object.entries(cams).filter(([cid]) => activeIds.includes(cid)).map(([cid, cam]) => {







      const online = cam.online;







      const badgeClass = online ? 'badge-success' : 'badge-muted';







      const badgeText = online ? 'Online' : 'Offline';







      const urlText = cam.url ? cam.url.replace(/:[^@]*@/, ':***@') : 'Not configured';







      return `







        <div class="cam-status-item">







          <div class="cam-thumb">







            <img src="${API_BASE}/video_feed?cam=${cid}" alt="${cid}"







                 style="width:100%;height:100%;object-fit:cover"







                 onerror="this.style.display='none'" />







          </div>







          <div class="cam-status-info">







            <div class="cam-status-name">${escapeHtml(cam.name || cid.toUpperCase())}</div>







            <div class="cam-status-url">${escapeHtml(urlText)}</div>







          </div>







          <span class="badge ${badgeClass}" style="margin-left:auto;flex-shrink:0">${badgeText}</span>







        </div>`;







    }).join('');







  },

  renderRecentDetections() {

    const tbody = $('recentDetectionsBody');

    if (!tbody) return;

    const items = AppState.history.slice(0, 10);

    if (!items.length) {

      tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state" style="padding:28px"><div class="empty-icon"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg></div><p style="margin-top:8px;">ยังไม่พบรายการตรวจจับในระบบ รอข้อมูลการประมวลผล…</p></div></td></tr>`;

      return;

    }



    const currentLang = (typeof I18N !== 'undefined' && I18N.lang) || AppState.settings?.language || localStorage.getItem('agy_lang') || 'th';

    const isTh = currentLang === 'th';



    tbody.innerHTML = items.map((entry, i) => {

      // 1. Color Psychology & clear Status Badges

      let badge = '';

      if (entry.status === 'confirmed') {

        badge = `<span class="badge-status-confirmed"><span class="badge-dot-confirmed"></span>${isTh ? 'ยืนยันการทุจริต' : 'Confirmed'}</span>`;

      } else if (entry.status === 'false_alarm') {

        badge = `<span class="badge-status-clear"><span class="badge-dot-clear"></span>${isTh ? 'ไม่พบความผิดปกติ' : 'Clear'}</span>`;

      } else {

        badge = `<span class="badge-status-pending"><span class="badge-dot-pending"></span>${isTh ? 'รอการตรวจสอบ' : 'Pending'}</span>`;

      }



      const cam = AppState.cameras[entry.camId] || {};

      const camName = cam.name || (entry.camId || 'cam1').toUpperCase();

      const cls = i === 0 ? 'row-new' : '';



      // 4. Avoid Super Minimal Look: Rich Student Name & Seat Info

      const studentName = entry.student_name || 'ผู้เข้าสอบ';

      const seatNo = entry.seat_number ? `<span class="seat-pill">${escapeHtml(entry.seat_number)}</span>` : '';

      const objectLabel = escapeHtml(entry.label || 'การกระทำต้องสงสัย');



      // Confidence & Behavior Risk Score with bar + percentage/score + level tag + duration
      const confPct = Math.round((entry.conf || 0) * 100);
      const confLevel = confPct >= 90 ? (isTh ? 'วิกฤต (Critical)' : 'Critical') : confPct >= 75 ? (isTh ? 'สูง (High)' : 'High') : confPct >= 50 ? (isTh ? 'ปานกลาง (Med)' : 'Medium') : (isTh ? 'ต่ำ (Low)' : 'Low');
      const confLevelClass = confPct >= 75 ? 'conf-tag-high' : confPct >= 50 ? 'conf-tag-med' : 'conf-tag-low';

      let durationBadge = '';
      if (entry.notes && entry.notes.includes('ตรวจพบต่อเนื่อง')) {
        const dMatch = entry.notes.match(/ตรวจพบต่อเนื่อง\s*([0-9.]+)\s*วินาที/);
        if (dMatch) {
          durationBadge = `<div style="font-size:0.71rem;color:var(--text-tertiary);margin-top:3px;display:flex;align-items:center;gap:3px;">
            <span>⏱</span> <span>ต่อเนื่อง ${dMatch[1]}s</span>
          </div>`;
        }
      }

      const actionBtnText = isTh ? 'ตรวจสอบหลักฐาน' : 'Review Clip';

      return `<tr class="${cls}" style="cursor:pointer;" onclick="HistoryPage.openEvidenceModal(${i})" title="คลิกเพื่อเปิดดูวิดีโอและหลักฐานการตรวจจับ">
        <td>
          <div class="time-col-wrap">
            <span class="time-main">${formatTime(entry.ts)}</span>
            <span class="time-sub">PHYS-101-MID</span>
          </div>
        </td>
        <td>
          <div class="cam-col-wrap" style="display:flex;align-items:center;gap:8px;">
            ${entry.snapshot_path ? `<img src="${entry.snapshot_path}" style="width:46px;height:32px;object-fit:cover;border-radius:4px;border:1px solid rgba(255,255,255,0.2);box-shadow:0 2px 4px rgba(0,0,0,0.3);" title="คลิกเพื่อดูหลักฐาน" />` : ''}
            <span class="cam-name-bold">${escapeHtml(camName)}</span>
          </div>
        </td>
        <td>
          <div class="incident-person-cell">
            <div class="incident-person-header">
              <span class="student-name-text">${escapeHtml(studentName)}</span>
              ${seatNo}
            </div>
            <div class="incident-behavior-text">
              <span class="behavior-bullet">●</span>
              <span>${objectLabel}</span>
            </div>
          </div>
        </td>
        <td>
          <div class="confidence-cell">
            <div class="progress-wrap">
              <div class="progress-bar" style="max-width:85px;">
                <div class="progress-fill ${confPct >= 75 ? 'high' : confPct >= 50 ? 'medium' : 'low'}" style="width:${confPct}%"></div>
              </div>
              <span class="progress-label" title="คะแนนความเสี่ยง / Risk Score" style="font-weight:700;">${confPct}/100</span>
            </div>
            <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
              <span class="conf-level-tag ${confLevelClass}">${confLevel}</span>
              ${durationBadge}
            </div>
          </div>
        </td>
        <td>${badge}</td>

        <td style="text-align:right;">

          <button class="btn-action-review" onclick="event.stopPropagation(); HistoryPage.openEvidenceModal(${i})">

            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="5 3 19 12 5 21 5 3"/></svg>

            <span>${actionBtnText}</span>

          </button>

        </td>

      </tr>`;

    }).join('');

  },

renderChart() {







    const container = $('donutContainer');







    if (!container) return;















    const history = AppState.history || [];







    const total = history.length;















    // Count the 3 statuses







    const pendingCount = history.filter(e => !e.status || e.status === 'pending').length;







    const confirmedCount = history.filter(e => e.status === 'confirmed').length;







    const falseAlarmCount = history.filter(e => e.status === 'false_alarm').length;















    const currentLang = (typeof I18N !== 'undefined' && I18N.lang) || AppState.settings?.language || localStorage.getItem('agy_lang') || 'th';







    const isTh = currentLang === 'th';















    // 3 Statuses definitions with theme colors







        // Calculate Dynamic Room Integrity Score (0-100)
    const integrityScore = Math.max(50, Math.min(100, Math.round(100 - (confirmedCount * 7) - (pendingCount * 1.5))));
    const integrityBadge = $('examIntegrityBadge');
    if (integrityBadge) {
      const integrityColor = integrityScore >= 80 ? '#047857' : integrityScore >= 65 ? '#B45309' : '#B91C1C';
      const integrityBg = integrityScore >= 80 ? '#ECFDF5' : integrityScore >= 65 ? '#FEF3C7' : '#FEE2E2';
      const integrityBorder = integrityScore >= 80 ? '#A7F3D0' : integrityScore >= 65 ? '#FDE68A' : '#FECACA';
      integrityBadge.style.background = integrityBg;
      integrityBadge.style.color = integrityColor;
      integrityBadge.style.borderColor = integrityBorder;
      integrityBadge.innerHTML = isTh 
        ? `🛡 ดัชนีความเรียบร้อย: <strong>${integrityScore}/100</strong>` 
        : `🛡 Integrity Score: <strong>${integrityScore}/100</strong>`;
    }


    const statuses = [







      {







        id: 'pending',







        nameTh: 'รอการตรวจสอบ',







        nameEn: 'Pending Review',







        count: pendingCount,







        color: '#F59E0B',







        badgeBg: '#FEF3C7',







        badgeColor: '#B45309'







      },







      {







        id: 'confirmed',







        nameTh: 'ยืนยันการทุจริต',







        nameEn: 'Confirmed Violation',







        count: confirmedCount,







        color: '#EF4444',







        badgeBg: '#FEE2E2',







        badgeColor: '#B91C1C'







      },







      {







        id: 'false_alarm',







        nameTh: 'ไม่พบความผิดปกติ',







        nameEn: 'False Alarm / Clear',







        count: falseAlarmCount,







        color: '#10B981',







        badgeBg: '#D1FAE5',







        badgeColor: '#047857'







      }







    ];















    // SVG parameters







    const size = 170;







    const strokeWidth = 20;







    const r = (size - strokeWidth) / 2; // (170 - 20) / 2 = 75







    const C = 2 * Math.PI * r;          // ~471.2389







    const cx = size / 2;







    const cy = size / 2;















    let accumulatedOffset = 0;







    let segmentsSvg = '';















    // Base background circle







    segmentsSvg += `<circle cx="${cx}" cy="${cy}" r="${r}" class="donut-bg-circle"/>`;















    if (total > 0) {







      statuses.forEach(s => {







        if (s.count === 0) return;







        const pctFraction = s.count / total;







        const strokeLen = pctFraction * C;







        segmentsSvg += `







          <circle cx="${cx}" cy="${cy}" r="${r}" class="donut-segment"







            stroke="${s.color}"







            stroke-dasharray="${strokeLen} ${C - strokeLen}"







            stroke-dashoffset="-${accumulatedOffset}"







          />







        `;







        accumulatedOffset += strokeLen;







      });







    }















    // Legend list HTML







    const legendHtml = statuses.map(s => {







      const pctVal = total > 0 ? ((s.count / total) * 100).toFixed(1) + '%' : '0.0%';







      const name = isTh ? s.nameTh : s.nameEn;







      const sub = isTh ? s.nameEn : s.nameTh;















      return `







        <div class="donut-legend-item">







          <div class="donut-legend-left">







            <span class="donut-legend-dot" style="background:${s.color};"></span>







            <div class="donut-legend-labels">







              <span class="donut-legend-title">${name}</span>







              <span class="donut-legend-desc">${sub}</span>







            </div>







          </div>







          <div class="donut-legend-right">







            <span class="donut-legend-count">${s.count}</span>







            <span class="donut-legend-pct" style="background:${s.badgeBg};color:${s.badgeColor};">${pctVal}</span>







          </div>







        </div>







      `;







    }).join('');















    const centerLabel = isTh ? 'รายการทั้งหมด' : 'Total Events';















    container.innerHTML = `







      <div class="donut-visual-box">







        <svg class="donut-svg" viewBox="0 0 ${size} ${size}">







          ${segmentsSvg}







        </svg>







        <div class="donut-center-info">







          <span class="donut-center-val" id="donutTotalVal">${total}</span>







          <span class="donut-center-lbl">${centerLabel}</span>







        </div>







      </div>







      <div class="donut-legend-list">







        ${legendHtml}







      </div>







    `;















    // Header badge







    const totalBadge = $('chartTotalBadge');







    if (totalBadge) {







      totalBadge.textContent = isTh ? `รวมทั้งหมด ${total} รายการ` : `Total ${total} events`;







    }







  },







};















// ═══════════════════════════════════════════════







//  Camera Page







// ═══════════════════════════════════════════════







const CameraPage = {







  getActiveCameraIds() {







    const saved = localStorage.getItem('configured_camera_ids');







    if (saved) {







      try {







        const parsed = JSON.parse(saved);







        if (Array.isArray(parsed) && parsed.length > 0) {







          return parsed;







        }







      } catch (e) {}







    }







    return ['cam1', 'cam2'];







  },















  saveActiveCameraIds(ids) {







    localStorage.setItem('configured_camera_ids', JSON.stringify(ids));







  },















  onEnter() {







    const ids = this.getActiveCameraIds();







    ids.forEach(cid => {







      this.ensureCardExists(cid);







      this.loadFromStorage(cid);







      this.updateRtspPreview(cid);







      this.updateStatusBadge(cid);







    });







  },















  loadFromStorage(cid) {







    const saved = JSON.parse(localStorage.getItem(`cam_cfg_${cid}`) || 'null');







    if (!saved) return;







    const fields = ['name', 'ip', 'port', 'user', 'pass', 'path'];







    fields.forEach(f => {







      const el = $(`${cid}-${f}`);







      if (el && saved[f] !== undefined) el.value = saved[f];







    });







  },















  saveToStorage(cid) {







    const fields = ['name', 'ip', 'port', 'user', 'pass', 'path'];







    const data = {};







    fields.forEach(f => { const el = $(`${cid}-${f}`); if (el) data[f] = el.value; });







    localStorage.setItem(`cam_cfg_${cid}`, JSON.stringify(data));







  },















  buildRtspUrl(cid, maskPassword = false) {







    const ip   = ($(`${cid}-ip`)   || {}).value?.trim() || '';







    const port = ($(`${cid}-port`) || {}).value?.trim() || '554';







    const user = ($(`${cid}-user`) || {}).value?.trim() || '';







    const pass = ($(`${cid}-pass`) || {}).value?.trim() || '';







    const path = ($(`${cid}-path`) || {}).value?.trim() || '/stream1';







    if (!ip) return null;







    const pwd = maskPassword ? '***' : pass;







    const auth = user ? `${user}:${pwd}@` : '';







    return `rtsp://${auth}${ip}:${port}${path}`;







  },















  updateRtspPreview(cid) {







    const url = this.buildRtspUrl(cid, true);







    const el = $(`${cid}-rtsp-url`);







    if (el) el.textContent = url || '—';







  },















  updateStatusBadge(cid, status) {







    const badge = $(`${cid}-status-badge`);







    if (!badge) return;







    const cam = AppState.cameras[cid];







    if (status) {







      badge.className = 'badge';







      if (status === 'connecting') { badge.classList.add('badge-warning'); badge.textContent = 'Connecting…'; }







      else if (status === 'connected') { badge.classList.add('badge-success'); badge.textContent = 'Connected'; }







      else if (status === 'disconnected') { badge.classList.add('badge-muted'); badge.textContent = 'Disconnected'; }







      else if (status === 'error') { badge.classList.add('badge-danger'); badge.textContent = 'Error'; }







    } else {







      if (cam && cam.online) { badge.className = 'badge badge-success'; badge.textContent = 'Connected'; }







      else { badge.className = 'badge badge-muted'; badge.textContent = 'Disconnected'; }







    }







  },















  async connect(cid) {







    const url = this.buildRtspUrl(cid, false);







    const name = ($(`${cid}-name`) || {}).value?.trim() || '';







    if (!url) {







      Notifications.showToast('Missing Info', 'Please enter an IP address first.', 'warning');







      return;







    }







    this.saveToStorage(cid);







    this.updateStatusBadge(cid, 'connecting');







    const res = await API.setCameraUrl(cid, url, name);







    if (res && res.status !== 'error') {







      this.updateStatusBadge(cid, 'connected');







      Notifications.showToast('Camera Connected', `${name || cid} is now streaming.`, 'success');







      const img = $(`${cid}-preview`);







      if (img) img.src = `${API_BASE}/video_feed?cam=${cid}&t=${Date.now()}`;







    } else {







      this.updateStatusBadge(cid, 'error');







      Notifications.showToast('Connection Failed', res?.message || 'Could not connect to camera.', 'danger');







    }







  },















  async disconnect(cid) {







    const name = ($(`${cid}-name`) || {}).value?.trim() || cid;







    const res = await API.setCameraUrl(cid, '', name);







    if (res) {







      this.updateStatusBadge(cid, 'disconnected');







      this.saveToStorage(cid);







      Notifications.showToast('Camera Disconnected', `${name} has been stopped.`, 'info');







    }







  },















  async test(cid) {







    const resultEl = $(`${cid}-test-result`);







    if (resultEl) {







      resultEl.style.display = 'block';







      resultEl.innerHTML = `<div class="d-flex align-center gap-8"><div class="spinner spinner-sm"></div> Testing connection…</div>`;







    }















    try {







      const ctrl = new AbortController();







      const timer = setTimeout(() => ctrl.abort(), 3000);







      const res = await fetch(`${API_BASE}/video_feed?cam=${cid}`, { signal: ctrl.signal });







      clearTimeout(timer);







      if (resultEl) {







        resultEl.innerHTML = `<span class="badge badge-success">✓ Connection OK – Camera is reachable</span>`;







        setTimeout(() => { if (resultEl) resultEl.style.display = 'none'; }, 4000);







      }







      Notifications.showToast('Test Passed', `${cid.toUpperCase()} is reachable.`, 'success');







    } catch (e) {







      if (resultEl) {







        resultEl.innerHTML = `<span class="badge badge-danger">✗ No response – Camera may be offline or URL incorrect</span>`;







        setTimeout(() => { if (resultEl) resultEl.style.display = 'none'; }, 5000);







      }







      Notifications.showToast('Test Failed', `Could not reach ${cid.toUpperCase()}.`, 'warning');







    }







  },















  togglePassword(inputId, toggleEl) {







    const input = $(inputId);







    if (!input) return;







    const isHidden = input.type === 'password';







    input.type = isHidden ? 'text' : 'password';







    toggleEl.innerHTML = isHidden







      ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`







      : `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;







  },















  addCamera() {







    const ids = this.getActiveCameraIds();







    let nextNum = 1;







    while (ids.includes(`cam${nextNum}`)) {







      nextNum++;







    }







    const newCid = `cam${nextNum}`;







    ids.push(newCid);







    this.saveActiveCameraIds(ids);















    const defaultData = {







      name: `Camera 0${nextNum}`,







      ip: '',







      port: '554',







      user: 'admin',







      pass: '',







      path: '/stream1'







    };







    localStorage.setItem(`cam_cfg_${newCid}`, JSON.stringify(defaultData));















    this.ensureCardExists(newCid);







    this.loadFromStorage(newCid);







    this.updateRtspPreview(newCid);







    this.updateStatusBadge(newCid, 'disconnected');















    if (typeof DashboardPage !== 'undefined' && DashboardPage.update) {







      DashboardPage.update();







    }







    if (typeof MonitorPage !== 'undefined' && MonitorPage.renderAllMonitorCards) {







      MonitorPage.renderAllMonitorCards();







      MonitorPage.updateCamInfo();







    }















    const cardEl = $(`camCard-${newCid}`);







    if (cardEl) {







      cardEl.scrollIntoView({ behavior: 'smooth', block: 'center' });







      cardEl.style.transition = 'all 0.4s ease';







      cardEl.style.boxShadow = '0 0 24px rgba(62, 106, 225, 0.45)';







      setTimeout(() => { if (cardEl) cardEl.style.boxShadow = ''; }, 1600);







    }















    Notifications.showToast('เพิ่มกล้องใหม่สำเร็จ', `สร้างช่อง Camera ${nextNum} เรียบร้อยแล้ว`, 'success');







  },















  removeCamera(cid) {







    if (cid === 'cam1' || cid === 'cam2') {







      Notifications.showToast('ไม่สามารถลบได้', `${cid.toUpperCase()} เป็นกล้องหลักของระบบ`, 'warning');







      return;







    }







    if (!confirm(`คุณต้องการลบช่องกล้อง ${cid.toUpperCase()} หรือไม่?`)) {







      return;







    }















    this.disconnect(cid);















    let ids = this.getActiveCameraIds();







    ids = ids.filter(id => id !== cid);







    this.saveActiveCameraIds(ids);















    API._fetch('/api/delete_camera', {







      method: 'POST',







      headers: { 'Content-Type': 'application/json' },







      body: JSON.stringify({ cam_id: cid })







    });















    localStorage.removeItem(`cam_cfg_${cid}`);















    const cardEl = $(`camCard-${cid}`);







    if (cardEl) {







      cardEl.style.transition = 'all 0.3s ease';







      cardEl.style.opacity = '0';







      cardEl.style.transform = 'scale(0.95)';







      setTimeout(() => { if (cardEl) cardEl.remove(); }, 300);







    }















    if (typeof DashboardPage !== 'undefined' && DashboardPage.update) {







      DashboardPage.update();







    }







    if (typeof MonitorPage !== 'undefined' && MonitorPage.renderAllMonitorCards) {







      MonitorPage.renderAllMonitorCards();







      MonitorPage.updateCamInfo();







    }















    Notifications.showToast('ลบกล้องสำเร็จ', `ลบช่อง ${cid.toUpperCase()} เรียบร้อยแล้ว`, 'info');







  },















  ensureCardExists(cid) {







    if ($(`camCard-${cid}`)) return;







    const grid = $('camerasGrid') || document.querySelector('#page-cameras .grid-cam');







    if (!grid) return;















    const numMatch = cid.match(/\d+/);







    const num = numMatch ? numMatch[0] : cid;















    const card = document.createElement('div');







    card.className = 'card';







    card.id = `camCard-${cid}`;







    card.innerHTML = `







      <div class="card-header">







        <div class="card-title">







          <div class="card-icon">







            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">







              <path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>







            </svg>







          </div>







          Camera ${num}







        </div>







        <div class="d-flex align-center gap-8">







          <span class="badge badge-muted" id="${cid}-status-badge">Disconnected</span>







          <button class="btn-icon" onclick="CameraPage.removeCamera('${cid}')" title="ลบช่องกล้องนี้" style="background:rgba(225,29,72,0.08);border:1px solid rgba(225,29,72,0.2);border-radius:6px;cursor:pointer;color:#e11d48;padding:5px 8px;display:flex;align-items:center;transition:all 0.2s;">







            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">







              <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>







            </svg>







          </button>







        </div>







      </div>







      <div class="card-body">







        <div class="form-group">







          <label class="form-label" data-i18n="cam.name">Camera Name</label>







          <input type="text" class="form-control" id="${cid}-name" value="Camera 0${num}" placeholder="e.g. Side Room Camera" />







        </div>







        <div class="form-row">







          <div class="form-group mb-0">







            <label class="form-label" data-i18n="cam.ip">IP Address</label>







            <input type="text" class="form-control" id="${cid}-ip" value="" placeholder="192.168.1.10${num}" oninput="CameraPage.updateRtspPreview('${cid}')" />







          </div>







          <div class="form-group mb-0">







            <label class="form-label" data-i18n="cam.port">RTSP Port</label>







            <input type="text" class="form-control" id="${cid}-port" value="554" placeholder="554" oninput="CameraPage.updateRtspPreview('${cid}')" />







          </div>







        </div>







        <div class="form-row mt-16">







          <div class="form-group mb-0">







            <label class="form-label" data-i18n="cam.user">Username</label>







            <input type="text" class="form-control" id="${cid}-user" value="" placeholder="admin" oninput="CameraPage.updateRtspPreview('${cid}')" />







          </div>







          <div class="form-group mb-0">







            <label class="form-label" data-i18n="cam.pass">Password</label>







            <div class="input-group">







              <input type="password" class="form-control" id="${cid}-pass" value="" placeholder="••••••••" oninput="CameraPage.updateRtspPreview('${cid}')" />







              <span class="input-group-append" onclick="CameraPage.togglePassword('${cid}-pass', this)" title="Show/Hide password">







                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">







                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>







                </svg>







              </span>







            </div>







          </div>







        </div>







        <div class="form-group mt-16">







          <label class="form-label" data-i18n="cam.path">Stream Path</label>







          <input type="text" class="form-control" id="${cid}-path" value="/stream1" placeholder="/stream1" oninput="CameraPage.updateRtspPreview('${cid}')" />







        </div>







        <!-- RTSP Preview -->







        <div class="rtsp-preview" id="${cid}-rtsp-preview">







          <div class="rtsp-label" data-i18n="cam.rtspPreview">RTSP URL Preview</div>







          <span id="${cid}-rtsp-url">—</span>







        </div>







        <!-- Action Buttons -->







        <div class="d-flex gap-8 mt-16">







          <button class="btn btn-primary" onclick="CameraPage.connect('${cid}')">







            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">







              <path d="M5 12h14"/><path d="M12 5l7 7-7 7"/>







            </svg>







            <span data-i18n="cam.connect">Connect</span>







          </button>







          <button class="btn btn-danger" onclick="CameraPage.disconnect('${cid}')">







            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">







              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>







            </svg>







            <span data-i18n="cam.disconnect">Disconnect</span>







          </button>







          <button class="btn btn-secondary" onclick="CameraPage.test('${cid}')">







            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">







              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>







            </svg>







            <span data-i18n="cam.test">Test</span>







          </button>







        </div>







        <!-- Camera Preview -->







        <div class="cam-feed-wrap mt-16">







          <img src="${API_BASE}/video_feed?cam=${cid}" alt="Camera ${num} Feed" id="${cid}-preview"







               style="width:100%;height:100%;object-fit:cover"







               onerror="this.style.display='none';document.getElementById('${cid}-no-signal').style.display='flex'"







               onload="document.getElementById('${cid}-no-signal').style.display='none';this.style.display='block'" />







          <div class="cam-no-signal" id="${cid}-no-signal" style="display:none">







            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">







              <path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>







              <line x1="1" y1="1" x2="23" y2="23"/>







            </svg>







            <p>No Signal</p>







          </div>







        </div>







        <!-- Test Result -->







        <div id="${cid}-test-result" style="display:none;margin-top:10px;" class="text-sm"></div>







      </div>







    `;







    grid.appendChild(card);







    if (typeof I18n !== 'undefined' && I18n.applyToElement) {







      I18n.applyToElement(card);







    }







  }







};















// ═══════════════════════════════════════════════







//  Monitor Page







// ═══════════════════════════════════════════════







const MonitorPage = {







  frameCount: {},







  fps: {},







  lastFpsCalc: 0,







  currentView: 'dual',







  singleCam: 'cam1',















  onEnter() {







    this.renderAllMonitorCards();







    this.updateCamInfo();







    if (!this._fpsTimer) {







      this._fpsTimer = setInterval(() => this.calcFps(), 1000);







    }







  },















  renderAllMonitorCards() {







    const grid = $('dualViewGrid');







    if (!grid) return;







    const ids = (typeof CameraPage !== 'undefined' && CameraPage.getActiveCameraIds) ? CameraPage.getActiveCameraIds() : ['cam1', 'cam2'];















    // Remove cards no longer in activeCameraIds







    const existingCards = grid.querySelectorAll('.monitor-card[data-cam-id]');







    existingCards.forEach(card => {







      const cid = card.getAttribute('data-cam-id');







      if (cid && !ids.includes(cid)) {







        card.remove();







      }







    });















    // Ensure cards exist for each active camera







    ids.forEach(cid => {







      this.ensureMonitorCard(cid);







    });















    // Update single view buttons







    this.renderSingleViewButtons(ids);







  },















  ensureMonitorCard(cid) {







    const grid = $('dualViewGrid');







    if (!grid) return;







    if (grid.querySelector(`.monitor-card[data-cam-id="${cid}"]`)) return;















    const numMatch = cid.match(/\d+/);







    const num = numMatch ? numMatch[0] : cid;







    const cam = AppState.cameras[cid] || {};







    const camName = cam.name || `Camera ${num}`;







    const camUrl = cam.url ? cam.url.replace(/:[^@]*@/, ':***@').substring(0, 30) : '—';















    const card = document.createElement('div');







    card.className = 'monitor-card';







    card.setAttribute('data-cam-id', cid);







    card.id = `mon-card-${cid}`;







    card.innerHTML = `







      <div class="monitor-card-header">







        <h3 id="${cid}-title">${camName}</h3>







        <div class="d-flex align-center gap-8">







          <span class="live-badge"><span class="live-dot"></span>LIVE</span>







          <button class="fullscreen-btn" onclick="MonitorPage.fullscreen('${cid}-feed')" title="Fullscreen">







            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">







              <polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/>







              <line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/>







            </svg>







          </button>







        </div>







      </div>







      <div class="cam-feed-wrap" style="border-radius:0 0 var(--radius-lg) var(--radius-lg);">







        <div class="cam-overlay-top">







          <div class="cam-info">







            <div class="cam-name" id="${cid}-cam-name">${camName}</div>







            <div class="cam-ip" id="${cid}-cam-ip">${camUrl}</div>







          </div>







        </div>







        <img src="${API_BASE}/video_feed?cam=${cid}" id="${cid}-feed" alt="${camName}"







             style="width:100%;height:100%;object-fit:cover;min-height:240px"







             onerror="MonitorPage.showNoSignal('${cid}')"







             onload="MonitorPage.trackFrame('${cid}')" />







        <div class="cam-no-signal" id="${cid}-no-signal" style="display:none;min-height:240px">







          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/><line x1="1" y1="1" x2="23" y2="23"/></svg>







          <p>No Signal – Camera Offline</p>







        </div>







        <div class="cam-overlay-bottom">







          <div class="cam-stats">







            <span class="cam-stat-item">FPS: <strong id="${cid}-fps">—</strong></span>







            <span class="cam-stat-item">Det: <strong id="${cid}-det">0</strong></span>







          </div>







        </div>







        <div class="cam-detect-alert" id="${cid}-alert" style="display:none">







          ⚠ PHONE DETECTED







        </div>







      </div>







    `;







    grid.appendChild(card);







  },















  renderSingleViewButtons(ids) {







    const btnWrap = $('singleCamButtons');







    if (!btnWrap) return;







    btnWrap.innerHTML = ids.map(cid => {







      const numMatch = cid.match(/\d+/);







      const num = numMatch ? numMatch[0] : cid;







      const activeClass = this.singleCam === cid ? 'btn-primary' : 'btn-secondary';







      return `<button class="btn ${activeClass} btn-sm" onclick="MonitorPage.switchSingle('${cid}')">Camera ${num}</button>`;







    }).join(' ');







  },















  trackFrame(id) {







    this.frameCount[id] = (this.frameCount[id] || 0) + 1;







    const feedEl = $(`${id}-feed`);







    const noSig = $(`${id}-no-signal`);







    if (feedEl) feedEl.style.display = 'block';







    if (noSig) noSig.style.display = 'none';







  },















  showNoSignal(id) {







    const feedEl = $(`${id}-feed`);







    const noSig = $(`${id}-no-signal`);







    if (feedEl) feedEl.style.display = 'none';







    if (noSig) noSig.style.display = 'flex';







  },















  calcFps() {
    const ids = (typeof CameraPage !== "undefined" && CameraPage.getActiveCameraIds) ? CameraPage.getActiveCameraIds() : ["cam1", "cam2"];
    ids.forEach(cid => {
      const numMatch = cid.match(/\d+/);
      const monId = numMatch ? ("mon" + numMatch[0]) : cid;
      const cam = AppState.cameras ? AppState.cameras[cid] : null;
      const isOnline = Boolean(cam && cam.online);
      const val = (cam && cam.fps) ? Number(cam.fps).toFixed(1) : "29.5";
      const fpsEl = document.getElementById(cid + "-fps") || document.getElementById(monId + "-fps");
      if (fpsEl) fpsEl.textContent = isOnline ? (val + " FPS") : "—";
    });







  },















  updateCamInfo() {







    const ids = (typeof CameraPage !== 'undefined' && CameraPage.getActiveCameraIds) ? CameraPage.getActiveCameraIds() : ['cam1', 'cam2'];







    ids.forEach(cid => {







      const cam = AppState.cameras[cid] || {};







      const numMatch = cid.match(/\d+/);







      const num = numMatch ? numMatch[0] : cid;







      const monId = `mon${num}`;















      const titleEl = $(`${cid}-title`) || $(`${monId}-title`);







      if (titleEl) titleEl.textContent = cam.name || `Camera ${num}`;















      const nameEl = $(`${cid}-cam-name`) || $(`${monId}-cam-name`);







      if (nameEl) nameEl.textContent = cam.name || `CAM 0${num}`;















      const ipEl = $(`${cid}-cam-ip`) || $(`${monId}-cam-ip`);







      if (ipEl) ipEl.textContent = cam.url ? cam.url.replace(/:[^@]*@/, ':***@').substring(0, 30) : '—';







    });







  },















  updateDetectionAlert(hasPhone) {







    const ids = (typeof CameraPage !== 'undefined' && CameraPage.getActiveCameraIds) ? CameraPage.getActiveCameraIds() : ['cam1', 'cam2'];







    ids.forEach(cid => {







      const numMatch = cid.match(/\d+/);







      const monId = numMatch ? `mon${numMatch[0]}` : cid;







      const alertEl = $(`${cid}-alert`) || $(`${monId}-alert`);







      if (alertEl) alertEl.style.display = hasPhone ? 'flex' : 'none';







    });







    const singleAlert = $('single-alert');







    if (singleAlert) singleAlert.style.display = hasPhone ? 'flex' : 'none';







  },















  updateDetCount(count) {







    const ids = (typeof CameraPage !== 'undefined' && CameraPage.getActiveCameraIds) ? CameraPage.getActiveCameraIds() : ['cam1', 'cam2'];







    ids.forEach(cid => {







      const numMatch = cid.match(/\d+/);







      const monId = numMatch ? `mon${numMatch[0]}` : cid;







      const detEl = $(`${cid}-det`) || $(`${monId}-det`);







      if (detEl) detEl.textContent = cid === 'cam1' ? (count || '0') : '0';







    });







  },















  setView(view) {







    this.currentView = view;







    $('dualViewGrid').style.display = view === 'dual' ? 'grid' : 'none';







    $('singleViewGrid').style.display = view === 'single' ? 'block' : 'none';







    $('viewDual').classList.toggle('active', view === 'dual');







    $('viewSingle').classList.toggle('active', view === 'single');







    if (view === 'single') {







      this.switchSingle(this.singleCam || 'cam1');







    }







  },















  switchSingle(camId) {







    this.singleCam = camId;







    const feedEl = $('single-feed');







    if (feedEl) feedEl.src = `${API_BASE}/video_feed?cam=${camId}&t=${Date.now()}`;







    const cam = AppState.cameras[camId] || {};







    const numMatch = camId.match(/\d+/);







    const num = numMatch ? numMatch[0] : camId;







    setText('singleCamTitle', cam.name || `Camera ${num}`);







    this.renderSingleViewButtons((typeof CameraPage !== 'undefined' && CameraPage.getActiveCameraIds) ? CameraPage.getActiveCameraIds() : ['cam1', 'cam2']);







  },















  fullscreen(imgId) {







    const el = $(imgId);







    if (!el) return;







    if (el.requestFullscreen) el.requestFullscreen();







    else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();







  },







};















// ═══════════════════════════════════════════════







//  History Page







// ═══════════════════════════════════════════════







const HistoryPage = {







  currentModalIndex: -1,















  onEnter() {







    this.loadHistory();







    this.render();







  },















  addEntry(entry) {







    AppState.history.unshift(entry);







    if (AppState.history.length > 500) AppState.history.length = 500;







    this._persistHistory();







    if (AppState.currentPage === 'history') this.render();







    if (AppState.currentPage === 'dashboard') DashboardPage.update();







  },















  _persistHistory() {







    try {







      const toSave = AppState.history.slice(0, 200);







      localStorage.setItem('agy_det_history', JSON.stringify(toSave));







    } catch (e) {}







  },















  async loadHistory() {







    try {







      const res = await API.getHistory({ limit: 100 });







      if (res && res.items && res.items.length) {







        AppState.history = res.items.map(item => ({







          id: item.id,







          ts: item.timestamp,







          camId: item.camera_id,







          label: item.label,







          conf: item.confidence,







          bbox: item.bbox,







          snapshot_path: item.snapshot_path,







          video_path: item.video_path,







          status: item.status || 'pending',







          reviewed_by: item.reviewed_by || '',







          notes: item.notes || '',







          student_name: item.student_name || '',







          seat_number: item.seat_number || '',







          session_id: item.session_id || 'PHYS-101-MID'







        }));







        AppState.detectionToday = AppState.history.length;







        AppState.suspiciousCount = AppState.history.filter(e => isSuspicious(e.label) && e.status !== 'false_alarm').length;







        this._persistHistory();







        if (AppState.currentPage === 'history') this.render();







        if (AppState.currentPage === 'dashboard') DashboardPage.update();







        return;







      }







    } catch (err) {







      console.warn('[History] API fetch fallback to local:', err);







    }







    try {







      const saved = JSON.parse(localStorage.getItem('agy_det_history') || '[]');







      AppState.history = Array.isArray(saved) ? saved : [];







    } catch (e) { AppState.history = []; }







  },















  render() {







    const tbody = $('historyTableBody');







    if (!tbody) return;















    const search  = ($('historySearch')?.value || '').toLowerCase();







    const dateVal = $('historyDate')?.value || '';







    const camF    = $('historyCamFilter')?.value || '';







    const statF   = $('historyStatusFilter')?.value || '';















    let items = AppState.history.filter(e => {







      if (search) {







        const fullTxt = `${e.label || ''} ${e.student_name || ''} ${e.seat_number || ''} ${e.camId || ''} ${e.notes || ''}`.toLowerCase();







        if (!fullTxt.includes(search)) return false;







      }







      if (camF && e.camId !== camF) return false;







      if (dateVal) {







        const eDate = new Date(e.ts * 1000).toISOString().split('T')[0];







        if (eDate !== dateVal) return false;







      }







      if (statF === 'confirmed' && e.status !== 'confirmed') return false;







      if (statF === 'pending' && e.status !== 'pending') return false;







      if (statF === 'false_alarm' && e.status !== 'false_alarm') return false;







      if (statF === 'phone' && !isPhone(e.label)) return false;







      if (statF === 'suspicious' && !isSuspicious(e.label)) return false;







      return true;







    });















    setText('historyCount', `${items.length} event${items.length !== 1 ? 's' : ''}`);















    if (!items.length) {







      tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state" style="padding:32px">







        <div class="empty-icon"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></div>







        <h3>No history matching filter</h3>







        <p>No detection events found matching your criteria.</p>







      </div></td></tr>`;







      return;







    }















    tbody.innerHTML = items.map((e) => {







      const origIdx = AppState.history.indexOf(e);







      let statusBadge = '';







      if (e.status === 'confirmed') {







        statusBadge = `<span class="badge-confirmed">Confirmed</span>`;







      } else if (e.status === 'false_alarm') {







        statusBadge = `<span class="badge-false-alarm">False Alarm</span>`;







      } else {







        statusBadge = `<span class="badge-pending">Pending</span>`;







      }















      const camInfo = AppState.cameras[e.camId] || {};







      const camName = camInfo.name || (e.camId || 'cam1').toUpperCase();







      const confPct = Math.round((e.conf || 0) * 100);







      const fillClass = confPct >= 75 ? 'high' : confPct >= 50 ? 'medium' : 'low';















      const thumbHtml = e.snapshot_path







        ? `<img src="${e.snapshot_path}" alt="Snap" onerror="this.style.display='none';this.nextElementSibling.style.display='block'" /><div style="display:none;font-size:10px;color:#94a3b8">NO IMG</div>`







        : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="5" y="2" width="14" height="20" rx="2"/><circle cx="12" cy="18" r="1"/></svg>`;















      const stuName = e.student_name ? escapeHtml(e.student_name) : 'Examinee';







      const seatNo = e.seat_number ? `<span style="display:inline-block;margin-left:4px;padding:1px 6px;border-radius:4px;background:rgba(62,106,225,0.08);color:#3e6ae1;font-size:0.75rem;font-weight:600">${escapeHtml(e.seat_number)}</span>` : '';















      return `<tr>







        <td>







          <div class="snap-thumb" onclick="HistoryPage.openEvidenceModal(${origIdx})" title="Click to view evidence clip">







            ${thumbHtml}







          </div>







        </td>







        <td style="font-size:0.8rem;white-space:nowrap">${formatDateTime(e.ts)}</td>







        <td style="font-size:0.82rem;font-weight:500">${escapeHtml(camName)}</td>







        <td style="font-size:0.82rem">${stuName} ${seatNo}</td>







        <td style="font-size:0.82rem;font-weight:500">${escapeHtml(e.label || '—')}</td>







        <td>







          <div class="progress-wrap">







            <div class="progress-bar" style="max-width:70px"><div class="progress-fill ${fillClass}" style="width:${confPct}%"></div></div>







            <span class="progress-label">${confPct}%</span>







          </div>







        </td>







        <td>${statusBadge}</td>







        <td>







          <div class="d-flex gap-8">







            <button class="btn btn-secondary btn-sm" onclick="HistoryPage.openEvidenceModal(${origIdx})" style="display:inline-flex;align-items:center;gap:4px;font-size:0.75rem;padding:4px 9px;">







              <span>📹 View</span>







            </button>







          </div>







        </td>







      </tr>`;







    }).join('');







  },















  switchMediaTab(tab) {
    const vPlayer = $('evVideoPlayer');
    const imgPreview = $('evImagePreview');
    const btnVideo = $('evTabVideo');
    const btnPhoto = $('evTabPhoto');
    const recBadge = document.querySelector('.evidence-rec-badge');

    if (tab === 'video') {
      if (btnVideo) { btnVideo.className = 'btn btn-sm btn-primary'; btnVideo.style.fontWeight = '700'; }
      if (btnPhoto) { btnPhoto.className = 'btn btn-sm btn-secondary'; btnPhoto.style.fontWeight = '400'; }
      if (imgPreview) imgPreview.style.display = 'none';
      if (vPlayer) {
        vPlayer.style.display = 'block';
        vPlayer.currentTime = 0;
        vPlayer.play().catch(() => {});
      }
      if (recBadge) recBadge.style.display = 'flex';
    } else {
      if (btnPhoto) { btnPhoto.className = 'btn btn-sm btn-primary'; btnPhoto.style.fontWeight = '700'; }
      if (btnVideo) { btnVideo.className = 'btn btn-sm btn-secondary'; btnVideo.style.fontWeight = '400'; }
      if (vPlayer) {
        vPlayer.pause();
        vPlayer.style.display = 'none';
      }
      if (imgPreview) imgPreview.style.display = 'block';
      if (recBadge) recBadge.style.display = 'none';
    }
  },

  openEvidenceModal(idx) {







    const e = AppState.history[idx];







    if (!e) return;







    this.currentModalIndex = idx;















    const modal = $('evidenceModal');







    if (!modal) return;















    setText('evModalTitle', e.label || 'AI Incident Evidence');







    setText('evModalSubtitle', `${formatDateTime(e.ts)} · ${(AppState.cameras[e.camId] || {}).name || e.camId}`);















    setText('evCamBadge', (AppState.cameras[e.camId] || {}).name || (e.camId || 'CAM 01').toUpperCase());







    setText('evTimeBadge', formatTime(e.ts));







    setText('evSessionBadge', e.session_id || 'PHYS-101-MID');















    setText('evStudentName', e.student_name || 'Examinee');







    setText('evSeatNumber', e.seat_number || 'A-01');







    setText('evEventType', e.label || 'Cheating Suspicion');







    setText('evConfidence', `${Math.round((e.conf || 0) * 100)}% (Confidence Score)`);















    const badgeWrap = $('evStatusBadge');







    if (badgeWrap) {







      if (e.status === 'confirmed') {







        badgeWrap.innerHTML = `<span class="badge-confirmed">Confirmed Violation</span>`;







      } else if (e.status === 'false_alarm') {







        badgeWrap.innerHTML = `<span class="badge-false-alarm">False Alarm / Dismissed</span>`;







      } else {







        badgeWrap.innerHTML = `<span class="badge-pending">Pending Review</span>`;







      }







    }















    const defaultNotes = isPhone(e.label)







      ? 'YOLO object detector identified smartphone form factor with emissive screen reflectance during exam session.'







      : 'Facial Landmark mesh and head orientation tracked sustained yaw deviation exceeding normal exam margin threshold.';







    setText('evAiNotes', e.notes || defaultNotes);















    const pNotesInput = $('evProctorNotes');







    if (pNotesInput) {







      pNotesInput.value = e.reviewed_by ? `[${e.reviewed_by}] ${e.notes || ''}` : (e.notes || '');







    }















    const vPlayer = $('evVideoPlayer');
    const imgPreview = $('evImagePreview');

    if (vPlayer) {
      vPlayer.src = e.video_path || '';
    }
    if (imgPreview) {
      imgPreview.src = e.snapshot_path || (e.video_path ? '' : `${API_BASE}/video_feed?cam=${e.camId || 'cam1'}`);
    }

    if (e.video_path) {
      this.switchMediaTab('video');
    } else if (e.snapshot_path) {
      this.switchMediaTab('photo');
    } else {
      this.switchMediaTab('photo');
    }















    modal.style.display = 'flex';







  },















  closeEvidenceModal() {







    const modal = $('evidenceModal');







    if (modal) modal.style.display = 'none';







    const vPlayer = $('evVideoPlayer');







    if (vPlayer) {







      vPlayer.pause();







      vPlayer.src = '';







    }







    this.currentModalIndex = -1;







  },















  async submitReview(status) {







    if (this.currentModalIndex < 0 || this.currentModalIndex >= AppState.history.length) return;







    const e = AppState.history[this.currentModalIndex];







    const notes = ($('evProctorNotes')?.value || '').trim();















    e.status = status;







    e.reviewed_by = 'TuNa';







    e.notes = notes;















    try {







      await API._fetch('/api/history/update_status', {







        method: 'POST',







        headers: { 'Content-Type': 'application/json' },







        body: JSON.stringify({







          id: e.id,







          status: status,







          reviewed_by: 'TuNa',







          notes: notes







        })







      });







      Notifications.showToast(







        status === 'confirmed' ? 'Violation Confirmed' : 'Marked False Alarm',







        `Incident for ${e.student_name || e.label} updated by TuNa.`,







        status === 'confirmed' ? 'danger' : 'success'







      );







    } catch (err) {







      console.warn('Failed to update status on server:', err);







    }















    this._persistHistory();







    this.render();







    if (typeof DashboardPage !== 'undefined' && DashboardPage.update) {







      DashboardPage.update();







    }







    this.closeEvidenceModal();







  },















  view(idx) {







    this.openEvidenceModal(idx);







  },















  exportCSV() {







    const rows = [['Time', 'Camera', 'Student', 'Seat', 'Label', 'Confidence', 'Status']];







    AppState.history.forEach(e => {







      rows.push([







        formatDateTime(e.ts),







        (AppState.cameras[e.camId] || {}).name || e.camId || '—',







        e.student_name || 'Examinee',







        e.seat_number || '—',







        e.label || '—',







        Math.round((e.conf || 0) * 100) + '%',







        e.status || 'pending',







      ]);







    });







    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');







    const blob = new Blob([csv], { type: 'text/csv' });







    const url = URL.createObjectURL(blob);







    const a = document.createElement('a');







    a.href = url;







    a.download = `exam_integrity_history_${new Date().toISOString().split('T')[0]}.csv`;







    a.click();







    URL.revokeObjectURL(url);







    Notifications.showToast('Export Complete', `${AppState.history.length} records exported.`, 'success');







  },















  async clearHistory() {







    if (!confirm('Clear all detection history? This cannot be undone.')) return;







    AppState.history = [];







    AppState.suspiciousCount = 0;







    this._persistHistory();







    this.render();







    await API.clearHistory();







    Notifications.showToast('History Cleared', 'All detection records removed.', 'info');







  },







};















// ═══════════════════════════════════════════════







//  AI Page







// ═══════════════════════════════════════════════







const AiPage = {







  updateStatus() {







    const el = $('aiStatusText');







    if (!el) return;







    const det = AppState.detections;







    if (!det || !det.timestamp) {







      el.textContent = 'Unknown (backend unreachable)';







      return;







    }







    const age = Date.now() / 1000 - (det.timestamp || 0);







    if (age < 5) {







      el.textContent = '🟢 Active – receiving detections';







    } else if (age < 30) {







      el.textContent = '🟡 Idle – no recent data';







    } else {







      el.textContent = '🔴 Inactive – no data for ' + Math.round(age) + 's';







    }







  },







};















// ═══════════════════════════════════════════════







//  Settings Page







// ═══════════════════════════════════════════════







const SettingsPage = {







  defaults: {







    systemName: 'Smart AI Exam Integrity',







    examCode: 'PHYS-101-MID',







    examRoom: 'Room 301',







    proctorName: 'TuNa (Proctor)',







    language: 'th',







    backendUrl: 'http://localhost:5000',







    port: '5000',







    ciraPort: '5055',







    alertSound: true,







    toastEnabled: true,







    toastDuration: '5',







    autoOpenEvidence: true,







    muteAll: false,







  },
  async load() {
    this.bindEvents();
    let saved = {};
    try {
      const stored = localStorage.getItem('agy_settings');
      if (stored) saved = JSON.parse(stored);
    } catch (e) {
      console.warn('Failed parsing local agy_settings:', e);
    }

    try {
      if (typeof API !== 'undefined' && API._fetch) {
        const srv = await API._fetch('/api/settings');
        if (srv && typeof srv === 'object' && Object.keys(srv).length > 0) {
          saved = { ...srv, ...saved };
        }
      }
    } catch (e) {}

    const cfg = { ...this.defaults, ...saved };
    AppState.settings = cfg;

    this.applySettingsToDOM(cfg);
    this.applySettingsToUI(cfg);
    this.updateStorageStats();
  },

  applySettingsToDOM(cfg) {
    this._set('set-system-name', cfg.systemName);
    this._set('set-exam-code', cfg.examCode);
    this._set('set-exam-room', cfg.examRoom);
    this._set('set-proctor-name', cfg.proctorName);
    this._set('set-language', cfg.language);
    this._set('set-backend-url', cfg.backendUrl);
    this._set('set-port', cfg.port);
    this._set('set-cira-port', cfg.ciraPort);
    this._setChk('set-alert-sound', cfg.alertSound !== false);
    this._setChk('set-toast', cfg.toastEnabled !== false);
    this._set('set-toast-duration', cfg.toastDuration || '5');
    this._setChk('set-auto-open-evidence', cfg.autoOpenEvidence !== false);
    this._setChk('set-mute-all', cfg.muteAll === true);
  },

  applySettingsToUI(cfg) {
    const notifBadge = $('notifSessionBadge');
    if (notifBadge) notifBadge.textContent = cfg.examCode;
    const evSessionBadge = $('evSessionBadge');
    if (evSessionBadge) evSessionBadge.textContent = cfg.examCode;
  },

  bindEvents() {
    const page = $('page-settings');
    if (page && !page._eventsBound) {
      page._eventsBound = true;
      page.addEventListener('change', (e) => {
        if (e.target && e.target.id && e.target.id.startsWith('set-')) {
          this.autoSave();
        }
      });
      page.addEventListener('input', (e) => {
        if (e.target && e.target.id && (e.target.id === 'set-toast-duration' || e.target.id.startsWith('set-'))) {
          this.autoSave();
        }
      });
    }
  },

  autoSave() {
    this.save(true);
  },

  save(silent = false) {
    const getVal = (id, fallback) => {
      const el = $(id);
      return el ? el.value : fallback;
    };
    const getChk = (id, fallback) => {
      const el = $(id);
      return el ? el.checked : fallback;
    };

    const cfg = {
      systemName:       getVal('set-system-name', this.defaults.systemName),
      examCode:         getVal('set-exam-code', this.defaults.examCode),
      examRoom:         getVal('set-exam-room', this.defaults.examRoom),
      proctorName:      getVal('set-proctor-name', this.defaults.proctorName),
      language:         getVal('set-language', 'th'),
      backendUrl:       getVal('set-backend-url', this.defaults.backendUrl),
      port:             getVal('set-port', '5000'),
      ciraPort:         getVal('set-cira-port', '5055'),
      alertSound:       getChk('set-alert-sound', true),
      toastEnabled:     getChk('set-toast', true),
      toastDuration:    getVal('set-toast-duration', '5'),
      autoOpenEvidence: getChk('set-auto-open-evidence', true),
      muteAll:          getChk('set-mute-all', false),
    };

    try {
      localStorage.setItem('agy_settings', JSON.stringify(cfg));
    } catch (e) {
      console.warn('Failed saving to localStorage:', e);
    }
    AppState.settings = cfg;

    // Async push to server
    try {
      if (typeof API !== 'undefined' && API._fetch) {
        API._fetch('/api/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(cfg)
        }).catch(() => {});
      }
    } catch (e) {}

    this.applySettingsToUI(cfg);

    if (cfg.language && typeof I18n !== 'undefined' && I18n.lang !== cfg.language) {
      I18n.setLang(cfg.language);
    }

    if (!silent) {
      if (typeof Notifications !== 'undefined' && Notifications.showToast) {
        Notifications.showToast('Settings Saved', 'บันทึกการตั้งค่าระบบเรียบร้อยแล้ว', 'success');
      }
    }
  },

  resetDefaults() {
    if (!confirm('ต้องการคืนค่าการตั้งค่าทั้งหมดกลับเป็นค่าเริ่มต้นหรือไม่?')) return;
    localStorage.removeItem('agy_settings');
    AppState.settings = { ...this.defaults };
    this.applySettingsToDOM(AppState.settings);
    this.applySettingsToUI(AppState.settings);
    try {
      if (typeof API !== 'undefined' && API._fetch) {
        API._fetch('/api/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(this.defaults)
        }).catch(() => {});
      }
    } catch (e) {}
    if (typeof Notifications !== 'undefined' && Notifications.showToast) {
      Notifications.showToast('คืนค่าสำเร็จ', 'รีเซ็ตการตั้งค่ากลับเป็นค่าเริ่มต้นแล้ว', 'info');
    }
  },
















  updateStorageStats() {







    const dbCountEl = $('setStorageDbCount');







    if (dbCountEl) {







      dbCountEl.textContent = `${AppState.history ? AppState.history.length : 15} รายการ`;







    }







  },















  backupDB() {







    window.location.href = '/api/backup_db';







    Notifications.showToast('Backup DB', 'กำลังดาวน์โหลดไฟล์สำรองฐานข้อมูล detections.db', 'success');







  },















  async clearHistoryPrompt() {







    if (!confirm('ต้องการล้างข้อมูลประวัติการตรวจจับทั้งหมดใช่หรือไม่? การกระทำนี้ไม่สามารถย้อนกลับได้')) return;







    try {







      await API.clearHistory();







      AppState.history = [];







      this.updateStorageStats();







      if (typeof HistoryPage !== 'undefined' && HistoryPage.render) HistoryPage.render();







      if (typeof DashboardPage !== 'undefined' && DashboardPage.update) DashboardPage.update();







      Notifications.showToast('Clear History', 'ล้างข้อมูลประวัติเรียบร้อยแล้ว', 'info');







    } catch (e) {







      Notifications.showToast('Error', 'ไม่สามารถล้างข้อมูลได้: ' + e.message, 'danger');







    }







  },















  _set(id, val) { const el = $(id); if (el) el.value = val; },







  _setVal(id, val) { const el = $(id); if (el) el.textContent = val; },







  _setChk(id, val) { const el = $(id); if (el) el.checked = !!val; },







};















//  Polling Module







// ═══════════════════════════════════════════════







const Polling = {







  _detTimer: null,







  _camTimer: null,















  startAll() {







    this.pollDetections();







    this.pollCameras();







  },















  async pollDetections() {







    const data = await API.getDetections();







    if (data) {







      AppState.detections = data;







      this._processDetections(data);







    }







    // Periodically sync SQLite history for real-time snapshots & video clips
    this._historySyncCounter = (this._historySyncCounter || 0) + 1;
    if (this._historySyncCounter % 2 === 0) {
      HistoryPage.loadHistory();
    }

    // Schedule next poll







    this._detTimer = setTimeout(() => this.pollDetections(), AppState.pollIntervalMs);







  },















  async pollCameras() {







    const data = await API.getCameras();







    if (data) {







      AppState.cameras = data;







      this._processCameraStatus(data);







    }







      // Update FPS indicators across all cards
      if (data) {
        Object.keys(data).forEach(cid => {
          const cam = data[cid];
          const fpsStr = (cam && cam.fps ? Number(cam.fps).toFixed(1) : '29.5') + ' FPS';
          const fpsEl = $(`${cid}-fps`) || $(`mon${cid.replace('cam','')}-fps`);
          if (fpsEl) fpsEl.textContent = fpsStr;
          const dashBadge = $(`${cid}-fps-badge`);
          if (dashBadge) dashBadge.textContent = fpsStr;
        });
      }

    this._camTimer = setTimeout(() => this.pollCameras(), 2000);







  },















  _processDetections(data) {







    const items = data.items || [];







    const ts = data.timestamp || 0;















    // Update chart data bucket







    this._updateChartBucket(items.length);















    // Check for phone detections







    const phoneItems = items.filter(it => isPhone(it.label));







    const hasPhone = phoneItems.length > 0;















    // Add to history if new detection







    if (ts > AppState.lastDetectionTs && items.length > 0) {
      AppState.lastDetectionTs = ts;
      HistoryPage.loadHistory();
    }















    // Phone alert







    if (hasPhone) {







      Notifications.playAlert();







      if (AppState.settings.toastEnabled !== false) {







        const phone = phoneItems[0];







        Notifications.showToast(







          '⚠️ PHONE DETECTED',







          `Camera 1 · ${phone.name || phone.label} · ${Math.round(phone.confidence * 100)}% confidence`,







          'danger'







        );

      }

      if (AppState.settings.autoOpenEvidence) {
        const modal = $('evidenceModal');
        if (modal && modal.style.display !== 'flex') {
          setTimeout(() => {
            if (AppState.history && AppState.history.length > 0) {
              HistoryPage.openEvidenceModal(0);
            }
          }, 350);
        }
      }

    }















    // Update monitor alerts







    MonitorPage.updateDetectionAlert(hasPhone);







    MonitorPage.updateDetCount(items.length);















    // Update dashboard if visible







    if (AppState.currentPage === 'dashboard') DashboardPage.update();







    if (AppState.currentPage === 'ai') AiPage.updateStatus();







  },















  _updateChartBucket(count) {







    const now = Date.now();







    const bucket = Math.floor(now / (30 * 60 * 1000)) % 12;







    if (count > 0) {







      AppState.chartData[bucket] = (AppState.chartData[bucket] || 0) + count;







    }







  },















  _processCameraStatus(data) {







    const online = Object.values(data).filter(c => c.online).length;







    const total  = Object.keys(data).length;















    // Sidebar status







    const pill = $('sidebarStatus');







    const pillTxt = $('sidebarStatusText');







    const topBadge = $('topbarBadge');







    const topBadgeTxt = $('topbarBadgeText');















    if (online > 0) {







      if (pill) { pill.className = 'status-pill'; }







      if (pillTxt) pillTxt.textContent = 'SYSTEM ONLINE';







      if (topBadge) { topBadge.className = 'topbar-badge'; }







      if (topBadgeTxt) topBadgeTxt.textContent = 'SYSTEM ONLINE';







    } else {







      if (pill) { pill.className = 'status-pill standby'; }







      if (pillTxt) pillTxt.textContent = 'SYSTEM STANDBY';







      if (topBadge) { topBadge.className = 'topbar-badge warning'; }







      if (topBadgeTxt) topBadgeTxt.textContent = 'STANDBY';







    }















    // Update pages







    if (AppState.currentPage === 'dashboard') DashboardPage.update();







    if (AppState.currentPage === 'cameras') {







      ['cam1', 'cam2'].forEach(cid => CameraPage.updateStatusBadge(cid));







    }







    if (AppState.currentPage === 'monitor') MonitorPage.updateCamInfo();















    // Update monitor subtitle







    const sub = $('monitorSubtitle');







    if (sub) sub.textContent = `${online} Camera${online !== 1 ? 's' : ''} Active`;







  },







};















// ═══════════════════════════════════════════════







//  System Status (once on load, then every 30s)







// ═══════════════════════════════════════════════







const SystemStatus = {







  async fetch() {







    const data = await API.getSystemStatus();







    if (data) {







      AppState.detectionToday = data.detections_today || 0;







      if (AppState.currentPage === 'dashboard') DashboardPage.update();







    }







    setTimeout(() => this.fetch(), 30000);







  },







};















// ═══════════════════════════════════════════════







//  I18n – Bilingual EN / TH







// ═══════════════════════════════════════════════







const I18n = {







  lang: 'en',















  dict: {







    en: {







      // Sidebar







      'nav.dashboard':   'Dashboard',







      'nav.cameras':     'Camera Management',







      'nav.monitor':     'Live Monitoring',







      'nav.history':     'Detection History',







      'nav.ai':          'AI Configuration',







      'nav.settings':    'System Settings',







      'nav.mainmenu':    'MAIN MENU',







      'nav.config':      'CONFIGURATION',







      // Topbar







      'topbar.subtitle': 'Smart AI Exam Integrity System',







      // Stat cards







      'stat.totalCams':       'Total Cameras',







      'stat.totalCamsTrend':  'Configured cameras',







      'stat.activeCams':      'Active Cameras',







      'stat.activeTrend':     'Currently streaming',







      'stat.detectionsToday': 'Detections Today',







      'stat.detectionsTrend': 'From history',







      'stat.suspicious':      'Suspicious Events',







      'stat.suspiciousTrend': 'Phone detections',







      // Dashboard cards







      'dash.activity':   'Detection Status Proportion',







      'dash.live':       'Live',







      'dash.camStatus':  'Live Camera Status',







      'dash.recent':     'Recent Detections',







      'dash.last10':     'Last 10 events',







      // Table headers







      'th.time':         'Time',







      'th.camera':       'Camera',







      'th.object':       'Object',



      'th.student':      'Examinee & Incident',



      'th.action':       'Action',







      'th.confidence':   'Confidence',







      'th.status':       'Status',







      'th.snapshot':     'Snapshot',







      'th.datetime':     'Date / Time',







      'th.actions':      'Actions',







      // Camera page







      'cam.subtitle':    'Configure and connect IP cameras via RTSP. Settings are saved automatically.',







      'cam.name':        'Camera Name',







      'cam.ip':          'IP Address',







      'cam.port':        'RTSP Port',







      'cam.user':        'Username',







      'cam.pass':        'Password',







      'cam.path':        'Stream Path',







      'cam.rtspPreview': 'RTSP URL PREVIEW',







      'cam.connect':     'Connect',







      'cam.disconnect':  'Disconnect',







      'cam.test':        'Test',







      'cam.preview':     'Live Preview',







      'cam.addCamera':   'Add Camera',







      // Monitor page







      'mon.subtitle':    'Real-time camera feeds with AI detection overlay',







      'mon.fullscreen':  'Fullscreen',







      'mon.exitFull':    'Exit Fullscreen',







      'mon.fps':         'FPS',







      'mon.res':         'Resolution',







      // History page







      'hist.subtitle':   'All detection events recorded by the AI system',







      'hist.filter':     'Filter by Camera',







      'hist.allCams':    'All Cameras',







      'hist.search':     'Search...',







      'hist.clear':      'Clear History',







      'hist.download':   'Download',







      'hist.view':       'View',







      // Settings page







      'set.general':     'General',







      'set.sysName':     'System Name',







      'set.language':    'Language',







      'set.server':      'Server',







      'set.backendUrl':  'Backend URL',







      'set.port':        'Port',







      'set.detection':   'Detection',







      'set.confidence':  'Confidence Threshold',







      'set.interval':    'Poll Interval (ms)',







      'set.alerts':      'Alerts',







      'set.alertSound':  'Alert Sound',







      'set.toast':       'Toast Notifications',







      'set.toastDur':    'Toast Duration (s)',







      'set.save':        'Save Settings',







      // AI page







      'ai.soon':         'AI Configuration coming soon.',







      // Status







      'status.online':   'Online',







      'status.offline':  'Offline',







      'status.connected':'Connected',







      'status.disconnected': 'Disconnected',







      'status.connecting':'Connecting…',







      'status.error':    'Error',







      'cam.soon':        'SOON',







    },







    th: {







      // Sidebar







      'nav.dashboard':   'แดชบอร์ด',







      'nav.cameras':     'จัดการกล้อง',







      'nav.monitor':     'ดูภาพสด',







      'nav.history':     'ประวัติการตรวจจับ',







      'nav.ai':          'ตั้งค่า AI',







      'nav.settings':    'ตั้งค่าระบบ',







      'nav.mainmenu':    'เมนูหลัก',







      'nav.config':      'การตั้งค่า',







      // Topbar







      'topbar.subtitle': 'ระบบตรวจจับการทุจริตในห้องสอบ AI',







      // Stat cards







      'stat.totalCams':       'กล้องทั้งหมด',







      'stat.totalCamsTrend':  'กล้องที่ตั้งค่าแล้ว',







      'stat.activeCams':      'กล้องที่ใช้งานอยู่',







      'stat.activeTrend':     'กำลังสตรีมอยู่',







      'stat.detectionsToday': 'ตรวจพบวันนี้',







      'stat.detectionsTrend': 'จากประวัติ',







      'stat.suspicious':      'เหตุการณ์ต้องสงสัย',







      'stat.suspiciousTrend': 'ตรวจพบโทรศัพท์',







      // Dashboard cards







      'dash.activity':   'สัดส่วนสถานะการตรวจจับ',







      'dash.live':       'สด',







      'dash.camStatus':  'สถานะกล้องสด',







      'dash.recent':     'รายการตรวจจับล่าสุด',







      'dash.last10':     '10 รายการล่าสุด',







      // Table headers







      'th.time':         'เวลา',







      'th.camera':       'กล้อง',







      'th.object':       'วัตถุ',



      'th.student':      'ผู้เข้าสอบ & เหตุการณ์ที่พบ',



      'th.action':       'การดำเนินการ',







      'th.confidence':   'ความแม่นยำ',







      'th.status':       'สถานะ',







      'th.snapshot':     'ภาพถ่าย',







      'th.datetime':     'วัน / เวลา',







      'th.actions':      'จัดการ',







      // Camera page







      'cam.subtitle':    'ตั้งค่าและเชื่อมต่อกล้อง IP ผ่าน RTSP ระบบจะบันทึกการตั้งค่าให้อัตโนมัติ',







      'cam.name':        'ชื่อกล้อง',







      'cam.ip':          'IP Address',







      'cam.port':        'RTSP Port',







      'cam.user':        'ชื่อผู้ใช้',







      'cam.pass':        'รหัสผ่าน',







      'cam.path':        'Stream Path',







      'cam.rtspPreview': 'ตัวอย่าง RTSP URL',







      'cam.connect':     'เชื่อมต่อ',







      'cam.disconnect':  'ตัดการเชื่อมต่อ',







      'cam.test':        'ทดสอบ',







      'cam.preview':     'ภาพตัวอย่างสด',







      'cam.addCamera':   'เพิ่มกล้อง',







      // Monitor page







      'mon.subtitle':    'ภาพสดจากกล้องพร้อมระบบตรวจจับ AI',







      'mon.fullscreen':  'เต็มหน้าจอ',







      'mon.exitFull':    'ออกจากเต็มหน้าจอ',







      'mon.fps':         'FPS',







      'mon.res':         'ความละเอียด',







      // History page







      'hist.subtitle':   'รายการเหตุการณ์ที่ AI ตรวจพบทั้งหมด',







      'hist.filter':     'กรองตามกล้อง',







      'hist.allCams':    'ทุกกล้อง',







      'hist.search':     'ค้นหา...',







      'hist.clear':      'ล้างประวัติ',







      'hist.download':   'ดาวน์โหลด',







      'hist.view':       'ดู',







      // Settings page







      'set.general':     'ทั่วไป',







      'set.sysName':     'ชื่อระบบ',







      'set.language':    'ภาษา',







      'set.server':      'เซิร์ฟเวอร์',







      'set.backendUrl':  'Backend URL',







      'set.port':        'พอร์ต',







      'set.detection':   'การตรวจจับ',







      'set.confidence':  'ระดับความแม่นยำ',







      'set.interval':    'รอบการโพลล์ (ms)',







      'set.alerts':      'การแจ้งเตือน',







      'set.alertSound':  'เสียงแจ้งเตือน',







      'set.toast':       'การแจ้งเตือนบนหน้าจอ',







      'set.toastDur':    'ระยะเวลาแจ้งเตือน (วินาที)',







      'set.save':        'บันทึกการตั้งค่า',







      // AI page







      'ai.soon':         'การตั้งค่า AI จะเปิดให้ใช้เร็วๆ นี้',







      // Status







      'status.online':   'ออนไลน์',







      'status.offline':  'ออฟไลน์',







      'status.connected':'เชื่อมต่อแล้ว',







      'status.disconnected': 'ยังไม่เชื่อมต่อ',







      'status.connecting':'กำลังเชื่อมต่อ…',







      'status.error':    'เกิดข้อผิดพลาด',







      'cam.soon':        'เร็วๆ นี้',







    },







  },















  t(key) {







    return (this.dict[this.lang] || this.dict.en)[key] || key;







  },















  apply() {







    document.querySelectorAll('[data-i18n]').forEach(el => {







      const key = el.dataset.i18n;







      el.textContent = this.t(key);







    });







    document.querySelectorAll('[data-i18n-ph]').forEach(el => {







      el.placeholder = this.t(el.dataset.i18nPh);







    });







    // Update html lang attribute







    document.documentElement.lang = this.lang;







  },















  setLang(lang) {







    this.lang = lang;







    AppState.settings.language = lang;







    localStorage.setItem('agy_lang', lang);







    this.apply();







    if (typeof DashboardPage !== 'undefined' && AppState.currentPage === 'dashboard') DashboardPage.renderChart();







    // Sync the settings dropdown if visible







    const sel = document.getElementById('set-language');







    if (sel) sel.value = lang;







    // Update toggle button active states







    document.querySelectorAll('.lang-btn').forEach(btn => {







      btn.classList.toggle('active', btn.dataset.lang === lang);







    });







  },















  init() {







    // Priority: localStorage lang > settings.language > 'en'







    const saved = localStorage.getItem('agy_lang')







      || AppState.settings.language







      || 'en';







    this.lang = saved;







    this.apply();







    if (typeof DashboardPage !== 'undefined' && AppState.currentPage === 'dashboard') DashboardPage.renderChart();







    document.querySelectorAll('.lang-btn').forEach(btn => {







      btn.classList.toggle('active', btn.dataset.lang === saved);







    });







  },







};















// ═══════════════════════════════════════════════







//  Bootstrap







// ═══════════════════════════════════════════════







(function init() {







  Banner.init();







  Notifications.init();







  NotifDropdown.init();







  Clock.init();







  SettingsPage.load();







  HistoryPage.loadHistory().then(() => { DashboardPage.update(); if (typeof NotifDropdown !== 'undefined') NotifDropdown.updateDot(); });







  Nav.init();







  I18n.init();          // ← apply translations on load







  Polling.startAll();







  SystemStatus.fetch();















  // Hook settings language dropdown so changes apply immediately







  const langSel = document.getElementById('set-language');







  if (langSel) {







    langSel.addEventListener('change', () => I18n.setLang(langSel.value));







  }















  // Initial dashboard render







  DashboardPage.update();







  CameraPage.onEnter();







  MonitorPage.onEnter();















  console.log('[Smart AI Dashboard] v2.0.0 ready. Polling backend at', API_BASE || 'same origin');







})();







