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

  function fmtDate(d) { try { return d ? new Date(d).toISOString() : null; } catch (e) { return null; } }

  // ====== 上传 state 到云端 ======
  async function syncNow() {
    if (!isReady()) return;
    if (!window.state) { console.warn('SYNC: window.state not ready'); return; }
    if (syncStatus === 'syncing') return;
    syncStatus = 'syncing';
    notify();
    try {
      const s = window.state;
      const userId = window.SB.getUser().id;

      // 1) books
      // 若本地 book.id 在云端已被其他用户占用，生成新 id 避免 RLS 冲突
      const bookIdMap = {};
      for (const book of (s.books || [])) {
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
            bookIdMap[oldId] = bid;
          } else {
            throw e;
          }
        }
        // 更新本地 book id（如果变了）
        if (bookIdMap[book.id]) {
          book.id = bookIdMap[book.id];
        }
        // 重建该书的 words（删除后插入，简化逻辑）
        await window.SB.remove('vocab_words', { book_id: bid });
        // 同步更新 words 里的 book_id（一般 words 里没有 book_id，但以防万一）
        if (book.words) {
          for (const w of book.words) { w.book_id = bid; }
        }
        if (book.words && book.words.length) {
          const rows = book.words.map(function (w) {
            return {
              book_id: book.id, word: w.word, type: w.type || null,
              meaning: w.meaning || null, example: w.example || null,
              mastered: !!w.mastered, srs: w.srs || null,
              added_at: fmtDate(w.addedAt) || fmtDate(Date.now())
            };
          });
          await window.SB.insert('vocab_words', rows);
        }
      }
      // 删除云端已不存在的 books（级联删 words）
      const remoteBooks = await window.SB.select('vocab_books', '?user_id=eq.' + userId + '&select=id');
      const localIds = new Set((s.books || []).map(function (b) { return b.id; }));
      for (const rb of (remoteBooks || [])) {
        if (!localIds.has(rb.id)) await window.SB.remove('vocab_books', { id: rb.id });
      }

      // 2) wrong_book
      // 先把 sources 里旧的 bookId 替换成新生成的 id
      if (Object.keys(bookIdMap).length) {
        for (const w of (s.wrongBook || [])) {
          if (!w.sources) continue;
          for (const src of w.sources) {
            if (src.bookId && bookIdMap[src.bookId]) src.bookId = bookIdMap[src.bookId];
            if (src.sourceBookId && bookIdMap[src.sourceBookId]) src.sourceBookId = bookIdMap[src.sourceBookId];
          }
        }
      }
      await window.SB.remove('wrong_book', { user_id: userId });
      if (s.wrongBook && s.wrongBook.length) {
        const rows = s.wrongBook.map(function (w) {
          return {
            user_id: userId, word: w.word, type: w.type || null,
            meaning: w.meaning || null, sources: w.sources || [],
            srs: w.srs || null, correct_count: w.correctCount || 0,
            last_seen: fmtDate(w.lastSeen)
          };
        });
        await window.SB.insert('wrong_book', rows);
      }

      // 3) user_dict
      await window.SB.remove('user_dict', { user_id: userId });
      const dictRows = Object.entries(s.userDict || {}).map(function (e) {
        return { user_id: userId, word: e[0], entry: e[1] };
      });
      if (dictRows.length) await window.SB.insert('user_dict', dictRows);

      // 4) user_state
      await window.SB.upsert('user_state', {
        user_id: userId,
        prefs: s.prefs || {},
        last_study: s.lastStudy || null,
        last_spell: s.lastSpell || null,
        last_listen: s.lastListen || null
      }, 'user_id');

      lastSync = Date.now();
      lastError = null;
      syncStatus = 'idle';
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
