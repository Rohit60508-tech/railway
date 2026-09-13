const https = require('https');
const fs = require('fs');

const envFile = fs.readFileSync('.env', 'utf8');
let url = '', key = '';
envFile.split('\n').forEach(line => {
  if (line.startsWith('SUPABASE_URL=')) url = line.split('=')[1].trim().replace(/"/g, '');
  if (line.startsWith('SUPABASE_SECRET_KEY=')) key = line.split('=')[1].trim().replace(/"/g, '');
});

const hostname = new URL(url).hostname;
const sql = fs.readFileSync('database/supabase_full_schema.sql', 'utf8');

console.log('Sending schema DDL to Supabase...');

const req = https.request({
  hostname,
  path: '/rest/v1/rpc/exec_sql',
  method: 'POST',
  headers: {
    'apikey': key,
    'Authorization': 'Bearer ' + key,
    'Content-Type': 'application/json'
  }
}, res => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => console.log('RPC Response Status:', res.statusCode, body));
});

req.on('error', e => console.error(e));
req.write(JSON.stringify({ query: sql }));
req.end();
