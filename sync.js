/* sync.js — 云端数据同步层（零外部依赖）
   依赖：window.SB（supabase.js）+ window.state（app.js 里的全局数据）
   暴露 window.SYNC：schedule / syncNow / pullFromCloud / migrateToCloud / setEnabled / getStatus */
(function () {
  'use strict';
  let syncTimer = null;
  let syncStatus = 'idle';     // idle | syncing | error | offline
  let lastSync = 0;
  let lastError = null;
  let enabled = false;

  function isReady() { return !!(window.SB && window.SB.isLoggedIn()); }

  function notify() {
    document.dispatchEvent(new CustomEvent('sb-sync-status', { detail: { status: syncStatus, lastSync: lastSync, lastError: lastError } }));
  }

  function schedule(delay) {
    if (!enabled || !isReady()) return;
    clearTimeout(syncTimer);
    syncTimer = setTimeout(function () { syncNow(); }, delay || 1500);
  }

  function fmtDate(d) { try { return d ? new Date(d).toISOString() : null; } catch (e) { null; } }

  // v5.9：把「按单词本分片的进度 map」随快照一起打包上传
  function packProgress(base, map) {
    const hasMap = map && Object.keys(map).length > 0;
    if (!base && !hasMap) return null;
    return Object.assign({}, base || {}, { __map: map || {} });
  }

  // ====== 单本书同步（独立函数，便于并发） ======
  async function syncBook(book, userId) {
    let bid = book.id;
    try {
      await window.SB.upsert('vocab_books', {
        id: bid, user_id: userId, name: book.name,
        source: book.source || 'manual',
        created_at: fmtDate(book.createdAt) || fmtDate(Date.now())
      }, 'id');
    } catch (e) {
      if ((e.message || '').includes('row-level security policy')) {
        // 换一个全局唯一 id 重试，并记住映射
        const oldId = bid;
        bid = 'b_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
        await window.SB.upsert('vocab_books', {
          id: bid, user_id: userId, name: book.name,
          source: book.source || 'manual',
          created_at: fmtDate(book.createdAt) || fmtDate(Date.now())
        }, 'id');
        book._idChanged = { from: oldId, to: bid };
      } else {
        throw e;
      }
    }
    // v6.1：安全的单词同步 —— 先 upsert 写入/更新，再清理本地已删除的行
    // 旧实现是「先 remove 整本再 insert」，同步窗口内该书在云端是空的；一旦中断就永久丢失
    const rows = (book.words || []).map(function (w) {
      return {
        book_id: bid, word: w.word, type: w.type || null,
        meaning: w.meaning || null, example: w.example || null,
        mastered: !!w.mastered, srs: w.srs || null,
        added_at: fmtDate(w.addedAt) || fmtDate(Date.now())
      };
    });
    if (rows.length) {
      await window.SB.upsertOn('vocab_words', rows, 'book_id,word');
    }
    // 清理云端多出来、本地已删除的行（这一步失败最多留脏数据，不会丢词）
    try {
      const remote = await window.SB.selectAll('vocab_words', '?book_id=eq.' + encodeURIComponent(bid) + '&select=word');
      const localWords = new Set(rows.map(function (r) { return r.word; }));
      const stale = remote.map(function (r) { return r.word; }).filter(function (w) { return w && !localWords.has(w); });
      for (const w of stale) {
        await window.SB.remove('vocab_words', { book_id: bid, word: w });
      }
    } catch (e) {
      console.warn('SYNC: 清理多余单词失败（不影响已有数据）', e && e.message);
    }
  }

  // ====== 上传 state 到云端 ======
  async function syncNow() {
    if (!isReady()) return;
    if (!window.state) { console.warn('SYNC: window.state not ready'); return; }
    if (syncStatus === 'syncing') return;
    syncStatus = 'syncing';
    notify();
    const startTs = Date.now();
    try {
      const s = window.state;
      const userId = window.SB.getUser().id;

      // 1) books + words（多本书并发同步）
      const books = s.books || [];
      const totalBooks = books.length;
      let doneBooks = 0;
      const updateProgress = function () {
        document.dispatchEvent(new CustomEvent('sb-sync-progress', { detail: { done: doneBooks, total: totalBooks, phase: 'books' } }));
      };
      updateProgress();
      // 清除 _idChanged 标记
      for (const b of books) { delete b._idChanged; }
      // 关键优化：多本书并发同步（Promise.all），速度提升 N 倍
      const bookResults = await Promise.allSettled(books.map(function (book) {
        return syncBook(book, userId).then(function () {
          doneBooks++;
          updateProgress();
        });
      }));
      // v6.1：单本书失败不再中断整条同步 —— 记录警告，继续推 wrong_book / user_state
      const bookFails = bookResults.filter(function (r) { return r.status === 'rejected'; });
      let softError = '';
      if (bookFails.length) {
        softError = bookFails.length + ' 本书同步失败: ' + (bookFails[0].reason && bookFails[0].reason.message || 'unknown');
        console.warn('SYNC(partial): ' + softError);
      }
      // 应用 id 变更映射
      for (const book of books) {
        if (book._idChanged) { book.id = book._idChanged.to; delete book._idChanged; }
      }
      // 删除云端已不存在的 books（级联删 words）
      const remoteBooks = await window.SB.select('vocab_books', '?user_id=eq.' + userId + '&select=id');
      const localIds = new Set(books.map(function (b) { return b.id; }));
      const toDelete = (remoteBooks || []).filter(function (rb) { return !localIds.has(rb.id); });
      if (toDelete.length) {
        await Promise.all(toDelete.map(function (rb) { return window.SB.remove('vocab_books', { id: rb.id }); }));
      }

      // 2) wrong_book（v6.1：同样改为 upsert 优先，避免中断即清空）
      if (s.wrongBook && s.wrongBook.length) {
        const rows = s.wrongBook.map(function (w) {
          return {
            user_id: userId, word: w.word, type: w.type || null,
            meaning: w.meaning || null, sources: w.sources || [],
            srs: w.srs || null, correct_count: w.correctCount || 0,
            last_seen: fmtDate(w.lastSeen)
          };
        });
        await window.SB.upsertOn('wrong_book', rows, 'user_id,word');
      }
      try {
        const remoteWrong = await window.SB.selectAll('wrong_book', '?user_id=eq.' + userId + '&select=word');
        const localWords = new Set((s.wrongBook || []).map(function (w) { return w.word; }));
        for (const r of remoteWrong) {
          if (r.word && !localWords.has(r.word)) {
            await window.SB.remove('wrong_book', { user_id: userId, word: r.word });
          }
        }
      } catch (e) {
        console.warn('SYNC: 清理多余错词失败（不影响已有数据）', e && e.message);
      }

      // 3) user_dict（v6.1：同样 upsert 优先）
      const dictRows = Object.entries(s.userDict || {}).map(function (e) {
        return { user_id: userId, word: e[0], entry: e[1] };
      });
      if (dictRows.length) {
        await window.SB.upsertOn('user_dict', dictRows, 'user_id,word');
      }
      try {
        const remoteDict = await window.SB.selectAll('user_dict', '?user_id=eq.' + userId + '&select=word');
        const localWords = new Set(Object.keys(s.userDict || {}));
        for (const r of remoteDict) {
          if (r.word && !localWords.has(r.word)) {
            await window.SB.remove('user_dict', { user_id: userId, word: r.word });
          }
        }
      } catch (e) {
        console.warn('SYNC: 清理多余词典条目失败（不影响已有数据）', e && e.message);
      }

      // 4) user_state
      await window.SB.upsert('user_state', {
        user_id: userId,
        prefs: s.prefs || {},
        last_study: packProgress(s.lastStudy, s.lastStudyMap),
        last_spell: packProgress(s.lastSpell, s.lastSpellMap),
        last_listen: packProgress(s.lastListen, s.lastListenMap)
      }, 'user_id');

      const elapsed = Date.now() - startTs;
      console.log('SYNC ok in ' + elapsed + 'ms' + (softError ? '（含部分失败）' : ''));
      lastSync = Date.now();
      if (softError) {
        // 部分失败：算成功（数据已尽量写入），但把警告透给用户
        lastError = softError;
        syncStatus = 'partial';
      } else {
        lastError = null;
        syncStatus = 'idle';
      }
    } catch (e) {
      console.error('SYNC failed:', e);
      lastError = (e && e.message) || String(e);
      syncStatus = 'error';
    }
    notify();
  }

  // ====== 从云端拉取，返回新 state（不直接应用，让调用方决定如何合并） ======
  async function pullFromCloud() {
    if (!isReady()) return null;
    const userId = window.SB.getUser().id;
    const [books, wrong, dict, ustate] = await Promise.all([
      window.SB.select('vocab_books', '?user_id=eq.' + userId + '&select=id,name,source,created_at'),
      window.SB.select('wrong_book', '?user_id=eq.' + userId),
      window.SB.select('user_dict', '?user_id=eq.' + userId),
      window.SB.select('user_state', '?user_id=eq.' + userId)
    ]);

    const fullBooks = [];
    for (const b of (books || [])) {
      const words = await window.SB.select('vocab_words', '?book_id=eq.' + b.id);
      const ws = (words || []).map(function (w) {
        return {
          word: w.word, type: w.type, meaning: w.meaning, example: w.example,
          mastered: !!w.mastered, srs: w.srs,
          addedAt: w.added_at ? new Date(w.added_at).getTime() : Date.now()
        };
      });
      fullBooks.push({
        id: b.id, name: b.name, source: b.source,
        createdAt: b.created_at ? new Date(b.created_at).getTime() : Date.now(),
        words: ws,
        progress: { mastered: new Set(ws.filter(function (w) { return w.mastered; }).map(function (w) { return w.word; })) }
      });
    }

    return {
      books: fullBooks,
      wrongBook: (wrong || []).map(function (w) {
        return {
          word: w.word, type: w.type, meaning: w.meaning, sources: w.sources || [],
          srs: w.srs, correctCount: w.correct_count || 0,
          lastSeen: w.last_seen ? new Date(w.last_seen).getTime() : null
        };
      }),
      userDict: Object.fromEntries((dict || []).map(function (d) { return [d.word, d.entry]; })),
      prefs: (ustate && ustate[0] && ustate[0].prefs) || {},
      lastStudy: ustate && ustate[0] && ustate[0].last_study,
      lastSpell: ustate && ustate[0] && ustate[0].last_spell,
      lastListen: ustate && ustate[0] && ustate[0].last_listen
    };
  }

  // ====== 一键迁移：把 localStorage 数据上传到云端 ======
  async function migrateToCloud() {
    if (!isReady()) throw new Error('未登录');
    if (!window.state) throw new Error('数据未加载');
    await syncNow();
    if (syncStatus === 'error') throw new Error(lastError || '同步失败');
    return { ok: true, lastSync: lastSync };
  }

  function setEnabled(v) {
    enabled = !!v;
    if (enabled && isReady()) schedule(200);
  }

  function getStatus() { return { status: syncStatus, lastSync: lastSync, lastError: lastError, enabled: enabled }; }

  window.SYNC = {
    schedule: schedule, syncNow: syncNow, pullFromCloud: pullFromCloud,
    migrateToCloud: migrateToCloud, setEnabled: setEnabled, getStatus: getStatus
  };
})();
