import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

export default function ThreeTrackCanvas({ trainSpeed = 160, trainName = "Vande Bharat Rake #22436" }) {
  const canvasRef = useRef(null);
  const [signalState, setSignalState] = useState('PROCEED_GREEN');
  const [currentKmh, setCurrentKmh] = useState(trainSpeed);
  const [kavachActive, setKavachActive] = useState(true);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(canvas.clientWidth || 600, 220);
    renderer.setClearColor(0x0f172a, 1);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, (canvas.clientWidth || 600) / 220, 0.1, 100);
    camera.position.set(0, 5, 14);
    camera.lookAt(0, 0, 0);

    // Track Rails (Steel Metallic Blue)
    const railMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    const railGeo = new THREE.BoxGeometry(0.15, 0.15, 36);
    const rail1 = new THREE.Mesh(railGeo, railMat);
    rail1.position.set(-1.2, 0, 0);
    const rail2 = new THREE.Mesh(railGeo, railMat);
    rail2.position.set(1.2, 0, 0);
    scene.add(rail1);
    scene.add(rail2);

    // Sleepers (Concrete Grey)
    const sleeperMat = new THREE.MeshBasicMaterial({ color: 0x475569 });
    const sleeperGeo = new THREE.BoxGeometry(3.2, 0.12, 0.35);
    for (let z = -18; z <= 18; z += 1.2) {
      const sleeper = new THREE.Mesh(sleeperGeo, sleeperMat);
      sleeper.position.set(0, -0.06, z);
      scene.add(sleeper);
    }

    // 3D Signal Post & Aspect Lights
    const signalPostGroup = new THREE.Group();
    const postMat = new THREE.MeshBasicMaterial({ color: 0x94a3b8 });
    const postGeo = new THREE.CylinderGeometry(0.1, 0.1, 4, 16);
    const post = new THREE.Mesh(postGeo, postMat);
    post.position.set(2.2, 2, -2);
    signalPostGroup.add(post);

    const aspectBoxMat = new THREE.MeshBasicMaterial({ color: 0x1e293b });
    const aspectBoxGeo = new THREE.BoxGeometry(0.5, 1.2, 0.4);
    const aspectBox = new THREE.Mesh(aspectBoxGeo, aspectBoxMat);
    aspectBox.position.set(2.2, 3.4, -2);
    signalPostGroup.add(aspectBox);

    // Green / Amber / Red Bulbs
    const greenBulbMat = new THREE.MeshBasicMaterial({ color: signalState === 'PROCEED_GREEN' ? 0x10b981 : 0x064e3b });
    const amberBulbMat = new THREE.MeshBasicMaterial({ color: signalState === 'CAUTION_AMBER' ? 0xf59e0b : 0x78350f });
    const redBulbMat = new THREE.MeshBasicMaterial({ color: signalState === 'DANGER_RED' ? 0xef4444 : 0x7f1d1d });

    const bulbGeo = new THREE.SphereGeometry(0.12, 16, 16);
    const greenBulb = new THREE.Mesh(bulbGeo, greenBulbMat);
    greenBulb.position.set(2.2, 3.7, -1.78);
    const amberBulb = new THREE.Mesh(bulbGeo, amberBulbMat);
    amberBulb.position.set(2.2, 3.4, -1.78);
    const redBulb = new THREE.Mesh(bulbGeo, redBulbMat);
    redBulb.position.set(2.2, 3.1, -1.78);

    signalPostGroup.add(greenBulb);
    signalPostGroup.add(amberBulb);
    signalPostGroup.add(redBulb);
    scene.add(signalPostGroup);

    // Kavach Protection Shield Mesh (Semi-transparent cyan dome)
    const shieldMat = new THREE.MeshBasicMaterial({ color: 0x06b6d4, wireframe: true, transparent: true, opacity: kavachActive ? 0.35 : 0.0 });
    const shieldGeo = new THREE.CylinderGeometry(2.5, 2.5, 36, 16);
    const shield = new THREE.Mesh(shieldGeo, shieldMat);
    shield.rotation.x = Math.PI / 2;
    shield.position.set(0, 1.2, 0);
    scene.add(shield);

    // 3D Train Locomotive Group
    const trainGroup = new THREE.Group();
    const engineMat = new THREE.MeshBasicMaterial({ color: 0x0056b3 });
    const engineGeo = new THREE.BoxGeometry(2.2, 1.4, 4);
    const engine = new THREE.Mesh(engineGeo, engineMat);
    engine.position.set(0, 0.7, 0);
    trainGroup.add(engine);

    // Aerodynamic Nose (Orange IR Livery Accent)
    const noseMat = new THREE.MeshBasicMaterial({ color: 0xff6600 });
    const noseGeo = new THREE.ConeGeometry(1.2, 1.5, 4);
    const nose = new THREE.Mesh(noseGeo, noseMat);
    nose.rotation.x = Math.PI / 2;
    nose.position.set(0, 0.7, 2.7);
    trainGroup.add(nose);

    // Cab Windows & Headlight
    const cabMat = new THREE.MeshBasicMaterial({ color: 0xe2e8f0 });
    const cabGeo = new THREE.BoxGeometry(2.25, 0.8, 1.5);
    const cab = new THREE.Mesh(cabGeo, cabMat);
    cab.position.set(0, 1.2, -0.8);
    trainGroup.add(cab);

    const headlightMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });
    const headlightGeo = new THREE.SphereGeometry(0.25, 16, 16);
    const headlight = new THREE.Mesh(headlightGeo, headlightMat);
    headlight.position.set(0, 0.9, 3.4);
    trainGroup.add(headlight);

    scene.add(trainGroup);

    let animId;
    let posZ = -18;
    const animate = () => {
      // Speed multiplier mapped to actual train km/h
      const speedStep = 0.04 + (currentKmh / 160) * 0.08;
      posZ += speedStep;
      if (posZ > 18) posZ = -18;
      trainGroup.position.z = posZ;

      // Pulse Kavach safety shield rotation
      shield.rotation.z += 0.01;

      renderer.render(scene, camera);
      animId = requestAnimationFrame(animate);
    };

    animate();

    const handleResize = () => {
      if (!canvas) return;
      const w = canvas.clientWidth || 600;
      renderer.setSize(w, 220);
      camera.aspect = w / 220;
      camera.updateProjectionMatrix();
    };

    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
    };
  }, [signalState, currentKmh, kavachActive]);

  return (
    <div style={{ background: '#0F172A', borderRadius: '12px', padding: '16px', marginBottom: '24px', border: '1px solid rgba(56,189,248,0.3)', boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: signalState === 'PROCEED_GREEN' ? '#10B981' : signalState === 'CAUTION_AMBER' ? '#F59E0B' : '#EF4444', display: 'inline-block', boxShadow: '0 0 10px currentColor' }} />
          <span style={{ fontSize: '0.85rem', fontWeight: '800', color: '#38BDF8', letterSpacing: '0.5px' }}>
            ● LIVE 3D TRACK & KAVACH ATP TELEMETRY CANVAS (WebGL Three.js)
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Signal Control Toggles */}
          <div style={{ display: 'flex', gap: '4px', background: '#1E293B', padding: '3px', borderRadius: '6px' }}>
            <button
              onClick={() => { setSignalState('PROCEED_GREEN'); setCurrentKmh(160); }}
              style={{ padding: '3px 8px', fontSize: '0.7rem', fontWeight: '700', borderRadius: '4px', border: 'none', background: signalState === 'PROCEED_GREEN' ? '#10B981' : 'transparent', color: signalState === 'PROCEED_GREEN' ? '#FFF' : '#94A3B8', cursor: 'pointer' }}
            >
              GREEN (160kph)
            </button>
            <button
              onClick={() => { setSignalState('CAUTION_AMBER'); setCurrentKmh(60); }}
              style={{ padding: '3px 8px', fontSize: '0.7rem', fontWeight: '700', borderRadius: '4px', border: 'none', background: signalState === 'CAUTION_AMBER' ? '#F59E0B' : 'transparent', color: signalState === 'CAUTION_AMBER' ? '#FFF' : '#94A3B8', cursor: 'pointer' }}
            >
              AMBER (60kph)
            </button>
            <button
              onClick={() => { setSignalState('DANGER_RED'); setCurrentKmh(0); }}
              style={{ padding: '3px 8px', fontSize: '0.7rem', fontWeight: '700', borderRadius: '4px', border: 'none', background: signalState === 'DANGER_RED' ? '#EF4444' : 'transparent', color: signalState === 'DANGER_RED' ? '#FFF' : '#94A3B8', cursor: 'pointer' }}
            >
              RED (STOP)
            </button>
          </div>

          {/* Kavach Protection Toggle */}
          <button
            onClick={() => setKavachActive(prev => !prev)}
            style={{
              padding: '4px 10px', fontSize: '0.72rem', fontWeight: '800', borderRadius: '6px',
              border: `1px solid ${kavachActive ? '#06B6D4' : '#475569'}`,
              background: kavachActive ? 'rgba(6,182,212,0.15)' : 'transparent',
              color: kavachActive ? '#06B6D4' : '#94A3B8', cursor: 'pointer'
            }}
          >
            {kavachActive ? '🛡 KAVACH ATP: ACTIVE' : '🛡 KAVACH ATP: OFF'}
          </button>

          <span style={{ fontSize: '0.78rem', color: '#F59E0B', fontFamily: 'monospace', fontWeight: '700' }}>
            {trainName} · {currentKmh} km/h
          </span>
        </div>
      </div>

      <canvas ref={canvasRef} style={{ width: '100%', height: '220px', borderRadius: '8px', display: 'block' }} />
    </div>
  );
}

