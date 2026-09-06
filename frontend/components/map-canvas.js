/**
 * map-canvas.js
 * Draws an animated India railway network map on #map-canvas
 * using the 2D Canvas API (no external dependency).
 */

(function () {
  'use strict';

  const canvas = document.getElementById('map-canvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');

  // ── Resize to fill container ──────────────────────────
  function resize() {
    canvas.width  = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
  }
  resize();
  window.addEventListener('resize', () => { resize(); });

  // ── India approx. outline (simplified polygon) ────────
  // Normalized [0-1] coords, will be projected to canvas
  const INDIA_OUTLINE = [
    [0.38,0.02],[0.44,0.02],[0.53,0.06],[0.61,0.08],[0.70,0.12],
    [0.78,0.16],[0.83,0.22],[0.87,0.28],[0.88,0.35],[0.86,0.42],
    [0.82,0.50],[0.79,0.57],[0.77,0.63],[0.73,0.68],[0.68,0.72],
    [0.63,0.76],[0.60,0.80],[0.57,0.85],[0.55,0.90],[0.53,0.95],
    [0.51,1.00],[0.49,0.95],[0.47,0.88],[0.44,0.82],[0.40,0.77],
    [0.35,0.72],[0.29,0.68],[0.22,0.62],[0.16,0.55],[0.13,0.48],
    [0.10,0.40],[0.11,0.33],[0.14,0.27],[0.20,0.20],[0.26,0.15],
    [0.31,0.09],[0.36,0.05],
  ];

  // ── Major city nodes ──────────────────────────────────
  const CITIES = [
    { name: 'Delhi',       x: 0.43, y: 0.20, zone: 'Northern',  status: 'clear' },
    { name: 'Mumbai',      x: 0.25, y: 0.48, zone: 'Western',   status: 'clear' },
    { name: 'Chennai',     x: 0.52, y: 0.75, zone: 'Southern',  status: 'occupied' },
    { name: 'Kolkata',     x: 0.72, y: 0.35, zone: 'Eastern',   status: 'clear' },
    { name: 'Hyderabad',   x: 0.47, y: 0.63, zone: 'SC',        status: 'ai_override' },
    { name: 'Bengaluru',   x: 0.44, y: 0.76, zone: 'SW',        status: 'clear' },
    { name: 'Ahmedabad',   x: 0.24, y: 0.35, zone: 'Western',   status: 'maintenance' },
    { name: 'Pune',        x: 0.28, y: 0.54, zone: 'Central',   status: 'clear' },
    { name: 'Jaipur',      x: 0.36, y: 0.25, zone: 'NW',        status: 'clear' },
    { name: 'Lucknow',     x: 0.52, y: 0.24, zone: 'NE',        status: 'clear' },
    { name: 'Bhopal',      x: 0.42, y: 0.40, zone: 'WC',        status: 'clear' },
    { name: 'Nagpur',      x: 0.50, y: 0.50, zone: 'Central',   status: 'occupied' },
    { name: 'Patna',       x: 0.60, y: 0.28, zone: 'EC',        status: 'clear' },
    { name: 'Bhubaneswar', x: 0.67, y: 0.48, zone: 'ECoR',      status: 'clear' },
    { name: 'Guwahati',    x: 0.80, y: 0.16, zone: 'NFR',       status: 'ai_override' },
    { name: 'Visakhapatnam', x: 0.65, y: 0.60, zone: 'ECoR',   status: 'clear' },
  ];

  // ── Railway connections ───────────────────────────────
  const ROUTES = [
    [0,1],[0,3],[0,8],[0,9],[0,10],[1,6],[1,7],[1,10],[2,4],[2,5],
    [2,15],[3,12],[3,9],[4,5],[4,11],[4,15],[5,7],[6,7],[7,11],
    [8,9],[9,10],[9,12],[10,11],[11,4],[12,13],[13,14],[13,15],[14,3],
  ];

  // ── Status colors (Unified Railway Palette) ──────────────
  const STATUS_COLORS = {
    clear:       '#0284C7',
    occupied:    '#D97706',
    maintenance: '#D9531E',
    ai_override: '#059669',
  };

  // ── Animated trains on routes ─────────────────────────
  const trains = ROUTES.slice(0, 12).map((route, i) => ({
    route,
    progress: Math.random(),
    speed: 0.001 + Math.random() * 0.0015,
    color: Object.values(STATUS_COLORS)[Math.floor(Math.random() * 4)],
  }));

  // ── Project normalized coords to canvas px ───────────
  function project(nx, ny) {
    const PAD = 0.05;
    return [
      PAD * canvas.width + nx * canvas.width  * (1 - 2 * PAD),
      PAD * canvas.height + ny * canvas.height * (1 - 2 * PAD),
    ];
  }

  // ── Draw ──────────────────────────────────────────────
  let frame = 0;

  function draw() {
    frame++;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Background
    const bgGrad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    bgGrad.addColorStop(0, '#FAF6EE');
    bgGrad.addColorStop(1, '#F3EDE2');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // India outline
    ctx.beginPath();
    INDIA_OUTLINE.forEach(([nx, ny], i) => {
      const [x, y] = project(nx, ny);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.strokeStyle = 'rgba(0, 51, 102, 0.35)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = 'rgba(0, 51, 102, 0.05)';
    ctx.fill();

    // Routes
    ROUTES.forEach(([a, b], i) => {
      const [ax, ay] = project(CITIES[a].x, CITIES[a].y);
      const [bx, by] = project(CITIES[b].x, CITIES[b].y);
      const ca = CITIES[a];
      const cb = CITIES[b];

      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, by);
      ctx.strokeStyle = 'rgba(0, 51, 102, 0.22)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 6]);
      ctx.stroke();
      ctx.setLineDash([]);
    });

    // Animated train dots
    trains.forEach(t => {
      t.progress += t.speed;
      if (t.progress > 1) t.progress = 0;

      const [a, b] = t.route;
      const [ax, ay] = project(CITIES[a].x, CITIES[a].y);
      const [bx, by] = project(CITIES[b].x, CITIES[b].y);

      const tx = ax + (bx - ax) * t.progress;
      const ty = ay + (by - ay) * t.progress;

      // Glow
      const grd = ctx.createRadialGradient(tx, ty, 0, tx, ty, 8);
      grd.addColorStop(0, t.color + 'cc');
      grd.addColorStop(1, t.color + '00');
      ctx.beginPath();
      ctx.arc(tx, ty, 8, 0, Math.PI * 2);
      ctx.fillStyle = grd;
      ctx.fill();

      // Dot
      ctx.beginPath();
      ctx.arc(tx, ty, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = t.color;
      ctx.fill();
    });

    // City nodes
    CITIES.forEach((city, i) => {
      const [cx, cy] = project(city.x, city.y);
      const color = STATUS_COLORS[city.status];
      const pulse = 0.6 + 0.4 * Math.sin(frame * 0.04 + i * 0.8);

      // Outer ring
      ctx.beginPath();
      ctx.arc(cx, cy, 8 * pulse, 0, Math.PI * 2);
      ctx.fillStyle = color + '22';
      ctx.fill();

      ctx.beginPath();
      ctx.arc(cx, cy, 5, 0, Math.PI * 2);
      ctx.fillStyle = color + '55';
      ctx.fill();

      ctx.beginPath();
      ctx.arc(cx, cy, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();

      // Label (only for major cities)
      if (['Delhi','Mumbai','Chennai','Kolkata','Hyderabad','Bengaluru'].includes(city.name)) {
        ctx.font = '600 10px Inter, sans-serif';
        ctx.fillStyle = '#0F172A';
        ctx.textAlign = 'center';
        ctx.fillText(city.name, cx, cy - 10);
      }
    });

    requestAnimationFrame(draw);
  }

  draw();

  // ── Populate zone list ────────────────────────────────
  const zones = [
    { name: 'Northern',        status: 'clear' },
    { name: 'Southern',        status: 'clear' },
    { name: 'Eastern',         status: 'clear' },
    { name: 'Western',         status: 'maintenance' },
    { name: 'Central',         status: 'clear' },
    { name: 'South Central',   status: 'ai_override' },
    { name: 'Northeast Frontier', status: 'clear' },
    { name: 'East Coast',      status: 'occupied' },
    { name: 'North Western',   status: 'clear' },
    { name: 'South Western',   status: 'clear' },
  ];

  const zoneList = document.getElementById('zone-list');
  if (zoneList) {
    zones.forEach(z => {
      const item = document.createElement('div');
      item.className = 'zone-item';
      item.innerHTML = `
        <span class="zone-name">${z.name}</span>
        <span class="zone-dot" style="background:${STATUS_COLORS[z.status]};box-shadow:0 0 6px ${STATUS_COLORS[z.status]}88"></span>
      `;
      zoneList.appendChild(item);
    });
  }

})();
