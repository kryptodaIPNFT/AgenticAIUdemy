const fs = require('fs');
const css = fs.readFileSync('public/css/styles.css', 'utf8');
const defined = new Set();
const re = /\.([A-Za-z_][\w-]*)/g;
let m;
while ((m = re.exec(css)) !== null) defined.add(m[1]);

const pages = ['index.html', 'dashboard.html', 'watch.html', 'qr-reader.html', 'admin.html'];
for (const f of pages) {
  const html = fs.readFileSync('public/' + f, 'utf8');
  const used = new Set();
  const cre = /class="([^"]+)"/g;
  while ((m = cre.exec(html)) !== null) {
    m[1].split(/\s+/).forEach((c) => c && used.add(c));
  }
  const missing = [...used].filter((c) => !defined.has(c));
  console.log('=== ' + f + ' ===');
  console.log('MISSING from CSS: ' + (missing.length ? missing.join(' ') : '(none)'));
}