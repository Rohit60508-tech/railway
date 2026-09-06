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
     1. BACKGROUND PARTICLE CANVAS
  ══════════════════════════════════════════ */
  (function initBg() {
    const canvas = document.getElementById('bg-canvas');
    if (!canvas) return;

    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x000000, 0);

    const scene  = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 200);
    camera.position.set(0, 0, 50);

    /* ─ Grid Lines ─ */
    const GRID = 28;
    const SPACING = 6;

    function makeGrid() {
      const mat = new THREE.LineBasicMaterial({ color: 0xC8B8A0, transparent: true, opacity: 0.45 });
      const half = GRID * SPACING * 0.5;
      const points = [];
      for (let i = 0; i <= GRID; i++) {
        const x = -half + i * SPACING;
        points.push(new THREE.Vector3(x, -half, -20), new THREE.Vector3(x, half, -20));
      }
      for (let j = 0; j <= GRID; j++) {
        const y = -half + j * SPACING;
        points.push(new THREE.Vector3(-half, y, -20), new THREE.Vector3(half, y, -20));
      }
      const geo = new THREE.BufferGeometry().setFromPoints(points);
      scene.add(new THREE.LineSegments(geo, mat));
    }
    makeGrid();

    /* ─ Floating Particles ─ */
    const PARTICLE_COUNT = 220;
    const pGeo = new THREE.BufferGeometry();
    const pPositions = new Float32Array(PARTICLE_COUNT * 3);
    const pSpeeds    = new Float32Array(PARTICLE_COUNT);
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      pPositions[i * 3]     = (Math.random() - 0.5) * 160;
      pPositions[i * 3 + 1] = (Math.random() - 0.5) * 120;
      pPositions[i * 3 + 2] = (Math.random() - 0.5) * 60;
      pSpeeds[i] = 0.008 + Math.random() * 0.016;
    }
    pGeo.setAttribute('position', new THREE.BufferAttribute(pPositions, 3));

    const pMat = new THREE.PointsMaterial({
      color: 0x0056B3, size: 0.4, transparent: true, opacity: 0.55,
      blending: THREE.NormalBlending, depthWrite: false,
    });
    const particles = new THREE.Points(pGeo, pMat);
    scene.add(particles);

    /* ─ Glow Nodes ─ */
    const nodeGeo = new THREE.SphereGeometry(0.5, 8, 8);
    const nodeMat = new THREE.MeshBasicMaterial({ color: 0x003366, transparent: true, opacity: 0.35 });
    const NODES = 18;
    const nodeObjs = [];
    for (let n = 0; n < NODES; n++) {
      const mesh = new THREE.Mesh(nodeGeo, nodeMat.clone());
      mesh.position.set(
        (Math.random() - 0.5) * 140,
        (Math.random() - 0.5) * 100,
        (Math.random() - 0.5) * 40
      );
      mesh.userData.phase = Math.random() * PI2;
      mesh.userData.speed = 0.3 + Math.random() * 0.5;
      scene.add(mesh);
      nodeObjs.push(mesh);
    }

    /* ─ Animation ─ */
    let mouseX = 0, mouseY = 0;
    window.addEventListener('mousemove', e => {
      mouseX = (e.clientX / window.innerWidth  - 0.5) * 0.4;
      mouseY = (e.clientY / window.innerHeight - 0.5) * 0.4;
    });

    let frameId;
    function animate(t) {
      frameId = requestAnimationFrame(animate);
      const time = t * 0.001;

      // Drift particles upward
      const pos = pGeo.attributes.position.array;
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        pos[i * 3 + 1] += pSpeeds[i];
        if (pos[i * 3 + 1] > 65) pos[i * 3 + 1] = -65;
      }
      pGeo.attributes.position.needsUpdate = true;

      // Pulse nodes
      nodeObjs.forEach(n => {
        n.material.opacity = 0.15 + 0.25 * Math.sin(time * n.userData.speed + n.userData.phase);
        n.scale.setScalar(0.8 + 0.3 * Math.sin(time * 0.7 + n.userData.phase));
      });

      // Camera parallax
      camera.position.x += (mouseX * 12 - camera.position.x) * 0.04;
      camera.position.y += (-mouseY * 8 - camera.position.y) * 0.04;
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
     2. HERO TRAIN CANVAS
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
    renderer.setClearColor(0xF5EFEB, 1);

    const scene  = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0xF5EFEB, 0.035);

    const camera = new THREE.PerspectiveCamera(55, W / H, 0.1, 200);
    camera.position.set(0, 3.5, 10);
    camera.lookAt(0, 1.2, 0);

    /* ─ Lighting ─ */
    scene.add(new THREE.AmbientLight(0xFFF8EE, 3.2));

    const dirLight = new THREE.DirectionalLight(0xFFF3E0, 2.5);
    dirLight.position.set(5, 10, 5);
    dirLight.castShadow = true;
    scene.add(dirLight);

    const headLight = new THREE.PointLight(0x0056B3, 4, 25);
    headLight.position.set(-8, 2, 0);
    scene.add(headLight);

    const engineGlow = new THREE.PointLight(0xD9531E, 3, 12);
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
    const sleeperMat = new THREE.MeshStandardMaterial({ color: 0x8C7A65, metalness: 0.1, roughness: 0.85 });
    for (let i = -40; i <= 40; i += 1.4) {
      const sleeperGeo = new THREE.BoxGeometry(0.25, 0.1, 2.2);
      const s = new THREE.Mesh(sleeperGeo, sleeperMat);
      s.position.set(i, 0.0, 0);
      s.receiveShadow = true;
      scene.add(s);
    }

    /* ─ Ground ─ */
    const groundGeo = new THREE.PlaneGeometry(80, 20);
    const groundMat = new THREE.MeshStandardMaterial({ color: 0xEAE1D2, roughness: 1 });
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
