const fs = require('fs');
const h = fs.readFileSync('D:/a4-vocab-portal-main/docs/index.html','utf8');

// Full pushToGist
const ptg = h.indexOf('function pushToGist');
console.log('=== pushToGist ===');
console.log(h.substring(ptg, ptg + 600));

// Search for all pushToGist calls
console.log('\n=== Calls to pushToGist ===');
let pos = 0;
while (true) {
  const idx = h.indexOf('pushToGist(', pos);
  if (idx === -1) break;
  const ctx = h.substring(Math.max(0, idx - 30), Math.min(h.length, idx + 80));
  console.log(ctx.replace(/\n/g, '\\n'));
  pos = idx + 20;
}

// Is there a "sync" button in UI?
console.log('\n=== sync button ===');
for (const s of ['syncBtn','同步','手动同步','handleSync','syncButton','uploadData','pushToCloud']) {
  const cnt = h.split(s).length - 1;
  if (cnt > 0) console.log(s + ': ' + cnt);
}

// After save operations (book progress, mastery, etc) - do they push?
console.log('\n=== save + push patterns ===');
for (const s of ['saveBookProgress','saveMastery','setItem','saveSession']) {
  const cnt = h.split(s).length - 1;
  if (cnt > 0) console.log(s + ': ' + cnt);
}
