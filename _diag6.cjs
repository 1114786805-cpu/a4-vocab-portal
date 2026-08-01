const fs = require('fs');
const h = fs.readFileSync('D:/a4-vocab-portal-main/docs/index.html','utf8');

// Find SYNC_KEYS
const sk = h.indexOf('SYNC_KEYS');
console.log('=== SYNC_KEYS ===');
const ctx = h.substring(sk, sk + 800);
console.log(ctx);

// Also find GIST_CONFIG_KEY
const gck = h.indexOf('GIST_CONFIG_KEY');
if (gck > -1) {
  console.log('\n=== GIST_CONFIG_KEY ===');
  console.log(h.substring(gck, gck + 200));
}

// And getStoredConfig / saveGistConfig
for (const f of ['getStoredConfig', 'saveGistConfig', 'getStoredToken']) {
  const idx = h.indexOf('function ' + f);
  if (idx > -1) {
    console.log('\n=== ' + f + ' ===');
    console.log(h.substring(idx, idx + 500));
  }
}
