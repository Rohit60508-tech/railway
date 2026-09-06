/**
 * dashboard-charts.js
 * Draws the block utilization bar chart and populates the alert log
 * inside the Dashboard Preview section using Canvas 2D.
 */

(function () {
  'use strict';

  /* ── Block Utilization Chart ──────────────────────────── */
  const chartCanvas = document.getElementById('util-chart');
  if (chartCanvas) {
    const ctx = chartCanvas.getContext('2d');
    const W = chartCanvas.width;
    const H = chartCanvas.height;

    const hours = ['00','02','04','06','08','10','12','14','16','18','20','22'];
    const data  = [12, 18, 14, 22, 68, 85, 91, 94, 88, 82, 72, 45];
    const BAR_COUNT = hours.length;
    const PADDING = { top: 16, right: 12, bottom: 28, left: 36 };
    const chartW = W - PADDING.left - PADDING.right;
    const chartH = H - PADDING.top  - PADDING.bottom;
    const barW   = chartW / BAR_COUNT - 4;

    let animFrame = 0;
    const ANIM_FRAMES = 40;

    function drawChart(progress) {
      ctx.clearRect(0, 0, W, H);

      // Background
      ctx.fillStyle = 'rgba(2, 8, 20, 0)';
      ctx.fillRect(0, 0, W, H);

      // Y-axis grid
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.lineWidth = 1;
      [0, 25, 50, 75, 100].forEach(v => {
        const y = PADDING.top + chartH - (v / 100) * chartH;
        ctx.beginPath();
        ctx.moveTo(PADDING.left, y);
        ctx.lineTo(W - PADDING.right, y);
        ctx.stroke();

        ctx.fillStyle = '#94A3B8';
        ctx.font = '600 9px Inter, sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(`${v}%`, PADDING.left - 4, y + 3);
      });

      // Bars
      data.forEach((value, i) => {
        const animValue = value * Math.min(progress, 1);
        const x = PADDING.left + i * (chartW / BAR_COUNT) + 2;
        const barH = (animValue / 100) * chartH;
        const y = PADDING.top + chartH - barH;

        // Gradient fill
        const grad = ctx.createLinearGradient(0, y, 0, y + barH);
        const hue = value > 85 ? '#DC2626' : value > 60 ? '#D9531E' : '#0056B3';
        grad.addColorStop(0, hue + 'dd');
        grad.addColorStop(1, hue + '33');

        ctx.beginPath();
        ctx.roundRect(x, y, barW, barH, [2, 2, 0, 0]);
        ctx.fillStyle = grad;
        ctx.fill();

        // Subtle glow on peak bars
        if (value > 85) {
          ctx.shadowColor = 'rgba(220, 38, 38, 0.4)';
          ctx.shadowBlur = 4;
          ctx.fill();
          ctx.shadowBlur = 0;
        }

        // X label
        ctx.fillStyle = '#94A3B8';
        ctx.font = '600 9px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(hours[i] + 'h', x + barW / 2, H - 8);
      });
    }

    function animate() {
      animFrame++;
      drawChart(animFrame / ANIM_FRAMES);
      if (animFrame <= ANIM_FRAMES) {
        requestAnimationFrame(animate);
      } else {
        // Live update: wiggle bars slightly
        setInterval(() => {
          data.forEach((_, i) => {
            data[i] = Math.min(100, Math.max(5, data[i] + (Math.random() - 0.5) * 3));
          });
          drawChart(1);
        }, 2000);
      }
    }

    // Start when section is visible
    const observer = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) {
        animate();
        observer.disconnect();
      }
    }, { threshold: 0.3 });
    observer.observe(chartCanvas);
  }

  /* ── Alert Log ────────────────────────────────────────── */
  const alertList = document.getElementById('alert-list');
  if (alertList) {
    const alerts = [
      { type: 'info',    msg: 'AI plan updated for Delhi–Mumbai corridor', time: '22:54' },
      { type: 'success', msg: 'Block conflict resolved: Nagpur Div.', time: '22:51' },
      { type: 'warning', msg: 'Maintenance window active: Ahmedabad', time: '22:48' },
      { type: 'info',    msg: 'Rajdhani 12951 block re-assigned', time: '22:45' },
      { type: 'success', msg: 'Zone handover complete: WR → CR', time: '22:39' },
      { type: 'info',    msg: 'IoT node #7821 reconnected', time: '22:35' },
    ];

    const colorMap = {
      info:    '#0056B3',
      success: '#059669',
      warning: '#D97706',
      error:   '#DC2626',
    };

    alerts.forEach(a => {
      const item = document.createElement('div');
      item.className = 'alert-item';
      item.innerHTML = `
        <span class="alert-dot" style="background:${colorMap[a.type]};"></span>
        <span style="flex:1">${a.msg}</span>
        <span style="color:#64748B;font-size:0.68rem;white-space:nowrap">${a.time}</span>
      `;
      alertList.appendChild(item);
    });

    // Live-update: push new alerts
    const liveAlerts = [
      { type: 'info',    msg: 'Block plan recalculated: Southern zone', time: '' },
      { type: 'success', msg: 'Train 16526 cleared block BLR-MAS', time: '' },
      { type: 'warning', msg: 'Sensor offline: Node #4402, Howrah', time: '' },
      { type: 'info',    msg: 'AI override: Shatabdi rerouted', time: '' },
    ];
    let liveIdx = 0;
    setInterval(() => {
      const now = new Date();
      const timeStr = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
      const a = liveAlerts[liveIdx % liveAlerts.length];
      a.time = timeStr;

      const item = document.createElement('div');
      item.className = 'alert-item';
      item.style.opacity = '0';
      item.style.transition = 'opacity 0.4s ease';
      item.innerHTML = `
        <span class="alert-dot" style="background:${colorMap[a.type]};"></span>
        <span style="flex:1">${a.msg}</span>
        <span style="color:rgba(74,106,154,0.7);font-size:0.68rem;white-space:nowrap">${a.time}</span>
      `;
      alertList.insertBefore(item, alertList.firstChild);
      requestAnimationFrame(() => { item.style.opacity = '1'; });

      // Remove old items if too many
      while (alertList.children.length > 7) {
        alertList.removeChild(alertList.lastChild);
      }

      liveIdx++;
    }, 4500);
  }

})();
