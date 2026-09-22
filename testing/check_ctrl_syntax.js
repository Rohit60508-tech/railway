const fs = require('fs');
const html = fs.readFileSync('frontend/pages/control-office.html', 'utf8');
const match = html.match(/<script type="module">([\s\S]*?)<\/script>/);
if (!match) {
  console.log('No script found');
} else {
  fs.writeFileSync('testing/extracted_ctrl_script.mjs', match[1]);
  console.log('Extracted ctrl script size:', match[1].length);
}
