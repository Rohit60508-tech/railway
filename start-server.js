/**
 * start-server.js
 * ─────────────────────────────────────────────────────────────────────────────
 * DEDICATED ALWAYS-ON CLOUD SERVER ORCHESTRATOR (RAILWAY, RENDER, DOCKER, AWS EC2)
 * ─────────────────────────────────────────────────────────────────────────────
 * Supervises both microservices in a single dedicated container instance:
 * 1. Python AI Inference & Dedicated Storage Engine (port 5001)
 * 2. Node.js API Gateway, Reverse Proxy & Web Frontend (port $PORT / 5000)
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

const { spawn } = require('child_process');
const http = require('http');
const path = require('path');
const fs = require('fs');

const PUBLIC_PORT = process.env.PORT || '5000';
const HOST = process.env.HOST || '0.0.0.0';
const ROOT_DIR = path.resolve(__dirname);

// Ensure persistent storage folders exist on server disk
const DATA_DIR = path.join(ROOT_DIR, 'data');
const BACKUPS_DIR = path.join(DATA_DIR, 'backups');
const STORAGE_DIR = path.join(DATA_DIR, 'storage');
if (!fs.existsSync(BACKUPS_DIR)) fs.mkdirSync(BACKUPS_DIR, { recursive: true });
if (!fs.existsSync(STORAGE_DIR)) fs.mkdirSync(STORAGE_DIR, { recursive: true });

console.log('════════════════════════════════════════════════════════════════════');
console.log('  INDIAN RAILWAYS AI PLATFORM — DEDICATED CLOUD SERVER STARTUP');
console.log('  Mode: ALWAYS-ON DEDICATED CONTAINER / VPS (Non-Serverless)');
console.log(`  Public Port: ${PUBLIC_PORT} | Host: ${HOST}`);
console.log(`  Persistent Volume: ${DATA_DIR}`);
console.log('════════════════════════════════════════════════════════════════════');

let pythonProcess = null;
let nodeProcess = null;

// Helper: Check if an HTTP service is already listening
function checkHttpService(port, pathName = '/') {
  return new Promise((resolve) => {
    const req = http.get({ hostname: '127.0.0.1', port, path: pathName, timeout: 1500 }, (res) => {
      resolve(true);
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function startPythonService() {
  const isRunning = await checkHttpService(5001, '/docs');
  if (isRunning) {
    console.log('[Orchestrator] Python AI & Storage engine is already running on port 5001.');
    return;
  }

  console.log('[Orchestrator] Launching Python AI & Storage Engine on 127.0.0.1:5001...');
  const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
  pythonProcess = spawn(pythonCmd, ['ai-models/inference/app.py'], {
    cwd: ROOT_DIR,
    env: { ...process.env, PYTHONUNBUFFERED: '1', HOST: '127.0.0.1', PORT: '5001' },
    stdio: 'inherit'
  });

  pythonProcess.on('exit', (code, signal) => {
    console.log(`[Orchestrator] Python AI service exited with code ${code} signal ${signal}`);
  });
}

async function startNodeService() {
  const isRunning = await checkHttpService(PUBLIC_PORT, '/api/v1/server/telemetry');
  if (isRunning && PUBLIC_PORT === '5000') {
    console.log(`[Orchestrator] Node Gateway is already running on port ${PUBLIC_PORT}.`);
    return;
  }

  console.log(`[Orchestrator] Launching Node.js API Gateway & Web Server on port ${PUBLIC_PORT}...`);
  nodeProcess = spawn('node', ['server.js'], {
    cwd: ROOT_DIR,
    env: { ...process.env, PORT: PUBLIC_PORT, HOST: HOST },
    stdio: 'inherit'
  });

  nodeProcess.on('exit', (code, signal) => {
    console.log(`[Orchestrator] Node.js Gateway exited with code ${code} signal ${signal}`);
  });
}

// Graceful shutdown handling
function shutdown() {
  console.log('\n[Orchestrator] Gracefully shutting down all services...');
  if (nodeProcess) {
    try { nodeProcess.kill('SIGTERM'); } catch (e) {}
  }
  if (pythonProcess) {
    try { pythonProcess.kill('SIGTERM'); } catch (e) {}
  }
  setTimeout(() => process.exit(0), 1000);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

async function main() {
  await startPythonService();
  // Small delay to let Python bind port before Node gateway proxies requests
  setTimeout(async () => {
    await startNodeService();
  }, 1000);
}

main();
