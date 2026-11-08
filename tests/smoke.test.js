// Smoke test: runs week-planner/index.html in jsdom with a fake PluginAPI.
// Run: npm test
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { JSDOM } = require('jsdom');
const fakeApiSource = require('./fake-api');

const html = fs.readFileSync(path.join(__dirname, '..', 'week-planner', 'index.html'), 'utf8')
  .replace('<body>', '<body><script>' + fakeApiSource() + '</script>');

const dom = new JSDOM(html, {
  runScripts: 'dangerously', pretendToBeVisual: true, url: 'http://localhost/?theme=light',
  beforeParse(w) { w.matchMedia = () => ({ matches: false }); }
});
const w = dom.window;
const $ = (id) => w.document.getElementById(id);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const names = (root) => [...root.querySelectorAll('.name')].map((n) => n.textContent);
const btn = (root, text) => [...root.querySelectorAll('button')].find((b) => b.textContent === text);
let passed = 0;
function check(name, fn) { fn(); passed++; console.log('ok -', name); }

(async () => {
  await wait(100);

  check('pool shows unplanned top-level tasks only', () => {
    const pool = names($('poolList'));
    assert.ok(pool.includes('Лабораторная №3 по физике'));
    assert.ok(!pool.includes('Бэкап перед миграцией'), 'subtasks are hidden by the default filter');
    assert.ok(!pool.includes('Курсовая: глава 2'), 'planned tasks are not in the pool');
  });

  check('lists come before the collapsed "all tasks" card', () => {
    assert.strictEqual($('listCards').querySelector('.card-title').textContent, 'University · 2 задачи');
    assert.strictEqual($('allCard').querySelectorAll('.item').length, 0, 'all-tasks card is collapsed');
  });

  check('banner reports the exceeded list', () => {
    assert.ok(!$('banner').hidden);
    assert.ok($('banner').textContent.includes('University: план 9ч при лимите 8ч (+1ч)'));
  });

  check('pool badge explains the limit', () => {
    const li = [...$('poolList').querySelectorAll('li')].find((x) => x.textContent.includes('Лабораторная'));
    assert.strictEqual(li.querySelector('.badge.over').textContent, 'University: превысит лимит');
  });

  check('add-selected button is hidden until something is selected', () => {
    assert.ok($('poolAddSel').hidden);
  });

  // Select two pool rows by clicking them, then add them.
  const rows = [...$('poolList').querySelectorAll('li')];
  rows[0].click();
  rows[1].click();
  check('row click selects tasks', () => {
    assert.ok(!$('poolAddSel').hidden);
    assert.strictEqual($('poolAddSel').textContent, 'Добавить 2 на неделю 45');
    assert.strictEqual($('poolSelAll').textContent, 'Снять выбор');
  });
  const picked = [rows[0], rows[1]].map((r) => r.querySelector('.name').textContent);
  $('poolAddSel').click();
  await wait(50);

  check('bulk add shows a toast with undo', () => {
    assert.ok(!$('toast').hidden);
    assert.ok($('toastMsg').textContent.startsWith('Добавлено на неделю 45: 2'));
    picked.forEach((p) => assert.ok(!names($('poolList')).includes(p)));
  });

  $('toastUndo').click();
  await wait(50);
  check('undo returns tasks to the pool', () => {
    picked.forEach((p) => assert.ok(names($('poolList')).includes(p)));
    assert.strictEqual($('toastMsg').textContent, 'Действие отменено');
  });

  // Week row buttons are labelled with text.
  $('listCards').querySelector('.card-title').click(); // collapse University
  $('listCards').querySelector('.card-title').click(); // expand again
  const uniRow = $('listCards').querySelector('.item');
  check('week row buttons have readable labels', () => {
    const labels = [...uniRow.querySelectorAll('.actions button')].map((b) => b.textContent);
    assert.deepStrictEqual(labels, ['← Нед. 44', 'Нед. 46 →', 'Убрать']);
  });

  // Editor: tags are chips, fields are grouped, Today tag is hidden.
  $('listCards').querySelector('.card-head button[title="Изменить"]').click();
  check('editor uses tag chips without #Today', () => {
    const chips = [...$('modal').querySelectorAll('.tog')].map((b) => b.textContent);
    assert.deepStrictEqual(chips, ['#КАИ', '#Здоровье', '#Чтение']);
    assert.ok($('modal').querySelectorAll('optgroup').length >= 5);
    assert.ok([...$('modal').querySelectorAll('option')].some((o) => o.textContent === 'Поле: deadlineDay'));
  });

  btn($('modal'), '#Здоровье').click();
  check('chip toggles and preview updates', () => {
    assert.ok(btn($('modal'), '#Здоровье').classList.contains('on'));
    assert.ok($('edPreview').textContent.includes('3 ·'));
  });

  w.document.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape' }));
  check('Esc with unsaved changes asks first', () => {
    assert.ok(!$('overlay').hidden);
    assert.ok($('modal').querySelector('.notice'));
    assert.ok(btn($('modal'), 'Выйти без сохранения'));
  });
  w.document.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape' }));
  check('second Esc discards changes', () => {
    assert.ok($('overlay').hidden);
    const cfg = JSON.parse(w.__store.cfg);
    assert.deepStrictEqual(cfg.lists[0].conds[0].value, ['kai']);
  });

  const lim = $('listCards').querySelector('.limit-input');
  lim.value = '10';
  lim.dispatchEvent(new w.Event('change'));
  await wait(50);
  check('inline limit edit saves and clears the banner', () => {
    assert.strictEqual(JSON.parse(w.__store.cfg).lists[0].limitH, 10);
    assert.ok($('banner').hidden);
  });

  check('week chips show planned hours', () => {
    const chip = $('weeks').querySelectorAll('.chip')[1];
    assert.ok(chip.textContent.includes('19ч 30м / 30ч'));
    assert.ok(chip.textContent.includes('6 задач'));
  });

  console.log(`\n${passed} checks passed`);
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
