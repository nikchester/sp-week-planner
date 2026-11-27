// Renders the planner with fake data in a headless Chromium browser and saves PNG screenshots
// to screenshots/en/ (README.md) and screenshots/ru/ (README.ru.md).
// Run: npm run screenshots   (set BROWSER to the path of msedge/chrome if auto-detection fails)
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const fakeApiSource = require('./fake-api');

const root = path.join(__dirname, '..');
const outDir = path.join(root, 'screenshots');
fs.mkdirSync(outDir, { recursive: true });

const harness = path.join(outDir, 'harness.html');
fs.writeFileSync(harness, fs.readFileSync(path.join(root, 'week-planner', 'index.html'), 'utf8')
  .replace('<body>', '<body><script>' + fakeApiSource() + '</script>'));

const candidates = [
  process.env.BROWSER,
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  '/usr/bin/google-chrome', '/usr/bin/chromium',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
].filter(Boolean);
const browser = candidates.find((p) => fs.existsSync(p));
if (!browser) { console.error('No Chromium browser found. Set BROWSER.'); process.exit(1); }

const url = 'file:///' + harness.replace(/\\/g, '/');

// Headless browsers on Windows keep the window at least ~500 px wide, so a phone-sized
// viewport is emulated with an iframe of the exact width.
const phone = path.join(outDir, 'phone.html');
const phoneUrl = 'file:///' + phone.replace(/\\/g, '/');
const shots = [
  ['planning', '?page=plan', '1400,1100'],
  ['week', '?page=week', '1400,1100'],
  ['kanban', '?page=kanban', '1400,900'],
  ['week-dark', '?page=week&theme=dark', '1400,1100'],
  ['categories-editor', '?page=week&act=cats', '1400,900'],
  ['pool-filter-editor', '?page=plan&act=pooleditor', '1400,900'],
  ['task-menu', '?page=week&act=ctx&theme=dark', '1400,900'],
  ['task-menu-priority', '?page=week&act=ctxprio&theme=dark', '1400,900'],
  ['mobile', null, '520,2600'],
  ['empty', '?page=plan&act=empty', '1400,800']
];
// Chromium refuses to start as root or in containers without user namespaces unless the sandbox is off.
const extra = process.platform === 'linux' ? ['--no-sandbox'] : [];
for (const lang of ['en', 'ru']) {
  const langDir = path.join(outDir, lang);
  fs.mkdirSync(langDir, { recursive: true });
  fs.writeFileSync(phone, '<!doctype html><body style="margin:0;background:#888">' +
    '<iframe src="harness.html?theme=light&page=week&lang=' + lang + '" style="width:380px;height:2600px;border:0;display:block"></iframe></body>');
  for (const [name, query, size] of shots) {
    execFileSync(browser, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--virtual-time-budget=3000', ...extra,
      '--allow-file-access-from-files', '--window-size=' + size, '--screenshot=' + path.join(langDir, name + '.png'),
      query === null ? phoneUrl : url + query + '&lang=' + lang], { stdio: 'ignore' });
    console.log('saved', lang + '/' + name + '.png');
  }
}
fs.unlinkSync(harness);
fs.unlinkSync(phone);
