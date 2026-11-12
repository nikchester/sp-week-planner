// Fake PluginAPI with realistic data. Used by the smoke test and the screenshot harness.
// Exported as a source string so it can be injected into index.html before the plugin script.
// URL parameters: theme=light|dark, lang=ru|en, page=plan|week|kanban, cur=<task id with time tracking>, act=cats|pooleditor|select|toast|empty
module.exports = function fakeApiSource() {
  return `(function () {
  var H = 3600e3;
  var params = new URLSearchParams(location.search);
  var theme = params.get('theme') || 'light';
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
    T('t1', 'Практическая №1 по дискретной математике: множества и диаграммы Эйлера', { projectId: 'uni', tagIds: ['kai'], timeEstimate: 4 * H, timeSpent: 1.5 * H, dueDay: '2026-11-10', timeSpentOnDay: { '2026-11-03': 1.5 * H } }),
    T('t2', 'Курсовая: глава 2', { projectId: 'uni', tagIds: ['kai'], timeEstimate: 5 * H, dueDay: '2026-11-13', priority: 1 }),
    T('t3', 'Код-ревью интеграции мессенджеров', { projectId: 'work', timeEstimate: 3 * H, timeSpent: 3 * H, isDone: true }),
    T('t4', 'Подготовить релиз 2.4', { projectId: 'work', timeEstimate: 6 * H, dueWithTime: new Date(2026, 10, 12, 18, 0).getTime(), priority: 3 }),
    T('t5', 'Оповестить ФНС об открытии зарубежного счёта', { dueDay: '2026-11-05' }),
    T('t6', 'Спортзал', { tagIds: ['health', 'TODAY'], timeEstimate: 1.5 * H, priority: 2 }),
    T('t7', 'Отчёт по практике', { projectId: 'uni', tagIds: ['kai'], timeEstimate: 2 * H, dueDay: '2026-11-02' }),
    T('t8', 'Созвон с заказчиком', { projectId: 'work', timeEstimate: 1 * H }),
    T('t9', 'Подготовка к коллоквиуму', { projectId: 'uni', tagIds: ['kai'], timeEstimate: 3 * H }),
    T('p1', 'Лабораторная №3 по физике', { projectId: 'uni', tagIds: ['kai'], timeEstimate: 3 * H, dueDay: '2026-11-11' }),
    T('p2', 'Миграция БД на PostgreSQL 17', { projectId: 'work', timeEstimate: 8 * H, subTaskIds: ['s1', 's2'] }),
    T('s1', 'Бэкап перед миграцией', { projectId: 'work', parentId: 'p2', timeEstimate: 1 * H }),
    T('s2', 'Прогнать тесты', { projectId: 'work', parentId: 'p2', timeEstimate: 2 * H }),
    T('p3', 'Купить подарок маме', { dueDay: '2026-11-20' }),
    T('p4', 'Прочитать «Designing Data-Intensive Applications», гл. 5', { tagIds: ['read'], timeEstimate: 2 * H, priority: 2 }),
    T('p8', 'Ответить на письмо куратора', { projectId: 'uni', timeEstimate: 0.25 * H }),
    T('p5', 'Записаться к стоматологу', {}),
    T('p6', 'Эссе по философии', { projectId: 'uni', tagIds: ['kai'], timeEstimate: 2.5 * H, dueDay: '2026-11-18', deadlineDay: '2026-11-17' }),
    T('p7', 'Настроить мониторинг Grafana', { projectId: 'work', timeEstimate: 4 * H, issueId: '123', issueType: 'GITLAB' })
  ];
  if (params.get('ptag')) tasks.find(function (x) { return x.id === 't5'; }).tagIds = ['ip'];
  window.__store = store;
  window.__secrets = secrets;
  window.__tasks = tasks;
  window.PluginAPI = {
    cfg: { theme: theme, lang: { code: params.get('lang') || 'ru' } },
    Hooks: { DATA_CHANGED: 'dataChanged', PERSISTED_DATA_CHANGED: 'persistedDataChanged', DAY_CHANGE: 'dayChange' },
    getCurrentLanguage: function () { return params.get('lang') || 'ru'; },
    getDayContext: async function () { return { todayStr: '2026-11-08', startOfNextDayDiffMs: 0 }; },
    listSyncedDataKeys: async function (p) { return Object.keys(store).filter(function (k) { return k.indexOf(p) === 0 && store[k]; }).sort(); },
    loadSyncedData: async function (k) { return store[k] || null; },
    persistDataSynced: async function (v, k) { store[k] = v; },
    getSecret: async function (k) { return secrets[k] || null; },
    setSecret: async function (k, v) { secrets[k] = v; },
    getTasks: async function () { return tasks; },
    getArchivedTasks: async function () { return []; },
    getAllProjects: async function () { return [{ id: 'uni', title: 'Учёба', icon: '🎓', theme: { primary: '#f6b13b' } }, { id: 'work', title: 'Работа', icon: 'work', theme: { primary: '#4a90e2' } }]; },
    getAllTags: async function () { return [{ id: 'TODAY', title: 'Today' }, { id: 'kai', title: 'КАИ', icon: '👨‍🎓', color: '#a05a2c' },
      { id: 'health', title: 'Здоровье', theme: { primary: '#ef6c00' } }, { id: 'read', title: 'Чтение', theme: { primary: '#ab47bc' } }]
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
          var b = Array.prototype.find.call(document.querySelectorAll('#ctxMenu button'), function (x) { return x.textContent.indexOf('Приоритет') === 0 || x.textContent.indexOf('!Приоритет') === 0; });
          if (b) b.click();
        }
      }
    }, 300);
  });
})();`;
};
