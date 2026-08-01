const fs = require('fs');
const h = fs.readFileSync('D:/a4-vocab-portal-main/docs/index.html','utf8');

// Full pullFromGist
const pfg = h.indexOf('async function pullFromGist');
const end = h.indexOf('async function push', pfg);
console.log('=== FULL pullFromGist ===');
console.log(h.substring(pfg, end > pfg ? end : pfg + 3000));

console.log('\n=== isLocalEmpty ===');
const ile = h.indexOf('function isLocalEmpty');
if (ile > -1) console.log(h.substring(ile, ile + 600));

console.log('\n=== packLocalData ===');
const pld = h.indexOf('function packLocalData');
if (pld > -1) console.log(h.substring(pld, pld + 800));

console.log('\n=== restoreFromRemote ===');
const rfr = h.indexOf('function restore');
if (rfr > -1) console.log(h.substring(rfr, rfr + 500));
