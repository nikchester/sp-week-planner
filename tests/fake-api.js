// Fake PluginAPI with realistic data. Used by the smoke test and the screenshot harness.
// Exported as a source string so it can be injected into index.html before the plugin script.
module.exports = function fakeApiSource(opts) {
  opts = opts || {};
  return `(function () {
  var H = 3600e3;
  var params = new URLSearchParams(location.search);
  var theme = params.get('theme') || ${JSON.stringify(opts.theme || 'light')};
  var store = {
    't_t1': '2026-W45', 't_t2': '2026-W45', 't_t3': '2026-W45', 't_t4': '2026-W45',
    't_t5': '2026-W45', 't_t6': '2026-W45', 't_t7': '2026-W44', 't_t8': '2026-W46',
    cfg: JSON.stringify({ v: 1,
      pool: { id: 'pool', match: 'all', conds: [{ field: 'isSubtask', op: 'isFalse' }],
        sort: [{ field: 'due', dir: 'asc' }, { field: 'created', dir: 'asc' }] },
      all: { id: 'all', match: 'all', conds: [], sort: [{ field: 'isDone', dir: 'asc' }, { field: 'due', dir: 'asc' }], limitH: 30 },
      lists: [
        { id: 'u', name: 'University', match: 'all', conds: [{ field: 'tags', op: 'any', value: ['kai'] }],
          sort: [{ field: 'due', dir: 'asc' }], limitH: 8 },
        { id: 'w', name: 'Работа', match: 'all', conds: [{ field: 'project', op: 'in', value: ['work'] }],
          sort: [{ field: 'timeEstimate', dir: 'desc' }], limitH: 16 }
      ] })
  };
  if (params.get('act') === 'empty' || ${!!opts.empty}) { Object.keys(store).forEach(function (k) { delete store[k]; }); }
  function T(id, title, o) {
    return Object.assign({ id: id, title: title, isDone: false, projectId: null, tagIds: [], timeEstimate: 0,
      timeSpent: 0, subTaskIds: [], created: 1700000000000 + id.charCodeAt(1) * 1000 }, o || {});
  }
  var tasks = [
    T('t1', 'Практическая №1 по дискретной математике: множества и диаграммы Эйлера', { projectId: 'uni', tagIds: ['kai'], timeEstimate: 4 * H, timeSpent: 1.5 * H, dueDay: '2026-11-10', timeSpentOnDay: { '2026-11-03': 1.5 * H } }),
    T('t2', 'Курсовая: глава 2', { projectId: 'uni', tagIds: ['kai'], timeEstimate: 5 * H, dueDay: '2026-11-13' }),
    T('t3', 'Код-ревью интеграции мессенджеров', { projectId: 'work', timeEstimate: 3 * H, timeSpent: 3 * H, isDone: true }),
    T('t4', 'Подготовить релиз 2.4', { projectId: 'work', timeEstimate: 6 * H, dueWithTime: new Date(2026, 10, 12, 18, 0).getTime() }),
    T('t5', 'Оповестить ФНС об открытии зарубежного счёта', { dueDay: '2026-11-05' }),
    T('t6', 'Спортзал', { tagIds: ['health', 'TODAY'], timeEstimate: 1.5 * H }),
    T('t7', 'Отчёт по практике', { projectId: 'uni', tagIds: ['kai'], timeEstimate: 2 * H, dueDay: '2026-11-02' }),
    T('t8', 'Созвон с заказчиком', { projectId: 'work', timeEstimate: 1 * H }),
    T('p1', 'Лабораторная №3 по физике', { projectId: 'uni', tagIds: ['kai'], timeEstimate: 3 * H, dueDay: '2026-11-11' }),
    T('p2', 'Миграция БД на PostgreSQL 17', { projectId: 'work', timeEstimate: 8 * H, subTaskIds: ['s1', 's2'] }),
    T('s1', 'Бэкап перед миграцией', { projectId: 'work', parentId: 'p2', timeEstimate: 1 * H }),
    T('s2', 'Прогнать тесты', { projectId: 'work', parentId: 'p2', timeEstimate: 2 * H }),
    T('p3', 'Купить подарок маме', { dueDay: '2026-11-20' }),
    T('p4', 'Прочитать «Designing Data-Intensive Applications», гл. 5', { tagIds: ['read'], timeEstimate: 2 * H }),
    T('p5', 'Записаться к стоматологу', {}),
    T('p6', 'Эссе по философии', { projectId: 'uni', tagIds: ['kai'], timeEstimate: 2.5 * H, dueDay: '2026-11-18', deadlineDay: '2026-11-17' }),
    T('p7', 'Настроить мониторинг Grafana', { projectId: 'work', timeEstimate: 4 * H, issueId: '123', issueType: 'GITLAB' })
  ];
  window.__store = store;
  window.__snacks = [];
  window.PluginAPI = {
    cfg: { theme: theme, lang: { code: params.get('lang') || 'ru' } },
    Hooks: { DATA_CHANGED: 'dataChanged', PERSISTED_DATA_CHANGED: 'persistedDataChanged', DAY_CHANGE: 'dayChange' },
    getCurrentLanguage: function () { return params.get('lang') || 'ru'; },
    getDayContext: async function () { return { todayStr: '2026-11-08', startOfNextDayDiffMs: 0 }; },
    listSyncedDataKeys: async function (p) { return Object.keys(store).filter(function (k) { return k.indexOf(p) === 0 && store[k]; }).sort(); },
    loadSyncedData: async function (k) { return store[k] || null; },
    persistDataSynced: async function (v, k) { store[k] = v; },
    getTasks: async function () { return tasks; },
    getArchivedTasks: async function () { return []; },
    getAllProjects: async function () { return [{ id: 'uni', title: 'Учёба' }, { id: 'work', title: 'Работа' }]; },
    getAllTags: async function () { return [{ id: 'TODAY', title: 'Today' }, { id: 'kai', title: 'КАИ' }, { id: 'health', title: 'Здоровье' }, { id: 'read', title: 'Чтение' }]; },
    addTask: async function (d) { var id = 'n' + tasks.length; tasks.push(T(id, d.title)); return id; },
    updateTask: async function (id, u) { tasks.forEach(function (x) { if (x.id === id) Object.assign(x, u); }); },
    selectTask: async function () {},
    registerHook: function () {}, showSnack: function (s) { window.__snacks.push(s); }, log: { err: console.error }
  };
  window.addEventListener('load', function () {
    var act = params.get('act');
    setTimeout(function () {
      if (act === 'editor') document.querySelector('#listCards .card-head button[title]').click();
      if (act === 'pooleditor') document.getElementById('poolCfgBtn').click();
      if (act === 'select') {
        var rows = document.querySelectorAll('#poolList li');
        rows[0].click(); rows[1].click();
      }
      if (act === 'toast') document.querySelector('#poolList li .actions button').click();
    }, 300);
  });
})();`;
};
