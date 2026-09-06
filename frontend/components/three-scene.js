/**
 * three-scene.js
 * Renders two Three.js canvases:
 *   1. #bg-canvas  – animated particle grid + floating nodes (background)
 *   2. #train-canvas – 3D train passing through a railway track scene (hero)
 */

(function () {
  'use strict';

  /* ─── Utility ─── */
  const PI2 = Math.PI * 2;

  /* ══════════════════════════════════════════
     1. BACKGROUND SPARKING LIGHT CANVAS
  ══════════════════════════════════════════ */
  (function initBg() {
    const canvas = document.getElementById('bg-canvas');
    if (!canvas) return;

    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x000000, 0);

    const scene  = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 300);
    camera.position.set(0, 0, 55);

    /* ─ Procedural Spark Texture Generators ─ */
    function makeSparkTexture(coreColor, haloColor, spikeColor) {
      const texCanvas = document.createElement('canvas');
      texCanvas.width = 64;
      texCanvas.height = 64;
      const ctx = texCanvas.getContext('2d');
      const cx = 32, cy = 32;

      // Soft circular outer aura
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 30);
      grad.addColorStop(0, coreColor);
      grad.addColorStop(0.18, haloColor);
      grad.addColorStop(0.5, spikeColor);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 64, 64);

      // 4-pointed diamond star spikes (spark diffraction)
      ctx.strokeStyle = coreColor;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(cx, 4);  ctx.lineTo(cx, 60);
      ctx.moveTo(4, cy);  ctx.lineTo(60, cy);
      ctx.stroke();

      // Micro diagonal glint
      ctx.strokeStyle = spikeColor;
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(14, 14); ctx.lineTo(50, 50);
      ctx.moveTo(14, 50); ctx.lineTo(50, 14);
      ctx.stroke();

      const tex = new THREE.CanvasTexture(texCanvas);
      tex.needsUpdate = true;
      return tex;
    }

    const sparkTexCyan   = makeSparkTexture('rgba(255,255,255,1)', 'rgba(56,189,248,0.95)', 'rgba(0,180,255,0.4)');
    const sparkTexGold   = makeSparkTexture('rgba(255,255,255,1)', 'rgba(255,190,40,0.95)', 'rgba(249,115,22,0.4)');
    const sparkTexWhite  = makeSparkTexture('rgba(255,255,255,1)', 'rgba(220,240,255,0.9)', 'rgba(180,210,255,0.3)');

    /* ─ Railway Electric Grid Lines (Deep Dark Horizon) ─ */
    const GRID = 32;
    const SPACING = 6;
    const gridMat = new THREE.LineBasicMaterial({
      color: 0x1E293B,
      transparent: true,
      opacity: 0.35,
    });
    const half = GRID * SPACING * 0.5;
    const gridPoints = [];
    for (let i = 0; i <= GRID; i++) {
      const x = -half + i * SPACING;
      gridPoints.push(new THREE.Vector3(x, -half, -28), new THREE.Vector3(x, half, -28));
    }
    for (let j = 0; j <= GRID; j++) {
      const y = -half + j * SPACING;
      gridPoints.push(new THREE.Vector3(-half, y, -28), new THREE.Vector3(half, y, -28));
    }
    const gridGeo = new THREE.BufferGeometry().setFromPoints(gridPoints);
    scene.add(new THREE.LineSegments(gridGeo, gridMat));

    /* ─ Main Sparkling Light Constellation (450 multi-layer sparks) ─ */
    const SPARK_COUNT = 450;
    const sPositions   = new Float32Array(SPARK_COUNT * 3);
    const sPhases      = new Float32Array(SPARK_COUNT);
    const sFreqs       = new Float32Array(SPARK_COUNT);
    const sBaseSizes   = new Float32Array(SPARK_COUNT);
    const sVelY        = new Float32Array(SPARK_COUNT);
    const sVelX        = new Float32Array(SPARK_COUNT);

    for (let i = 0; i < SPARK_COUNT; i++) {
      sPositions[i * 3]     = (Math.random() - 0.5) * 180;
      sPositions[i * 3 + 1] = (Math.random() - 0.5) * 140;
      sPositions[i * 3 + 2] = (Math.random() - 0.5) * 80;
      sPhases[i]    = Math.random() * PI2;
      sFreqs[i]     = 1.5 + Math.random() * 4.5;
      sBaseSizes[i] = 0.9 + Math.random() * 2.2;
      sVelY[i]      = 0.015 + Math.random() * 0.035;
      sVelX[i]      = (Math.random() - 0.5) * 0.01;
    }

    const sGeo = new THREE.BufferGeometry();
    sGeo.setAttribute('position', new THREE.BufferAttribute(sPositions, 3));

    // Cyan sparks group
    const sparkMatCyan = new THREE.PointsMaterial({
      map: sparkTexCyan,
      size: 2.2,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const sparksCyan = new THREE.Points(sGeo, sparkMatCyan);
    scene.add(sparksCyan);

    // Gold / Amber sparks group
    const gPositions = new Float32Array(180 * 3);
    for (let i = 0; i < 180; i++) {
      gPositions[i * 3]     = (Math.random() - 0.5) * 170;
      gPositions[i * 3 + 1] = (Math.random() - 0.5) * 130;
      gPositions[i * 3 + 2] = (Math.random() - 0.5) * 70;
    }
    const gGeo = new THREE.BufferGeometry();
    gGeo.setAttribute('position', new THREE.BufferAttribute(gPositions, 3));
    const sparkMatGold = new THREE.PointsMaterial({
      map: sparkTexGold,
      size: 2.5,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const sparksGold = new THREE.Points(gGeo, sparkMatGold);
    scene.add(sparksGold);

    // Diamond white micro-sparks
    const wPositions = new Float32Array(200 * 3);
    for (let i = 0; i < 200; i++) {
      wPositions[i * 3]     = (Math.random() - 0.5) * 160;
      wPositions[i * 3 + 1] = (Math.random() - 0.5) * 120;
      wPositions[i * 3 + 2] = (Math.random() - 0.5) * 60;
    }
    const wGeo = new THREE.BufferGeometry();
    wGeo.setAttribute('position', new THREE.BufferAttribute(wPositions, 3));
    const sparkMatWhite = new THREE.PointsMaterial({
      map: sparkTexWhite,
      size: 1.6,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const sparksWhite = new THREE.Points(wGeo, sparkMatWhite);
    scene.add(sparksWhite);

    /* ─ Pulsing Glowing Nodes (Light Orbs) ─ */
    const nodeGeo = new THREE.SphereGeometry(0.7, 12, 12);
    const NODES = 14;
    const nodeObjs = [];
    const nodeColors = [0x00E5FF, 0xFFB703, 0x38BDF8, 0xF97316];
    for (let n = 0; n < NODES; n++) {
      const col = nodeColors[n % nodeColors.length];
      const nodeMat = new THREE.MeshBasicMaterial({
        color: col,
        transparent: true,
        opacity: 0.5,
      });
      const mesh = new THREE.Mesh(nodeGeo, nodeMat);
      mesh.position.set(
        (Math.random() - 0.5) * 150,
        (Math.random() - 0.5) * 110,
        (Math.random() - 0.5) * 45
      );
      mesh.userData.phase = Math.random() * PI2;
      mesh.userData.speed = 0.6 + Math.random() * 0.8;
      scene.add(mesh);
      nodeObjs.push(mesh);
    }

    /* ─ Electric Track Spark Streaks (Linear shooting sparks) ─ */
    const STREAK_COUNT = 8;
    const streaks = [];
    for (let s = 0; s < STREAK_COUNT; s++) {
      const lineMat = new THREE.LineBasicMaterial({
        color: s % 2 === 0 ? 0x38BDF8 : 0xFFD700,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
      });
      const lineGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 0, 0),
      ]);
      const line = new THREE.Line(lineGeo, lineMat);
      line.userData = {
        active: false,
        timer: Math.random() * 120,
        x: 0, y: 0, z: -25,
        len: 8 + Math.random() * 12,
        progress: 0,
        speed: 1.2 + Math.random() * 1.5,
      };
      scene.add(line);
      streaks.push(line);
    }

    /* ─ Interactive Mouse Spark Emitter ─ */
    const MOUSE_SPARKS = 50;
    const mPos = new Float32Array(MOUSE_SPARKS * 3);
    const mVel = new Float32Array(MOUSE_SPARKS * 3);
    const mLife = new Float32Array(MOUSE_SPARKS);
    for (let i = 0; i < MOUSE_SPARKS; i++) {
      mPos[i * 3 + 1] = -999;
      mLife[i] = 0;
    }
    const mGeo = new THREE.BufferGeometry();
    mGeo.setAttribute('position', new THREE.BufferAttribute(mPos, 3));
    const mMat = new THREE.PointsMaterial({
      map: sparkTexGold,
      size: 2.8,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const mouseSparks = new THREE.Points(mGeo, mMat);
    scene.add(mouseSparks);
    let sparkSpawnIdx = 0;

    let mouseX = 0, mouseY = 0;
    let worldMouseX = 0, worldMouseY = 0;
    window.addEventListener('mousemove', e => {
      const nx = (e.clientX / window.innerWidth  - 0.5) * 2;
      const ny = -(e.clientY / window.innerHeight - 0.5) * 2;
      mouseX = nx * 0.2;
      mouseY = ny * 0.2;
      worldMouseX = nx * 45;
      worldMouseY = ny * 35;

      for (let k = 0; k < 2; k++) {
        const idx = (sparkSpawnIdx++) % MOUSE_SPARKS;
        mPos[idx * 3]     = worldMouseX + (Math.random() - 0.5) * 3;
        mPos[idx * 3 + 1] = worldMouseY + (Math.random() - 0.5) * 3;
        mPos[idx * 3 + 2] = 10 + (Math.random() - 0.5) * 5;
        mVel[idx * 3]     = (Math.random() - 0.5) * 0.4;
        mVel[idx * 3 + 1] = (Math.random() - 0.5) * 0.4 + 0.1;
        mVel[idx * 3 + 2] = (Math.random() - 0.5) * 0.2;
        mLife[idx] = 1.0;
      }
    });

    /* ─ Animation Loop ─ */
    let frameId;
    function animate(t) {
      frameId = requestAnimationFrame(animate);
      const time = t * 0.001;

      // Cyan sparks drift & sparkle
      const cPos = sGeo.attributes.position.array;
      for (let i = 0; i < SPARK_COUNT; i++) {
        cPos[i * 3 + 1] += sVelY[i];
        cPos[i * 3]     += sVelX[i];
        if (cPos[i * 3 + 1] > 70) cPos[i * 3 + 1] = -70;
        if (cPos[i * 3] > 90)     cPos[i * 3] = -90;
        if (cPos[i * 3] < -90)    cPos[i * 3] = 90;
      }
      sGeo.attributes.position.needsUpdate = true;
      sparkMatCyan.size = 2.0 + 1.2 * Math.sin(time * 6.0);
      sparkMatCyan.opacity = 0.7 + 0.3 * Math.sin(time * 4.0);

      // Gold sparks
      const gp = gGeo.attributes.position.array;
      for (let i = 0; i < 180; i++) {
        gp[i * 3 + 1] += 0.02;
        if (gp[i * 3 + 1] > 65) gp[i * 3 + 1] = -65;
      }
      gGeo.attributes.position.needsUpdate = true;
      sparkMatGold.size = 2.2 + 1.5 * Math.sin(time * 7.5 + 1.2);
      sparkMatGold.opacity = 0.75 + 0.25 * Math.cos(time * 5.0);

      // Diamond micro-sparks
      sparkMatWhite.size = 1.4 + 0.8 * Math.sin(time * 9.0 + 2.5);

      // Pulse nodes
      nodeObjs.forEach(n => {
        n.material.opacity = 0.3 + 0.45 * Math.sin(time * n.userData.speed + n.userData.phase);
        n.scale.setScalar(0.7 + 0.4 * Math.sin(time * 1.2 + n.userData.phase));
      });

      // Electric track streaks
      streaks.forEach(s => {
        const d = s.userData;
        d.timer--;
        if (d.timer <= 0 && !d.active) {
          d.active = true;
          d.progress = 0;
          d.x = (Math.random() - 0.5) * 120;
          d.y = (Math.random() - 0.5) * 80;
        }
        if (d.active) {
          d.progress += 0.05 * d.speed;
          const headX = d.x + d.progress * 25;
          const tailX = Math.max(d.x, headX - d.len);
          const pts = [
            new THREE.Vector3(tailX, d.y, d.z),
            new THREE.Vector3(headX, d.y, d.z),
          ];
          s.geometry.setFromPoints(pts);
          s.material.opacity = Math.sin(d.progress * Math.PI) * 0.85;
          if (d.progress >= 1.0) {
            d.active = false;
            s.material.opacity = 0;
            d.timer = 60 + Math.random() * 180;
          }
        }
      });

      // Mouse sparks decay
      const mp = mGeo.attributes.position.array;
      for (let i = 0; i < MOUSE_SPARKS; i++) {
        if (mLife[i] > 0) {
          mLife[i] -= 0.035;
          mp[i * 3]     += mVel[i * 3];
          mp[i * 3 + 1] += mVel[i * 3 + 1];
          mp[i * 3 + 2] += mVel[i * 3 + 2];
          if (mLife[i] <= 0) mp[i * 3 + 1] = -999;
        }
      }
      mGeo.attributes.position.needsUpdate = true;

      // Smooth parallax
      camera.position.x += (mouseX * 14 - camera.position.x) * 0.04;
      camera.position.y += (-mouseY * 10 - camera.position.y) * 0.04;
      camera.lookAt(0, 0, 0);

      renderer.render(scene, camera);
    }
    animate(0);

    window.addEventListener('resize', () => {
      renderer.setSize(window.innerWidth, window.innerHeight);
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
    });
  })();

  /* ══════════════════════════════════════════
     2. HERO TRAIN CANVAS (Dark Theme Integration)
  ══════════════════════════════════════════ */
  (function initTrain() {
    const canvas = document.getElementById('train-canvas');
    if (!canvas) return;

    const W = canvas.parentElement.clientWidth  || 560;
    const H = canvas.parentElement.clientHeight || 420;

    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(W, H);
    renderer.shadowMap.enabled = true;
    renderer.setClearColor(0x060913, 1);

    const scene  = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x060913, 0.035);

    const camera = new THREE.PerspectiveCamera(55, W / H, 0.1, 200);
    camera.position.set(0, 3.5, 10);
    camera.lookAt(0, 1.2, 0);

    /* ─ Lighting ─ */
    scene.add(new THREE.AmbientLight(0x88A0C0, 2.0));

    const dirLight = new THREE.DirectionalLight(0xFFFFFF, 2.2);
    dirLight.position.set(5, 10, 5);
    dirLight.castShadow = true;
    scene.add(dirLight);

    const headLight = new THREE.PointLight(0x00E5FF, 5, 30);
    headLight.position.set(-8, 2, 0);
    scene.add(headLight);

    const engineGlow = new THREE.PointLight(0xF97316, 4, 15);
    engineGlow.position.set(0, 1, 0);
    scene.add(engineGlow);

    /* ─ Rails ─ */
    function makeRail(x) {
      const geo = new THREE.BoxGeometry(80, 0.12, 0.18);
      const mat = new THREE.MeshStandardMaterial({ color: 0x5A6A80, metalness: 0.85, roughness: 0.3 });
      const rail = new THREE.Mesh(geo, mat);
      rail.position.set(0, 0.06, x);
      rail.receiveShadow = true;
      scene.add(rail);
    }
    makeRail(-0.7);
    makeRail(0.7);

    /* ─ Sleepers ─ */
    const sleeperMat = new THREE.MeshStandardMaterial({ color: 0x1E293B, metalness: 0.2, roughness: 0.85 });
    for (let i = -40; i <= 40; i += 1.4) {
      const sleeperGeo = new THREE.BoxGeometry(0.25, 0.1, 2.2);
      const s = new THREE.Mesh(sleeperGeo, sleeperMat);
      s.position.set(i, 0.0, 0);
      s.receiveShadow = true;
      scene.add(s);
    }

    /* ─ Ground ─ */
    const groundGeo = new THREE.PlaneGeometry(80, 20);
    const groundMat = new THREE.MeshStandardMaterial({ color: 0x0A0F1D, roughness: 0.95 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    /* ─ Train ─ */
    const trainGroup = new THREE.Group();
    scene.add(trainGroup);

    function addCar(offsetX, isLoco) {
      const bodyColor = isLoco ? 0x003366 : 0x004080;
      const accentColor = isLoco ? 0xD9531E : 0x0056B3;

      // Car body
      const bodyGeo = new THREE.BoxGeometry(isLoco ? 3.5 : 3, 1.1, 1.6);
      const bodyMat = new THREE.MeshStandardMaterial({ color: bodyColor, metalness: 0.7, roughness: 0.4 });
      const body = new THREE.Mesh(bodyGeo, bodyMat);
      body.position.set(offsetX, 0.9, 0);
      body.castShadow = true;
      trainGroup.add(body);

      // Accent stripe
      const stripeGeo = new THREE.BoxGeometry(isLoco ? 3.52 : 3.02, 0.18, 0.02);
      const stripeMat = new THREE.MeshStandardMaterial({ color: accentColor, emissive: accentColor, emissiveIntensity: 0.6 });
      const stripe = new THREE.Mesh(stripeGeo, stripeMat);
      stripe.position.set(offsetX, 1.15, 0.81);
      trainGroup.add(stripe);

      // Roof
      const roofGeo = new THREE.BoxGeometry(isLoco ? 3.3 : 2.8, 0.2, 1.5);
      const roofMat = new THREE.MeshStandardMaterial({ color: 0x0d1e35, metalness: 0.8, roughness: 0.3 });
      const roof = new THREE.Mesh(roofGeo, roofMat);
      roof.position.set(offsetX, 1.55, 0);
      trainGroup.add(roof);

      // Windows
      if (!isLoco) {
        const winMat = new THREE.MeshStandardMaterial({ color: 0x8FA4B8, emissive: 0x002244, emissiveIntensity: 0.5, transparent: true, opacity: 0.7 });
        for (let w = -0.9; w <= 0.9; w += 0.65) {
          const winGeo = new THREE.BoxGeometry(0.35, 0.28, 0.04);
          const win = new THREE.Mesh(winGeo, winMat);
          win.position.set(offsetX + w, 1.0, 0.82);
          trainGroup.add(win);
        }
      }

      // Bogies (wheels)
      [-0.95, 0.95].forEach(wOff => {
        const bogieGeo = new THREE.BoxGeometry(0.8, 0.25, 1.7);
        const bogieMat = new THREE.MeshStandardMaterial({ color: 0x0a1526, metalness: 0.9, roughness: 0.4 });
        const bogie = new THREE.Mesh(bogieGeo, bogieMat);
        bogie.position.set(offsetX + wOff, 0.33, 0);
        trainGroup.add(bogie);

        [-0.6, 0.6].forEach(zOff => {
          const wheelGeo = new THREE.CylinderGeometry(0.26, 0.26, 0.14, 16);
          const wheelMat = new THREE.MeshStandardMaterial({ color: 0x1a3a5e, metalness: 0.95, roughness: 0.2 });
          const wheel = new THREE.Mesh(wheelGeo, wheelMat);
          wheel.rotation.x = Math.PI / 2;
          wheel.position.set(offsetX + wOff, 0.26, zOff);
          wheel.userData.isWheel = true;
          trainGroup.add(wheel);
        });
      });

      // Headlight (loco only)
      if (isLoco) {
        const hlGeo = new THREE.SphereGeometry(0.14, 8, 8);
        const hlMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 2 });
        const hl = new THREE.Mesh(hlGeo, hlMat);
        hl.position.set(offsetX - 1.78, 0.9, 0);
        trainGroup.add(hl);

        const coneGeo = new THREE.ConeGeometry(0.22, 0.6, 8);
        const coneMat = new THREE.MeshStandardMaterial({ color: 0x1a3a6e, metalness: 0.8, roughness: 0.3 });
        const cone = new THREE.Mesh(coneGeo, coneMat);
        cone.rotation.z = Math.PI / 2;
        cone.position.set(offsetX - 1.65, 0.9, 0);
        trainGroup.add(cone);
      }
    }

    addCar(-5.8, true);   // Locomotive
    addCar(-2.5, false);  // Car 1
    addCar(0.95, false);  // Car 2
    addCar(4.4, false);   // Car 3

    // Exhaust particles
    const exhaustGeo = new THREE.BufferGeometry();
    const EXHAUST_COUNT = 80;
    const exPositions = new Float32Array(EXHAUST_COUNT * 3);
    for (let i = 0; i < EXHAUST_COUNT; i++) {
      exPositions[i * 3]     = (Math.random() - 0.5) * 0.6;
      exPositions[i * 3 + 1] = Math.random() * 3;
      exPositions[i * 3 + 2] = (Math.random() - 0.5) * 0.4;
    }
    exhaustGeo.setAttribute('position', new THREE.BufferAttribute(exPositions, 3));
    const exhaustMat = new THREE.PointsMaterial({ color: 0x5080a0, size: 0.12, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false });
    const exhaust = new THREE.Points(exhaustGeo, exhaustMat);
    exhaust.position.set(-7.7, 1.6, 0);
    scene.add(exhaust);

    /* ─ Trackside Signal ─ */
    function addSignal(x, state) {
      const poleGeo = new THREE.BoxGeometry(0.08, 3, 0.08);
      const poleMat = new THREE.MeshStandardMaterial({ color: 0x1a2a40, metalness: 0.8 });
      const pole = new THREE.Mesh(poleGeo, poleMat);
      pole.position.set(x, 1.5, -1.4);
      scene.add(pole);

      const headGeo = new THREE.BoxGeometry(0.4, 0.9, 0.28);
      const headMat = new THREE.MeshStandardMaterial({ color: 0x0a1526 });
      const head = new THREE.Mesh(headGeo, headMat);
      head.position.set(x, 3.15, -1.4);
      scene.add(head);

      const colors = state === 'green' ? [0x002200, 0x002200, 0x00cc44] : [0x220000, 0x221100, 0x002200];
      [[0, 0.28], [0, 0], [0, -0.28]].forEach(([_, yOff], idx) => {
        const lightGeo = new THREE.SphereGeometry(0.1, 8, 8);
        const c = [0x002200, 0x221100, 0x220000];
        const e = idx === (state === 'green' ? 2 : 0) ? (state === 'green' ? 0x00cc44 : 0xff2200) : c[idx];
        const lightMat = new THREE.MeshStandardMaterial({ color: colors[idx], emissive: e, emissiveIntensity: idx === (state === 'green' ? 2 : 0) ? 3 : 0 });
        const light = new THREE.Mesh(lightGeo, lightMat);
        light.position.set(x, 3.15 + (state === 'green' ? -1 + idx : idx) * 0.28 - 0.28, -1.2);
        scene.add(light);
      });
    }
    addSignal(-4, 'green');
    addSignal(6, 'red');

    /* ─ Animate ─ */
    let trainX = 12;
    let time = 0;

    function animate(t) {
      requestAnimationFrame(animate);
      time = t * 0.001;

      // Move train from right to left
      trainX -= 0.06;
      if (trainX < -18) trainX = 14;
      trainGroup.position.x = trainX;

      // Rotate wheels
      trainGroup.children.forEach(child => {
        if (child.userData.isWheel) {
          child.rotation.y += 0.12;
        }
      });

      // Exhaust drift
      const exPos = exhaustGeo.attributes.position.array;
      for (let i = 0; i < EXHAUST_COUNT; i++) {
        exPos[i * 3 + 1] += 0.025;
        exPos[i * 3]     += (Math.random() - 0.5) * 0.008;
        if (exPos[i * 3 + 1] > 4.5) {
          exPos[i * 3 + 1] = 0;
          exPos[i * 3]     = (Math.random() - 0.5) * 0.5;
        }
      }
      exhaustGeo.attributes.position.needsUpdate = true;
      exhaust.position.x = trainGroup.position.x - 6.1;

      // Glow flicker
      engineGlow.position.x = trainGroup.position.x - 5.8;
      engineGlow.intensity = 3 + Math.sin(time * 5) * 0.8;

      headLight.position.x = trainGroup.position.x - 7.8;

      // Camera gentle bob
      camera.position.y = 3.5 + Math.sin(time * 0.5) * 0.05;

      renderer.render(scene, camera);
    }
    animate(0);

    window.addEventListener('resize', () => {
      const nW = canvas.parentElement.clientWidth;
      const nH = canvas.parentElement.clientHeight;
      renderer.setSize(nW, nH);
      camera.aspect = nW / nH;
      camera.updateProjectionMatrix();
    });
  })();

})();
