/* Week Planner: attach tasks to ISO weeks. Plain script, not a module. */
(function () {
  'use strict';

  var KEY_PREFIX = 't_';
  var NAV_SECRET = 'nav';
  var CUR_SECRET = 'cur';
  var UNSORTED = 'unsorted';
  var WEEK_RE = /^\d{4}-W\d{2}$/;

  var TEXT = {
    en: {
      thisWeek: 'Plan for this week',
      nextWeek: 'Plan for next week',
      weekAfter: 'Plan for the week after next',
      unpin: 'Remove from week',
      planner: 'Week planner',
      kanban: 'Week kanban',
      pinned: 'Task planned for {week}',
      unpinned: 'Task removed from its week',
      notPinned: 'Task is not planned for any week',
      overdue: '{n} unfinished task(s) from past weeks',
      weekStarted: 'Week {n} started: {count} task(s) planned',
      open: 'Open',
      error: 'Week planner: {msg}',
      week: 'week {n} ({range})'
    },
    ru: {
      thisWeek: 'На эту неделю',
      nextWeek: 'На следующую неделю',
      weekAfter: 'Через неделю',
      unpin: 'Убрать из недели',
      planner: 'План недели',
      kanban: 'Канбан недели',
      pinned: 'Задача запланирована: {week}',
      unpinned: 'Задача убрана из недели',
      notPinned: 'Задача не привязана к неделе',
      overdue: 'Незакрытых задач с прошлых недель: {n}',
      weekStarted: 'Началась неделя {n}: задач в плане — {count}',
      open: 'Открыть',
      error: 'План недели: {msg}',
      week: 'неделя {n} ({range})'
    }
  };

  function lang() {
    var code = '';
    try {
      code = PluginAPI.getCurrentLanguage() || '';
    } catch (e) {
      code = '';
    }
    return String(code).toLowerCase();
  }

  function t(key, params) {
    var dict = lang().indexOf('ru') === 0 ? TEXT.ru : TEXT.en;
    var s = dict[key] || TEXT.en[key] || key;
    if (params) {
      Object.keys(params).forEach(function (k) {
        s = s.split('{' + k + '}').join(String(params[k]));
      });
    }
    return s;
  }

  // ---------- ISO week helpers ----------
  function pad(n) {
    return (n < 10 ? '0' : '') + n;
  }

  function parseYmd(s) {
    var p = String(s).split('-');
    return new Date(+p[0], +p[1] - 1, +p[2]);
  }

  function isoWeekKey(date) {
    var d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    var wd = (d.getDay() + 6) % 7;
    d.setDate(d.getDate() - wd + 3); // Thursday of this week
    var y = d.getFullYear();
    var jan4 = new Date(y, 0, 4);
    var w = 1 + Math.round(((d - jan4) / 864e5 - 3 + ((jan4.getDay() + 6) % 7)) / 7);
    return y + '-W' + pad(w);
  }

  function weekMonday(key) {
    var y = +key.slice(0, 4);
    var w = +key.slice(6);
    var d = new Date(y, 0, 4);
    d.setDate(4 - ((d.getDay() + 6) % 7) + (w - 1) * 7);
    return d;
  }

  function shiftWeek(key, n) {
    var m = weekMonday(key);
    m.setDate(m.getDate() + 7 * n);
    return isoWeekKey(m);
  }

  function fmtDay(d) {
    try {
      return d.toLocaleDateString(lang() || undefined, { day: 'numeric', month: 'short' });
    } catch (e) {
      return d.getDate() + '.' + pad(d.getMonth() + 1);
    }
  }

  function weekLabel(key) {
    var mon = weekMonday(key);
    var sun = new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + 6);
    return t('week', { n: +key.slice(6), range: fmtDay(mon) + ' – ' + fmtDay(sun) });
  }

  async function todayDate() {
    if (typeof PluginAPI.getDayContext === 'function') {
      try {
        var ctx = await PluginAPI.getDayContext();
        if (ctx && ctx.todayStr) return parseYmd(ctx.todayStr);
      } catch (e) {
        PluginAPI.log.warn('[week-planner] getDayContext failed', e);
      }
    }
    return new Date();
  }

  async function currentWeekKey() {
    return isoWeekKey(await todayDate());
  }

  // ---------- storage: one synced key per task ----------
  // Value: JSON {w: "2026-W45", c: categoryId, s: "todo" | "doing"}.
  // Versions 0.1–0.3 stored only the week string; it is still read.
  function parseEntry(v) {
    if (!v) return null;
    if (WEEK_RE.test(v)) return { w: v, c: UNSORTED, s: 'todo' };
    try {
      var o = JSON.parse(v);
      if (o && WEEK_RE.test(o.w)) return { w: o.w, c: o.c || UNSORTED, s: o.s === 'doing' ? 'doing' : 'todo' };
    } catch (e) {
      /* ignore broken entries */
    }
    return null;
  }

  async function getEntry(taskId) {
    return parseEntry(await PluginAPI.loadSyncedData(KEY_PREFIX + taskId));
  }

  async function setWeek(taskId, weekKey) {
    if (!weekKey) {
      // An empty string clears the entry; listSyncedDataKeys skips empty keys.
      await PluginAPI.persistDataSynced('', KEY_PREFIX + taskId);
      return;
    }
    var old = await getEntry(taskId);
    var entry = { w: weekKey, c: old ? old.c : UNSORTED, s: old ? old.s : 'todo' };
    await PluginAPI.persistDataSynced(JSON.stringify(entry), KEY_PREFIX + taskId);
  }

  async function loadAssignments() {
    var keys = await PluginAPI.listSyncedDataKeys(KEY_PREFIX);
    var vals = await Promise.all(
      keys.map(function (k) {
        return PluginAPI.loadSyncedData(k);
      })
    );
    var map = {};
    keys.forEach(function (k, i) {
      var e = parseEntry(vals[i]);
      if (e) map[k.slice(KEY_PREFIX.length)] = e.w;
    });
    return map;
  }

  function fail(e) {
    var msg = e && e.message ? e.message : String(e);
    PluginAPI.log.err('[week-planner]', e);
    PluginAPI.showSnack({ msg: t('error', { msg: msg }), type: 'ERROR' });
  }

  // The view reads the requested page from local (not synced) secret storage.
  async function openPage(page) {
    try {
      await PluginAPI.setSecret(NAV_SECRET, JSON.stringify({ page: page, ts: Date.now() }));
    } catch (e) {
      PluginAPI.log.warn('[week-planner] cannot store navigation request', e);
    }
    PluginAPI.showIndexHtmlAsView();
  }

  function openPlanner() {
    openPage('plan');
  }

  function openKanban() {
    openPage('kanban');
  }

  // ---------- UI entry points (plugin.js only) ----------
  function registerWeekEntry(id, label, icon, offset) {
    PluginAPI.registerTaskContextMenuEntry({
      id: id,
      label: label,
      icon: icon,
      onClick: async function (ctx) {
        try {
          var key = shiftWeek(await currentWeekKey(), offset);
          await setWeek(ctx.taskId, key);
          PluginAPI.showSnack({
            msg: t('pinned', { week: weekLabel(key) }),
            type: 'SUCCESS',
            ico: 'date_range',
            action: { label: t('open'), onClick: openPlanner }
          });
        } catch (e) {
          fail(e);
        }
      }
    });
  }

  registerWeekEntry('week-this', t('thisWeek'), 'today', 0);
  registerWeekEntry('week-next', t('nextWeek'), 'date_range', 1);
  registerWeekEntry('week-after', t('weekAfter'), 'event', 2);

  PluginAPI.registerTaskContextMenuEntry({
    id: 'week-remove',
    label: t('unpin'),
    icon: 'event_busy',
    onClick: async function (ctx) {
      try {
        if (!(await getEntry(ctx.taskId))) {
          PluginAPI.showSnack({ msg: t('notPinned'), type: 'INFO' });
          return;
        }
        await setWeek(ctx.taskId, null);
        PluginAPI.showSnack({ msg: t('unpinned'), type: 'SUCCESS' });
      } catch (e) {
        fail(e);
      }
    }
  });

  PluginAPI.registerHeaderButton({
    label: t('planner'),
    icon: 'date_range',
    onClick: openPlanner
  });

  PluginAPI.registerHeaderButton({
    label: t('kanban'),
    icon: 'view_kanban',
    onClick: openKanban
  });

  PluginAPI.registerShortcut({
    id: 'open-week-planner',
    label: t('planner'),
    onExec: openPlanner
  });

  PluginAPI.registerShortcut({
    id: 'open-week-kanban',
    label: t('kanban'),
    onExec: openKanban
  });

  // ---------- hooks ----------
  PluginAPI.registerHook(PluginAPI.Hooks.TASK_DELETE, async function (payload) {
    try {
      if (payload && payload.taskId && (await getEntry(payload.taskId))) {
        await setWeek(payload.taskId, null);
      }
    } catch (e) {
      PluginAPI.log.warn('[week-planner] cleanup failed', e);
    }
  });

  // The view highlights the task with time tracking. Super Productivity has no getter for it,
  // so keep the id from this hook in local (not synced) secret storage; the view polls it.
  PluginAPI.registerHook(PluginAPI.Hooks.CURRENT_TASK_CHANGE || 'currentTaskChange', async function (payload) {
    try {
      var cur = payload && payload.current;
      await PluginAPI.setSecret(CUR_SECRET, JSON.stringify({ id: cur ? cur.id : null, ts: Date.now() }));
    } catch (e) {
      PluginAPI.log.warn('[week-planner] cannot store the current task', e);
    }
  });

  var lastWeekKey = null;

  async function countWeek(weekKey) {
    var res = await Promise.all([loadAssignments(), PluginAPI.getTasks()]);
    var assign = res[0];
    var planned = 0;
    var overdue = 0;
    res[1].forEach(function (task) {
      var w = assign[task.id];
      if (!w || task.isDone) return;
      if (w === weekKey) planned++;
      else if (w < weekKey) overdue++;
    });
    return { planned: planned, overdue: overdue };
  }

  // DAY_CHANGE fires on every device: only notify here, never write data.
  PluginAPI.registerHook(PluginAPI.Hooks.DAY_CHANGE, async function (payload) {
    try {
      var key = isoWeekKey(parseYmd(payload.todayStr));
      if (lastWeekKey && key !== lastWeekKey) {
        var c = await countWeek(key);
        PluginAPI.showSnack({
          msg: t('weekStarted', { n: +key.slice(6), count: c.planned }),
          type: 'INFO',
          ico: 'date_range',
          action: { label: t('open'), onClick: openKanban }
        });
      }
      lastWeekKey = key;
    } catch (e) {
      PluginAPI.log.warn('[week-planner] day change failed', e);
    }
  });

  PluginAPI.onReady(async function () {
    try {
      lastWeekKey = await currentWeekKey();
      var c = await countWeek(lastWeekKey);
      if (c.overdue > 0) {
        PluginAPI.showSnack({
          msg: t('overdue', { n: c.overdue }),
          type: 'WARNING',
          ico: 'event_busy',
          action: { label: t('open'), onClick: openPlanner }
        });
      }
    } catch (e) {
      PluginAPI.log.warn('[week-planner] startup check failed', e);
    }
  });
})();
