// Fake PluginAPI with realistic data. Used by the smoke test and the screenshot harness.
// Exported as a source string so it can be injected into index.html before the plugin script.
// URL parameters: theme=light|dark, lang=ru|en, page=plan|week|kanban, cur=<task id with time tracking>, act=cats|pooleditor|select|toast|empty
module.exports = function fakeApiSource() {
  return `(function () {
  var H = 3600e3;
  var params = new URLSearchParams(location.search);
  var theme = params.get('theme') || 'light';
  var lang = params.get('lang') || 'ru';
  // Task, project and tag names in the language of the UI, so screenshots are in one language.
  function L(ru, en) { return lang.indexOf('ru') === 0 ? ru : en; }
  function E(w, c, s) { return JSON.stringify({ w: w, c: c, s: s || 'todo' }); }
  var store = {
    // t_t5 and t_t7 use the old 0.3 format (plain week string) on purpose.
    't_t1': E('2026-W45', 'uni', 'doing'), 't_t2': E('2026-W45', 'uni'), 't_t3': E('2026-W45', 'career'),
    't_t4': E('2026-W45', 'career', 'doing'), 't_t5': '2026-W45', 't_t6': E('2026-W45', 'personal'),
    't_t7': '2026-W44', 't_t8': E('2026-W46', 'career'), 't_t9': E('2026-W46', 'uni'),
    cfg: JSON.stringify({ v: 2,
      pool: { id: 'pool', match: 'all', conds: [{ field: 'isSubtask', op: 'isFalse' }],
        sort: [{ field: 'due', dir: 'asc' }, { field: 'created', dir: 'asc' }] },
      cats: [{ id: 'unsorted', name: '', limitH: null }, { id: 'uni', name: '', limitH: 8 },
        { id: 'career', name: '', limitH: 16 }, { id: 'personal', name: '', limitH: 6 }],
      weekLimitH: 30,
      cardSort: [{ field: 'isDone', dir: 'asc' }, { field: 'due', dir: 'asc' }] })
  };
  if (params.get('act') === 'empty') { Object.keys(store).forEach(function (k) { delete store[k]; }); }
  var secrets = {};
  if (params.get('page')) secrets.nav = JSON.stringify({ page: params.get('page'), ts: 1 });
  if (params.get('cur')) secrets.cur = JSON.stringify({ id: params.get('cur'), ts: 1 });
  function T(id, title, o) {
    return Object.assign({ id: id, title: title, isDone: false, projectId: null, tagIds: [], timeEstimate: 0,
      timeSpent: 0, subTaskIds: [], created: 1700000000000 + id.charCodeAt(1) * 1000 }, o || {});
  }
  var tasks = [
    T('t1', L('Практическая №1 по дискретной математике: множества и диаграммы Эйлера', 'Discrete math assignment 1: sets and Euler diagrams'), { projectId: 'uni', tagIds: ['kai'], timeEstimate: 4 * H, timeSpent: 1.5 * H, dueDay: '2026-11-10', timeSpentOnDay: { '2026-11-03': 1.5 * H } }),
    T('t2', L('Курсовая: глава 2', 'Term paper: chapter 2'), { projectId: 'uni', tagIds: ['kai'], timeEstimate: 5 * H, dueDay: '2026-11-13', priority: 1 }),
    T('t3', L('Код-ревью интеграции мессенджеров', 'Code review of the messenger integration'), { projectId: 'work', timeEstimate: 3 * H, timeSpent: 3 * H, isDone: true }),
    T('t4', L('Подготовить релиз 2.4', 'Prepare release 2.4'), { projectId: 'work', timeEstimate: 6 * H, dueWithTime: new Date(2026, 10, 12, 18, 0).getTime(), priority: 3 }),
    T('t5', L('Оповестить ФНС об открытии зарубежного счёта', 'File the tax notice about the foreign account'), { dueDay: '2026-11-05' }),
    T('t6', L('Спортзал', 'Gym'), { tagIds: ['health', 'TODAY'], timeEstimate: 1.5 * H, priority: 2 }),
    T('t7', L('Отчёт по практике', 'Internship report'), { projectId: 'uni', tagIds: ['kai'], timeEstimate: 2 * H, dueDay: '2026-11-02' }),
    T('t8', L('Созвон с заказчиком', 'Call with the client'), { projectId: 'work', timeEstimate: 1 * H }),
    T('t9', L('Подготовка к коллоквиуму', 'Prepare for the colloquium'), { projectId: 'uni', tagIds: ['kai'], timeEstimate: 3 * H }),
    T('p1', L('Лабораторная №3 по физике', 'Physics lab 3'), { projectId: 'uni', tagIds: ['kai'], timeEstimate: 3 * H, dueDay: '2026-11-11' }),
    T('p2', L('Миграция БД на PostgreSQL 17', 'Migrate the DB to PostgreSQL 17'), { projectId: 'work', timeEstimate: 8 * H, subTaskIds: ['s1', 's2'] }),
    T('s1', L('Бэкап перед миграцией', 'Backup before the migration'), { projectId: 'work', parentId: 'p2', timeEstimate: 1 * H }),
    T('s2', L('Прогнать тесты', 'Run the tests'), { projectId: 'work', parentId: 'p2', timeEstimate: 2 * H }),
    T('p3', L('Купить подарок маме', 'Buy a gift for mom'), { dueDay: '2026-11-20' }),
    T('p4', L('Прочитать «Designing Data-Intensive Applications», гл. 5', 'Read "Designing Data-Intensive Applications", ch. 5'), { tagIds: ['read'], timeEstimate: 2 * H, priority: 2 }),
    T('p8', L('Ответить на письмо куратора', 'Reply to the supervisor'), { projectId: 'uni', timeEstimate: 0.25 * H }),
    T('p5', L('Записаться к стоматологу', 'Book a dentist appointment'), {}),
    T('p6', L('Эссе по философии', 'Philosophy essay'), { projectId: 'uni', tagIds: ['kai'], timeEstimate: 2.5 * H, dueDay: '2026-11-18', deadlineDay: '2026-11-17' }),
    T('p7', L('Настроить мониторинг Grafana', 'Set up Grafana monitoring'), { projectId: 'work', timeEstimate: 4 * H, issueId: '123', issueType: 'GITLAB' })
  ];
  if (params.get('ptag')) tasks.find(function (x) { return x.id === 't5'; }).tagIds = ['ip'];
  window.__store = store;
  window.__secrets = secrets;
  window.__tasks = tasks;
  window.PluginAPI = {
    cfg: { theme: theme, lang: { code: lang } },
    Hooks: { DATA_CHANGED: 'dataChanged', PERSISTED_DATA_CHANGED: 'persistedDataChanged', DAY_CHANGE: 'dayChange' },
    getCurrentLanguage: function () { return lang; },
    getDayContext: async function () { return { todayStr: '2026-11-08', startOfNextDayDiffMs: 0 }; },
    listSyncedDataKeys: async function (p) { return Object.keys(store).filter(function (k) { return k.indexOf(p) === 0 && store[k]; }).sort(); },
    loadSyncedData: async function (k) { return store[k] || null; },
    persistDataSynced: async function (v, k) { store[k] = v; },
    getSecret: async function (k) { return secrets[k] || null; },
    setSecret: async function (k, v) { secrets[k] = v; },
    getTasks: async function () { return tasks; },
    getArchivedTasks: async function () { return []; },
    getAllProjects: async function () { return [{ id: 'uni', title: L('Учёба', 'Study'), icon: '🎓', theme: { primary: '#f6b13b' } }, { id: 'work', title: L('Работа', 'Work'), icon: 'work', theme: { primary: '#4a90e2' } }]; },
    getAllTags: async function () { return [{ id: 'TODAY', title: 'Today' }, { id: 'kai', title: L('КАИ', 'KAI'), icon: '👨‍🎓', color: '#a05a2c' },
      { id: 'health', title: L('Здоровье', 'Health'), theme: { primary: '#ef6c00' } }, { id: 'read', title: L('Чтение', 'Reading'), theme: { primary: '#ab47bc' } }]
      .concat(params.get('ptag') ? [{ id: 'ip', title: 'in-progress' }] : []); },
    addTag: async function (d) { var id = 'tag' + (++window.__tagN || (window.__tagN = 1)); window.__newTags = (window.__newTags || []).concat([{ id: id, title: d.title }]); return id; },
    addTask: async function (d) { var id = 'n' + tasks.length; tasks.push(T(id, d.title)); return id; },
    updateTask: async function (id, u) { tasks.forEach(function (x) { if (x.id === id) Object.assign(x, u); }); },
    selectTask: async function (id) { window.__selected = id; },
    dispatchAction: async function (act) { window.__actions = (window.__actions || []).concat([act.type]); },
    deleteTask: async function (id) { var i = tasks.findIndex(function (x) { return x.id === id; }); if (i >= 0) tasks.splice(i, 1); },
    startTracking: async function (id) { window.__tracking = id; },
    registerHook: function () {}, showSnack: function () {}, log: { err: console.error }
  };
  window.addEventListener('load', function () {
    var act = params.get('act');
    setTimeout(function () {
      if (act === 'cats') document.getElementById('catsBtn').click();
      if (act === 'pooleditor') document.getElementById('poolCfgBtn').click();
      if (act === 'select') {
        var rows = document.querySelectorAll('#poolList li');
        rows[0].click(); rows[1].click();
      }
      if (act === 'toast') document.querySelector('#poolList li .actions button').click();
      if (act === 'ctx' || act === 'ctxprio') {
        var card = document.querySelector('#weekBoard .bcol:nth-child(2) .item');
        var r = card.getBoundingClientRect();
        card.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: r.left + 120, clientY: r.top + 20 }));
        if (act === 'ctxprio') {
          var b = Array.prototype.find.call(document.querySelectorAll('#ctxMenu button'), function (x) { return /^!?(Приоритет|Priority)/.test(x.textContent); });
          if (b) b.click();
        }
      }
    }, 300);
  });
})();`;
};
