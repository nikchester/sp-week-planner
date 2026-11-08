// Smoke test: runs week-planner/index.html in jsdom with a fake PluginAPI.
// Run: npm test
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { JSDOM } = require('jsdom');
const fakeApiSource = require('./fake-api');

const html = fs.readFileSync(path.join(__dirname, '..', 'week-planner', 'index.html'), 'utf8')
  .replace('<body>', '<body><script>' + fakeApiSource() + '</script>');

let passed = 0;
function check(name, fn) { fn(); passed++; console.log('ok -', name); }
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function open(query) {
  const dom = new JSDOM(html, {
    runScripts: 'dangerously', pretendToBeVisual: true, url: 'http://localhost/' + query,
    beforeParse(w) { w.matchMedia = () => ({ matches: false }); w.scrollTo = () => {}; }
  });
  const w = dom.window;
  return { w, $: (id) => w.document.getElementById(id) };
}
const names = (root) => [...root.querySelectorAll('.name')].map((n) => n.textContent);
const btn = (root, text) => [...root.querySelectorAll('button')].find((b) => b.textContent === text);
const colByTitle = (root, start) => [...root.querySelectorAll('.bcol')]
  .find((c) => c.querySelector('.bcol-title').textContent.startsWith(start));

// Simulates HTML5 drag and drop: jsdom has no DataTransfer, so a minimal one is passed.
function drag(w, from, to) {
  const data = {};
  const dt = { setData: (k, v) => { data[k] = v; }, getData: (k) => data[k], effectAllowed: '' };
  const ev = (type) => { const e = new w.Event(type, { bubbles: true, cancelable: true }); e.dataTransfer = dt; return e; };
  from.dispatchEvent(ev('dragstart'));
  to.dispatchEvent(ev('dragover'));
  to.dispatchEvent(ev('drop'));
}

(async () => {
  // ---------- planning ----------
  {
    const { w, $ } = open('?page=plan');
    await wait(150);

    check('planning page is shown by the nav request', () => {
      assert.ok(!$('pagePlan').hidden);
      assert.ok($('pageWeek').hidden && $('pageKanban').hidden);
      assert.ok($('tabPlan').classList.contains('on'));
    });

    check('pool shows unplanned top-level tasks only', () => {
      const pool = names($('poolList'));
      assert.ok(pool.includes('Лабораторная №3 по физике'));
      assert.ok(!pool.includes('Бэкап перед миграцией'));
      assert.ok(!pool.includes('Курсовая: глава 2'));
    });

    check('six week cards with category loads, current week is the target', () => {
      const cards = $('weeksGrid').querySelectorAll('.wcard');
      assert.strictEqual(cards.length, 6);
      assert.ok(cards[0].classList.contains('target'));
      const text = cards[0].textContent;
      assert.ok(text.includes('19ч 30м / 30ч'), text);
      assert.ok(text.includes('Университет9ч / 8ч ⚠'), text);
      assert.ok(text.includes('Несортированное (1)'), text);
    });

    check('overdue task from week 44 is listed', () => {
      assert.ok(!$('overdueSec').hidden);
      assert.deepStrictEqual(names($('overdueList')), ['Отчёт по практике']);
    });

    // Select week 46 as target, then add a pool task with the row button.
    $('weeksGrid').querySelectorAll('.wcard')[1].click();
    check('clicking a week card makes it the target', () => {
      assert.ok($('weeksGrid').querySelectorAll('.wcard')[1].classList.contains('target'));
      assert.strictEqual($('poolList').querySelector('.actions button').textContent, '→ Нед. 46');
    });
    const first = $('poolList').querySelector('li');
    const firstName = first.querySelector('.name').textContent;
    first.querySelector('.actions button').click();
    await wait(50);
    check('pool button plans the task into the target week as unsorted', () => {
      const id = Object.keys(w.__store).find((k) => w.__store[k] && w.__store[k].includes('W46') && !['t_t8', 't_t9'].includes(k));
      assert.ok(id, 'new entry exists');
      assert.deepStrictEqual(JSON.parse(w.__store[id]), { w: '2026-W46', c: 'unsorted', s: 'todo' });
      assert.ok(!names($('poolList')).includes(firstName));
      assert.ok($('toastMsg').textContent.startsWith('Добавлено на неделю 46: 1'));
    });

    $('toastUndo').click();
    await wait(50);
    check('undo returns the task to the pool', () => {
      assert.ok(names($('poolList')).includes(firstName));
    });

    // Drag a pool task onto week 45: University goes further over its limit, week total too.
    const lab = [...$('poolList').querySelectorAll('li')].find((li) => li.textContent.includes('Мониторинг') || li.textContent.includes('Grafana'));
    drag(w, lab, $('weeksGrid').querySelectorAll('.wcard')[0]);
    await wait(50);
    check('drop on a week card plans the task', () => {
      assert.ok(!names($('poolList')).includes('Настроить мониторинг Grafana'));
      assert.ok($('weeksGrid').querySelectorAll('.wcard')[0].textContent.includes('23ч 30м / 30ч'));
    });
  }

  // ---------- week page ----------
  {
    const { w, $ } = open('?page=week');
    await wait(150);

    check('week page shows category columns in order', () => {
      assert.ok(!$('pageWeek').hidden);
      const titles = [...$('weekBoard').querySelectorAll('.bcol-title')].map((n) => n.textContent);
      assert.deepStrictEqual(titles, ['Несортированное · 1', 'Университет · 2', 'Карьера · 2', 'Личное · 1']);
    });

    check('old-format entry lands in Unsorted', () => {
      assert.deepStrictEqual(names(colByTitle($('weekBoard'), 'Несортированное')), ['Оповестить ФНС об открытии зарубежного счёта']);
    });

    check('banner reports the exceeded category', () => {
      assert.ok(!$('weekBanner').hidden);
      assert.ok($('weekBanner').textContent.includes('Университет: 9ч из 8ч (+1ч)'));
    });

    // Move the FNS task from Unsorted to Personal by drag and drop.
    const fns = colByTitle($('weekBoard'), 'Несортированное').querySelector('.item');
    drag(w, fns, colByTitle($('weekBoard'), 'Личное'));
    await wait(50);
    check('drag between columns changes the category', () => {
      assert.deepStrictEqual(JSON.parse(w.__store.t_t5), { w: '2026-W45', c: 'personal', s: 'todo' });
      assert.ok(names(colByTitle($('weekBoard'), 'Личное')).includes('Оповестить ФНС об открытии зарубежного счёта'));
    });

    // Estimate the FNS task at 5 h: Personal (1.5 h + 5 h) goes over 6 h.
    const est = [...colByTitle($('weekBoard'), 'Личное').querySelectorAll('.item')]
      .find((li) => li.textContent.includes('ФНС')).querySelector('.num-input');
    est.value = '5';
    est.dispatchEvent(new w.Event('change'));
    await wait(50);
    check('inline estimate updates the task and warns about the limit', () => {
      assert.strictEqual(w.__tasks.find((x) => x.id === 't5').timeEstimate, 5 * 3600e3);
      assert.ok($('toastMsg').textContent.includes('Неделя 45, «Личное»: 6ч 30м из 6ч'), $('toastMsg').textContent);
    });

    const lim = colByTitle($('weekBoard'), 'Университет').querySelector('.num-input');
    lim.value = '10';
    lim.dispatchEvent(new w.Event('change'));
    await wait(50);
    check('inline category limit is saved globally', () => {
      assert.strictEqual(JSON.parse(w.__store.cfg).cats.find((c) => c.id === 'uni').limitH, 10);
    });

    // Categories editor: rename Career, add a category, cancel asks before discarding.
    $('catsBtn').click();
    const nameInputs = $('modal').querySelectorAll('.catrow input[type=text]');
    check('categories editor lists categories with translated placeholders', () => {
      assert.deepStrictEqual([...nameInputs].map((i) => i.placeholder), ['Несортированное', 'Университет', 'Карьера', 'Личное']);
      assert.strictEqual($('modal').querySelectorAll('.catrow .danger').length, 3, 'Unsorted cannot be deleted');
    });
    nameInputs[2].value = 'Работа';
    nameInputs[2].dispatchEvent(new w.Event('input'));
    btn($('modal'), '+ Категория').click();
    const inputs = $('modal').querySelectorAll('.catrow input[type=text]');
    inputs[inputs.length - 1].value = 'Здоровье';
    inputs[inputs.length - 1].dispatchEvent(new w.Event('input'));
    btn($('modal'), 'Сохранить').click();
    await wait(50);
    check('saved categories apply to the board', () => {
      const titles = [...$('weekBoard').querySelectorAll('.bcol-title')].map((n) => n.textContent);
      assert.deepStrictEqual(titles, ['Несортированное · 0', 'Университет · 2', 'Работа · 2', 'Личное · 2', 'Здоровье · 0']);
      const cats = JSON.parse(w.__store.cfg).cats;
      assert.strictEqual(cats[0].name, '', 'built-in names stay translatable');
    });
  }

  // ---------- kanban ----------
  {
    const { w, $ } = open('?page=kanban');
    await wait(150);

    check('kanban opens on the current week with three status columns', () => {
      assert.ok(!$('pageKanban').hidden);
      assert.strictEqual($('kTitle').textContent, 'Канбан · неделя 45');
      const titles = [...$('kBoard').querySelectorAll('.bcol-title')].map((n) => n.textContent);
      assert.deepStrictEqual(titles, ['Сделать · 3', 'В работе · 2', 'Готово · 1']);
    });

    // Drag "Курсовая" from To do to Done.
    const kurs = [...colByTitle($('kBoard'), 'Сделать').querySelectorAll('.item')].find((li) => li.textContent.includes('Курсовая'));
    drag(w, kurs, colByTitle($('kBoard'), 'Готово'));
    await wait(50);
    check('drop on Done marks the task done in Super Productivity', () => {
      assert.strictEqual(w.__tasks.find((x) => x.id === 't2').isDone, true);
      assert.ok(names(colByTitle($('kBoard'), 'Готово')).includes('Курсовая: глава 2'));
    });

    const review = [...colByTitle($('kBoard'), 'Готово').querySelectorAll('.item')].find((li) => li.textContent.includes('Код-ревью'));
    btn(review, '← Вернуть').click();
    await wait(50);
    check('reopen moves the task back to To do', () => {
      assert.strictEqual(w.__tasks.find((x) => x.id === 't3').isDone, false);
    });

    const spb = [...colByTitle($('kBoard'), 'Сделать').querySelectorAll('.item')].find((li) => li.textContent.includes('Спортзал'));
    btn(spb, 'В работу →').click();
    await wait(50);
    check('"Start" moves a card to In progress and stores the status', () => {
      assert.strictEqual(JSON.parse(w.__store.t_t6).s, 'doing');
    });

    btn($('kCats'), 'Университет · 2').click();
    check('category filter narrows the board', () => {
      const all = names($('kBoard'));
      assert.deepStrictEqual(all.sort(), ['Курсовая: глава 2', 'Практическая №1 по дискретной математике: множества и диаграммы Эйлера'].sort());
    });

    // A header button click while the view is open switches the page.
    w.__secrets.nav = JSON.stringify({ page: 'plan', ts: Date.now() });
    await wait(1000);
    check('navigation request switches the open view', () => {
      assert.ok(!$('pagePlan').hidden);
    });
  }

  // ---------- migration from 0.3 config ----------
  {
    const { w, $ } = open('?page=week');
    w.__store.cfg = JSON.stringify({ v: 1, pool: { conds: [], sort: [] }, all: { id: 'all', limitH: 16, sort: [] }, lists: [] });
    w.document.dispatchEvent(new w.Event('visibilitychange'));
    await wait(500);
    check('0.3 config migrates: week limit kept, default categories created', () => {
      const titles = [...$('weekBoard').querySelectorAll('.bcol-title')].map((n) => n.textContent.split(' · ')[0]);
      assert.deepStrictEqual(titles, ['Несортированное', 'Университет', 'Карьера', 'Личное']);
      assert.ok($('weekPanel').textContent.includes('План недели'));
      assert.strictEqual($('weekPanel').querySelector('.num-input').value, '16');
    });
  }

  console.log(`\n${passed} checks passed`);
  process.exit(0);
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
