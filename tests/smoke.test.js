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

    // Ready-made filters. Target week is 46 here (selected above).
    const chipTexts = () => [...$('poolPresets').querySelectorAll('.tog')].map((b) => b.textContent);
    check('ready-made filters are listed with task counts', () => {
      assert.deepStrictEqual(chipTexts(), [
        'Мой фильтр · 7', 'Срочные · 1', 'Срок в нед. 46 · 1', 'С приоритетом · 1', 'Без оценки · 2',
        'Быстрые ≤ 30м · 1', 'Начатые · 0', 'Давно лежат · 7', 'Из трекера · 0'
      ]);
    });
    btn($('poolPresets'), 'Срочные · 1').click();
    await wait(50);
    check('a ready-made filter narrows the pool and is remembered', () => {
      assert.deepStrictEqual(names($('poolList')), ['Лабораторная №3 по физике']);
      assert.strictEqual(JSON.parse(w.__store.cfg).poolPreset, 'urgent');
      assert.ok($('poolSummary').textContent.includes('Срок (день или время) не позже чем через 7 дн.'), $('poolSummary').textContent);
    });
    btn($('poolPresets'), 'Быстрые ≤ 30м · 1').click();
    await wait(50);
    check('"Quick" shows short tasks', () => {
      assert.deepStrictEqual(names($('poolList')), ['Ответить на письмо куратора']);
    });
    $('poolCfgBtn').click();
    check('editing starts from the active ready-made filter', () => {
      assert.ok($('modal').textContent.includes('Основа — готовый фильтр «Быстрые ≤ 30м»'));
      assert.strictEqual($('modal').querySelectorAll('.cond').length, 3);
    });
    btn($('modal'), 'Сохранить').click();
    await wait(50);
    check('saving turns it into "My filter"', () => {
      const cfg = JSON.parse(w.__store.cfg);
      assert.strictEqual(cfg.poolPreset, null);
      assert.ok(cfg.pool.conds.some((c) => c.field === 'timeEstimate' && c.op === 'lte'));
      assert.ok(chipTexts()[0].startsWith('Мой фильтр · 1'));
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
    const fnsCard = [...colByTitle($('weekBoard'), 'Личное').querySelectorAll('.item')]
      .find((li) => li.textContent.includes('ФНС'));
    check('week card has no action buttons except ⋯', () => {
      assert.deepStrictEqual([...fnsCard.querySelectorAll('button')].map((b) => b.className), ['more-btn']);
      assert.ok(!fnsCard.querySelector('.num-input'));
    });
    fnsCard.querySelector('.est-link').click();
    check('estimate link opens the estimate menu', () => {
      assert.ok(!$('ctxMenu').hidden);
      assert.ok($('ctxMenu').textContent.includes('Своё значение, ч'));
    });
    const est = $('ctxMenu').querySelector('input[type=number]');
    est.value = '5';
    est.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Enter' }));
    await wait(50);
    check('estimate from the card updates the task and warns about the limit', () => {
      assert.strictEqual(w.__tasks.find((x) => x.id === 't5').timeEstimate, 5 * 3600e3);
      assert.ok($('toastMsg').textContent.includes('Неделя 45, «Личное»: 6ч 30м из 6ч'), $('toastMsg').textContent);
    });

    const lim = colByTitle($('weekBoard'), 'Университет').querySelector('.num-input');
    lim.value = '10';
    lim.dispatchEvent(new w.Event('change'));
    await wait(50);
    check('category limit cannot exceed the free hours of the week', () => {
      // Week 30 h, Career 16 h + Personal 6 h → at most 8 h are left for University.
      assert.strictEqual(JSON.parse(w.__store['wl_2026-W45']).cats.uni, 8);
      assert.ok($('toastMsg').textContent.includes('Лимит «Университет» уменьшен до 8ч'), $('toastMsg').textContent);
      assert.strictEqual(colByTitle($('weekBoard'), 'Университет').querySelector('.num-input').max, '8');
    });

    check('the week panel shows how much is allocated', () => {
      assert.ok($('weekPanel').textContent.includes('Распределено по категориям 30ч из 30ч'));
    });

    const personalLim = colByTitle($('weekBoard'), 'Личное').querySelector('.num-input');
    personalLim.value = '4';
    personalLim.dispatchEvent(new w.Event('change'));
    await wait(50);
    const uniLim = colByTitle($('weekBoard'), 'Университет').querySelector('.num-input');
    uniLim.value = '10';
    uniLim.dispatchEvent(new w.Event('change'));
    await wait(50);
    check('freed hours can be given to another category', () => {
      const own = JSON.parse(w.__store['wl_2026-W45']);
      assert.strictEqual(own.cats.personal, 4);
      assert.strictEqual(own.cats.uni, 10);
    });

    check('week edits go to the week only, defaults stay', () => {
      const cats = JSON.parse(w.__store.cfg).cats;
      assert.strictEqual(cats.find((c) => c.id === 'uni').limitH, 8);
      assert.strictEqual(cats.find((c) => c.id === 'personal').limitH, 6);
      assert.ok($('weekPanel').textContent.includes('свои лимиты недели'));
    });

    const weekLim = $('weekPanel').querySelector('.num-input');
    weekLim.value = '20';
    weekLim.dispatchEvent(new w.Event('change'));
    await wait(50);
    check('week limit cannot go below the category limits together', () => {
      assert.strictEqual(JSON.parse(w.__store['wl_2026-W45']).week, 30);
      assert.ok($('toastMsg').textContent.includes('Лимит недели поднят до 30ч'));
    });

    // Categories editor: rename Career, add a category, cancel asks before discarding.
    $('catsBtn').click();
    const nameInputs = $('modal').querySelectorAll('.catrow input[type=text]');
    check('categories editor lists categories with translated placeholders', () => {
      assert.deepStrictEqual([...nameInputs].map((i) => i.placeholder), ['Несортированное', 'Университет', 'Карьера', 'Личное']);
      assert.strictEqual($('modal').querySelectorAll('.catrow .danger').length, 3, 'Unsorted cannot be deleted');
    });
    const limInputs = $('modal').querySelectorAll('.catrow input[type=number]');
    check('the editor edits the defaults', () => {
      assert.deepStrictEqual([...limInputs].map((i) => i.value), ['', '8', '16', '6']);
    });
    limInputs[3].value = '9'; // default Personal 6 → 9: 8 + 16 + 9 = 33 > 30
    limInputs[3].dispatchEvent(new w.Event('input'));
    check('editor blocks saving while category limits exceed the week', () => {
      assert.ok($('edSave').disabled);
      assert.ok($('edAlloc').textContent.includes('33ч больше лимита недели 30ч'), $('edAlloc').textContent);
    });
    limInputs[3].value = '6';
    limInputs[3].dispatchEvent(new w.Event('input'));
    check('editor allows saving again when limits fit', () => {
      assert.ok(!$('edSave').disabled);
      assert.ok($('edAlloc').textContent.includes('30ч из 30ч'));
    });
    limInputs[1].value = '5'; // new default for University
    limInputs[1].dispatchEvent(new w.Event('input'));
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

    const uniLimit = () => colByTitle($('weekBoard'), 'Университет').querySelector('.num-input').value;
    check('a new default does not change a week with own limits', () => {
      assert.strictEqual(JSON.parse(w.__store.cfg).cats.find((c) => c.id === 'uni').limitH, 5);
      assert.strictEqual(uniLimit(), '10');
    });
    check('a new category gets its default limit in a week with own limits', () => {
      assert.strictEqual(colByTitle($('weekBoard'), 'Здоровье').querySelector('.num-input').value, '');
    });

    $('weekNext').click();
    check('a week without own limits follows the new default', () => {
      assert.strictEqual(uniLimit(), '5');
      assert.ok($('weekPanel').textContent.includes('Лимиты: стандартные'));
    });

    $('weekPrev').click();
    btn($('weekPanel'), 'Вернуть стандартные').click();
    await wait(50);
    check('"Use defaults" removes the own limits of the week', () => {
      assert.strictEqual(w.__store['wl_2026-W45'], '');
      assert.strictEqual(uniLimit(), '5');
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

    check('a task already "In progress" gets the #in-progress tag on load', () => {
      assert.strictEqual(w.__newTags.length, 1);
      assert.ok(w.__tasks.find((x) => x.id === 't1').tagIds.includes(w.__newTags[0].id));
      assert.ok(w.__tasks.find((x) => x.id === 't4').tagIds.includes(w.__newTags[0].id));
    });

    check('kanban cards have no status buttons, only the checkbox and ⋯', () => {
      const card = colByTitle($('kBoard'), 'Сделать').querySelector('.item');
      assert.deepStrictEqual([...card.querySelectorAll('button')].map((b) => b.className), ['more-btn']);
      assert.ok(card.querySelector('input[type=checkbox]'));
    });

    const kcard = (title) => [...$('kBoard').querySelectorAll('.item')].find((li) => li.textContent.includes(title));
    const review = kcard('Код-ревью').querySelector('input[type=checkbox]');
    review.checked = false;
    review.dispatchEvent(new w.Event('change'));
    await wait(50);
    check('unchecking a done card moves it back to To do', () => {
      assert.strictEqual(w.__tasks.find((x) => x.id === 't3').isDone, false);
      assert.ok(names(colByTitle($('kBoard'), 'Сделать')).includes('Код-ревью интеграции мессенджеров'));
    });

    const menuItem = (label) => [...$('ctxMenu').querySelectorAll('button')]
      .find((b) => (b.querySelector('.grow') || b).textContent.trim() === label);
    kcard('Спортзал').dispatchEvent(new w.MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 50, clientY: 50 }));
    menuItem('Статус').click();
    menuItem('В работе').click();
    await wait(50);
    check('task menu → Status moves a card to In progress and stores the status', () => {
      assert.strictEqual(JSON.parse(w.__store.t_t6).s, 'doing');
      assert.ok(names(colByTitle($('kBoard'), 'В работе')).includes('Спортзал'));
    });
    check('"In progress" creates the #in-progress tag and puts it on the task', () => {
      assert.strictEqual(w.__newTags.length, 1);
      assert.strictEqual(w.__newTags[0].title, 'in-progress');
      assert.ok(w.__tasks.find((x) => x.id === 't6').tagIds.includes(w.__newTags[0].id));
    });
    const spbBox = kcard('Спортзал').querySelector('input[type=checkbox]');
    spbBox.checked = true;
    spbBox.dispatchEvent(new w.Event('change'));
    await wait(50);
    check('leaving "In progress" removes the tag, the tag is not created twice', () => {
      assert.ok(!w.__tasks.find((x) => x.id === 't6').tagIds.includes(w.__newTags[0].id));
      assert.strictEqual(w.__newTags.length, 1);
    });
    const kursCard = kcard('Курсовая');
    kursCard.dispatchEvent(new w.MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 50, clientY: 50 }));
    menuItem('Статус').click();
    menuItem('В работе').click();
    await wait(50);
    check('the existing #in-progress tag is reused', () => {
      assert.strictEqual(w.__newTags.length, 1);
      assert.ok(w.__tasks.find((x) => x.id === 't2').tagIds.includes(w.__newTags[0].id));
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

  // ---------- column filter & sort (pencil) ----------
  {
    const { w, $ } = open('?page=week');
    await wait(150);
    const career = () => colByTitle($('weekBoard'), 'Карьера');
    check('every week column has a pencil button', () => {
      assert.strictEqual($('weekBoard').querySelectorAll('.bcol-head .edit-btn').length, 4);
    });
    career().querySelector('.edit-btn').click();
    check('the pencil opens the column editor', () => {
      assert.ok(!$('overlay').hidden);
      assert.ok($('modal').textContent.includes('Колонка «Карьера»: фильтр и сортировка'));
      assert.ok($('modal').textContent.includes('Сейчас показано: 2 из 2'));
    });
    btn($('modal'), '+ Условие').click();
    const fieldSel = $('modal').querySelector('.cond select');
    fieldSel.value = 'isDone';
    fieldSel.dispatchEvent(new w.Event('change'));
    const opSel = $('modal').querySelectorAll('.cond select')[1];
    opSel.value = 'isFalse';
    opSel.dispatchEvent(new w.Event('change'));
    check('the preview counts the shown cards', () => {
      assert.ok($('modal').textContent.includes('Сейчас показано: 1 из 2'), $('modal').textContent);
    });
    btn($('modal'), 'Сохранить').click();
    await wait(50);
    check('the column filter hides cards, the header shows the hidden count, hours stay', () => {
      assert.deepStrictEqual(names(career()), ['Подготовить релиз 2.4']);
      assert.ok(career().querySelector('.bcol-head').textContent.includes('скрыто 1'));
      assert.ok(career().querySelector('.edit-btn').classList.contains('on'));
      assert.ok(career().querySelector('.bcol-title').textContent === 'Карьера · 2');
      assert.ok(career().querySelector('.hours').textContent.startsWith('9ч'));
      const v = JSON.parse(w.__store.cfg).colViews['w:career'];
      assert.deepStrictEqual(v.conds.map((c) => [c.field, c.op]), [['isDone', 'isFalse']]);
      assert.strictEqual(v.sort, null);
    });
    career().querySelector('.edit-btn').click();
    btn($('modal'), 'Сбросить').click();
    btn($('modal'), 'Сохранить').click();
    await wait(50);
    check('"Reset" returns the column to the common view', () => {
      assert.strictEqual(names(career()).length, 2);
      assert.ok(!JSON.parse(w.__store.cfg).colViews['w:career']);
    });
  }
  {
    const { w, $ } = open('?page=kanban');
    await wait(200);
    const todo = () => colByTitle($('kBoard'), 'Сделать');
    todo().querySelector('.edit-btn').click();
    check('kanban columns have the pencil too', () => {
      assert.ok($('modal').textContent.includes('Колонка «Сделать»: фильтр и сортировка'));
    });
    const firstSort = $('modal').querySelectorAll('.sortrow')[1]; // row 0 is "match all / any"
    const [field, dir] = firstSort.querySelectorAll('select');
    field.value = 'title';
    field.dispatchEvent(new w.Event('change'));
    dir.value = 'desc';
    dir.dispatchEvent(new w.Event('change'));
    btn($('modal'), 'Сохранить').click();
    await wait(50);
    check('own sort of a kanban column is applied and stored', () => {
      const n = names(todo());
      assert.deepStrictEqual(n, n.slice().sort((a, b) => b.localeCompare(a, 'ru')));
      assert.strictEqual(JSON.parse(w.__store.cfg).colViews['k:todo'].sort[0].field, 'title');
    });
  }

  // ---------- kanban: manual order ----------
  {
    const { w, $ } = open('?page=kanban');
    await wait(200);
    const col = (start) => colByTitle($('kBoard'), start);
    const card = (start, title) => [...col(start).querySelectorAll('li.item')]
      .find((li) => li.querySelector('.name').textContent.startsWith(title));
    const entry = (id) => JSON.parse(w.__store['t_' + id]);
    const before = names(col('Сделать'));
    drag(w, card('Сделать', 'Спортзал'), card('Сделать', before[0]));
    await wait(50);
    check('drop on a card puts the task before it and turns on the manual order', () => {
      const n = names(col('Сделать'));
      assert.strictEqual(n[0], 'Спортзал');
      assert.strictEqual(n.length, before.length);
      assert.deepStrictEqual(JSON.parse(w.__store.cfg).colViews['k:todo'].sort, [{ field: 'manual', dir: 'asc' }]);
      assert.deepStrictEqual([entry('t6').o, entry('t6').os], [1, 'todo']);
      assert.ok($('toast').textContent.includes('ручном порядке'));
    });
    drag(w, card('Сделать', 'Спортзал'), col('Сделать').querySelector('.bcol-head'));
    await wait(50);
    check('drop on the free space of the own column puts the task to the end', () => {
      const n = names(col('Сделать'));
      assert.strictEqual(n[n.length - 1], 'Спортзал');
    });
    drag(w, card('В работе', 'Подготовить релиз'), card('Сделать', 'Спортзал'));
    await wait(50);
    check('drop on a card of another column changes the status and the position', () => {
      const n = names(col('Сделать'));
      assert.deepStrictEqual(n.slice(-2), ['Подготовить релиз 2.4', 'Спортзал']);
      assert.ok(!names(col('В работе')).includes('Подготовить релиз 2.4'));
      assert.deepStrictEqual([entry('t4').s, entry('t4').os], ['todo', 'todo']);
    });
    drag(w, card('Сделать', 'Подготовить релиз'), col('В работе').querySelector('.bcol-head'));
    await wait(50);
    check('drop on the free space of another column only changes the status', () => {
      assert.ok(names(col('В работе')).includes('Подготовить релиз 2.4'));
      assert.ok(!JSON.parse(w.__store.cfg).colViews['k:doing']);
      assert.strictEqual(entry('t4').os, 'todo', 'the old position is kept but does not count in another column');
    });
    col('Сделать').querySelector('.edit-btn').click();
    check('the kanban column editor offers the manual order', () => {
      const sel = $('modal').querySelectorAll('.sortrow')[1].querySelector('select');
      assert.strictEqual(sel.value, 'manual');
      assert.ok($('modal').textContent.includes('Перетащите карточку'));
    });
  }

  // ---------- kanban: "+" of a column ----------
  {
    const { w, $ } = open('?page=kanban');
    await wait(200);
    const col = (start) => colByTitle($('kBoard'), start);
    const newTask = (id, title, o) => Object.assign({ id, title, isDone: false, tagIds: [], subTaskIds: [], timeEstimate: 0,
      timeSpent: 0, created: Date.now() }, o || {});
    col('В работе').querySelector('.add-btn').click();
    await wait(50);
    check('"+" of a column opens the add task bar of Super Productivity', () => {
      assert.deepStrictEqual(Array.from(w.__actions), ['[Layout] Show AddTaskBar']);
      assert.ok($('toast').textContent.includes('«В работе»'));
    });
    w.__tasks.push(newTask('a1', 'Новая из строки'));
    w.__tasks.push(newTask('a2', 'Подзадача', { parentId: 't2' }));
    w.__tasks.push(newTask('a3', 'Старая', { created: 1700000000000 }));
    w.document.dispatchEvent(new w.Event('visibilitychange'));
    await wait(450);
    check('a task created while the bar is open goes to that column', () => {
      assert.deepStrictEqual(JSON.parse(w.__store.t_a1), { w: '2026-W45', c: 'unsorted', s: 'doing' });
      assert.ok(names(col('В работе')).includes('Новая из строки'));
      assert.ok(w.__tasks.find((x) => x.id === 'a1').tagIds.length === 1, 'gets the #in-progress tag');
      assert.ok(!w.__store.t_a2 && !w.__store.t_a3, 'subtasks and old tasks stay unplanned');
    });
    w.document.dispatchEvent(new w.Event('pointerdown'));
    await wait(450);
    w.__tasks.push(newTask('a4', 'После клика', { created: Date.now() + 1000 }));
    w.document.dispatchEvent(new w.Event('visibilitychange'));
    await wait(450);
    check('a click in the plugin ends the wait', () => {
      assert.ok(!w.__store.t_a4);
    });
  }

  // ---------- #in-progress tag set in Super Productivity ----------
  {
    const { w, $ } = open('?page=kanban&ptag=1');
    await wait(200);
    const task = (id) => w.__tasks.find((x) => x.id === id);
    check('a To do task with the existing #in-progress tag shows in In progress', () => {
      assert.ok(names(colByTitle($('kBoard'), 'В работе')).includes('Оповестить ФНС об открытии зарубежного счёта'));
      assert.strictEqual(JSON.parse(w.__store.t_t5).s, 'doing');
      assert.ok(!w.__newTags, 'no new tag is created');
      assert.ok(task('t1').tagIds.includes('ip'), 'old In progress tasks get the tag');
      assert.strictEqual(JSON.parse(w.__store.cfg).progressTagInit, true);
    });
    task('t1').tagIds = task('t1').tagIds.filter((x) => x !== 'ip');
    w.document.dispatchEvent(new w.Event('visibilitychange'));
    await wait(450);
    check('removing the tag in Super Productivity moves the card back to To do', () => {
      assert.strictEqual(JSON.parse(w.__store.t_t1).s, 'todo');
      assert.ok(names(colByTitle($('kBoard'), 'Сделать')).includes('Практическая №1 по дискретной математике: множества и диаграммы Эйлера'));
    });
    task('t6').tagIds = task('t6').tagIds.concat('ip');
    w.document.dispatchEvent(new w.Event('visibilitychange'));
    await wait(450);
    check('adding the tag in Super Productivity moves the card to In progress', () => {
      assert.strictEqual(JSON.parse(w.__store.t_t6).s, 'doing');
    });
  }

  // ---------- hours: a done task counts its spent time ----------
  // Week 45: t3 (Career, done, estimate 3h) and t4 (Career, estimate 6h). Week plan is 19h 30m with t3 at 3h.
  {
    const { w, $ } = open('?page=week');
    await wait(150);
    const task = (id) => w.__tasks.find((x) => x.id === id);
    const careerHours = () => colByTitle($('weekBoard'), 'Карьера').querySelector('.hours').textContent;
    const refresh = async () => { w.document.dispatchEvent(new w.Event('visibilitychange')); await wait(450); };

    task('t3').timeSpent = 0.5 * 3600e3;
    await refresh();
    check('a done task faster than the estimate counts the spent time', () => {
      assert.ok(careerHours().startsWith('6ч 30м /'), careerHours());
      assert.ok($('weekPanel').textContent.includes('План недели 17ч /'), $('weekPanel').textContent);
    });

    task('t3').timeSpent = 12 * 3600e3;
    await refresh();
    check('a done task slower than the estimate counts the spent time, limits too', () => {
      assert.ok(careerHours().startsWith('18ч /'), careerHours());
      assert.ok($('weekBanner').textContent.includes('Карьера: 18ч из 16ч (+2ч)'), $('weekBanner').textContent);
    });

    task('t3').timeSpent = 0;
    await refresh();
    check('a done task without tracked time counts the estimate', () => {
      assert.ok(careerHours().startsWith('9ч /'), careerHours());
    });

    task('t3').timeSpent = 0.5 * 3600e3;
    task('t1').timeSpent = 6 * 3600e3;
    $('tabKanban').click();
    await refresh();
    check('kanban: Done counts the spent time, open tasks keep the estimate', () => {
      assert.ok($('kPanel').textContent.includes('Готово 30м из 17ч'), $('kPanel').textContent);
      assert.ok(colByTitle($('kBoard'), 'Готово').querySelector('.bcol-right').textContent.startsWith('30м'));
    });
  }

  // ---------- task context menu ----------
  {
    const { w, $ } = open('?page=week');
    await wait(150);
    const card = (title) => [...$('weekBoard').querySelectorAll('.item')].find((li) => li.textContent.includes(title));
    const rightClick = (node) => node.dispatchEvent(new w.MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 50, clientY: 50 }));
    const item = (label) => [...$('ctxMenu').querySelectorAll('button')]
      .find((b) => (b.querySelector('.grow') || b).textContent.trim() === label || b.textContent.trim() === label);
    const task = (id) => w.__tasks.find((x) => x.id === id);

    rightClick(card('Курсовая'));
    check('right click opens the task menu with the main actions', () => {
      assert.ok(!$('ctxMenu').hidden);
      ['Отметить как выполненное', 'Начать отслеживание времени', 'Оценка', 'Переключать метки',
        'Переместить в другой проект', 'Приоритет', 'Неделя', 'Категория', 'Открыть панель задачи', 'Удалить задачу']
        .forEach((l) => assert.ok(item(l), 'missing ' + l));
      const badge = card('Курсовая').querySelector('.prio');
      assert.ok(badge && badge.classList.contains('prio-1') && badge.textContent === '1', 'priority badge on the card');
    });

    item('Приоритет').click();
    item('Приоритет 3').click();
    await wait(50);
    check('priority can be changed', () => {
      assert.strictEqual(task('t2').priority, 3);
      assert.ok($('ctxMenu').hidden);
      assert.ok(card('Курсовая').querySelector('.prio-3'));
    });

    rightClick(card('Курсовая'));
    item('Оценка').click();
    item('2ч').click();
    await wait(50);
    check('estimate preset sets the estimate', () => { assert.strictEqual(task('t2').timeEstimate, 2 * 3600e3); });

    rightClick(card('Курсовая'));
    item('Переключать метки').click();
    item('#Здоровье').click();
    await wait(50);
    check('tag toggle keeps the menu open and updates tags', () => {
      assert.deepStrictEqual(Array.from(task('t2').tagIds), ['kai', 'health']);
      assert.ok(!$('ctxMenu').hidden);
    });
    w.document.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape' }));
    check('Esc in a submenu goes back to the main menu', () => { assert.ok(item('Оценка')); });
    w.document.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape' }));
    check('second Esc closes the menu', () => { assert.ok($('ctxMenu').hidden); });

    rightClick(card('Курсовая'));
    [...$('ctxMenu').querySelectorAll('.ctx-date')].find((b) => b.textContent.includes('Сегодня')).click();
    await wait(50);
    check('"Today" sets the due day', () => { assert.strictEqual(task('t2').dueDay, '2026-11-08'); });

    const weekOf = () => JSON.parse(w.__store.t_t2).w;
    const startWeek = weekOf();
    rightClick(card('Курсовая'));
    item('Неделя').click();
    item('На неделю позже').click();
    await wait(50);
    check('"One week later" moves the task from its own week', () => { assert.notStrictEqual(weekOf(), startWeek); });
    // The card left the shown week; open the menu from the page of the next week.
    const chipStep = (d) => {
      const chips = [...$('weekStrip').querySelectorAll('.chip')];
      chips[chips.findIndex((c) => c.classList.contains('sel')) + d].click();
    };
    chipStep(1);
    await wait(50);
    rightClick(card('Курсовая'));
    item('Неделя').click();
    item('На неделю раньше').click();
    await wait(50);
    check('"One week earlier" moves the task back', () => { assert.strictEqual(weekOf(), startWeek); });
    chipStep(-1);
    await wait(50);

    rightClick(card('Курсовая'));
    item('Категория').click();
    item('Личное').click();
    await wait(50);
    check('category can be changed from the menu', () => {
      assert.strictEqual(JSON.parse(w.__store.t_t2).c, 'personal');
    });

    card('Курсовая').querySelector('.more-btn').click();
    check('the ⋯ button opens the same menu', () => { assert.ok(!$('ctxMenu').hidden); });
    item('Начать отслеживание времени').click();
    await wait(50);
    check('start tracking calls the API', () => { assert.strictEqual(w.__tracking, 't2'); });

    rightClick(card('Курсовая'));
    item('Удалить задачу').click();
    check('delete asks for a second click', () => {
      assert.ok(item('Нажмите ещё раз, чтобы удалить'));
      assert.ok(task('t2'));
    });
    item('Нажмите ещё раз, чтобы удалить').click();
    await wait(50);
    check('second click deletes the task and its week entry', () => {
      assert.ok(!task('t2'));
      assert.strictEqual(w.__store.t_t2, '');
      assert.ok(!card('Курсовая'));
    });
  }

  // ---------- the task with time tracking ----------
  {
    const { w, $ } = open('?page=kanban');
    w.__secrets.cur = JSON.stringify({ id: 't2', ts: 1 });
    await wait(200);
    const card = (id) => $('kBoard').querySelector('li.item[data-id="' + id + '"]');
    check('the tracked task is highlighted on open', () => {
      assert.ok(card('t2').classList.contains('cur'));
      assert.strictEqual($('kBoard').querySelectorAll('li.item.cur').length, 1);
    });
    w.__secrets.cur = JSON.stringify({ id: 't1', ts: 2 });
    await wait(900);
    check('the highlight follows the tracked task without a reload', () => {
      assert.ok(card('t1').classList.contains('cur') && !card('t2').classList.contains('cur'));
    });
    w.__secrets.cur = JSON.stringify({ id: null, ts: 3 });
    await wait(900);
    check('no highlight when tracking stops', () => {
      assert.strictEqual($('kBoard').querySelectorAll('li.item.cur').length, 0);
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
