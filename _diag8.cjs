const fs = require('fs');
const h = fs.readFileSync('D:/a4-vocab-portal-main/docs/index.html','utf8');

// Full autoSyncToGist
const ast = h.indexOf('function autoSyncToGist');
console.log('=== Full autoSyncToGist ===');
console.log(h.substring(ast, ast + 400));

// All calls to autoSyncToGist
console.log('\n=== Calls to autoSyncToGist() ===');
let pos = 0;
while (true) {
  const idx = h.indexOf('autoSyncToGist()', pos);
  if (idx === -1) break;
  const ctx = h.substring(Math.max(0, idx - 60), Math.min(h.length, idx + 30));
  console.log(ctx.replace(/\n/g, '\\n'));
  pos = idx + 20;
}

// Check handleSyncManual
const hsm = h.indexOf('function handleSyncManual');
if (hsm > -1) console.log('\n=== handleSyncManual ===\n' + h.substring(hsm, hsm + 400));
const hsm2 = h.indexOf('function handleSyncConnected');
if (hsm2 > -1) console.log('\n=== handleSyncConnected ===\n' + h.substring(hsm2, hsm2 + 300));
