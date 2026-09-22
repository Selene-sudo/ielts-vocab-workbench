/* =====================================================
   app.js  -  VocabMaster 主应用
   ===================================================== */

(function () {
  'use strict';

  /* ---------- 0. 状态与持久化 ---------- */
  const STORAGE_KEY = 'vocabmaster.v1';

  const state = {
    books: [],          // [{ id, name, createdAt, words: [{ word, meaning, example, type, mastered, srs }], progress: { mastered: Set } }]
    wrongBook: [],      // [{ word, type, entry, correctCount, sources: [bookId], lastSeen, srs }]
    userDict: {},       // { 'abandon': { pos, cn, phonetic, example, type }, 'abandon ship': {...} }
    activeBookId: null,
    activeWrongSession: false,
    studyIndex: 0,
    studyQueue: [],     // 当前背诵队列（v6：可能含重复项 —— 未通过的词会重新排入队尾）
    studyRevealed: false,
    studyStreak: {},    // v6：{ word: 连续「认识」次数 }，达到 STUDY_PASS_STREAK 才通过
    audioMuted: false,  // v6：全局朗读总开关（顶部 🔊 按钮）
    dictFilter: 'all',  // all | word | phrase
    editScope: 'dict',
    // 拼写平台状态
    spellScope: 'due',  // due | book:<id> | wrong | all
    spellQueue: [],
    spellIndex: 0,
    spellAnswered: false,
    spellSource: '',    // 用于显示当前拼写模式
    // —— v5：进度恢复 ——
    lastStudy: null,    // { activeBookId, activeWrongSession, studyIndex, studyQueue, studyRevealed }
    lastSpell: null,    // { scope, queue, index, answered }
    // —— v5.9：按单词本 / 范围分片保存的进度（key = bookId | 'wrong' | scope）——
    lastStudyMap: {},   // { [bookId|'wrong']: { index, revealed, queue: [{word}] } }
    lastSpellMap: {},   // { [scope]: { index, answered, queue: [{word,key,sourceBookId,lastOk,userInput}] } }
    lastListenMap: {},  // { [scope]: { index, answered, queue: [{word,key,sourceBookId}] } }
    wrongSessionScope: 'all', // 错词复习会话限定的范围：all | book:<id> | orphans
    wrongCardMode: 'recall',  // 错词复习卡片模式：recall（认不认识）| spell（拼写）
    wrongSpellAnswered: false,
    wrongSpellOk: false,
    wrongSpellInput: '',
    _wrongQueueScope: null,   // 当前错词队列对应的范围（内存态，不持久化）
    // —— 听音辨义（独立模块） ——
    listenScope: 'book',  // book:<id> | wrong | all
    listenQueue: [],      // [{ word, key, sourceBookId, srs, type, meaning, entry }]
    listenIndex: 0,
    listenAnswered: false,
    listenLastDecision: null,  // 'know' | 'unknow' | null  上一次的选择
    listenSource: '',    // 用于显示来源
    // —— v5：自动朗读开关 ——
    autoSpeak: true,
    // —— v5：错词 / 复习 tab 的过滤 ——
    wrongFilter: 'all', // all | book:<id> | orphans（没有 sources 的）
    reviewFilter: 'all' // all | book:<id>
  };

  /* ---------- 0.5 艾宾浩斯复习曲线 (SRS) ---------- */
  // 经典间隔：1 → 2 → 4 → 7 → 15 → 30（天），之后保持 30
  const SRS_INTERVALS = [1, 2, 4, 7, 15, 30];
  const DAY_MS = 24 * 60 * 60 * 1000;

  /* ---------- 0.6 v6：背诵词卡通过规则 ---------- */
  // 每个词需要「连续认识」STUDY_PASS_STREAK 次才算通过；
  // 期间任何一次「不认识」都会把计数清零、立即进错词本，并把词卡重新排回队尾
  // —— 也就是点一次不认识后，这张卡至少还要再出现两次、连续答对两次才能过。
  const STUDY_PASS_STREAK = 2;

  /** 创建一个新的 SRS 记录（初次学习） */
  function newSrsRecord() {
    return {
      repetitions: 0,     // 累计正确复习次数
      interval: 0,         // 当前间隔（天）
      nextReview: Date.now() + 1 * DAY_MS, // 明天首次复习
      lastReviewed: 0,
      graduated: false,    // 是否毕业（单词本里"已掌握"）
      history: []          // [{ at, ok, mode }]
    };
  }

  /** 计算下次复习时间 = 今天 + 选定间隔 */
  function nextReviewAfter(srs, correct) {
    if (!correct) {
      // 拼错 / 标记不认识 → 重置回第 1 阶梯，明天再背
      srs.repetitions = 0;
      srs.interval = 1;
      srs.nextReview = Date.now() + SRS_INTERVALS[0] * DAY_MS;
      return;
    }
    srs.repetitions = (srs.repetitions || 0) + 1;
    const idx = Math.min(srs.repetitions - 1, SRS_INTERVALS.length - 1);
    srs.interval = SRS_INTERVALS[idx];
    srs.nextReview = Date.now() + srs.interval * DAY_MS;
  }

  /** 给一条词条添加 SRS 字段（如还未创建） */
  function ensureSrs(item) {
    if (!item.srs) item.srs = newSrsRecord();
    return item.srs;
  }

  /** 把 srs 复制到错词本条目 */
  function cloneSrs(srs) {
    return srs ? JSON.parse(JSON.stringify(srs)) : newSrsRecord();
  }

  /* ---------- 0.2 分片进度（v5.9）：把 progress map 与"最近一次"快照打包/拆包 ---------- */
  /** 打包：{ ...base, __map: map }；两者都空则返回 null */
  function attachMap(base, map) {
    const hasMap = map && Object.keys(map).length > 0;
    if (!base && !hasMap) return null;
    return { ...(base || {}), __map: map || {} };
  }
  /** 拆包：取出分片 map */
  function readMap(raw) {
    if (!raw || typeof raw !== 'object') return {};
    return raw.__map || {};
  }
  /** 拆包：取出不含 __map 的"最近一次"快照 */
  function stripMap(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const { __map, ...rest } = raw;
    return Object.keys(rest).length ? rest : null;
  }

  function persist() {
    const slim = {
      books: state.books.map(b => ({
        id: b.id,
        name: b.name,
        createdAt: b.createdAt,
        words: b.words,
        progress: { mastered: Array.from(b.progress.mastered) }
      })),
      wrongBook: state.wrongBook,
      userDict: state.userDict,
      // v5：保存进度（v5.9：随快照一起带上按单词本分片的 map）
      lastStudy: attachMap(state.lastStudy, state.lastStudyMap),
      lastSpell: attachMap(state.lastSpell, state.lastSpellMap),
      lastListen: attachMap(state.lastListen, state.lastListenMap),
      // v5：保存用户偏好（v5.9：并记住上次所在的范围，刷新后可直接续上进度）
      prefs: {
        autoSpeak: state.autoSpeak,
        audioMuted: !!state.audioMuted,
        wrongFilter: state.wrongFilter,
        reviewFilter: state.reviewFilter,
        activeBookId: state.activeBookId,
        spellScope: state.spellScope,
        listenScope: state.listenScope,
        wrongSessionScope: state.wrongSessionScope,
        wrongCardMode: state.wrongCardMode
      }
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(slim));
    // v5.8：登录后自动同步到云端（SYNC.schedule 内部 1.5s 防抖）
    if (window.SYNC) window.SYNC.schedule(2000);
  }

  function hydrate() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      state.books = (data.books || []).map(b => ({
        ...b,
        progress: { mastered: new Set(b.progress?.mastered || []) }
      }));
      state.wrongBook = data.wrongBook || [];
      state.userDict = data.userDict || {};
      // 兼容旧数据：补 type 与 srs；清洗 DICT 占位释义
      for (const b of state.books) {
        for (const w of b.words) {
          if (!w.type) w.type = window.VocabData.detectType(w.word);
          ensureSrs(w);
          if (isPlaceholderMeaning(w.meaning)) w.meaning = '';
        }
      }
      for (const w of state.wrongBook) {
        if (!w.type) w.type = window.VocabData.detectType(w.word);
        if (!w.srs) w.srs = newSrsRecord();
        if (typeof w.correctCount !== 'number') w.correctCount = 0;
        if (isPlaceholderMeaning(w.meaning)) w.meaning = '';
      }
      // v6.1：补回历史错词缺失的中文释义（只填空，不覆盖）
      try { healWrongMeanings(); } catch (e) { console.warn('healWrongMeanings on hydrate failed', e); }
      // 同步注入给 data.js 的 lookup
      window.VocabData.setUserDict(state.userDict);

      // v5：恢复用户偏好（v5.9：含上次所在范围）
      if (data.prefs) {
        state.autoSpeak = data.prefs.autoSpeak !== false;
        state.audioMuted = !!data.prefs.audioMuted;
        state.wrongFilter = data.prefs.wrongFilter || 'all';
        state.reviewFilter = data.prefs.reviewFilter || 'all';
        if (data.prefs.activeBookId) state.activeBookId = data.prefs.activeBookId;
        if (data.prefs.spellScope) state.spellScope = data.prefs.spellScope;
        if (data.prefs.listenScope) state.listenScope = data.prefs.listenScope;
        if (data.prefs.wrongSessionScope) state.wrongSessionScope = data.prefs.wrongSessionScope;
        if (data.prefs.wrongCardMode) state.wrongCardMode = data.prefs.wrongCardMode;
      }
      // v5：恢复进度（先放在 lastStudy / lastSpell，下次切到对应 tab 时 apply）
      // v5.9：同时恢复"按单词本 / 范围分片"的进度 map
      state.lastStudy = stripMap(data.lastStudy);
      state.lastSpell = stripMap(data.lastSpell);
      state.lastListen = stripMap(data.lastListen);
      state.lastStudyMap = readMap(data.lastStudy);
      state.lastSpellMap = readMap(data.lastSpell);
      state.lastListenMap = readMap(data.lastListen);
    } catch (e) {
      console.warn('恢复本地数据失败', e);
    }
  }

  /* ---------- 1. 工具 ---------- */
  function uid() { return 'b_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4); }
  function $(sel) { return document.querySelector(sel); }
  function $all(sel) { return document.querySelectorAll(sel); }
  function escapeHtml(str) {
    const map = {
      ampersand: /&/g,
      lt: /</g,
      gt: />/g,
      quot: /"/g,
      apos: /'/g
    };
    return String(str || '')
      .replace(map.ampersand, '&')
      .replace(map.lt, '<')
      .replace(map.gt, '>')
      .replace(map.quot, '"')
      .replace(map.apos, '\'');
  }
  // 是否是 DICT 的占位释义（视为"未导入"）
  function isPlaceholderMeaning(s) {
    const t = String(s || '').trim();
    if (!t) return true;
    return /释义待补|待补全|可点击编辑|n\.\/v\.\s*$/i.test(t);
  }
  function toast(msg, type, duration) {
    const el = $('#toast');
    el.textContent = msg;
    el.classList.remove('hidden', 'toast-error', 'toast-success');
    if (type === 'error') el.classList.add('toast-error');
    else if (type === 'success') el.classList.add('toast-success');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => el.classList.add('hidden'), duration || 1800);
  }

  /* ---------- 1.5 语音合成（Web Speech API） ---------- */
  // 英式英语优先，找不到再退回其他英语口音
  const Speech = {
    voices: [],
    ready: false,
    preferredVoice: null,
    supported: true,
    muted: false,          // v6：全局静音（由顶部 🔊 按钮控制）
    _loadPromise: null,
    _loading: false,
    _lastSpokenText: '',
    _lastSpeakAt: 0,
    _speaking: false,
    _cardKey: null,        // v6：当前词卡对应的文本，用于"换词即停/出现即播"
    _watchdog: null,       // v6：Chrome 长句会被"卡住"，定时 resume
    _unlocked: false,      // v6：iOS/Safari 需要一次用户手势解锁
    _retryTimers: [],
    init() {
      if (!('speechSynthesis' in window)) {
        this.supported = false;
        return;
      }
      this.supported = true;

      const loadVoices = () => {
        this.voices = speechSynthesis.getVoices();
        if (!this.voices.length) return false;
        this.ready = true;
        // 优先级：英式英语 - Google UK English > Microsoft Ryan/Susan > Daniel > en-GB 任意
        const priority = [
          /Google.*UK.*English/i,
          /Google.*British/i,
          /Microsoft.*(Ryan|Susan|George|Hazel)/i,
          /Daniel\b/i,
          /Karen\b/i,
          /Martha\b/i,
          /en[-_]GB/i
        ];
        for (const re of priority) {
          const v = this.voices.find(x => re.test(x.name) || re.test(x.lang + ' ' + x.name));
          if (v) { this.preferredVoice = v; break; }
        }
        // 兜底：再选个英文 voice，避免不能读
        if (!this.preferredVoice) {
          this.preferredVoice = this.voices.find(x => /^en/i.test(x.lang)) || this.voices[0];
        }
        return true;
      };

      // 立即尝试加载一次；并监听异步事件；并兜底轮询
      loadVoices();
      if ('onvoiceschanged' in speechSynthesis) {
        speechSynthesis.onvoiceschanged = loadVoices;
      }
      // 部分浏览器（如旧版 Edge）onvoiceschanged 不可靠，兜底轮询
      let tries = 0;
      const poll = setInterval(() => {
        if (this.ready || tries++ > 30) { clearInterval(poll); return; }
        loadVoices();
      }, 250);

      // v6：一次用户手势解锁 —— iOS/Safari 首次必须由手势触发，否则后续 speak 静默失败
      const unlock = () => {
        if (this._unlocked) return;
        this._unlocked = true;
        try {
          const u = new SpeechSynthesisUtterance(' ');
          u.volume = 0;
          u.lang = 'en-GB';
          speechSynthesis.speak(u);
        } catch (e) {}
        document.removeEventListener('pointerdown', unlock, true);
        document.removeEventListener('touchstart', unlock, true);
        document.removeEventListener('keydown', unlock, true);
      };
      document.addEventListener('pointerdown', unlock, true);
      document.addEventListener('touchstart', unlock, true);
      document.addEventListener('keydown', unlock, true);

      // v6：页面回到前台 / 从暂停态恢复 —— 修复"放着放着就没声了"
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && !this.muted) {
          try { speechSynthesis.resume(); } catch (e) {}
        }
      });
    },
    /** 等待 voice 加载完成（最多等待 ~3s），返回是否 ready */
    whenReady(timeoutMs = 3000) {
      if (this.ready) return Promise.resolve(true);
      if (this._loadPromise) return this._loadPromise;
      this._loadPromise = new Promise(resolve => {
        const start = Date.now();
        const tick = () => {
          if (this.ready) return resolve(true);
          if (Date.now() - start > timeoutMs) return resolve(false);
          setTimeout(tick, 100);
        };
        tick();
      });
      return this._loadPromise;
    },
    /** v6：停掉当前朗读（词卡消失 / 静音 / 切页时调用） */
    stop() {
      try { if ('speechSynthesis' in window) speechSynthesis.cancel(); } catch (e) {}
      this._speaking = false;
      this._clearTimers();
      this._stopWatchdog();
    },
    setMuted(flag) {
      this.muted = !!flag;
      if (this.muted) this.stop();
    },
    _clearTimers() {
      (this._retryTimers || []).forEach(t => clearTimeout(t));
      this._retryTimers = [];
    },
    /** Chrome 会把长句/连续 speak 卡在 paused 状态，定时 resume 兜底 */
    _startWatchdog() {
      this._stopWatchdog();
      this._watchdog = setInterval(() => {
        if (this.muted) { this._stopWatchdog(); return; }
        try {
          if (speechSynthesis.speaking && speechSynthesis.paused) speechSynthesis.resume();
        } catch (e) {}
      }, 4000);
    },
    _stopWatchdog() {
      if (this._watchdog) { clearInterval(this._watchdog); this._watchdog = null; }
    },
    speak(text) {
      const t = String(text || '').trim();
      if (!t) return;
      if (this.muted) return;
      if (!this.supported) {
        toast('当前浏览器不支持语音合成，建议使用 Chrome / Edge / Safari');
        return;
      }

      // 避免极短间隔内重复触发同一文本（保护 user activation）
      const now = Date.now();
      if (t === this._lastSpokenText && now - this._lastSpeakAt < 350) return;
      this._lastSpokenText = t;
      this._lastSpeakAt = now;

      const buildUtterance = () => {
        const u = new SpeechSynthesisUtterance(t);
        u.lang = 'en-GB';
        u.rate = 0.92;
        u.pitch = 1;
        u.volume = 1;
        // 即便 voice.lang 不是 en-GB，也保留 lang 字段，让浏览器走英国口音模型
        if (this.preferredVoice) u.voice = this.preferredVoice;
        return u;
      };

      const trySpeak = (attempt) => {
        if (this.muted) return;
        try {
          // v6：先 resume —— Chrome 在暂停态下 speak 会被直接丢弃（"经常不出音"的主因之一）
          try { speechSynthesis.resume(); } catch (e) {}
          // 仅在 idle 时 cancel，避免打断当前播放
          if (!speechSynthesis.speaking && !speechSynthesis.pending) {
            speechSynthesis.cancel();
          }
          const u = buildUtterance();
          let started = false;
          u.onstart = () => { started = true; this._speaking = true; this._startWatchdog(); };
          u.onend = () => { this._speaking = false; this._stopWatchdog(); };
          u.onerror = (ev) => {
            this._speaking = false;
            this._stopWatchdog();
            // 'canceled' / 'interrupted' 不算错误
            if (ev && (ev.error === 'canceled' || ev.error === 'interrupted')) return;
            console.warn('[speech] error', ev);
            // v6：真错误（如 synthesis-failed / audio-busy）→ 换一条 utterance 再试
            if ((attempt || 0) < 2) {
              const t2 = setTimeout(() => trySpeak((attempt || 0) + 1), 180);
              this._retryTimers.push(t2);
            }
          };
          speechSynthesis.speak(u);
          // 兜底：500ms 后还没开始播，说明这次 speak 被浏览器吞了（user activation 失效 / 静音 / 后台等），再 speak 一次
          const retryT = setTimeout(() => {
            if (this.muted) return;
            if (!started && !speechSynthesis.speaking && (attempt || 0) < 2) {
              console.warn('[speech] 未开始播放，重试第', (attempt || 0) + 1, '次');
              trySpeak((attempt || 0) + 1);
            }
          }, 500);
          this._retryTimers.push(retryT);
        } catch (e) {
          console.warn('[speech] 发音异常', e);
        }
      };

      // 如果 voice 还没好，先等 ready 再播；超时则仍尝试一次（浏览器会用 lang 自动选）
      if (!this.ready) {
        this.whenReady(2500).then(ok => {
          if (this.muted) return;
          trySpeak(0);
          if (!ok) console.warn('[speech] voices 未加载，仍尝试用 lang=en-GB 播放');
        });
      } else {
        trySpeak(0);
      }
    },
    /** 渲染一个 🔊 按钮；点击触发 speak。clicks 委托给顶层（避免被外部捕获） */
    button(text, opts) {
      const o = opts || {};
      return `<button class="btn-speak${o.small ? ' small' : ''}" data-speak="${escapeHtml(text)}" title="朗读 ${escapeHtml(text)}" type="button">🔊</button>`;
    }
  };
  Speech.init();

  /**
   * v6：把音频和「词卡生命周期」绑在一起
   *  - 卡片换词（上一张消失 / 这一张出现）→ 停掉上一张的音频
   *  - 新卡片出现 → 自动朗读（autoSpeak 开启且未静音时）
   *  - silent = true 时不自动发声，但仍然负责"换词即停"
   */
  function syncCardAudio(word, opts) {
    const o = opts || {};
    const key = String(word || '').trim();
    if (Speech._cardKey !== key) {
      Speech.stop();
      Speech._cardKey = key || null;
    }
    if (!key || o.silent) return;
    if (!state.autoSpeak || state.audioMuted) return;
    try { Speech.speak(key); } catch (e) {}
  }

  /** v6：卡片区域没词了（空态 / 本轮完成）→ 立刻停声 */
  function endCardAudio() {
    Speech.stop();
    Speech._cardKey = null;
  }

  /** v6：用户主动点 🔊 播放（静音时给个提示，避免"点了没反应"的错觉） */
  function manualSpeak(text) {
    if (state.audioMuted) {
      toast('🔇 朗读已关闭 · 点顶部 🔊 可重新开启');
      return;
    }
    try { Speech.speak(text); } catch (e) {}
  }

  /* ---------- 2. Tab 切换 ---------- */
  function bindTabs() {
    $all('.tab').forEach(tab => {
      tab.addEventListener('click', () => {
        // v6：离开当前页面 → 立刻停掉正在朗读的音频（音频跟随单词消失而消失）
        endCardAudio();
        $all('.tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const target = tab.dataset.tab;
        $all('.panel').forEach(p => p.classList.remove('active'));
        $('#panel-' + target).classList.add('active');
        if (target === 'study') renderStudy();
        if (target === 'notebooks') renderBooks();
        if (target === 'wrong') renderWrong();
        if (target === 'dict') renderDict();
        if (target === 'article') renderArticleSelect();
        if (target === 'stats') renderStats();
        if (target === 'spell') renderSpellInit();
        if (target === 'review') renderReview();
        if (target === 'listen') renderListenInit();
      });
    });
  }

  /* ---------- 3. 导入与生成单词本 ---------- */
  function bindHome() {
    $('#loadSample').addEventListener('click', () => {
      $('#wordsInput').value = window.VocabData.SAMPLE_WORDS.slice(0, 60).join('\n');
      $('#bookName').value = $('#bookName').value || '示例词库：雅思高频 60 词';
      updateParseHint();
    });
    $('#clearInput').addEventListener('click', () => {
      $('#wordsInput').value = '';
      $('#bookName').value = '';
      updateParseHint();
    });
    $('#wordsInput').addEventListener('input', updateParseHint);
    $('#createBook').addEventListener('click', createBook);
  }

  function updateParseHint() {
    const text = $('#wordsInput').value;
    const words = window.VocabData.parseWords(text);
    const w = words.filter(x => x.type === 'word').length;
    const p = words.filter(x => x.type === 'phrase').length;
    const s = words.filter(x => x.type === 'sentence').length;
    if (words.length === 0) {
      $('#parseHint').textContent = '请输入词汇';
    } else {
      $('#parseHint').innerHTML = `已识别 <b>${words.length}</b> 个条目（单词 ${w} · 短语 ${p} · 句子 ${s}），<b>都不会跳过</b>`;
    }
  }

  function createBook() {
    const name = $('#bookName').value.trim();
    const text = $('#wordsInput').value;
    if (!name) { toast('请先给单词本命名'); return; }
    const words = window.VocabData.parseWords(text);
    if (!words.length) {
      toast('未识别到有效词条，每行格式：英文 # 中文');
      return;
    }

    // 合并释义：先查用户字典，再查内置词典
    const enriched = words.map(w => {
      const entry = window.VocabData.lookup(w.word);
      const srs = newSrsRecord();
      srs.nextReview = Date.now() + SRS_INTERVALS[0] * DAY_MS;
      // 释义拼接：用户导入时填的 > DICT 真实释义；若 DICT 也是占位符则视为空
      let meaning = (w.meaning || '').trim();
      if (!meaning) {
        const fromDict = `${entry.pos ? entry.pos + ' ' : ''}${entry.cn || ''}`.trim();
        meaning = isPlaceholderMeaning(fromDict) ? '' : fromDict;
      }
      return {
        word: w.word,
        type: w.type || entry.type || window.VocabData.detectType(w.word),
        meaning,
        example: w.example || entry.example,
        mastered: false,
        srs,
        addedAt: Date.now()
      };
    });

    const book = {
      id: uid(),
      name,
      createdAt: Date.now(),
      words: enriched,
      progress: { mastered: new Set() }
    };
    state.books.unshift(book);
    state.activeBookId = book.id;
    persist();
    const cw = enriched.filter(x => x.type === 'word').length;
    const cp = enriched.filter(x => x.type === 'phrase').length;
    const cs = enriched.filter(x => x.type === 'sentence').length;
    toast(`已创建《${name}》共 ${enriched.length} 条（单词 ${cw} · 短语 ${cp} · 句子 ${cs}）`);

    // 切到背诵
    $all('.tab').forEach(t => t.classList.remove('active'));
    $('.tab[data-tab="study"]').classList.add('active');
    $all('.panel').forEach(p => p.classList.remove('active'));
    $('#panel-study').classList.add('active');
    renderStudy();
  }

  /* ---------- 4. 背诵 ---------- */
  function buildStudyQueue(book) {
    // 队列：未掌握 + 已掌握但未确认（默认跳过已掌握）
    return book.words.filter(w => !book.progress.mastered.has(w.word));
  }

  function renderStudy() {
    // 填充 select
    const sel = $('#studyBookSelect');
    sel.innerHTML = state.books
      .map(b => `<option value="${b.id}" ${state.activeBookId === b.id ? 'selected' : ''}>${escapeHtml(b.name)} (${b.words.length})</option>`)
      .join('');
    if (!state.books.length) {
      $('#studyTitle').textContent = '你还没有单词本';
      $('#studySub').textContent = '先去首页导入一批词汇吧';
      $('#studyArea').innerHTML = `
        <div class="study-empty">
          <div class="icon">📭</div>
          <p>暂无可背单词本。请前往 <b>首页</b> 导入词汇生成你的第一本。</p>
        </div>`;
      return;
    }
    if (!state.activeBookId) state.activeBookId = state.books[0].id;
    sel.value = state.activeBookId;

    const book = state.books.find(b => b.id === state.activeBookId);
    if (!book) return;

    // 错词会话模式
    if (state.activeWrongSession) {
      renderWrongSession();
      return;
    }

    // 标准单词本背诵
    const freshQueue = buildStudyQueue(book);
    // v5.9 / v6：每个单词本各自保存进度 —— 优先从本本的快照恢复
    // v6 起队列里可能含重复项（未通过的词会重新排队），所以按「保存的顺序」原样重建
    const savedStudy = getStudyProgress(book.id);
    let restored = false;
    if (savedStudy && Array.isArray(savedStudy.queue) && savedStudy.queue.length) {
      const byWord = new Map(book.words.map(w => [w.word, w]));
      const rebuilt = savedStudy.queue
        .map(q => byWord.get(q && q.word ? q.word : q))
        .filter(w => w && !book.progress.mastered.has(w.word));
      if (rebuilt.length) {
        // 快照之后新导入的词补到队尾，避免漏背
        const inQueue = new Set(rebuilt.map(w => w.word));
        for (const w of freshQueue) if (!inQueue.has(w.word)) rebuilt.push(w);
        state.studyQueue = rebuilt;
        const savedIdx = savedStudy.index || 0;
        state.studyIndex = savedIdx >= rebuilt.length ? rebuilt.length : savedIdx;
        state.studyRevealed = !!savedStudy.revealed;
        state.studyStreak = { ...(savedStudy.streak || {}) };
        restored = true;
      }
    }
    if (!restored) {
      state.studyQueue = freshQueue;
      state.studyIndex = 0;
      state.studyRevealed = false;
      state.studyStreak = {};
    }
    saveLastStudy();

    const total = book.words.length;
    const mastered = book.progress.mastered.size;
    $('#studyTitle').textContent = book.name;
    $('#studySub').textContent = `共 ${total} 词，已掌握 ${mastered}，待复习 ${total - mastered}`;

    renderStudyCard();
  }

  /** 取某个 key（单词本 id / 'wrong'）的背诵进度快照 */
  function getStudyProgress(key) {
    if (!key) return null;
    const m = state.lastStudyMap && state.lastStudyMap[key];
    if (m && Array.isArray(m.queue) && m.queue.length) return m;
    // 兼容旧数据：只有单份 lastStudy 时，若指向本本则沿用
    if (state.lastStudy && state.lastStudy.activeBookId === key && !state.lastStudy.activeWrongSession) {
      return {
        index: state.lastStudy.studyIndex,
        revealed: state.lastStudy.studyRevealed,
        queue: state.lastStudy.studyQueue
      };
    }
    return null;
  }

  /** 把当前背诵状态写到 state.lastStudy（最近一次）+ lastStudyMap（按单词本/范围分片）并 persist */
  function saveLastStudy() {
    const queue = state.studyQueue.map(w => ({ word: w.word }));
    // v5.9：错词会话按「范围」独立分片，普通背诵按「单词本」分片
    const key = state.activeWrongSession
      ? wrongStudyKey(state.wrongSessionScope || 'all')
      : state.activeBookId;
    state.lastStudy = {
      activeBookId: state.activeBookId,
      activeWrongSession: !!state.activeWrongSession,
      studyIndex: state.studyIndex,
      studyQueue: queue,
      studyRevealed: !!state.studyRevealed
    };
    // v5.9：按 key 分片保存 —— 切到别的词本/范围再切回来，进度仍在
    if (key) {
      state.lastStudyMap[key] = {
        index: state.studyIndex,
        revealed: !!state.studyRevealed,
        queue,
        // v6：把「连续认识」计数一起存下来，切走再回来不会白答
        streak: { ...(state.studyStreak || {}) },
        wrongFilter: state.activeWrongSession ? (state.wrongSessionScope || 'all') : null
      };
    }
    persist();
  }

  /** 错词复习进度的分片 key */
  function wrongStudyKey(scope) {
    return 'wrong|' + (scope || 'all');
  }

  function renderStudyCard() {
    const book = state.books.find(b => b.id === state.activeBookId);
    if (!book) return;
    const total = book.words.length;
    const mastered = book.progress.mastered.size;
    const remain = total - mastered;

    const area = $('#studyArea');

    // v6：队列里可能残留已经通过的重复项 → 先跳过，避免"过了又出现"
    while (state.studyIndex < state.studyQueue.length) {
      const cur = state.studyQueue[state.studyIndex];
      if (cur && book.progress.mastered.has(cur.word)) { state.studyIndex++; continue; }
      break;
    }

    if (remain === 0) {
      endCardAudio();
      area.innerHTML = `
        <div class="study-empty">
          <div class="icon">🎉</div>
          <h3>本单词本已全部掌握！</h3>
          <p>这本没有要背的了，但错词本里可能还有你的"老大难"。</p>
          <div style="margin-top:18px" class="row gap">
            <button class="btn" id="startSpellOfBook">✍ 拼写本词本</button>
            <button class="btn primary" id="goWrong">去复习错词本</button>
          </div>
        </div>`;
      $('#startSpellOfBook')?.addEventListener('click', () => startSpellScope('book:' + book.id));
      $('#goWrong').addEventListener('click', () => startWrongSession('book:' + book.id));
      return;
    }

    if (state.studyIndex >= state.studyQueue.length) {
      endCardAudio();
      area.innerHTML = `
        <div class="study-empty">
          <div class="icon">✅</div>
          <h3>本轮完成！</h3>
          <p>每个词都<b>连续认识 ${STUDY_PASS_STREAK} 次</b>才算过，已通过的不再出现；<b>不认识</b>的已加入错词本（需累计答对 3 次才能毕业）。</p>
          <div style="margin-top:18px" class="row gap">
            <button class="btn" id="restartRound">再走一遍（错词优先）</button>
            <button class="btn primary" id="goWrong2">复习错词本</button>
            <button class="btn" id="spellThisBook">✍ 拼写本词本</button>
          </div>
        </div>`;
      $('#restartRound').addEventListener('click', () => {
        state.studyIndex = 0;
        state.studyRevealed = false;
        state.studyStreak = {};
        renderStudyCard();
      });
      $('#goWrong2').addEventListener('click', () => startWrongSession('book:' + book.id));
      $('#spellThisBook')?.addEventListener('click', () => startSpellScope('book:' + book.id));
      return;
    }

    const w = state.studyQueue[state.studyIndex];
    const entry = window.VocabData.lookup(w.word);
    const pct = ((state.studyIndex) / state.studyQueue.length) * 100;
    const typeTag = renderTypeTag(w.type);
    const streak = state.studyStreak[w.word] || 0;
    const needMore = Math.max(0, STUDY_PASS_STREAK - streak);

    area.innerHTML = `
      <div class="progress-bar"><span style="width:${pct.toFixed(1)}%"></span></div>
      <div class="flashcard">
        <div class="card-actions" title="点击可重新朗读">
          ${Speech.button(w.word, { small: true })}
        </div>
        <div class="progress">${state.studyIndex + 1} / ${state.studyQueue.length} · ${typeTag}${streak ? ` · 已连续认识 ${streak}/${STUDY_PASS_STREAK}` : ''}</div>
        <div class="word ${w.type === 'sentence' ? 'sentence' : (w.type === 'phrase' ? 'phrase' : '')}">${escapeHtml(w.word)}</div>
        ${entry.phonetic ? `<div class="phonetic">${escapeHtml(entry.phonetic)}</div>` : `<div class="phonetic muted">（暂无音标）</div>`}
        ${state.studyRevealed
          ? `
            <div class="meaning">${escapeHtml(w.meaning || `${entry.pos} ${entry.cn}`)}</div>
            ${w.example ? `<div class="example">${escapeHtml(w.example)}</div>` : (entry.example ? `<div class="example muted">${escapeHtml(entry.example)}</div>` : '')}
          `
          : `<button class="reveal-btn" id="revealBtn">显示释义</button>`
        }
      </div>
      ${state.studyRevealed ? `
        <div class="actions">
          <button class="btn edit-meaning-btn" id="editCardBtn" title="修正这个词的释义 / 例句">
            <span class="edit-icon">✏</span><span class="edit-text">编辑释义</span>
          </button>
          <div class="actions-main">
            <button class="btn unknow" id="btnUnknow">不认识 → 入错词本</button>
            <button class="btn know" id="btnKnow">认识 ✓${streak ? `（再需 ${needMore} 次）` : `（需连续 ${STUDY_PASS_STREAK} 次）`}</button>
          </div>
        </div>
      ` : ''}
    `;

    // v6：音频跟随词卡 —— 换词就停掉上一张卡的音频，新卡出现就自动朗读
    // 不放 setTimeout：保持用户点击栈内的 user activation（Chrome 才有声音）
    syncCardAudio(w.word);
    if (state.autoSpeak && !state.audioMuted && !sessionStorage.getItem('__autospk_hinted')) {
      sessionStorage.setItem('__autospk_hinted', '1');
      toast('🔊 已开启自动英式朗读 · 点 🔊 可单独再读 · 顶部 🔊 可一键静音');
    }

    // 绑定词卡上的"编辑"按钮（不管是否揭示都能点）
    const editBtn = $('#editCardBtn');
    if (editBtn) {
      editBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openEditModal({
          word: w.word,
          meaning: w.meaning || `${entry.pos} ${entry.cn}`,
          example: w.example || entry.example || '',
          scope: 'word',
          source: 'study'
        });
      });
    }

    if (!state.studyRevealed) {
      $('#revealBtn').addEventListener('click', () => {
        state.studyRevealed = true;
        renderStudyCard();
      });
      const handler = (e) => {
        if ((e.code === 'Space' || e.code === 'Enter') && !state.studyRevealed) {
          e.preventDefault();
          state.studyRevealed = true;
          renderStudyCard();
        }
      };
      document.addEventListener('keydown', handler, { once: true });
    } else {
      $('#btnUnknow').addEventListener('click', () => handleAnswer(false, w));
      $('#btnKnow').addEventListener('click', () => handleAnswer(true, w));
    }
  }

  /** 把 type 字段渲染成 pill 文字 */
  function renderTypeTag(type) {
    if (type === 'sentence') return '<span class="type-pill sentence">句子</span>';
    if (type === 'phrase') return '<span class="type-pill phrase">短语</span>';
    return '<span class="type-pill word">单词</span>';
  }

  function handleAnswer(know, word) {
    const book = state.books.find(b => b.id === state.activeBookId);
    if (!state.studyStreak) state.studyStreak = {};

    if (know) {
      // 更新 SRS：按照认识次数推进到下一个艾宾浩斯阶梯
      const srs = ensureSrs(word);
      srs.lastReviewed = Date.now();
      nextReviewAfter(srs, true);

      const streak = (state.studyStreak[word.word] || 0) + 1;
      state.studyStreak[word.word] = streak;

      if (streak >= STUDY_PASS_STREAK) {
        // 连续认识达标 → 通过，不再出现
        delete state.studyStreak[word.word];
        book.progress.mastered.add(word.word);
        const wrong = state.wrongBook.find(w => w.word === word.word);
        if (wrong) {
          wrong.correctCount = (wrong.correctCount || 0) + 1;
          wrong.lastSeen = Date.now();
          ensureSrs(wrong);
          if (wrong.correctCount >= 3) {
            state.wrongBook = state.wrongBook.filter(w => w.word !== word.word);
            toast(`「${word.word}」连续认识 ${STUDY_PASS_STREAK} 次 ✓ 并从错词本毕业！`);
          } else {
            toast(`「${word.word}」连续认识 ${STUDY_PASS_STREAK} 次 ✓ · 错词本累计 ${wrong.correctCount}/3`);
          }
        } else {
          toast(`「${word.word}」连续认识 ${STUDY_PASS_STREAK} 次，通过 ✓`);
        }
      } else {
        // 还没连续达标 → 这张卡重新排回队尾，稍后再考
        state.studyQueue.push(word);
        const wrong = state.wrongBook.find(w => w.word === word.word);
        toast(`「${word.word}」已认识 ${streak}/${STUDY_PASS_STREAK} · 稍后会再考一次${wrong ? `（错词本 ${wrong.correctCount || 0}/3）` : ''}`);
      }
    } else {
      // 不认识 → 计数清零、立即进错词本，并把词卡重新排回队尾
      // （至少要再连续答对 STUDY_PASS_STREAK 次才能过，也就是这张卡还会再出现至少两次）
      state.studyStreak[word.word] = 0;
      addToWrongBook(word.word, word.type, book.id, word.meaning);
      ensureSrs(word).lastReviewed = Date.now();
      nextReviewAfter(word.srs, false);
      state.studyQueue.push(word);
      toast(`「${word.word}」已加入错词本 · 需连续认识 ${STUDY_PASS_STREAK} 次才算过`);
    }
    persist();
    state.studyIndex++;
    state.studyRevealed = false;
    saveLastStudy();
    renderStudyCard();
  }

  function addToWrongBook(word, type, sourceBookId, meaning) {
    const existing = state.wrongBook.find(w => w.word === word);
    const entry = window.VocabData.lookup(word);
    // 计算释义：优先传入的 meaning → 从单词本反查 → entry 拼装（排除占位符）
    let m = (meaning || '').trim();
    if (isPlaceholderMeaning(m)) m = '';
    if (!m) {
      for (const b of state.books) {
        const it = b.words.find(x => window.VocabData.normalizeKey(x.word) === window.VocabData.normalizeKey(word));
        if (it && it.meaning && !isPlaceholderMeaning(it.meaning)) { m = it.meaning.trim(); break; }
      }
    }
    if (!m) {
      const fromEntry = `${(entry && entry.pos) || ''} ${(entry && entry.cn) || ''}`.trim();
      if (!isPlaceholderMeaning(fromEntry)) m = fromEntry;
    }
    if (existing) {
      existing.sources = Array.from(new Set([...(existing.sources || []), sourceBookId]));
      existing.lastSeen = Date.now();
      existing.type = type || existing.type || entry.type || window.VocabData.detectType(word);
      if (m) existing.meaning = m;
    } else {
      const srs = newSrsRecord();
      srs.nextReview = Date.now() + SRS_INTERVALS[0] * DAY_MS;
      state.wrongBook.push({
        word,
        type: type || entry.type || window.VocabData.detectType(word),
        entry,
        meaning: m,
        correctCount: 0,
        sources: [sourceBookId],
        lastSeen: Date.now(),
        createdAt: Date.now(),
        srs
      });
    }
  }

  /** 进入错词复习会话；scope 决定"只复习哪一部分错词"（all | book:<id> | orphans） */
  function startWrongSession(scope) {
    const s = scope || state.wrongFilter || 'all';
    state.wrongSessionScope = s;
    state.activeWrongSession = true;
    state.studyQueue = [];
    state.studyIndex = 0;
    state.studyRevealed = false;
    state.wrongSpellAnswered = false;
    state.wrongSpellOk = false;
    state.wrongSpellInput = '';
    state._wrongQueueScope = null; // 交给 renderWrongSession 按范围恢复/重建
    $all('.tab').forEach(t => t.classList.remove('active'));
    $('.tab[data-tab="study"]').classList.add('active');
    $all('.panel').forEach(p => p.classList.remove('active'));
    $('#panel-study').classList.add('active');
    renderStudy();
  }

  /** 按范围过滤错词（语法与错词本页面一致：all | book:<id> | orphans） */
  function filterWrongByScope(list, scope) {
    if (!scope || scope === 'all') return list;
    if (scope === 'orphans') return list.filter(w => !w.sources || !w.sources.length);
    if (scope.startsWith('book:')) {
      const id = scope.slice(5);
      return list.filter(w => w.sources && w.sources.includes(id));
    }
    return list;
  }

  /** 错词范围的可读名称 */
  function wrongScopeLabel(scope) {
    if (!scope || scope === 'all') return '全部错词';
    if (scope === 'orphans') return '未归类';
    if (scope.startsWith('book:')) {
      const b = state.books.find(x => x.id === scope.slice(5));
      return b ? `《${b.name}》` : '（已删除词本）';
    }
    return scope;
  }

  /** 错词复习：释义取「错词本自身 meaning」优先，其次 DICT 拼装 */
  function wrongItemMeaning(w, entry) {
    let m = (w.meaning || '').trim();
    if (isPlaceholderMeaning(m)) m = '';
    if (!m) m = `${(entry && entry.pos) || ''} ${(entry && entry.cn) || ''}`.trim();
    if (isPlaceholderMeaning(m)) m = '';
    if (!m) {
      // 再从单词本反查一次
      const key = window.VocabData.normalizeKey(w.word);
      for (const b of state.books) {
        const it = b.words.find(x => window.VocabData.normalizeKey(x.word) === key);
        if (it && it.meaning && !isPlaceholderMeaning(it.meaning)) { m = it.meaning.trim(); break; }
      }
    }
    return m;
  }

  function renderWrongSession() {
    const area = $('#studyArea');
    const allWrong = state.wrongBook.filter(w => (w.correctCount || 0) < 3);
    const scope = state.wrongSessionScope || 'all';
    const due = filterWrongByScope(allWrong, scope);

    if (!due.length) {
      endCardAudio();
      area.innerHTML = `
        <div class="study-empty">
          <div class="icon">🌟</div>
          <h3>「${escapeHtml(wrongScopeLabel(scope))}」范围内没有待复习的错词</h3>
          <p>该范围的错词都已达到"认识 3 次"毕业标准，或本来就没有错词。</p>
          <div style="margin-top:18px" class="row gap wrap">
            <button class="btn primary" id="backNormal">回到单词本</button>
            <button class="btn" id="wrongScopeSwitch">🔄 更换范围</button>
          </div>
        </div>`;
      $('#backNormal').addEventListener('click', () => {
        state.activeWrongSession = false;
        renderStudy();
      });
      $('#wrongScopeSwitch')?.addEventListener('click', () => {
        state.activeWrongSession = false;
        renderStudy();
        setTimeout(() => { const p = $('#wrongBookPicker'); if (p) { p.focus(); p.scrollIntoView({ behavior: 'smooth', block: 'center' }); } }, 30);
      });
      return;
    }

    // —— 队列准备：内存中的队列若仍属于同一范围则直接续用 ——
    const saved = state.lastStudyMap && (state.lastStudyMap[wrongStudyKey(scope)] || state.lastStudyMap['wrong']);
    const savedMatches = saved && (saved.wrongFilter || 'all') === scope;
    const inMemoryOk = state.studyQueue && state.studyQueue.length
      && state._wrongQueueScope === scope
      && state.studyIndex < state.studyQueue.length;

    if (!inMemoryOk) {
      let rebuilt = null;
      if (savedMatches && Array.isArray(saved.queue) && saved.queue.length) {
        const byWord = new Map(due.map(w => [w.word, w]));
        rebuilt = saved.queue.map(q => byWord.get(q.word)).filter(Boolean);
      }
      if (rebuilt && rebuilt.length) {
        state.studyQueue = rebuilt;
        state.studyIndex = Math.min(saved.index || 0, rebuilt.length - 1);
        state.studyRevealed = !!saved.revealed;
      } else {
        state.studyQueue = due.slice();
        for (let i = state.studyQueue.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [state.studyQueue[i], state.studyQueue[j]] = [state.studyQueue[j], state.studyQueue[i]];
        }
        state.studyIndex = 0;
        state.studyRevealed = false;
      }
      state._wrongQueueScope = scope;
      state.wrongSpellAnswered = false;
      state.studyStreak = {};   // v6：错词复习不共用单词本的「连续认识」计数
      saveLastStudy();
    }

    // 进度耗尽 → 本轮结束
    if (state.studyIndex >= state.studyQueue.length) {
      endCardAudio();
      area.innerHTML = `
        <div class="study-empty">
          <div class="icon">✅</div>
          <h3>本轮错词复习完成！</h3>
          <p>范围「${escapeHtml(wrongScopeLabel(scope))}」本轮已全部过一遍，继续练可再来一轮。</p>
          <div style="margin-top:18px" class="row gap wrap">
            <button class="btn primary" id="wrongRoundAgain">🔁 再来一轮</button>
            <button class="btn" id="exitWrong">退出错词复习</button>
          </div>
        </div>`;
      $('#wrongRoundAgain').addEventListener('click', () => {
        state.studyQueue = [];
        state.studyIndex = 0;
        state._wrongQueueScope = null;
        renderWrongSession();
      });
      $('#exitWrong').addEventListener('click', () => {
        state.activeWrongSession = false;
        state.studyQueue = [];
        state.studyIndex = 0;
        state._wrongQueueScope = null;
        saveLastStudy();
        renderStudy();
      });
      return;
    }

    const w = state.studyQueue[state.studyIndex];
    const entry = window.VocabData.lookup(w.word) || {};
    const wrong = state.wrongBook.find(x => x.word === w.word);
    const correctCount = wrong?.correctCount || 0;
    const typeTag = renderTypeTag(w.type);
    const meaning = wrongItemMeaning(w, entry);
    const mode = state.wrongCardMode === 'spell' ? 'spell' : 'recall';

    // 顶部：范围选择（可随时更换单词本一起做）
    const scopeOpts = ['<option value="all">📚 全部错词</option>']
      .concat(state.books.map(b => {
        const c = state.wrongBook.filter(x => (x.correctCount || 0) < 3 && x.sources && x.sources.includes(b.id)).length;
        return `<option value="book:${b.id}" ${scope === 'book:' + b.id ? 'selected' : ''}>《${escapeHtml(b.name)}》(${c})</option>`;
      }));
    const orphanAll = state.wrongBook.filter(x => (x.correctCount || 0) < 3 && (!x.sources || !x.sources.length)).length;
    if (orphanAll) scopeOpts.push(`<option value="orphans" ${scope === 'orphans' ? 'selected' : ''}>📦 未归类（${orphanAll}）</option>`);

    $('#studyTitle').textContent = '错词本复习';
    $('#studySub').textContent = `范围：${wrongScopeLabel(scope)} · 待毕业 ${due.length} 个 · 本词进度 ${correctCount}/3`;

    const pct = (state.studyIndex / state.studyQueue.length) * 100;
    const spellAnswered = !!state.wrongSpellAnswered;
    const spellOk = !!state.wrongSpellOk;

    area.innerHTML = `
      <div class="progress-bar"><span style="width:${pct.toFixed(1)}%"></span></div>

      <div class="card" style="padding:10px 16px;display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:10px">
        <span class="muted small">复习范围：</span>
        <select id="wrongScopeSelect" class="select" style="min-width:170px">${scopeOpts.join('')}</select>
        <span class="muted small">答对 3 次即毕业</span>
        <span class="grow"></span>
        <button class="btn small-btn ${mode === 'spell' ? 'primary' : ''}" id="wrongModeToggle">
          ${mode === 'spell' ? '🎴 改回认词模式' : '✍ 拼写这道题'}
        </button>
      </div>

      <div class="flashcard spell-card">
        <div class="card-actions">
          ${Speech.button(w.word, { small: true })}
          <button class="edit-btn" id="editCardBtn" title="修正这个词的释义">✏ 编辑</button>
        </div>
        <div class="progress">${state.studyIndex + 1} / ${state.studyQueue.length} · ${correctCount}/3 · ${typeTag}</div>

        ${mode === 'recall' ? `
          <div class="word ${w.type === 'sentence' ? 'sentence' : (w.type === 'phrase' ? 'phrase' : '')}">${escapeHtml(w.word)}</div>
          ${entry.phonetic ? `<div class="phonetic">${escapeHtml(entry.phonetic)}</div>` : `<div class="phonetic muted">（暂无音标）</div>`}
          ${state.studyRevealed
            ? `
              <div class="meaning">${escapeHtml(meaning || '（暂无释义，可点右上角 ✏ 补充）')}</div>
              ${(w.example || entry.example) ? `<div class="example">${escapeHtml(w.example || entry.example)}</div>` : ''}
            `
            : `<button class="reveal-btn" id="revealBtn">显示释义</button>`
          }
        ` : `
          <div class="spell-blank-stage">
            <div class="blank-icon">🎧</div>
            <div class="blank-hint">${w.type === 'sentence' ? '请拼写下面的英文句子' : w.type === 'phrase' ? '请拼写下面的英文短语（保留空格）' : '请拼写下面的英文单词'}</div>
            <button class="btn-listen-big" id="wrongSpellPlay" type="button">
              <span class="play-glyph">▶</span>
              <span class="play-label">播放发音</span>
            </button>
          </div>
          ${spellAnswered ? `
            <div class="spell-reveal ${spellOk ? 'is-correct' : 'is-wrong'}">
              <div class="reveal-banner ${spellOk ? 'ok-banner' : 'wrong-banner'}">
                ${spellOk ? '<span class="ok-text">✓ 拼写正确 · 已累计 +1</span>' : '<span class="bad-text">✗ 拼错了 · 进度已重置</span>'}
              </div>
              <div class="reveal-correct ${spellOk ? '' : 'reveal-correct-wrong'}">
                <span class="muted small">你的答案：</span>
                <span class="${spellOk ? 'ok-text' : 'bad-text'}">${escapeHtml(state.wrongSpellInput || '（空）')}</span>
              </div>
              <div class="reveal-correct reveal-correct-wrong">
                <span class="reveal-label">正确答案</span>
                <span class="correct-word">${escapeHtml(w.word)}</span>
                ${Speech.button(w.word, { small: true })}
              </div>
              <div class="reveal-meaning-block">
                <div class="meaning-label muted small">中文释义</div>
                <div class="meaning-line">${escapeHtml(meaning || '（暂无释义，可点右上角 ✏ 补充）')}</div>
                ${entry.phonetic ? `<div class="phonetic">/${escapeHtml(entry.phonetic)}/</div>` : ''}
              </div>
            </div>
          ` : `
            <div class="spell-input-row">
              <input id="wrongSpellInput" class="input" type="text" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" placeholder="输入后按 Enter 提交" />
              <button class="btn primary" id="wrongSpellSubmit">提交 ✍️</button>
            </div>
          `}
        `}
      </div>

      ${mode === 'recall' && state.studyRevealed ? `
        <div class="actions">
          <button class="btn unknow" id="btnUnknow">不认识</button>
          <button class="btn know" id="btnKnow">认识 +1 (${correctCount + 1}/3)</button>
        </div>
      ` : ''}
      ${mode === 'spell' && spellAnswered ? `
        <div class="actions">
          <button class="btn primary" id="wrongNext">下一题 ➜</button>
        </div>
      ` : ''}

      <div style="text-align:center;margin-top:14px" class="row gap wrap">
        <button class="btn ghost" id="exitWrong">退出错词复习</button>
        <button class="btn" id="spellWrongHere">✍ 整轮拼写模式</button>
      </div>
    `;

    // v6：音频跟随词卡 —— 换词停旧音频，新卡出现自动朗读
    // 拼写模式下不自动朗读（会剧透答案），但仍然负责"换词即停"
    syncCardAudio(w.word, { silent: mode === 'spell' });
    if (state.autoSpeak && !state.audioMuted && mode === 'recall' && !state.studyRevealed
        && !sessionStorage.getItem('__autospk_hinted')) {
      sessionStorage.setItem('__autospk_hinted', '1');
      toast('🔊 已开启自动英式朗读 · 点 🔊 可单独再读 · 顶部 🔊 可一键静音');
    }

    // —— 范围切换：整轮进度按新范围重新开始，但各范围进度各自保留 ——
    $('#wrongScopeSelect').addEventListener('change', (e) => {
      state.wrongSessionScope = e.target.value;
      state.studyQueue = [];
      state.studyIndex = 0;
      state.studyRevealed = false;
      state.wrongSpellAnswered = false;
      state._wrongQueueScope = null;
      renderWrongSession();
    });

    // —— 模式切换 ——
    $('#wrongModeToggle').addEventListener('click', () => {
      state.wrongCardMode = mode === 'spell' ? 'recall' : 'spell';
      state.wrongSpellAnswered = false;
      state.studyRevealed = false;
      renderWrongSession();
    });

    $('#editCardBtn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      openEditModal({
        word: w.word,
        meaning: meaning || `${entry.pos || ''} ${entry.cn || ''}`.trim(),
        example: w.example || entry.example || '',
        scope: 'word'
      });
    });

    if (mode === 'recall') {
      if (!state.studyRevealed) {
        $('#revealBtn').addEventListener('click', () => { state.studyRevealed = true; renderWrongSession(); });
      } else {
        $('#btnUnknow').addEventListener('click', () => {
          if (wrong) {
            wrong.correctCount = 0;
            wrong.lastSeen = Date.now();
            nextReviewAfter(ensureSrs(wrong), false);
          } else {
            // 该词可能刚毕业又被判不认识 → 重新拉回错词本
            addToWrongBook(w.word, w.type, (w.sources && w.sources[0]) || w.sourceBookId, w.meaning);
          }
          persist();
          // v6：不认识的错词重新排回本轮队尾，本轮里还会再出现（不必等到下一轮）
          state.studyQueue.push(w);
          toast(`已重置「${w.word}」的累计进度 · 本轮稍后会再出现`);
          state.studyIndex++;
          state.studyRevealed = false;
          saveLastStudy();
          renderWrongSession();
        });
        $('#btnKnow').addEventListener('click', () => {
          if (wrong) {
            wrong.correctCount = (wrong.correctCount || 0) + 1;
            wrong.lastSeen = Date.now();
            nextReviewAfter(ensureSrs(wrong), true);
            if (wrong.correctCount >= 3) {
              state.wrongBook = state.wrongBook.filter(x => x.word !== w.word);
              // v6：毕业了就把它在本轮队列里还没轮到的副本一并清掉
              state.studyQueue = state.studyQueue.filter((x, i) => i < state.studyIndex || x.word !== w.word);
              toast(`「${w.word}」已毕业！`);
            } else {
              toast(`「${w.word}」进度 ${wrong.correctCount}/3`);
            }
          }
          persist();
          state.studyIndex++;
          state.studyRevealed = false;
          saveLastStudy();
          renderWrongSession();
        });
      }
    } else {
      const playBtn = $('#wrongSpellPlay');
      if (playBtn) playBtn.addEventListener('click', () => manualSpeak(w.word));

      if (spellAnswered) {
        $('#wrongNext').addEventListener('click', () => {
          state.studyIndex++;
          state.wrongSpellAnswered = false;
          state.wrongSpellOk = false;
          state.wrongSpellInput = '';
          saveLastStudy();
          renderWrongSession();
        });
      } else {
        const inp = $('#wrongSpellInput');
        if (inp) inp.focus();
        const submit = () => {
          const v = (inp.value || '').trim();
          const ok = v !== '' && normalizeForCompare(v) === normalizeForCompare(w.word);
          state.wrongSpellAnswered = true;
          state.wrongSpellOk = ok;
          state.wrongSpellInput = v || '（空）';
          if (wrong) {
            if (ok) {
              wrong.correctCount = (wrong.correctCount || 0) + 1;
              wrong.lastSeen = Date.now();
              nextReviewAfter(ensureSrs(wrong), true);
              if (wrong.correctCount >= 3) {
                state.wrongBook = state.wrongBook.filter(x => x.word !== w.word);
                toast(`「${w.word}」已毕业！`);
              } else {
                toast(`✓ 拼对了 ·「${w.word}」进度 ${wrong.correctCount}/3`);
              }
            } else {
              wrong.correctCount = 0;
              wrong.lastSeen = Date.now();
              nextReviewAfter(ensureSrs(wrong), false);
              toast(`✗ 拼错了，「${w.word}」进度已重置`);
            }
          }
          persist();
          saveLastStudy();
          renderWrongSession();
        };
        $('#wrongSpellSubmit').addEventListener('click', submit);
        if (inp) {
          inp.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              e.stopPropagation();
              e.stopImmediatePropagation();
              submit();
            }
          });
        }
      }
    }

    $('#exitWrong').addEventListener('click', () => {
      state.activeWrongSession = false;
      state.studyQueue = [];
      state.studyIndex = 0;
      state._wrongQueueScope = null;
      renderStudy();
    });
    $('#spellWrongHere')?.addEventListener('click', () => startSpellScope(scope === 'all' ? 'wrong' : scope));
  }

  function bindStudy() {
    $('#studyBookSelect').addEventListener('change', (e) => {
      state.activeBookId = e.target.value;
      state.activeWrongSession = false;
      renderStudy();
    });
    $('#restartBook').addEventListener('click', () => {
      const book = state.books.find(b => b.id === state.activeBookId);
      if (!book) return;
      if (!confirm(`确定重置《${book.name}》的背诵进度？已掌握记录将清空（不影响错词本）。`)) return;
      book.progress.mastered = new Set();
      persist();
      renderStudy();
      toast('已重置进度');
    });
    $('#studyWrong').addEventListener('click', () => {
      // v5.9：只复习「错词本页面当前选中范围」的错词（跟随上方下拉）
      const picker = $('#wrongBookPicker');
      const scope = (picker && picker.value) ? picker.value : (state.wrongFilter || 'all');
      state.wrongFilter = scope;
      startWrongSession(scope);
    });
  }

  /* ---------- 5. 单词本管理 ---------- */
  function renderBooks() {
    const list = $('#bookList');
    if (!state.books.length) {
      list.innerHTML = `<div class="muted">还没有单词本，去首页导入吧。</div>`;
      return;
    }
    list.innerHTML = state.books.map(b => {
      const mastered = b.progress.mastered.size;
      const total = b.words.length;
      const rate = total ? Math.round(mastered / total * 100) : 0;
      const wrongCount = state.wrongBook.filter(w => w.sources.includes(b.id)).length;
      return `
        <div class="book-card">
          <div class="name">${escapeHtml(b.name)}</div>
          <div class="meta">创建于 ${new Date(b.createdAt).toLocaleString('zh-CN')}</div>
          <div class="stat-row">
            <span class="mastered">已掌握 ${mastered}</span>
            <span class="unmastered">未掌握 ${total - mastered}</span>
            <span>${rate}%</span>
          </div>
          <div class="meta">贡献错词：${wrongCount}</div>
          <div class="book-actions">
            <button class="btn primary" data-act="study" data-id="${b.id}">背诵</button>
            <button class="btn" data-act="spell" data-id="${b.id}">拼写</button>
            <button class="btn" data-act="view" data-id="${b.id}">查看词条</button>
            <button class="btn" data-act="reset" data-id="${b.id}">重置进度</button>
            <button class="btn danger" data-act="del" data-id="${b.id}">删除</button>
          </div>
        </div>
      `;
    }).join('');

    list.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        const act = btn.dataset.act;
        const book = state.books.find(b => b.id === id);
        if (!book) return;
        if (act === 'study') {
          state.activeBookId = id;
          state.activeWrongSession = false;
          $all('.tab').forEach(t => t.classList.remove('active'));
          $('.tab[data-tab="study"]').classList.add('active');
          $all('.panel').forEach(p => p.classList.remove('active'));
          $('#panel-study').classList.add('active');
          renderStudy();
        } else if (act === 'spell') {
          startSpellScope('book:' + id);
        } else if (act === 'view') {
          viewBook(book);
        } else if (act === 'reset') {
          if (!confirm(`重置《${book.name}》的背诵进度？`)) return;
          book.progress.mastered = new Set();
          persist();
          renderBooks();
        } else if (act === 'del') {
          const wordCount = book.words.length;
          // 统计"仅来自这本书"的错词（这些会被彻底清除）
          const onlyFromThis = state.wrongBook.filter(w => w.sources.length === 1 && w.sources[0] === id).length;
          // 统计"含这本书"的错词（这些只去掉一个来源，词本身保留）
          const shared = state.wrongBook.filter(w => w.sources.length > 1 && w.sources.includes(id)).length;
          if (!confirm(
            `确定删除《${book.name}》？此操作不可撤销。\n\n` +
            `将级联清理：\n` +
            `• 本词本 ${wordCount} 个词条\n` +
            `• ${onlyFromThis} 个仅来自本本的错词（彻底删除）\n` +
            `• ${shared} 个多源错词（仅去掉本本来源，词保留）\n` +
            `• 当前拼写 / 背诵 / 复习计划中对本本的引用`
          )) return;

          // 1) 移除该书
          state.books = state.books.filter(b => b.id !== id);

          // 2) 错词本级联清理：完全来自该书的错词删除；多源错词只去掉该来源
          state.wrongBook = state.wrongBook.reduce((acc, w) => {
            const newSources = w.sources.filter(s => s !== id);
            if (newSources.length === 0) return acc;
            w.sources = newSources;
            acc.push(w);
            return acc;
          }, []);

          // 3) 清理 lastStudy：若指向上述词本，则清空
          if (state.lastStudy?.activeBookId === id) state.lastStudy = null;

          // 3.5) v5.9：同步清理三个分片进度 map 里对该书的引用
          purgeBookFromProgressMaps(id);

          // 4) 清理 lastSpell：若 scope 是该本或队列含仅来自该本的项目
          if (state.lastSpell) {
            const scope = state.lastSpell.scope || '';
            if (scope === 'book:' + id) {
              state.lastSpell = null;
            } else if (Array.isArray(state.lastSpell.queue)) {
              const remaining = state.lastSpell.queue.filter(it => {
                if (!it.sourceBookId) return true; // 来自错词本等，不属于单词本
                return it.sourceBookId !== id;    // 删掉属于被删书的
              });
              if (!remaining.length) state.lastSpell = null;
              else state.lastSpell.queue = remaining;
            }
          }

          // 5) 如果当前拼写队列来自该书或全是来自该书 → 重置拼写
          if (state.spellQueue?.length) {
            const remaining = state.spellQueue.filter(it => {
              if (!it.sourceBookId) return true;
              return it.sourceBookId !== id;
            });
            if (!remaining.length) {
              state.spellQueue = [];
              state.spellIndex = 0;
              state.spellAnswered = false;
              state.spellSource = '';
              state.spellScope = 'due';
              state.lastSpell = null;
            } else {
              state.spellQueue = remaining;
              if (state.spellIndex >= remaining.length) state.spellIndex = Math.max(0, remaining.length - 1);
              state.lastSpell = null;
            }
          }

          // 6) 当前 activeBookId
          if (state.activeBookId === id) state.activeBookId = state.books[0]?.id || null;

          // 7) reviewFilter
          if (state.reviewFilter === 'book:' + id) state.reviewFilter = 'all';

          // 8) 听音：清理 lastListen + listenQueue
          if (state.lastListen) {
            const ls = state.lastListen;
            if (ls.scope === 'book:' + id) {
              state.lastListen = null;
            } else if (Array.isArray(ls.queue)) {
              const remaining = ls.queue.filter(it => !it.sourceBookId || it.sourceBookId !== id);
              if (!remaining.length) state.lastListen = null;
              else ls.queue = remaining;
            }
          }
          if (state.listenQueue?.length) {
            const remaining = state.listenQueue.filter(it => !it.sourceBookId || it.sourceBookId !== id);
            if (!remaining.length) {
              state.listenQueue = [];
              state.listenIndex = 0;
              state.listenAnswered = false;
              state.listenScope = 'book';
              state.listenSource = '';
              state.lastListen = null;
            } else {
              state.listenQueue = remaining;
              if (state.listenIndex >= remaining.length) state.listenIndex = Math.max(0, remaining.length - 1);
            }
          }

          // 9) listenScope 若指向被删书 → 退回 book:
          if (state.listenScope === 'book:' + id) state.listenScope = 'book';

          persist();
          renderBooks();
          toast(`已删除《${book.name}》并级联清理关联数据`);
        }
      });
    });
  }

  function viewBook(book) {
    const w = window.open('', '_blank', 'width=720,height=600');
    if (!w) { toast('请允许弹窗以查看词条'); return; }
    const rows = book.words.map((it, i) => `
      <tr>
        <td>${i + 1}</td>
        <td><b>${escapeHtml(it.word)}</b></td>
        <td>${escapeHtml(it.meaning)}</td>
        <td>${escapeHtml(it.example || '')}</td>
        <td>${book.progress.mastered.has(it.word) ? '✓' : '—'}</td>
      </tr>`).join('');
    w.document.write(`
      <meta charset="utf-8"><title>${escapeHtml(book.name)}</title>
      <style>body{font-family:-apple-system,sans-serif;padding:20px;color:#1f2433}h1{font-size:18px}table{border-collapse:width:100%;font-size:13px}th,td{border-bottom:1px solid #eee;padding:8px;text-align:left;vertical-align:top}</style>
      <h1>${escapeHtml(book.name)}</h1>
      <p>共 ${book.words.length} 词 · 已掌握 ${book.progress.mastered.size}</p>
      <table>
        <thead><tr><th>#</th><th>Word</th><th>Meaning</th><th>Example</th><th>Status</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    `);
  }

  function bindBooks() {
    $('#exportAll').addEventListener('click', () => {
      // 完整备份：包含所有可恢复字段，确保导入后可完全还原
      const data = {
        exportAt: new Date().toISOString(),
        version: 'vocabmaster.v1',
        books: state.books.map(b => ({
          id: b.id,
          name: b.name,
          createdAt: b.createdAt,
          words: b.words,
          progress: { mastered: Array.from(b.progress.mastered) }
        })),
        wrongBook: state.wrongBook,
        userDict: state.userDict,
        lastStudy: attachMap(state.lastStudy, state.lastStudyMap),
        lastSpell: attachMap(state.lastSpell, state.lastSpellMap),
        lastListen: attachMap(state.lastListen, state.lastListenMap),
        prefs: {
          autoSpeak: state.autoSpeak,
          wrongFilter: state.wrongFilter,
          reviewFilter: state.reviewFilter,
          activeBookId: state.activeBookId,
          spellScope: state.spellScope,
          listenScope: state.listenScope,
          wrongSessionScope: state.wrongSessionScope,
          wrongCardMode: state.wrongCardMode
        }
      };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `vocabmaster-export-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast('✅ 备份已下载。请妥善保管此文件，下次数据丢失时可用来恢复。');
    });

    // ─── 导入 JSON 备份 ────────────────────────────────────────────
    const fileInput = $('#importAllFile');
    $('#importAll').addEventListener('click', () => {
      if (!fileInput) {
        toast('导入功能初始化失败，请刷新页面重试');
        return;
      }
      fileInput.value = ''; // 允许重复选同一个文件
      fileInput.click();
    });
    if (fileInput) {
      fileInput.addEventListener('change', (ev) => {
        const file = ev.target.files && ev.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const raw = e.target.result;
            const incoming = JSON.parse(raw);
            handleImportedData(incoming);
          } catch (err) {
            toast('❌ 解析失败：文件不是合法的 JSON 备份');
            console.error('import parse error', err);
          }
        };
        reader.onerror = () => toast('❌ 读取文件失败');
        reader.readAsText(file, 'utf-8');
      });
    }
  }

  // 处理导入的数据：先预览，再让用户选择「合并 / 替换 / 仅合并错词」
  function handleImportedData(incoming) {
    if (!incoming || typeof incoming !== 'object') {
      toast('❌ 文件内容格式不对');
      return;
    }

    // 兼容多种导出格式：完整版（来自本应用新版导出）+ 旧版（仅 books/wrongBook）
    const incBooks = Array.isArray(incoming.books) ? incoming.books : [];
    const incWrong = Array.isArray(incoming.wrongBook) ? incoming.wrongBook : [];
    const incUserDict = (incoming.userDict && typeof incoming.userDict === 'object') ? incoming.userDict : null;
    const incLastStudy = incoming.lastStudy || null;
    const incLastSpell = incoming.lastSpell || null;
    const incPrefs = incoming.prefs || {};

    if (!incBooks.length && !incWrong.length) {
      toast('❌ 备份里没有可恢复的内容（缺少单词本和错词本）');
      return;
    }

    // 统计一下要恢复的内容，方便用户判断
    let totalWords = 0;
    for (const b of incBooks) totalWords += (b.words || []).length;

    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-card">
        <div class="modal-head">
          <h3>📥 导入 JSON 备份</h3>
          <button class="modal-close" data-act="cancel">✕</button>
        </div>
        <div class="modal-body">
          <p class="muted small">检测到备份内容：</p>
          <ul class="muted small" style="line-height:1.8;padding-left:18px">
            <li>单词本：<b>${incBooks.length}</b> 个，共 <b>${totalWords}</b> 词</li>
            <li>错词：<b>${incWrong.length}</b> 条${incUserDict ? ` · 含 <b>${Object.keys(incUserDict).length}</b> 个用户字典` : ''}</li>
            ${incLastStudy ? `<li>包含上次背诵进度（${escapeHtml(incLastStudy.bookName || '')}）</li>` : ''}
            ${incLastSpell ? `<li>包含上次拼写进度</li>` : ''}
          </ul>
          <p class="muted small">请选择恢复方式（<b>合并</b>更安全，不会清空你现有的数据）：</p>
          <div class="row gap wrap" style="margin-top:14px;justify-content:flex-end">
            <button class="btn ghost" data-act="merge-dict" title="只补充用户字典（不影响单词本/错词）">仅导入字典</button>
            <button class="btn" data-act="replace">覆盖现有</button>
            <button class="btn primary" data-act="merge">合并</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    const close = () => { document.body.removeChild(modal); };
    modal.addEventListener('click', (e) => {
      if (e.target === modal) close();
      if (e.target.matches('[data-act=cancel]')) close();
    });

    // 仅导入字典（最安全：不动 books/wrongBook/progress）
    modal.querySelector('[data-act=merge-dict]').onclick = () => {
      close();
      if (!incUserDict) { toast('此备份不含用户字典，跳过'); return; }
      Object.assign(state.userDict, incUserDict);
      window.VocabData.setUserDict(state.userDict);
      persist();
      renderBooks();
      toast(`✅ 已合并 ${Object.keys(incUserDict).length} 个用户字典释义`);
    };

    // 覆盖现有（替换所有数据为导入内容，会清空当前所有进度）
    modal.querySelector('[data-act=replace]').onclick = () => {
      if (!confirm('覆盖模式会清空当前所有单词本、错词、进度，确定吗？')) {
        return;
      }
      close();
      applyImport({ books: incBooks, wrong: incWrong, userDict: incUserDict,
                    lastStudy: incLastStudy, lastSpell: incLastSpell, prefs: incPrefs },
                  /*merge=*/false);
    };

    // 合并（默认推荐：保留当前数据，导入缺失/新内容）
    modal.querySelector('[data-act=merge]').onclick = () => {
      close();
      applyImport({ books: incBooks, wrong: incWrong, userDict: incUserDict,
                    lastStudy: incLastStudy, lastSpell: incLastSpell, prefs: incPrefs },
                  /*merge=*/true);
    };
  }

  /** v5.9：删除单词本时，同步清理三个分片进度 map 里对它的引用 */
  function purgeBookFromProgressMaps(bookId) {
    const purge = (map, keyIsBook) => {
      if (!map) return;
      for (const k of Object.keys(map)) {
        if (keyIsBook(k, bookId)) { delete map[k]; continue; }
        const snap = map[k];
        if (snap && Array.isArray(snap.queue)) {
          const remaining = snap.queue.filter(it => !it.sourceBookId || it.sourceBookId !== bookId);
          if (!remaining.length) { delete map[k]; continue; }
          snap.queue = remaining;
          if ((snap.index || 0) >= remaining.length) snap.index = Math.max(0, remaining.length - 1);
        }
      }
    };
    purge(state.lastStudyMap, (k, id) => k === id || k === 'wrong|book:' + id || k === 'wrong');
    purge(state.lastSpellMap, (k, id) => k === 'book:' + id);
    purge(state.lastListenMap, (k, id) => k === 'book:' + id);
  }

  /** v5.9：把 incoming 的分片进度合并进 target（已存在的 key 不覆盖，保护本地进行中的进度） */
  function mergeProgressMap(target, incoming) {
    if (!incoming || typeof incoming !== 'object') return;
    for (const k of Object.keys(incoming)) {
      if (!target[k]) target[k] = incoming[k];
    }
  }

  // 真正把数据写入 state 并持久化、重新渲染
  function applyImport(payload, merge) {
    const { books: incBooks, wrong: incWrong, userDict, lastStudy, lastSpell, lastListen, prefs } = payload;

    // 1. 用户字典：永远合并
    if (userDict) {
      Object.assign(state.userDict, userDict);
      window.VocabData.setUserDict(state.userDict);
    }

    // 2. 单词本：合并模式按 id 去重（已有则跳过；同 id 不同内容优先保留已有的避免覆盖学习进度）
    const haveBookIds = new Set(state.books.map(b => b.id));
    if (merge) {
      let added = 0;
      for (const b of incBooks) {
        if (!b || !b.id) continue;
        if (haveBookIds.has(b.id)) continue;
        state.books.push(normalizeBook(b));
        added++;
      }
      if (added) toast(`✅ 已合并新增 ${added} 个单词本（同 id 的跳过，避免覆盖本地进度）`);
    } else {
      state.books = incBooks.map(normalizeBook);
    }

    // 3. 错词：合并模式按 word+srs.nextReview 去重，保留 correctCount 较大的
    if (merge) {
      const keyOf = w => `${(w.word||'').toLowerCase()}|${(w.srs && w.srs.nextReview) || 0}`;
      const m = new Map(state.wrongBook.map(w => [keyOf(w), w]));
      let added = 0, merged = 0;
      for (const w of incWrong) {
        if (!w || !w.word) continue;
        const k = keyOf(w);
        if (m.has(k)) {
          const cur = m.get(k);
          if ((w.correctCount || 0) > (cur.correctCount || 0)) {
            cur.correctCount = w.correctCount;
            merged++;
          }
          // sources 合并
          cur.sources = Array.from(new Set([...(cur.sources||[]), ...(w.sources||[])]));
        } else {
          state.wrongBook.push(normalizeWrong(w));
          m.set(k, state.wrongBook[state.wrongBook.length - 1]);
          added++;
        }
      }
      if (added || merged) toast(`✅ 错词：新增 ${added} 条，更新 ${merged} 条`);
    } else {
      state.wrongBook = incWrong.map(normalizeWrong);
    }
    // v6.1：补齐云端历史错词缺失的中文释义
    try {
      const fixed = healWrongMeanings();
      if (fixed > 0) toast(`🩹 已为 ${fixed} 条错词补回中文释义`);
    } catch (e) { console.warn('healWrongMeanings failed', e); }

    // 4. 进度：仅在本地为空时才接受导入的进度（避免覆盖当前进行中的状态）
    // v5.9：同时接收「按单词本分片」的进度 map（已有的分片不被覆盖）
    if (!state.lastStudy && stripMap(lastStudy)) state.lastStudy = stripMap(lastStudy);
    if (!state.lastSpell && stripMap(lastSpell)) state.lastSpell = stripMap(lastSpell);
    if (!state.lastListen && stripMap(lastListen)) state.lastListen = stripMap(lastListen);
    mergeProgressMap(state.lastStudyMap, readMap(lastStudy));
    mergeProgressMap(state.lastSpellMap, readMap(lastSpell));
    mergeProgressMap(state.lastListenMap, readMap(lastListen));

    // 5. 偏好：仅在本地无设置时采用
    if (prefs) {
      if (prefs.autoSpeak === false) state.autoSpeak = false;
      if (!state.wrongFilter && prefs.wrongFilter) state.wrongFilter = prefs.wrongFilter;
      if (!state.reviewFilter && prefs.reviewFilter) state.reviewFilter = prefs.reviewFilter;
      if (!state.activeBookId && prefs.activeBookId) state.activeBookId = prefs.activeBookId;
      if (!state.spellScope && prefs.spellScope) state.spellScope = prefs.spellScope;
      if (!state.listenScope && prefs.listenScope) state.listenScope = prefs.listenScope;
      if (prefs.wrongSessionScope) state.wrongSessionScope = prefs.wrongSessionScope;
      if (prefs.wrongCardMode) state.wrongCardMode = prefs.wrongCardMode;
    }

    persist();
    // 重新渲染所有 tab
    renderBooks();
    renderWrong();
    renderSpellInit();
    renderReview();
    renderDict();
    if (typeof renderStats === 'function') renderStats();
    toast('📥 导入完成。回到首页或「单词本」tab 即可看到新内容。');
  }

  function normalizeBook(b) {
    return {
      id: b.id || ('b_imp_' + Math.random().toString(36).slice(2, 10)),
      name: b.name || '导入的单词本',
      createdAt: b.createdAt || Date.now(),
      words: (b.words || []).map(w => ({
        word: w.word,
        type: w.type || window.VocabData.detectType(w.word),
        meaning: w.meaning || '',
        example: w.example || '',
        mastered: !!w.mastered,
        srs: w.srs || newSrsRecord(),
        addedAt: w.addedAt || Date.now()
      })),
      progress: { mastered: new Set(b.progress?.mastered || []) }
    };
  }

  /* v6.1：错词释义自愈
     云端存量 wrong_book 里有大量 meaning 为空的历史数据（表现为拼写/复习时不显示中文）。
     每次载入或导入后，从「单词本 → 用户字典 → 内置词库」逐级回填，只填空、不覆盖已有释义。 */
  function healWrongMeanings() {
    const index = Object.create(null);
    const put = (word, meaning) => {
      if (!word || !meaning) return;
      const k = String(word).toLowerCase();
      if (!index[k]) index[k] = String(meaning).trim();
    };
    for (const b of (state.books || [])) {
      for (const w of (b.words || [])) put(w.word, w.meaning);
    }
    try {
      const dict = state.userDict || {};
      for (const word of Object.keys(dict)) {
        const e = dict[word] || {};
        put(word, e.cn ? ((e.pos ? e.pos + ' ' : '') + e.cn) : null);
      }
    } catch (e) {}
    try {
      for (const w of (state.wrongBook || [])) put(w.word, w.meaning);
    } catch (e) {}

    let fixed = 0;
    for (const w of (state.wrongBook || [])) {
      if (w && !String(w.meaning || '').trim()) {
        const m = index[String(w.word).toLowerCase()];
        if (m) { w.meaning = m; fixed++; continue; }
        try {
          const e = window.VocabData && window.VocabData.lookup ? window.VocabData.lookup(w.word) : null;
          if (e && e.cn) { w.meaning = ((e.pos ? e.pos + ' ' : '') + e.cn).trim(); fixed++; }
        } catch (e) {}
      }
    }
    return fixed;
  }

  function normalizeWrong(w) {
    return {
      word: w.word,
      type: w.type || window.VocabData.detectType(w.word),
      entry: w.entry || {},
      correctCount: typeof w.correctCount === 'number' ? w.correctCount : 0,
      sources: Array.from(new Set(w.sources || [])),
      lastSeen: w.lastSeen || Date.now(),
      srs: w.srs || newSrsRecord()
    };
  }

  /* ---------- 6. 错词本 ---------- */
  function renderWrong() {
    // 渲染下拉
    const picker = $('#wrongBookPicker');
    if (picker) {
      const opts = ['<option value="all">📚 全部错词</option>'];
      for (const b of state.books) {
        const count = state.wrongBook.filter(w => w.sources && w.sources.includes(b.id) && (w.correctCount || 0) < 3).length;
        opts.push(`<option value="book:${b.id}">《${escapeHtml(b.name)}》(${count})</option>`);
      }
      const orphanCount = state.wrongBook.filter(w => !w.sources || !w.sources.length).length;
      opts.push(`<option value="orphans">📦 未归类（${orphanCount}）</option>`);
      picker.innerHTML = opts.join('');
      picker.value = state.wrongFilter || 'all';
      picker.onchange = () => {
        state.wrongFilter = picker.value;
        persist();
        renderWrong();
      };
    }

    // 按下拉过滤
    const filter = state.wrongFilter || 'all';
    const items = state.wrongBook.filter(w => {
      if ((w.correctCount || 0) >= 3) return false; // 已毕业的隐藏
      if (filter === 'all') return true;
      if (filter === 'orphans') return !w.sources || !w.sources.length;
      if (filter.startsWith('book:')) {
        const id = filter.slice(5);
        return w.sources && w.sources.includes(id);
      }
      return true;
    });

    // 更新「清空错词」按钮的文案，按当前过滤范围区分
    updateClearWrongButton(filter, items.length);

    // v5.9：让「开始复习错词」按钮明确显示将复习的范围
    const swBtn = $('#studyWrong');
    if (swBtn) {
      const label = wrongScopeLabel(filter);
      swBtn.textContent = items.length
        ? `开始复习错词（${label} · ${items.length}）`
        : `开始复习错词（${label}）`;
    }

    // 分组（按单词本），便于一眼看到"这本词本欠我多少"
    const groups = {};
    for (const w of items) {
      const groupKey = (w.sources && w.sources.length)
        ? w.sources.map(id => state.books.find(b => b.id === id)?.name || '已删除词本').join('、')
        : '未归类';
      if (!groups[groupKey]) groups[groupKey] = [];
      groups[groupKey].push(w);
    }
    const list = $('#wrongList');
    if (!items.length) {
      list.innerHTML = `<div class="muted">当前筛选下没有错词。每当你标记"不认识"就会出现在这里。</div>`;
      return;
    }

    const renderRow = (w) => {
      const e = w.entry || window.VocabData.lookup(w.word);
      const progress = Math.min(w.correctCount || 0, 3);
      const pct = (progress / 3) * 100;
      const typeTag = renderTypeTag(w.type || e.type || window.VocabData.detectType(w.word));
      const next = w.srs ? new Date(w.srs.nextReview).toLocaleDateString('zh-CN') : '—';
      return `
        <div class="wrong-row">
          <div>
            <div style="font-weight:600">
              ${Speech.button(w.word, { small: true })}
              <span style="margin-left:4px">${escapeHtml(w.word)}</span>
              ${typeTag}
              <span class="muted small" style="margin-left:6px">${escapeHtml(e.phonetic || '')}</span>
            </div>
            <div class="meta">${escapeHtml((e.pos || '') + (e.pos ? ' ' : '') + (e.cn || ''))}</div>
            <div class="meta small">下次复习：${next} · 阶梯 ${w.srs?.repetitions || 0}/${SRS_INTERVALS.length}</div>
          </div>
          <div class="row gap">
            <span class="progress-mini"><span style="width:${pct}%"></span></span>
            <span class="meta">${progress}/3</span>
            <button class="btn" data-act="edit" data-word="${escapeHtml(w.word)}">编辑</button>
            <button class="btn danger" data-act="del" data-word="${escapeHtml(w.word)}">移除</button>
          </div>
        </div>
      `;
    };

    // 全局 / 某本 → 是否分组渲染
    if (filter === 'all' && Object.keys(groups).length > 1) {
      list.innerHTML = Object.entries(groups).map(([g, arr]) => `
        <div style="grid-column:1/-1">
          <h3 class="muted" style="font-size:13px;margin:14px 0 6px">📕 ${escapeHtml(g)} <span class="muted small">${arr.length} 个</span></h3>
          <div class="grid">${arr.map(renderRow).join('')}</div>
        </div>
      `).join('');
    } else {
      list.innerHTML = items.map(renderRow).join('');
    }
    list.querySelectorAll('button[data-act]').forEach(btn => {
      btn.addEventListener('click', () => {
        const word = btn.dataset.word;
        const item = state.wrongBook.find(x => x.word === word);
        if (!item) return;
        if (btn.dataset.act === 'del') {
          state.wrongBook = state.wrongBook.filter(x => x.word !== word);
          persist();
          renderWrong();
        } else if (btn.dataset.act === 'edit') {
          openEditModal({
            word,
            meaning: `${item.entry?.pos || ''} ${item.entry?.cn || ''}`.trim(),
            example: item.entry?.example || '',
            scope: 'word'
          });
        }
      });
    });
  }

  function bindWrong() {
    $('#clearWrong').addEventListener('click', () => {
      const filter = state.wrongFilter || 'all';
      const count = state.wrongBook.filter(w => {
        if ((w.correctCount || 0) >= 3) return false;
        if (filter === 'all') return true;
        if (filter === 'orphans') return !w.sources || !w.sources.length;
        if (filter.startsWith('book:')) {
          const id = filter.slice(5);
          return w.sources && w.sources.includes(id);
        }
        return true;
      }).length;
      if (!count) { toast('当前范围没有可清空的错词'); return; }

      let confirmMsg;
      if (filter === 'all') {
        confirmMsg = `确定清空全部错词（${count} 个）？此操作不可撤销。`;
      } else if (filter === 'orphans') {
        confirmMsg = `确定清空未归类的错词（${count} 个）？其他单词本的错词不受影响。`;
      } else if (filter.startsWith('book:')) {
        const id = filter.slice(5);
        const book = state.books.find(b => b.id === id);
        const bookName = book ? `《${book.name}》` : '该单词本';
        // 计算多来源会被影响但不会被清掉的数量
        const multiSourceCount = state.wrongBook.filter(w =>
          w.sources && w.sources.includes(id) && w.sources.length > 1
        ).length;
        if (multiSourceCount > 0) {
          confirmMsg = `确定清空${bookName}的错词（${count} 个，含 ${multiSourceCount} 个多来源词 —— 会从这些词中移除「${bookName}」来源，但不会彻底删除这些词本身）？`;
        } else {
          confirmMsg = `确定清空${bookName}的错词（${count} 个）？其他单词本的错词不受影响。`;
        }
      }
      if (!confirm(confirmMsg)) return;

      if (filter === 'all') {
        state.wrongBook = [];
      } else if (filter === 'orphans') {
        state.wrongBook = state.wrongBook.filter(w => w.sources && w.sources.length > 0);
      } else if (filter.startsWith('book:')) {
        const id = filter.slice(5);
        state.wrongBook = state.wrongBook
          .map(w => {
            if (!w.sources || !w.sources.includes(id)) return w;
            const newSources = w.sources.filter(s => s !== id);
            if (newSources.length === 0) return null; // 移除该词
            return { ...w, sources: newSources };
          })
          .filter(Boolean);
      }

      persist();
      // 同步清理 lastSpell 里对已删词的依赖（如果当前词本所有词被清完）
      renderWrong();
      toast('已按当前范围清空错词');
    });
  }

  /** 根据当前过滤范围，动态更新"清空错词本"按钮的文案，避免误操作 */
  function updateClearWrongButton(filter, count) {
    const btn = $('#clearWrong');
    if (!btn) return;
    let label;
    if (filter === 'all') {
      label = `🧹 清空全部错词（${count}）`;
    } else if (filter === 'orphans') {
      label = `🧹 清空未归类（${count}）`;
    } else if (filter.startsWith('book:')) {
      const id = filter.slice(5);
      const book = state.books.find(b => b.id === id);
      const name = book ? `《${book.name}》` : '该单词本';
      label = `🧹 清空${name}（${count}）`;
    } else {
      label = '🧹 清空错词本';
    }
    btn.textContent = label;
    btn.disabled = count === 0;
  }

  /* ---------- 7. AI 文章生成 ---------- */
  function renderArticleSelect() {
    const sel = $('#articleBookSelect');
    if (!state.books.length) {
      sel.innerHTML = `<option value="">— 暂无单词本 —</option>`;
      $('#articleOut').innerHTML = `<div class="placeholder">还没有单词本，请先去首页导入词汇。</div>`;
      return;
    }
    sel.innerHTML = state.books
      .map(b => `<option value="${b.id}">${escapeHtml(b.name)} (${b.words.length})</option>`)
      .join('');
  }

  function bindArticle() {
    $('#generateArticle').addEventListener('click', generate);
  }

  /* =====================================================
     12. 拼写平台
     ===================================================== */

  /** 收集某来源下的拼写条目（带 SRS） */
  function collectSpellItems(scope) {
    const items = [];

    function pushItem(word, type, source) {
      const key = window.VocabData.normalizeKey(word);
      // 去重（同一词多次出现时优先取更新的）
      if (items.find(x => x.word === key)) return;
      const entry = window.VocabData.lookup(word);
      const srs = source.srs ? JSON.parse(JSON.stringify(source.srs)) : newSrsRecord();
      // 释义：优先源数据里用户填的 meaning（排除占位符）→ 从单词本反查 → DICT 拼装
      let meaning = (source.meaning || '').trim();
      if (isPlaceholderMeaning(meaning)) meaning = '';
      if (!meaning) {
        const preferredBookId = source.sourceBookId;
        const booksToSearch = preferredBookId
          ? [state.books.find(b => b.id === preferredBookId)].filter(Boolean)
          : state.books;
        for (const b of booksToSearch) {
          const it = b.words.find(w => window.VocabData.normalizeKey(w.word) === key);
          if (it && it.meaning && !isPlaceholderMeaning(it.meaning)) { meaning = it.meaning.trim(); break; }
        }
      }
      if (!meaning) meaning = `${(entry && entry.pos) || ''} ${(entry && entry.cn) || ''}`.trim();
      items.push({
        word,
        key,
        type,
        entry,
        srs,
        sourceBookId: source.sourceBookId,
        wrong: source.wrong || null,
        meaning
      });
    }

    if (scope === 'due') {
      // 今日到期 = 所有 nextReview <= now + 1天的词
      //   - 涵盖今天到期的（艾宾浩斯到点）
      //   - 涵盖明天到期的（保证新词 / 错词也立刻能拼）
      const now = Date.now();
      const horizon = now + 1 * DAY_MS;
      // 1. 错词本未毕业的词（最优先）
      for (const w of state.wrongBook) {
        if ((w.correctCount || 0) >= 3) continue;
        if (!w.srs) w.srs = newSrsRecord();
        if (w.srs.nextReview <= horizon) pushItem(w.word, w.type, {
          srs: w.srs, sourceBookId: null, wrong: w, meaning: w.meaning
        });
      }
      // 2. 单词本里已掌握但到期的（用于长期巩固）
      for (const b of state.books) {
        for (const w of b.words) {
          if (!b.progress.mastered.has(w.word)) continue;
          ensureSrs(w);
          if (w.srs.nextReview <= horizon) pushItem(w.word, w.type, {
            srs: w.srs, sourceBookId: b.id, meaning: w.meaning
          });
        }
      }
      // 3. 单词本里未掌握且到期的
      for (const b of state.books) {
        for (const w of b.words) {
          if (b.progress.mastered.has(w.word)) continue;
          ensureSrs(w);
          if (w.srs.nextReview <= horizon) pushItem(w.word, w.type, {
            srs: w.srs, sourceBookId: b.id, meaning: w.meaning
          });
        }
      }
    } else if (scope === 'wrong') {
      for (const w of state.wrongBook) {
        if ((w.correctCount || 0) >= 3) continue;
        if (!w.srs) w.srs = newSrsRecord();
        pushItem(w.word, w.type, { srs: w.srs, sourceBookId: null, wrong: w, meaning: w.meaning });
      }
    } else if (scope.startsWith('book:')) {
      const id = scope.slice(5);
      const b = state.books.find(x => x.id === id);
      if (b) {
        for (const w of b.words) {
          ensureSrs(w);
          pushItem(w.word, w.type, { srs: w.srs, sourceBookId: b.id, meaning: w.meaning });
        }
      }
    } else if (scope === 'all') {
      for (const b of state.books) for (const w of b.words) {
        ensureSrs(w);
        pushItem(w.word, w.type, { srs: w.srs, sourceBookId: b.id, meaning: w.meaning });
      }
      for (const w of state.wrongBook) {
        if ((w.correctCount || 0) >= 3) continue;
        if (!w.srs) w.srs = newSrsRecord();
        pushItem(w.word, w.type, { srs: w.srs, sourceBookId: null, wrong: w, meaning: w.meaning });
      }
    }

    // 排序：到期越早排前（同时间 SRS 阶梯低的先）
    items.sort((a, b) => a.srs.nextReview - b.srs.nextReview);
    return items;
  }

  function spellSourceLabel(scope) {
    if (scope === 'due') return '今日到期（SRS）';
    if (scope === 'wrong') return '错词本（未毕业）';
    if (scope === 'all') return '全部条目';
    if (scope.startsWith('book:')) {
      const b = state.books.find(x => x.id === scope.slice(5));
      return b ? `《${b.name}》` : '（词本已删除）';
    }
    return scope;
  }

  /** 用保存的快照重建拼写队列；返回 null 表示无法完整还原 */
  function rebuildSpellItems(snapshot) {
    if (!snapshot || !Array.isArray(snapshot.queue) || !snapshot.queue.length) return null;
    const rebuilt = snapshot.queue.map(q => {
      if (!q || !q.word) return null;
      const entry = window.VocabData.lookup(q.word);
      // 合并最新的 srs 信息（如果在单词本/错词本里仍然存在）
      let liveSrs = q.srs;
      let wrong = null;
      let sourceBookId = q.sourceBookId;
      if (q.sourceBookId) {
        const b = state.books.find(x => x.id === q.sourceBookId);
        if (b) {
          const item = b.words.find(w => window.VocabData.normalizeKey(w.word) === window.VocabData.normalizeKey(q.word));
          if (item && item.srs) liveSrs = item.srs;
        }
      } else {
        wrong = state.wrongBook.find(w => window.VocabData.normalizeKey(w.word) === window.VocabData.normalizeKey(q.word)) || null;
        if (wrong && wrong.srs) liveSrs = wrong.srs;
      }
      // 释义：优先用保存的（排除占位符）→ 从错词本/单词本反查最新 → entry 拼装
      let meaning = (q.meaning || '').trim();
      if (isPlaceholderMeaning(meaning)) meaning = '';
      if (!meaning && wrong && wrong.meaning && !isPlaceholderMeaning(wrong.meaning)) {
        meaning = wrong.meaning.trim();
      }
      if (!meaning) {
        const srcBook = state.books.find(x => x.id === q.sourceBookId);
        const srcWord = srcBook && srcBook.words.find(w => window.VocabData.normalizeKey(w.word) === window.VocabData.normalizeKey(q.word));
        if (srcWord && srcWord.meaning && !isPlaceholderMeaning(srcWord.meaning)) meaning = srcWord.meaning.trim();
      }
      if (!meaning) {
        for (const b of state.books) {
          const it = b.words.find(w => window.VocabData.normalizeKey(w.word) === window.VocabData.normalizeKey(q.word));
          if (it && it.meaning && !isPlaceholderMeaning(it.meaning)) { meaning = it.meaning.trim(); break; }
        }
      }
      if (!meaning) meaning = `${(entry && entry.pos) || ''} ${(entry && entry.cn) || ''}`.trim();
      const item = {
        word: q.word,
        key: q.key || window.VocabData.normalizeKey(q.word),
        type: q.type || entry.type || window.VocabData.detectType(q.word),
        entry,
        srs: liveSrs || newSrsRecord(),
        sourceBookId,
        wrong,
        meaning
      };
      // 恢复上次答题结果，确保刷新后仍能看到正确答案
      if (q._lastOk !== undefined) item._lastOk = q._lastOk;
      if (q._userInput !== undefined) item._userInput = q._userInput;
      return item;
    }).filter(Boolean);
    if (rebuilt.length !== snapshot.queue.length) return null;
    return rebuilt;
  }

  /** 尝试恢复某个 scope 的拼写进度（v5.9：每个单词本 / 来源各自保存） */
  function tryRestoreSpell(scope) {
    if (!scope) return false;
    const snap = (state.lastSpellMap && state.lastSpellMap[scope])
      || (state.lastSpell && state.lastSpell.scope === scope ? state.lastSpell : null);
    const items = rebuildSpellItems(snap);
    if (!items || !items.length) return false;
    const idx = Math.min(snap.index || 0, items.length - 1);
    if (idx < 0) return false;
    state.spellScope = scope;
    state.spellQueue = items;
    state.spellIndex = idx;
    state.spellAnswered = !!snap.answered;
    state.spellSource = spellSourceLabel(scope);
    state._spellSpeakOnNext = false; // 恢复进度时不再重播
    return true;
  }

  /** 切换拼写范围：有历史进度就恢复，没有才开始新一轮 */
  function goSpellScope(scope, sel) {
    state.spellScope = scope;
    if (sel) sel.value = scope;
    if (tryRestoreSpell(scope)) {
      persist(); // 记住本次选择的范围，刷新后可直接续上
      renderSpellCard();
      toast(`↩ 已恢复「${spellSourceLabel(scope)}」的拼写进度`);
    } else {
      startSpellScope(scope);
    }
  }

  function renderSpellInit() {
    // 渲染模式 select 与初始界面
    const sel = $('#spellScopeSelect');
    const opts = ['<option value="due">今日到期（SRS）</option>',
      '<option value="wrong">错词本（未毕业）</option>',
      '<option value="all">全部条目</option>'];
    for (const b of state.books) {
      opts.push(`<option value="book:${b.id}">《${escapeHtml(b.name)}》</option>`);
    }
    sel.innerHTML = opts.join('');

    $('#spellRefresh').onclick = () => {
      state.spellScope = sel.value;
      startSpellScope(state.spellScope); // 明确「重新生成队列」
    };
    sel.onchange = () => goSpellScope(sel.value, sel);

    if (!state.spellScope) state.spellScope = 'due';
    sel.value = state.spellScope;

    // 单词本快速选择下拉
    const picker = $('#spellBookPicker');
    picker.innerHTML = state.books
      .map(b => `<option value="${b.id}">${escapeHtml(b.name)} (${b.words.length})</option>`)
      .join('');
    if (state.activeBookId && picker.querySelector(`option[value="${state.activeBookId}"]`)) {
      picker.value = state.activeBookId;
    } else if (state.spellScope?.startsWith('book:')) {
      const id = state.spellScope.slice(5);
      if (picker.querySelector(`option[value="${id}"]`)) picker.value = id;
    }
    $('#spellBookGo').onclick = () => {
      const id = picker.value;
      if (!id) { toast('请先选择一个单词本'); return; }
      goSpellScope('book:' + id, sel);
    };

    // 快捷按钮
    $all('[data-spell-scope]').forEach(btn => {
      btn.onclick = () => goSpellScope(btn.dataset.spellScope, sel);
    });

    // v5.9：恢复「当前 scope」的拼写进度（每个单词本各自保存，切换不丢）
    if (tryRestoreSpell(state.spellScope)) {
      sel.value = state.spellScope;
      renderSpellCard();
      return;
    }
    renderSpellLanding();
  }

  function renderSpellLanding() {
    const items = collectSpellItems(state.spellScope);
    const total = items.length;
    const today = new Date().toDateString();
    const dueToday = collectSpellItems('due').length;

    $('#spellTitle').textContent = '拼写训练';
    $('#spellSub').textContent = `当前来源：${spellSourceLabel(state.spellScope)} · 共 ${total} 条`;
    $('#spellInfoBar').innerHTML = `
      <div class="row between wrap gap" style="font-size:13px">
        <div>今天到期（艾宾浩斯）：<b style="color:var(--warning)">${dueToday}</b> 个</div>
        <div>本次拼写规模：<b>${total}</b> 个</div>
        <div class="muted">拼写错的词会自动加入<b>错词本</b>，下次优先级最高；连续对 3 次才毕业。</div>
      </div>
    `;

    const area = $('#spellArea');
    if (!total) {
      area.innerHTML = `
        <div class="study-empty">
          <div class="icon">📭</div>
          <h3>当前来源里没有可拼写条目</h3>
          <p>先把词汇导入单词本，或切换到「错词本 / 全部条目」开始拼写。</p>
        </div>`;
      return;
    }

    area.innerHTML = `
      <div class="study-empty">
        <div class="icon">✍️</div>
        <h3>准备好开始拼写</h3>
        <p>输入前<b>不显示中文/英文提示</b>，纯靠听音或回忆拼写；提交后若拼错，会立即揭示正确答案、中文释义与例句，并自动加入错词本。</p>
        <div style="margin-top:18px"><button class="btn primary" id="startSpellNow">开始拼写这 ${total} 个</button></div>
      </div>`;
    $('#startSpellNow').onclick = () => startSpellScope(state.spellScope);
  }

  function startSpellScope(scope) {
    state.spellScope = scope || 'due';
    const items = collectSpellItems(state.spellScope);
    state.spellQueue = items;
    state.spellIndex = 0;
    state.spellAnswered = false;
    state.spellSource = spellSourceLabel(state.spellScope);
    state._spellSpeakOnNext = true; // 让首题自动读音
    saveLastSpell();

    // 切到 spell tab
    $all('.tab').forEach(t => t.classList.remove('active'));
    $('.tab[data-tab="spell"]').classList.add('active');
    $all('.panel').forEach(p => p.classList.remove('active'));
    $('#panel-spell').classList.add('active');

    const sel = $('#spellScopeSelect');
    if (sel && !sel.value) {
      const opts = ['due', 'wrong', 'all'];
      for (const b of state.books) opts.push(`book:${b.id}`);
      sel.innerHTML = opts.map(v => {
        const label = v === 'due' ? '今日到期（SRS）'
          : v === 'wrong' ? '错词本（未毕业）'
          : v === 'all' ? '全部条目'
          : state.books.find(b => `book:${b.id}` === v)?.name || v;
        return `<option value="${v}">${escapeHtml(label)}</option>`;
      }).join('');
    }
    if (sel) sel.value = state.spellScope;

    if (!items.length) {
      renderSpellLanding();
      return;
    }
    renderSpellCard();
  }

  /** 保存当前拼写进度到 state.lastSpell（最近一次）+ lastSpellMap（按范围分片）并 persist */
  function saveLastSpell() {
    const snapshot = {
      scope: state.spellScope,
      // 保存完整队列（包含 srs / meaning / 答题结果），恢复时不依赖 collectSpellItems 排序
      queue: state.spellQueue.map(w => ({
        word: w.word,
        key: w.key,
        type: w.type,
        sourceBookId: w.sourceBookId,
        meaning: w.meaning || '',
        srs: w.srs ? JSON.parse(JSON.stringify(w.srs)) : null,
        _lastOk: w._lastOk,
        _userInput: w._userInput
      })),
      index: state.spellIndex,
      answered: !!state.spellAnswered
    };
    state.lastSpell = snapshot;
    // v5.9：按 scope 分片保存 —— 每个单词本 / 每个来源的进度互不覆盖
    if (state.spellScope) {
      state.lastSpellMap[state.spellScope] = JSON.parse(JSON.stringify(snapshot));
    }
    persist();
  }

  function normalizeForCompare(s) {
    return String(s || '')
      .toLowerCase()
      // 去除所有标点和空白，统一比较
      .replace(/[\s\u3000.,!?;:'"\-()\[\]{}，。！？；：""''（）【】]/g, '')
      .replace(/\s+/g, '');
  }

  function renderSpellCard() {
    if (state.spellIndex >= state.spellQueue.length) {
      const right = state.spellQueue.filter(x => x._lastOk).length;
      const wrong = state.spellQueue.length - right;
      $('#spellTitle').textContent = '拼写完成';
      $('#spellSub').textContent = `共 ${state.spellQueue.length} 个 · 对 ${right} · 错 ${wrong}`;
      $('#spellInfoBar').innerHTML = right === state.spellQueue.length
        ? `<div style="color:var(--success)">🎉 全部正确！这次没有需要复习的。</div>`
        : `<div>错词已自动加入错词本，下次到期会再来找你。</div>`;
      $('#spellArea').innerHTML = `
        <div class="study-empty">
          <div class="icon">✅</div>
          <h3>本轮拼写完成</h3>
          <p>对 <b style="color:var(--success)">${right}</b> · 错 <b style="color:var(--danger)">${wrong}</b></p>
          <div style="margin-top:18px" class="row gap">
            <button class="btn primary" id="respellFailed">再练一遍错的（${wrong}）</button>
            <button class="btn" id="spellExit">退出到单词本</button>
          </div>
        </div>
      `;
      $('#respellFailed').onclick = () => {
        const failed = state.spellQueue.filter(x => !x._lastOk);
        if (!failed.length) { toast('都对了，无需重练'); return; }
        state.spellQueue = failed;
        state.spellIndex = 0;
        state.spellAnswered = false;
        renderSpellCard();
      };
      $('#spellExit').onclick = () => {
        $all('.tab').forEach(t => t.classList.remove('active'));
        $('.tab[data-tab="study"]').classList.add('active');
        $all('.panel').forEach(p => p.classList.remove('active'));
        $('#panel-study').classList.add('active');
        renderStudy();
      };
      return;
    }

    const w = state.spellQueue[state.spellIndex];
    const entry = w.entry;
    const total = state.spellQueue.length;
    const pct = (state.spellIndex / total) * 100;
    const typeTag = renderTypeTag(w.type);

    // 拼装释义：用户导入的 meaning → DICT 拼装 → 兜底
    let correctMeaning = (w.meaning || '').trim();
    if (!correctMeaning) {
      correctMeaning = `${(entry && entry.pos) || ''} ${(entry && entry.cn) || ''}`.trim();
    }
    // 兜底释义如果是 DICT 占位符，视为空
    const hasMeaning = correctMeaning && !isPlaceholderMeaning(correctMeaning);
    if (!hasMeaning) correctMeaning = '';
    const phoneticText = (entry && entry.phonetic) || '';
    const exampleText = (entry && entry.example) || w.example || '';
    // 拼写时的提示（仅在不揭示答案时显示，不暴露单词 / 释义）
    const typeHint = w.type === 'sentence' ? '请拼写下面的英文句子'
      : w.type === 'phrase' ? '请拼写下面的英文短语（保留空格）'
      : '请拼写下面的英文单词';

    $('#spellTitle').textContent = '拼写训练';
    $('#spellSub').textContent = `来源：${state.spellSource} · ${state.spellIndex + 1} / ${total}`;
    $('#spellInfoBar').innerHTML = `
      <div class="row between wrap gap" style="font-size:13px">
        <div>来源：<b>${escapeHtml(state.spellSource)}</b></div>
        <div>SRS：第 ${w.srs.repetitions || 0} 阶梯，下次复习 ${new Date(w.srs.nextReview).toLocaleDateString('zh-CN')}</div>
      </div>
    `;

    $('#spellArea').innerHTML = `
      <div class="progress-bar"><span style="width:${pct.toFixed(1)}%"></span></div>
      <div class="flashcard spell-card" data-state="${state.spellAnswered ? 'answered' : 'pending'}">
        <div class="card-actions">
          ${Speech.button(w.word, { small: true })}
          <button class="edit-btn" id="spellSpeakAgain" title="再读一次">🔁 朗读</button>
        </div>
        <div class="progress">${state.spellIndex + 1} / ${total}</div>

        <!-- 未答时：完全盲打白板（不显示单词 / 中文释义 / 音标 / 例句） -->
        ${!state.spellAnswered ? `
          <div class="spell-blank-stage">
            <div class="blank-icon">🎧</div>
            <div class="blank-hint">${escapeHtml(typeHint)}</div>
            <button class="btn-listen-big" id="spellPlayMain" type="button">
              <span class="play-glyph">▶</span>
              <span class="play-label">播放发音</span>
            </button>
            ${state.autoSpeak
              ? `<div class="auto-speak-tag muted small">已开启自动播放 · 关闭：Ctrl/Cmd+Shift+S</div>`
              : `<div class="muted small">点上方按钮听音后输入英文</div>`}
          </div>
        ` : ''}

        <!-- 答题后的揭示区 -->
        ${state.spellAnswered ? `
          <div class="spell-reveal ${w._lastOk ? 'is-correct' : 'is-wrong'}">
            ${w._lastOk
              ? `
                <div class="reveal-banner ok-banner">
                  <span class="ok-text">✓ 拼写正确</span>
                  <span class="muted small" style="margin-left:8px">${(w.srs.interval || 0) > 0 ? `${escapeHtml(String(w.srs.interval))} 天后复习` : '明天复习'}</span>
                </div>
                <div class="reveal-correct">
                  <span class="muted small">你的答案：</span>
                  <span class="ok-text">${escapeHtml(w._userInput || w.word)}</span>
                </div>
              `
              : `
                <div class="reveal-banner wrong-banner">
                  <span class="bad-text">✗ 拼错，已加入错题本</span>
                  ${w._userInput ? `<span class="muted small" style="margin-left:8px">你写的是：<b class="bad-text">${escapeHtml(w._userInput)}</b></span>` : ''}
                </div>
                <div class="reveal-correct reveal-correct-wrong">
                  <span class="reveal-label">正确答案</span>
                  <span class="correct-word">${escapeHtml(w.word)}</span>
                  ${Speech.button(w.word, { small: true })}
                </div>
              `
            }
            <!-- 中文释义：错时着重显示，对时也展示 -->
            <div class="reveal-meaning-block ${w._lastOk ? '' : 'is-wrong-meaning'} ${correctMeaning ? '' : 'is-empty-meaning'}">
              <div class="meaning-label muted small">${w._lastOk ? '中文释义' : '中文释义（订正）'}</div>
              <div class="meaning-line">${correctMeaning ? escapeHtml(correctMeaning) : '<span class="muted">📝 这个词还没导入释义。请去 <b>单词本</b> 找到它，点右侧 ✎ 按钮补上中文。</span>'}</div>
              ${phoneticText ? `<div class="phonetic">/${escapeHtml(phoneticText)}/</div>` : ''}
              ${exampleText ? `<div class="example muted small">例：${escapeHtml(exampleText)}</div>` : ''}
            </div>
          </div>
        ` : ''}

        <input id="spellInput" class="input spell-input" type="text" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="${state.spellAnswered ? (w._lastOk ? '（已拼对）' : '请改正后按 Enter 提交...') : '在这里输入英文...'}" value="${state.spellAnswered ? escapeHtml(w._userInput || '') : ''}" />
        ${state.spellAnswered ? `
          <div class="actions">
            ${w._lastOk
              ? `<button class="btn primary" id="spellNext"><kbd>Enter</kbd> 下一题 →</button>`
              : `<button class="btn ghost" id="spellRetry">✏ 改正 ↩</button> <button class="btn primary" id="spellNext"><kbd>Enter</kbd> 下一题 →</button>`}
          </div>
          <div class="muted small spell-hint">${w._lastOk ? `⌨ <kbd>Enter</kbd> = 下一题` : `⌨ <kbd>Enter</kbd> = 下一题 · <b>改正</b> 后再回车则判定这次答得对不对，<span style="color:var(--success)">连续答对 3 次即可从错题本毕业</span>`}</div>
        ` : `
          <div class="spell-feedback" id="spellFeedback"></div>
          <div class="actions">
            <button class="btn primary" id="spellCheck" type="button"><kbd>Enter</kbd> 提交 ✍️</button>
          </div>
          <div class="muted small spell-hint">⌨ <kbd>Enter</kbd> = 提交（空输入也会算错并加入错题本）</div>
        `}
      </div>
    `;

    // 自动朗读（英式）+ 自动聚焦输入框。自动朗读可关闭：Ctrl/Cmd+Shift+S
    // 不放 setTimeout 包裹 speak：保持用户点击栈内的 user activation（Chrome 才有声音）
    // 但仅在切到拼写 tab 或开始新题时才放声，恢复进度时不重复播
    // v6：音频跟随词卡 —— 必须先"换词即停 + 登记新词"，再决定要不要朗读
    // 拼写模式下不自动朗读（会剧透答案），仅在新题开始时按开关朗读
    if (state.spellAnswered) {
      // 已经揭晓答案 → 停止发音（单词"消失"了，声音也跟着消失）
      endCardAudio();
    } else {
      syncCardAudio(w.word, { silent: true });
      if (state._spellSpeakOnNext) {
        state._spellSpeakOnNext = false;
        if (state.autoSpeak) manualSpeak(w.word);
      }
    }
    const _inp = $('#spellInput');
    if (_inp && !state.spellAnswered) _inp.focus();

    // 顶部 / 白板区域的播放按钮
    $('#spellSpeakAgain').onclick = () => manualSpeak(w.word);
    const _playMain = $('#spellPlayMain');
    if (_playMain) _playMain.onclick = () => manualSpeak(w.word);

    const onCheck = () => {
      const v = $('#spellInput').value;
      // 空输入也算错：保证拼错就加入错题本
      const isRetry = state.spellAnswered && w._hasJudged;  // 是否"改正模式"提交
      state.spellAnswered = true;
      w._hasJudged = true;
      const ok = v.trim() !== '' && normalizeForCompare(v) === normalizeForCompare(w.word);
      w._lastOk = ok;
      w._userInput = v;
      // 同步 SRS / 错词本
      if (ok) {
        nextReviewAfter(w.srs, true);
        w.srs.lastReviewed = Date.now();
        // 先回写 w.wrong 引用（如果是改正模式答对，要累计错题本累计值；如果是首次答对，状态也已经存在）
        if (!w.wrong) {
          w.wrong = state.wrongBook.find(x => x.word === w.word) || null;
        }
        // 如果在错词本里：累计 +1，并回填释义（防止旧数据 meaning 为空）
        if (w.wrong) {
          w.wrong.correctCount = (w.wrong.correctCount || 0) + 1;
          w.wrong.lastSeen = Date.now();
          ensureSrs(w.wrong);
          nextReviewAfter(w.wrong.srs, true);
          if (!w.wrong.meaning || isPlaceholderMeaning(w.wrong.meaning)) {
            let m = (w.meaning || '').trim();
            if (isPlaceholderMeaning(m)) m = '';
            if (!m && w.sourceBookId) {
              const b = state.books.find(x => x.id === w.sourceBookId);
              const it = b && b.words.find(x => window.VocabData.normalizeKey(x.word) === w.key);
              if (it && it.meaning && !isPlaceholderMeaning(it.meaning)) m = it.meaning.trim();
            }
            if (!m) {
              for (const b of state.books) {
                const it = b.words.find(x => window.VocabData.normalizeKey(x.word) === w.key);
                if (it && it.meaning && !isPlaceholderMeaning(it.meaning)) { m = it.meaning.trim(); break; }
              }
            }
            if (m) w.wrong.meaning = m;
          }
          if (w.wrong.correctCount >= 3) {
            state.wrongBook = state.wrongBook.filter(x => x.word !== w.word);
            toast(`「${w.word}」已从错词本毕业！`);
            w.wrong = null;
          }
        }
        // 同步到单词本里的 srs（如该词出自某本）
        for (const b of state.books) {
          const item = b.words.find(it => window.VocabData.normalizeKey(it.word) === w.key);
          if (item) {
            ensureSrs(item);
            nextReviewAfter(item.srs, true);
            item.srs.lastReviewed = Date.now();
          }
        }
      } else {
        nextReviewAfter(w.srs, false);
        w.srs.lastReviewed = Date.now();
        // 进入错词本（首次错时新增，已存在则合并 sources）
        addToWrongBook(w.word, w.type, w.sourceBookId, w.meaning);
        // 关键修复：回写 w.wrong 引用，让"重答答对"时能累计 correctCount 直至毕业
        w.wrong = state.wrongBook.find(x => x.word === w.word);
        if (w.wrong) {
          w.wrong.correctCount = 0;
          w.wrong.lastSeen = Date.now();
          ensureSrs(w.wrong);
          nextReviewAfter(w.wrong.srs, false);
        }
        // 同步单词本里的 srs
        for (const b of state.books) {
          const item = b.words.find(it => window.VocabData.normalizeKey(it.word) === w.key);
          if (item) {
            ensureSrs(item);
            nextReviewAfter(item.srs, false);
            item.srs.lastReviewed = Date.now();
          }
        }
      }
      w._retryCount = (w._retryCount || 0) + (isRetry ? 1 : 0);
      persist();
      saveLastSpell();
      // 改正模式答对后，保留揭示一会儿让用户看清反馈；如果还想再练可继续改正
      const wasInRetry = !!w._inRetry;
      if (wasInRetry) w._inRetry = false;
      renderSpellCard();
      if (wasInRetry && ok) {
        toast(`✓ 改正成功 · 错词累计 ${w.wrong ? `${w.wrong.correctCount}/3 次` : '已记录'} · 按 Enter 下一题`);
      }
    };

    const doSkip = () => {
      // 跳过 = 算"标错"，进入错词本
      state.spellAnswered = true;
      w._lastOk = false;
      w._userInput = '';
      nextReviewAfter(w.srs, false);
      addToWrongBook(w.word, w.type, w.sourceBookId, w.meaning);
      for (const b of state.books) {
        const item = b.words.find(it => window.VocabData.normalizeKey(it.word) === w.key);
        if (item) { ensureSrs(item); nextReviewAfter(item.srs, false); }
      }
      persist();
      saveLastSpell();
      renderSpellCard();
    };

    const goNext = () => {
      state.spellIndex++;
      state.spellAnswered = false;
      state._spellSpeakOnNext = true;
      // 新题没有改正模式
      const nextW = state.spellQueue[state.spellIndex];
      if (nextW) nextW._inRetry = false;
      saveLastSpell();
      renderSpellCard();
    };

    if (!state.spellAnswered) {
      $('#spellCheck').onclick = onCheck;
      const inputEl = $('#spellInput');
      inputEl.onkeydown = (e) => {
        if (e.key === 'Enter') {
          // 关键：阻止冒泡到 window 监听器，避免被错误地再走一次 goNext
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          onCheck();
        }
      };
      // 兜底：window 级 Enter 监听（防止焦点丢失）
      if (!window._spellEnterBound) {
        window._spellEnterBound = true;
        window.addEventListener('keydown', (e) => {
          if (e.key !== 'Enter') return;
          // 只在拼写 tab 激活时生效
          const spellTab = document.querySelector('.tab[data-tab="spell"]');
          if (!spellTab || !spellTab.classList.contains('active')) return;
          // 避免和 input 的 onkeydown 重复触发：仅当焦点不在 input 上时
          const ae = document.activeElement;
          if (ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA')) return;
          // 屏蔽：用户在按按钮的时候
          if (ae && (ae.tagName === 'BUTTON')) return;
          // 进入处理
          if (state.spellIndex >= state.spellQueue.length) return;
          if (state.spellAnswered) {
            // 已答：Enter = 下一题
            e.preventDefault();
            goNext();
          } else {
            // 未答：Enter = 提交 / 跳过（onCheck 内部处理）
            e.preventDefault();
            onCheck();
          }
        });
      }
    } else {
      $('#spellNext').onclick = goNext;
      const inputEl2 = $('#spellInput');
      // 改正模式：Enter = 提交重判（不是下一题）
      if (inputEl2) {
        inputEl2.onkeydown = (e) => {
          if (e.key === 'Enter') {
            // 关键：阻止冒泡到 window 监听器，避免被错误地当成"下一题"
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            onCheck();
          }
        };
      }
      // 改正按钮：不清空 reveal 信息，只清空输入框让用户对照正确答案改正
      $('#spellRetry').onclick = () => {
        w._userInput = '';
        w._inRetry = true;
        // 标记进入"改正模式"：保留 answered，保留揭示信息，提示用户改正
        renderSpellCard();
        // 自动聚焦 + 朗读正确答案（提示对照）
        setTimeout(() => {
          const inp = $('#spellInput');
          if (inp) {
            inp.focus();
            manualSpeak(w.word);
          }
        }, 60);
      };
    }
  }

  /* =====================================================
     12.5 听音辨义 —— 只放声音 + 认识 / 不认识 + 揭示后可重判
     ===================================================== */
  // 收集听音队列（与拼写类似：book:<id> / wrong / all）
  function collectListenItems(scope) {
    const items = [];
    const seen = new Set();
    // 拼装最终释义：优先用户导入时填的 meaning，其次查 DICT
    const composeMeaning = (word, srcMeaning) => {
      const src = (srcMeaning || '').trim();
      if (src) return src;
      const e = window.VocabData.lookup(word) || {};
      return `${e.pos || ''} ${e.cn || ''}`.trim();
    };
    const push = (word, bookId, srs, type, srcMeaning) => {
      const k = (word || '').toLowerCase();
      if (!k || seen.has(k)) return;
      seen.add(k);
      const entry = window.VocabData.lookup(word) || {};
      items.push({
        word,
        key: k,
        sourceBookId: bookId,
        srs: srs || newSrsRecord(),
        type: type || window.VocabData.detectType(word),
        meaning: composeMeaning(word, srcMeaning),
        entry
      });
    };

    if (scope === 'wrong') {
      for (const w of state.wrongBook) {
        if ((w.correctCount || 0) >= 3) continue;
        const bookId = (w.sources || [])[0] || null;
        push(w.word, bookId, w.srs, w.type, w.meaning);
      }
    } else if (scope === 'all') {
      for (const b of state.books) {
        for (const w of b.words) {
          if (b.progress?.mastered?.has?.(w.word)) continue;
          push(w.word, b.id, w.srs, w.type, w.meaning);
        }
      }
    } else if (typeof scope === 'string' && scope.startsWith('book:')) {
      const bookId = scope.slice(5);
      const book = state.books.find(b => b.id === bookId);
      if (book) {
        for (const w of book.words) {
          if (book.progress?.mastered?.has?.(w.word)) continue;
          push(w.word, book.id, w.srs, w.type, w.meaning);
        }
      }
    }

    // 随机打乱，让听音更像真实测试
    for (let i = items.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [items[i], items[j]] = [items[j], items[i]];
    }
    return items;
  }

  function saveLastListen() {
    // 仅保存元数据，恢复时按 word 反查
    const snapshot = state.listenQueue.length ? {
      scope: state.listenScope,
      index: state.listenIndex,
      answered: state.listenAnswered,
      queue: state.listenQueue.map(it => ({
        word: it.word,
        key: it.key,
        sourceBookId: it.sourceBookId
      }))
    } : null;
    state.lastListen = snapshot;
    // v5.9：按 scope 分片保存 —— 换单词本再换回来，听音进度仍在
    if (snapshot && state.listenScope) {
      state.lastListenMap[state.listenScope] = JSON.parse(JSON.stringify(snapshot));
    }
    persist();
  }

  /** 进入指定范围的听音（供复习页 / 快捷入口调用） */
  function startListenScope(scope) {
    state.listenScope = scope || 'all';
    state.listenQueue = [];
    state.listenIndex = 0;
    state.listenAnswered = false;
    $all('.tab').forEach(t => t.classList.remove('active'));
    $('.tab[data-tab="listen"]').classList.add('active');
    $all('.panel').forEach(p => p.classList.remove('active'));
    $('#panel-listen').classList.add('active');
    renderListenInit();
    startListen();
  }

  function renderListenInit() {
    const picker = $('#listenBookPicker');
    if (!picker) return;

    const opts = [];
    for (const b of state.books) {
      const cand = (b.words || []).filter(w => !b.progress?.mastered?.has?.(w.word));
      opts.push(`<option value="book:${b.id}">《${escapeHtml(b.name)}》(${cand.length})</option>`);
    }
    const wrongCand = state.wrongBook.filter(w => (w.correctCount || 0) < 3);
    opts.push(`<option value="wrong">🔥 错词本（${wrongCand.length}）</option>`);
    let allCount = 0;
    for (const b of state.books) {
      allCount += (b.words || []).filter(w => !b.progress?.mastered?.has?.(w.word)).length;
    }
    opts.push(`<option value="all">📚 全部未掌握（${allCount}）</option>`);

    picker.innerHTML = opts.join('');
    // 默认选择当前激活的单词本
    const wantDefault = state.listenScope && state.listenScope.startsWith('book:') ? state.listenScope : ('book:' + (state.activeBookId || ''));
    const wantedExists = opts.some(o => o.includes(`value="${wantDefault}"`));
    picker.value = wantedExists ? wantDefault : (opts[0] || '').match(/value="([^"]+)"/)?.[1] || '';

    // onchange 仅切换默认 scope，不立即进入；用户需点「开始听音」
    picker.onchange = () => {
      state.listenScope = picker.value;
    };

    // 进入 / 重听按钮
    const goBtn = $('#listenBookGo');
    if (goBtn) {
      goBtn.onclick = () => {
        state.listenScope = picker.value;
        startListen();
      };
    }
    const repBtn = $('#listenRepeat');
    if (repBtn) {
      repBtn.onclick = () => {
        const cur = state.listenQueue[state.listenIndex];
        if (cur) manualSpeak(cur.word);
        else toast('请先选择单词本开始');
      };
    }

    // 进度恢复提示
    if (state.lastListen && state.listenQueue.length === 0) {
      try {
        const saved = state.lastListen;
        const bookOpt = saved.scope && saved.scope.startsWith('book:')
          ? state.books.find(b => b.id === saved.scope.slice(5)) : null;
        const scopeLabel = saved.scope === 'wrong' ? '错词本'
          : saved.scope === 'all' ? '全部未掌握'
          : bookOpt ? `《${bookOpt.name}》` : '上次';
        toast(`↩ 上次听到第 ${saved.index + 1} / ${saved.queue.length} 个（${scopeLabel}），点「开始听音」继续`);
      } catch (e) { /* 静默 */ }
    }

    // 如果有保存的进度且匹配当前 scope，提示恢复
    renderListenCard();
  }

  function startListen() {
    const scope = state.listenScope;
    if (!scope) { toast('请先选择单词本'); return; }
    const items = collectListenItems(scope);
    if (!items.length) {
      toast('当前范围内没有可听的单词');
      state.listenQueue = [];
      state.listenIndex = 0;
      state.listenAnswered = false;
      state.lastListen = null;
      persist();
      renderListenCard();
      return;
    }

    // v5.9：优先用「本 scope 专属」的进度快照恢复（换单词本再换回来，进度也不丢）
    const saved = (state.lastListenMap && state.lastListenMap[scope])
      || (state.lastListen && state.lastListen.scope === scope ? state.lastListen : null);
    if (saved && saved.queue && saved.queue.length) {
      const savedMap = new Map(saved.queue.map(it => [it.key, it]));
      const merged = [];
      for (const it of items) {
        const sv = savedMap.get(it.key);
        merged.push(sv ? { ...it, savedAt: sv } : it);
      }
      // 按上次 queue 顺序排序，未出现的 append
      const order = saved.queue.map(q => q.key);
      merged.sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key));
      state.listenQueue = merged;
      state.listenIndex = Math.min(saved.index || 0, state.listenQueue.length - 1);
      state.listenAnswered = !!saved.answered;
      toast(`↩ 已恢复进度：从第 ${state.listenIndex + 1} 个继续`);
    } else {
      state.listenQueue = items;
      state.listenIndex = 0;
      state.listenAnswered = false;
    }
    state.listenLastDecision = null;
    state.listenSource = scope;
    saveLastListen();
    // v6：音频由 renderListenCard 里的 syncCardAudio 统一负责（出现即播、换词即停）
    renderListenCard();
  }

  function renderListenCard() {
    const area = $('#listenArea');
    const info = $('#listenInfoBar');
    if (!area) return;

    // 顶部信息条
    if (state.listenQueue.length === 0) {
      endCardAudio();
      if (info) info.innerHTML = `<span class="muted small">👆 选择单词本后点「开始听音」即可进入</span>`;
      area.innerHTML = `
        <div class="card flashcard" style="text-align:center;padding:48px 24px">
          <div style="font-size:48px;margin-bottom:12px">🎧</div>
          <h3 style="margin:0 0 8px">准备开始听音辨义</h3>
          <p class="muted">上方选择单词本 → 点「开始听音」即进入。<br>听音时只放声音，凭记忆选择认识 / 不认识。</p>
        </div>
      `;
      return;
    }

    const it = state.listenQueue[state.listenIndex];
    if (!it) {
      endCardAudio();
      area.innerHTML = `
        <div class="card flashcard" style="text-align:center;padding:48px 24px">
          <div style="font-size:48px;margin-bottom:12px">🎉</div>
          <h3 style="margin:0 0 8px">本轮听音已完成</h3>
          <p class="muted">认识 ${state._listenKnowCount || 0} · 不认识 ${state._listenUnknowCount || 0}</p>
          <button class="btn primary" id="listenRestart" style="margin-top:14px">🔄 再来一轮</button>
        </div>
      `;
      const restartBtn = $('#listenRestart');
      if (restartBtn) restartBtn.onclick = () => { state.listenIndex = 0; state._listenKnowCount = 0; state._listenUnknowCount = 0; state.listenAnswered = false; renderListenCard(); };
      return;
    }

    // 顶部进度
    const total = state.listenQueue.length;
    const cur = state.listenIndex + 1;
    const pct = (cur / total) * 100;
    if (info) info.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap">
        <div>
          <b>${cur}</b> / ${total}
          <span class="muted small" style="margin-left:8px">${escapeHtml(state.listenSource || '')}</span>
        </div>
        <div class="muted small">认识 ${state._listenKnowCount || 0} · 不认识 ${state._listenUnknowCount || 0}</div>
      </div>
      <div class="progress-bar"><span style="width:${pct.toFixed(1)}%"></span></div>
    `;

    const entry = it.entry || {};
    // 释义：优先 it.meaning（来自单词本/错词本里的释义），否则用 DICT 拼装
    let correctMeaning = (it.meaning || '').trim();
    if (!correctMeaning) {
      correctMeaning = `${entry.pos || ''} ${entry.cn || ''}`.trim();
    }
    // 例句：优先 DICT 里的 example
    const exampleText = entry.example || (it.entry && it.entry.example) || '';
    const phoneticText = entry.phonetic || '';
    const typeLabel = it.type === 'sentence' ? '原句' : (it.type === 'phrase' ? '短语' : '单词');

    area.innerHTML = `
      <div class="flashcard listen-card">
        <div class="card-actions">
          ${Speech.button(it.word, { small: true })}
        </div>
        <div class="progress">${cur} / ${total}</div>

        <!-- 核心：只显示「听音」按钮，不显示词 -->
        <div class="listen-stage">
          <div class="listen-icon">🎧</div>
          <div class="listen-hint">听下面的发音，在心里想它的意思</div>
          <button class="btn-listen-big" id="listenPlayBtn" type="button" title="播放发音">
            <span class="play-glyph">▶</span>
            <span class="play-label">播放发音</span>
          </button>
          ${state.autoSpeak ? `<div class="auto-speak-tag muted small">已开启自动播放 · 可关闭：Ctrl/Cmd+Shift+S</div>` : ''}
        </div>

        <!-- 揭示区：未揭示时不显示，揭示后才显示（包含单词+释义） -->
        ${state.listenAnswered ? `
          <div class="listen-reveal">
            <div class="reveal-label muted small">${typeLabel}：</div>
            <div class="reveal-word">${escapeHtml(it.word)}</div>
            ${phoneticText ? `<div class="phonetic">/${escapeHtml(phoneticText)}/</div>` : ''}
            <div class="reveal-meaning">${correctMeaning ? escapeHtml(correctMeaning) : '<span class="muted">暂无释义 · 可在单词本里编辑这个词补充</span>'}</div>
            ${exampleText ? `<div class="example muted">例：${escapeHtml(exampleText)}</div>` : ''}
            ${state.listenLastDecision === 'know' ? `
              <div class="rejudge-row">
                <span class="muted small">发现自己想错了？</span>
                <button class="btn ghost small-btn" id="listenRejudgeUnknow">🔁 改成「不认识」</button>
              </div>
            ` : ''}
          </div>
        ` : ''}
      </div>

      ${state.listenAnswered ? `
        <div class="actions">
          <button class="btn primary" id="listenNext">下一题 →</button>
        </div>
      ` : `
        <div class="actions">
          <button class="btn know" id="listenKnow" type="button">✓ 认识</button>
          <button class="btn unknow" id="listenUnknow" type="button">不认识</button>
          <button class="btn ghost" id="listenSkip" type="button" title="跳过这题">跳过</button>
        </div>
      `}
    `;

    // —— 事件绑定 ——
    const playBtn = $('#listenPlayBtn');
    if (playBtn) playBtn.onclick = () => manualSpeak(it.word);

    // v6：音频跟随词卡 —— 换一个词就停掉上一个、并自动朗读当前词
    syncCardAudio(it.word);

    // 揭示后的重判
    const rejudge = $('#listenRejudgeUnknow');
    if (rejudge) {
      rejudge.onclick = () => {
        // 把这次"认识"撤销，改判为不认识：撤销计数并加入错词本
        state._listenKnowCount = Math.max(0, (state._listenKnowCount || 0) - 1);
        state._listenUnknowCount = (state._listenUnknowCount || 0) + 1;
        addToWrongBook(it.word, it.type, it.sourceBookId, it.meaning);
        state.listenLastDecision = 'unknow';
        // 答错时 SRS 重置：下一题复习更短
        nextReviewAfter(it.srs, false);
        saveLastListen();
        toast('已重判为「不认识」，已加入错词本');
        renderListenCard();
      };
    }

    const nextBtn = $('#listenNext');
    if (nextBtn) nextBtn.onclick = () => listenNext();

    if (!state.listenAnswered) {
      const knowBtn = $('#listenKnow');
      if (knowBtn) knowBtn.onclick = () => listenJudge(true);
      const unknowBtn = $('#listenUnknow');
      if (unknowBtn) unknowBtn.onclick = () => listenJudge(false);
      const skipBtn = $('#listenSkip');
      if (skipBtn) skipBtn.onclick = () => {
        // 跳过：不计分、不加入错词本、不计入进度恢复（直接进入下一题）
        state.listenAnswered = false;
        state.listenIndex++;
        if (state.listenIndex >= state.listenQueue.length) {
          state.listenIndex = state.listenQueue.length; // 触发"已完成"状态
          state.lastListen = null;
          persist();
        } else {
          saveLastListen();
        }
        renderListenCard();
      };
    }
  }

  function listenJudge(isKnow) {
    const it = state.listenQueue[state.listenIndex];
    if (!it) return;
    state.listenAnswered = true;
    state.listenLastDecision = isKnow ? 'know' : 'unknow';

    if (isKnow) {
      state._listenKnowCount = (state._listenKnowCount || 0) + 1;
      // SRS 累计
      nextReviewAfter(it.srs, true);
    } else {
      state._listenUnknowCount = (state._listenUnknowCount || 0) + 1;
      addToWrongBook(it.word, it.type, it.sourceBookId, it.meaning);
      nextReviewAfter(it.srs, false);
    }
    saveLastListen();
    renderListenCard();
  }

  function listenNext() {
    state.listenIndex++;
    state.listenAnswered = false;
    state.listenLastDecision = null;
    if (state.listenIndex >= state.listenQueue.length) {
      // 全部完成
      state.listenIndex = state.listenQueue.length;
      state.lastListen = null;
      persist();
      renderListenCard();
      // 完成后回到听音本面板给个汇总
      toast(`🎉 本轮听音完成：认识 ${state._listenKnowCount || 0} · 不认识 ${state._listenUnknowCount || 0}`);
      return;
    }
    saveLastListen();
    renderListenCard();
  }

  /* =====================================================
     13. 复习计划（艾宾浩斯看板）
     ===================================================== */

  function renderReview() {
    // 渲染下拉：全部 / 单词本（每本独立）
    const picker = $('#reviewBookPicker');
    if (picker) {
      const opts = ['<option value="all">📚 全部词本</option>'];
      for (const b of state.books) {
        const dueNow = b.words.filter(w => ensureSrs(w).nextReview <= Date.now() + DAY_MS).length;
        opts.push(`<option value="book:${b.id}">《${escapeHtml(b.name)}》(今日 ${dueNow})</option>`);
      }
      picker.innerHTML = opts.join('');
      // 默认值：优先上次的选择；否则用当前活跃词本；否则全部
      let want = state.reviewFilter;
      if (want !== 'all' && !picker.querySelector(`option[value="${want}"]`)) want = null;
      if (!want && state.activeBookId && picker.querySelector(`option[value="book:${state.activeBookId}"]`)) {
        want = 'book:' + state.activeBookId;
        state.reviewFilter = want;
      }
      if (!want) want = 'all';
      picker.value = want;
      state.reviewFilter = want;
      picker.onchange = () => {
        state.reviewFilter = picker.value;
        persist();
        renderReview();
      };
    }

    const filter = state.reviewFilter || 'all';
    persist();

    // 顶部统计（按当前过滤）
    const all = [];
    // 错词本未毕业（始终包含）
    for (const w of state.wrongBook) {
      if ((w.correctCount || 0) >= 3) continue;
      ensureSrs(w);
      all.push({ word: w.word, type: w.type, source: `错词本 · ${w.correctCount}/3`, srs: w.srs, bookId: null });
    }
    // 单词本
    for (const b of state.books) {
      if (filter.startsWith('book:') && filter.slice(5) !== b.id) continue;
      for (const w of b.words) {
        ensureSrs(w);
        const status = b.progress.mastered.has(w.word) ? '已掌握·巩固' : '未掌握';
        all.push({ word: w.word, type: w.type, source: `《${b.name}》· ${status}`, srs: w.srs, bookId: b.id });
      }
    }

    // 按单词本分桶（便于一眼看清每本要复习多少）
    const bookBuckets = {};
    for (const it of all) {
      const k = it.bookId || 'wrong';
      if (!bookBuckets[k]) bookBuckets[k] = [];
      bookBuckets[k].push(it);
    }
    const bookOrder = [];
    if (!filter.startsWith('book:')) {
      // 全部模式：错词本放最前
      if (bookBuckets['wrong']) bookOrder.push({ id: 'wrong', label: '🔥 错词本', items: bookBuckets['wrong'] });
      for (const b of state.books) {
        if (bookBuckets[b.id]) bookOrder.push({ id: b.id, label: `《${b.name}》`, items: bookBuckets[b.id] });
      }
    } else {
      const id = filter.slice(5);
      if (bookBuckets[id]) {
        const b = state.books.find(x => x.id === id);
        bookOrder.push({ id, label: b ? `《${b.name}》` : '已删除词本', items: bookBuckets[id] });
      }
    }

    const buckets = [];
    const today0 = new Date();
    today0.setHours(0, 0, 0, 0);
    for (let i = 0; i <= 35; i++) {
      const dayStart = today0.getTime() + i * DAY_MS;
      const dayEnd = dayStart + DAY_MS;
      const items = all.filter(x => x.srs.nextReview >= dayStart && x.srs.nextReview < dayEnd);
      const date = new Date(dayStart);
      let label;
      if (i === 0) label = '今天';
      else if (i === 1) label = '明天';
      else if (i <= 7) label = `+${i} 天（${['日','一','二','三','四','五','六'][date.getDay()]}）`;
      else label = `+${i} 天`;
      buckets.push({ i, date, label, items });
    }

    const dueToday = buckets[0].items.length;
    const dueWeek = buckets.slice(0, 7).reduce((s, b) => s + b.items.length, 0);
    const totalAll = all.length;
    const dueSoon = all.filter(x => x.srs.nextReview <= Date.now() + DAY_MS).length;

    const reviewArea = $('#reviewArea');
    reviewArea.innerHTML = `
      <div class="grid" style="margin-bottom:16px">
        <div class="stat-card ${dueToday ? 'warning' : ''}">
          <div class="num">${dueToday}</div>
          <div class="label">今日到期</div>
        </div>
        <div class="stat-card">
          <div class="num">${dueSoon}</div>
          <div class="label">未来 24h 内</div>
        </div>
        <div class="stat-card">
          <div class="num">${dueWeek}</div>
          <div class="label">未来 7 天</div>
        </div>
        <div class="stat-card success">
          <div class="num">${all.filter(x => x.srs.interval >= 15).length}</div>
          <div class="label">长间隔（≥15 天）</div>
        </div>
      </div>

      <div class="card" style="padding:14px 16px;margin-bottom:10px">
        <h3 style="margin:0 0 8px;font-size:14px">📕 按单词本拆分（共 ${bookOrder.length} 组）</h3>
        <div class="grid">
          ${bookOrder.map(g => `
            <div class="book-card" style="cursor:pointer" data-book-jump="${g.id}">
              <div class="name">${escapeHtml(g.label)}</div>
              <div class="meta">条目 ${g.items.length} 个 · 今日到期 ${g.items.filter(x => x.srs.nextReview <= Date.now() + DAY_MS).length}</div>
              <div class="row gap wrap" style="margin-top:6px">
                <button class="btn small-btn" data-spell-now="${g.id === 'wrong' ? 'wrong' : ('book:' + g.id)}">✍ 拼写</button>
                <button class="btn small-btn" data-listen-now="${g.id === 'wrong' ? 'wrong' : ('book:' + g.id)}">🔊 听音</button>
                <button class="btn small-btn" data-go-study="${g.id === 'wrong' ? 'wrong' : g.id}">📖 背诵</button>
              </div>
            </div>
          `).join('')}
        </div>
      </div>

      ${buckets.filter(b => b.items.length || b.i === 0).map(b => `
        <div class="card" style="padding:14px 16px;margin-bottom:10px">
          <div class="row between" style="margin-bottom:8px">
            <h3 style="margin:0;font-size:14px">${b.label} · ${b.date.toLocaleDateString('zh-CN')}</h3>
            <span class="muted">${b.items.length} 个${b.i === 0 ? ' · <b style="color:var(--primary)">现在就可以开始</b>' : ''}</span>
          </div>
          ${b.items.length ? `<div class="row wrap gap" style="font-size:13px">
            ${b.items.map(it => `${Speech.button(it.word, { small: true })}<span class="chip">${escapeHtml(it.word)}<span class="muted"> · ${escapeHtml(it.source)}</span></span>`).join('')}
          </div>` : `<div class="muted small">无</div>`}
        </div>
      `).join('')}

      <div class="card" style="padding:14px 16px">
        <h3 style="margin:0 0 6px;font-size:14px">艾宾浩斯曲线 · 阶梯</h3>
        <p class="muted small">每拼对 1 次，间隔向下一阶梯推进；拼错就回到第 1 阶梯（明天再背）。</p>
        <div class="row wrap gap" style="margin-top:8px">
          ${SRS_INTERVALS.map((d, i) => `<span class="chip">第 ${i + 1} 阶：<b>${d} 天</b></span>`).join('')}
        </div>
      </div>
    `;

    // 绑定按钮
    reviewArea.querySelectorAll('[data-book-jump]').forEach(el => {
      el.onclick = (e) => {
        if (e.target.closest('button')) return;
        const id = el.dataset.bookJump;
        if (id === 'wrong') return;
        state.reviewFilter = 'book:' + id;
        if (picker) picker.value = state.reviewFilter;
        renderReview();
      };
    });
    reviewArea.querySelectorAll('[data-spell-now]').forEach(btn => {
      btn.onclick = () => startSpellScope(btn.dataset.spellNow);
    });
    reviewArea.querySelectorAll('[data-go-study]').forEach(btn => {
      btn.onclick = () => {
        const id = btn.dataset.goStudy;
        if (id === 'wrong') {
          // v5.9：错词复习跟随复习页当前过滤范围
          startWrongSession(filter === 'all' ? 'all' : filter);
          return;
        }
        state.activeBookId = id;
        state.activeWrongSession = false;
        saveLastStudy();
        $all('.tab').forEach(t => t.classList.remove('active'));
        $('.tab[data-tab="study"]').classList.add('active');
        $all('.panel').forEach(p => p.classList.remove('active'));
        $('#panel-study').classList.add('active');
        renderStudy();
      };
    });
    reviewArea.querySelectorAll('[data-listen-now]').forEach(btn => {
      btn.onclick = () => startListenScope(btn.dataset.listenNow);
    });
    $('#reviewStartSpell').onclick = () => {
      // 按当前过滤拼写
      const scope = filter.startsWith('book:') ? filter : 'due';
      startSpellScope(scope);
    };
    $('#reviewStartAllSpell').onclick = () => {
      const scope = filter.startsWith('book:') ? filter : 'all';
      startSpellScope(scope);
    };
    $('#reviewStartListen') && ($('#reviewStartListen').onclick = () => {
      startListenScope(filter.startsWith('book:') ? filter : 'all');
    });
    $('#reviewStartWrong') && ($('#reviewStartWrong').onclick = () => {
      startWrongSession(filter === 'all' ? 'all' : filter);
    });
  }

  function bindSpell() {
    // 已通过 renderSpellInit() 在 DOMContentLoaded 时渲染
  }
  function bindReview() {}

  function generate() {
    const sel = $('#articleBookSelect');
    const book = state.books.find(b => b.id === sel.value);
    if (!book) { toast('请选择一个单词本'); return; }

    const topic = $('#articleTopic').value.trim();
    const level = $('#articleLevel').value;
    const maxNew = parseInt($('#articleMaxNew').value, 10) || 10;
    const words = book.words.slice(0, maxNew * 2); // 多取一些供挑选

    const result = window.VocabData.generateArticle({
      topic,
      vocabWords: words,
      level,
      maxNew
    });

    renderArticle(result, book);
  }

  function renderArticle(result, book) {
    const out = $('#articleOut');
    const vocabSet = new Set(result.vocab.map(v => v.word));
    const knownSet = new Set(book.progress.mastered);

    function linkify(sentence) {
      // 把生词加上链接（按词边界匹配，且不在常见短词中）
      let html = escapeHtml(sentence);
      // 先匹配较长的词，再短词
      const sorted = result.vocab.slice().sort((a, b) => b.word.length - a.word.length);
      for (const v of sorted) {
        const re = new RegExp(`\\b(${escapeReg(v.word)})\\b`, 'gi');
        html = html.replace(re, (m) => {
          const cls = knownSet.has(v.word.toLowerCase()) ? 'vocab-link mastered' : 'vocab-link';
          return `<span class="${cls}" data-word="${escapeHtml(v.word)}">${m}</span>`;
        });
      }
      return html;
    }

    const paraHtml = result.paragraphs.map(p => {
      return `<p>${p.sentences.map(linkify).join(' ')}</p>`;
    }).join('');

    out.innerHTML = `
      <div class="article-title">${escapeHtml(result.title)}</div>
      <div class="article-topic">主题：${escapeHtml(result.topic)} · 难度 ${escapeHtml($('#articleLevel').value)} · 词源：《${escapeHtml(book.name)}》</div>
      ${paraHtml}
      <h4>本文生词（${result.vocab.length}）</h4>
      <div class="grid">
        ${result.vocab.map(v => {
          const e = v.entry;
          const cls = knownSet.has(v.word) ? 'vocab-link mastered' : 'vocab-link unmastered';
          return `<div class="wrong-row">
            <div>
              <div style="font-weight:600">
                ${Speech.button(v.word, { small: true })}
                <span class="${cls}" data-word="${escapeHtml(v.word)}" style="margin-left:4px">${escapeHtml(v.word)}</span>
                <span class="muted small" style="margin-left:6px">${escapeHtml(e.phonetic || '')}</span>
              </div>
              <div class="meta">${escapeHtml((e.pos || '') + (e.pos ? ' ' : '') + (e.cn || ''))}</div>
            </div>
          </div>`;
        }).join('')}
      </div>
    `;

    // 绑定点击显示释义
    out.querySelectorAll('.vocab-link').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        showBubble(e.target, el.dataset.word);
      });
    });
  }

  function escapeReg(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

  function showBubble(target, word) {
    const entry = window.VocabData.lookup(word);
    const bubble = $('#bubble');
    bubble.querySelector('.bubble-word').textContent = word;
    bubble.querySelector('.bubble-phonetic').textContent = entry.phonetic;
    bubble.querySelector('.bubble-meaning').textContent = `${entry.pos} ${entry.cn}`;
    bubble.querySelector('.bubble-example').textContent = entry.example;
    // 让气泡里的 🔊 按钮朗读当前词
    const speakBtn = bubble.querySelector('#bubbleSpeak');
    if (speakBtn) speakBtn.setAttribute('data-speak', word);
    const rect = target.getBoundingClientRect();
    const top = rect.bottom + 8;
    const left = Math.min(window.innerWidth - 330, Math.max(8, rect.left));
    bubble.style.top = top + 'px';
    bubble.style.left = left + 'px';
    bubble.classList.remove('hidden');
    clearTimeout(showBubble._t);
    showBubble._t = setTimeout(() => bubble.classList.add('hidden'), 4500);
  }

  document.addEventListener('click', (e) => {
    if (!e.target.classList?.contains('vocab-link')) {
      $('#bubble').classList.add('hidden');
    }
  });

  /* ---------- 8. 统计 ---------- */
  function renderStats() {
    const totalWords = state.books.reduce((s, b) => s + b.words.length, 0);
    const totalMastered = state.books.reduce((s, b) => s + b.progress.mastered.size, 0);
    const wrongDue = state.wrongBook.filter(w => (w.correctCount || 0) < 3).length;
    const wrongGrad = state.wrongBook.filter(w => (w.correctCount || 0) >= 3).length;

    $('#statsArea').innerHTML = `
      <div class="stat-card">
        <div class="num">${state.books.length}</div>
        <div class="label">单词本数量</div>
      </div>
      <div class="stat-card">
        <div class="num">${totalWords}</div>
        <div class="label">累计词汇</div>
      </div>
      <div class="stat-card success">
        <div class="num">${totalMastered}</div>
        <div class="label">已掌握</div>
      </div>
      <div class="stat-card warning">
        <div class="num">${wrongDue}</div>
        <div class="label">错词待毕业</div>
      </div>
      <div class="stat-card">
        <div class="num">${wrongGrad}</div>
        <div class="label">错词已毕业</div>
      </div>
      <div class="stat-card danger">
        <div class="num">${state.wrongBook.length}</div>
        <div class="label">错词总数</div>
      </div>
    `;
  }

  /* ---------- 9. 字典管理 ---------- */
  function dictEntries() {
    return Object.entries(state.userDict).map(([term, entry]) => ({
      term,
      entry,
      phrase: window.VocabData.isPhrase(term)
    }));
  }

  function renderDict() {
    // 统计
    const all = dictEntries();
    const words = all.filter(x => !x.phrase);
    const phrases = all.filter(x => x.phrase);
    $('#dictCountAll').textContent = all.length;
    $('#dictCountWord').textContent = words.length;
    $('#dictCountPhrase').textContent = phrases.length;

    // 过滤
    let list = all;
    if (state.dictFilter === 'word') list = words;
    if (state.dictFilter === 'phrase') list = phrases;

    // 搜索
    const q = ($('#dictSearch').value || '').trim().toLowerCase();
    if (q) list = list.filter(x => x.term.includes(q) || (x.entry.cn || '').includes(q));

    // 高亮当前过滤按钮
    $all('#panel-dict .btn[id^="dictFilter"]').forEach(b => b.classList.remove('primary'));
    if (state.dictFilter === 'all') $('#dictFilterAll').classList.add('primary');
    if (state.dictFilter === 'word') $('#dictFilterWord').classList.add('primary');
    if (state.dictFilter === 'phrase') $('#dictFilterPhrase').classList.add('primary');

    // 排序：单词在前、短语在后，各按字母
    list.sort((a, b) => {
      if (a.phrase !== b.phrase) return a.phrase ? 1 : -1;
      return a.term.localeCompare(b.term);
    });

    const wrap = $('#dictList');
    if (!list.length) {
      wrap.innerHTML = `<div class="muted" style="grid-column:1/-1">${
        state.userDict ? '没有匹配的字典条目。试试切换过滤或清空搜索框。' : '字典为空。在上方输入框批量导入或点击＋逐条添加。'
      }</div>`;
      return;
    }

    wrap.innerHTML = list.map(({ term, entry, phrase }) => {
      const tagCls = phrase ? 'tag phrase' : 'tag';
      const tagText = phrase ? '短语' : '单词';
      return `
        <div class="dict-row">
          <div class="head">
            <<div class="term">
              ${Speech.button(term, { small: true })}
              <span style="margin-left:4px">${escapeHtml(term)}</span>
              <span class="${tagCls}">${tagText}</span>
            </div>
            <div class="row-actions">
              <button class="btn" data-act="edit" data-term="${escapeHtml(term)}">编辑</button>
              <button class="btn danger" data-act="del" data-term="${escapeHtml(term)}">删除</button>
            </div>
          </div>
          <div class="meaning">${escapeHtml(entry.pos ? entry.pos + ' ' : '')}${escapeHtml(entry.cn || '')}</div>
          ${entry.example ? `<div class="muted small" style="margin-top:2px">${escapeHtml(entry.example)}</div>` : ''}
        </div>
      `;
    }).join('');

    wrap.querySelectorAll('button[data-act]').forEach(btn => {
      btn.addEventListener('click', () => {
        const term = btn.dataset.term;
        if (btn.dataset.act === 'del') {
          if (!confirm(`从字典删除「${term}」？`)) return;
          delete state.userDict[term];
          window.VocabData.setUserDict(state.userDict);
          persist();
          renderDict();
          toast(`已删除「${term}」`);
        } else if (btn.dataset.act === 'edit') {
          const entry = state.userDict[term];
          openEditModal({
            word: term,
            meaning: (entry.pos ? entry.pos + ' ' : '') + (entry.cn || ''),
            example: entry.example || '',
            scope: 'dict'
          });
        }
      });
    });
  }

  function bindDict() {
    $('#dictAdd').addEventListener('click', () => {
      const text = $('#dictAddInput').value;
      const lines = window.VocabData.parseDictLines(text);
      if (!lines.length) { toast('请先输入词条（每行：词/短语 + 释义）'); return; }
      let added = 0, updated = 0;
      for (const { term, meaning } of lines) {
        const key = window.VocabData.normalizeKey(term);
        const existing = state.userDict[key];
        const entry = window.VocabData.buildEntry(term, meaning);
        if (existing) updated++; else added++;
        state.userDict[key] = entry;
      }
      window.VocabData.setUserDict(state.userDict);
      persist();
      $('#dictAddInput').value = '';
      renderDict();
      toast(`已新增 ${added}，更新 ${updated}`);
    });
    $('#dictSearch').addEventListener('input', renderDict);
    $('#dictFilterAll').addEventListener('click', () => { state.dictFilter = 'all'; renderDict(); });
    $('#dictFilterWord').addEventListener('click', () => { state.dictFilter = 'word'; renderDict(); });
    $('#dictFilterPhrase').addEventListener('click', () => { state.dictFilter = 'phrase'; renderDict(); });
    $('#dictExport').addEventListener('click', () => {
      const rows = [['term', 'pos', 'meaning', 'example']];
      for (const { term, entry } of dictEntries().sort((a,b)=>a.term.localeCompare(b.term))) {
        rows.push([term, entry.pos || '', entry.cn || '', entry.example || '']);
      }
      const csv = rows.map(r => r.map(x => `"${String(x).replace(/"/g, '""')}"`).join(',')).join('\n');
      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `my-dict-${Date.now()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    });
    $('#dictClear').addEventListener('click', () => {
      if (!Object.keys(state.userDict).length) return;
      if (!confirm('清空整个字典？此操作不可撤销。')) return;
      state.userDict = {};
      window.VocabData.setUserDict(state.userDict);
      persist();
      renderDict();
      toast('字典已清空');
    });
  }

  /* ---------- 10. 编辑释义弹窗 ---------- */
  let editContext = null; // { word, scope, source, _origMeaning }

  function openEditModal({ word, meaning, example, scope, source }) {
    editContext = { word, scope, source, _origMeaning: meaning };
    state.editScope = scope;
    $('#editWord').value = word;
    $('#editWord').readOnly = false; // 单词本身也可编辑（拼写错误 / 改成更合适的写法）
    $('#editMeaning').value = meaning || '';
    $('#editExample').value = example || '';
    $('#editScopeHint').textContent = scope === 'dict'
      ? '将保存到字典，并应用到所有相关词本/错词本/文章'
      : '将更新当前单词本与错词本里的这条记录（不会写入字典）';
    // v6：删除按钮 —— 字典范围删字典条目，词本范围删单词本 + 错词本里的这个词
    const delBtn = $('#editDelete');
    if (delBtn) {
      delBtn.textContent = scope === 'dict' ? '🗑 从字典删除' : '🗑 删除这个词';
      delBtn.title = scope === 'dict'
        ? '从「我的字典」里删除这条'
        : '把这个词从所有单词本和错词本里彻底删除（含学习进度）';
    }
    $('#editModal').classList.remove('hidden');
    setTimeout(() => $('#editMeaning').focus(), 50);
  }

  function closeEditModal() {
    $('#editModal').classList.add('hidden');
    editContext = null;
  }

  function saveEdit() {
    if (!editContext) return;
    const newWordRaw = $('#editWord').value.trim();
    const newMeaning = $('#editMeaning').value.trim();
    const newExample = $('#editExample').value.trim();
    if (!newMeaning) { toast('释义不能为空'); return; }
    if (!newWordRaw) { toast('单词 / 短语不能为空'); return; }

    const ctx = editContext;
    const oldKey = window.VocabData.normalizeKey(ctx.word);
    const newKey = window.VocabData.normalizeKey(newWordRaw);
    const entry = window.VocabData.buildEntry(newKey, newMeaning, newExample);
    const oldIsPhrase = window.VocabData.isPhrase(oldKey);
    const newIsPhrase = window.VocabData.isPhrase(newKey);

    if (ctx.scope === 'dict') {
      if (oldKey !== newKey) delete state.userDict[oldKey];
      state.userDict[newKey] = entry;
      window.VocabData.setUserDict(state.userDict);
    } else if (newIsPhrase && !oldIsPhrase) {
      // 在词本里编辑时把单词改成短语 → 自动写入字典
      state.userDict[newKey] = entry;
      window.VocabData.setUserDict(state.userDict);
    }

    // 同步更新所有单词本中的该词
    for (const book of state.books) {
      const newMastered = new Set();
      for (const k of book.progress.mastered) {
        if (k === oldKey) newMastered.add(newKey);
        else newMastered.add(k);
      }
      book.progress.mastered = newMastered;
      for (const w of book.words) {
        if (w.word === oldKey) {
          w.meaning = newMeaning;
          w.example = newExample;
          if (oldKey !== newKey) w.word = newKey;
        }
      }
      // 短语不应混在单词本里，自动剔除
      if (newIsPhrase && !oldIsPhrase) {
        book.words = book.words.filter(w => w.word !== newKey);
      }
    }

    // 同步更新错词本
    for (const w of state.wrongBook) {
      if (w.word === oldKey) {
        w.word = newKey;
        w.entry = entry;
        w.lastSeen = Date.now();
      }
    }
    if (newIsPhrase) {
      state.wrongBook = state.wrongBook.filter(w => w.word !== newKey);
    }

    persist();
    closeEditModal();
    const msg = ctx.scope === 'dict'
      ? '字典已更新'
      : (newIsPhrase && !oldIsPhrase
          ? '已转为短语并存入字典'
          : (oldKey !== newKey ? '已重命名并同步到所有词本/错词本' : '释义已修正'));
    toast(msg);
    const activePanel = document.querySelector('.panel.active');
    if (activePanel?.id === 'panel-study') renderStudy();
    else if (activePanel?.id === 'panel-wrong') renderWrong();
    else if (activePanel?.id === 'panel-dict') renderDict();
    else if (activePanel?.id === 'panel-notebooks') renderBooks();
  }

  /** v6：把某个词从所有"学习进度"的队列里清掉（背诵 / 拼写 / 听音 / 各分片快照） */
  function purgeWordFromProgress(wordKey) {
    const same = (x) => x && window.VocabData.normalizeKey(x.word || x) === wordKey;
    const clean = (arr) => (Array.isArray(arr) ? arr.filter(x => !same(x)) : arr);
    state.studyQueue = clean(state.studyQueue);
    state.spellQueue = clean(state.spellQueue);
    state.listenQueue = clean(state.listenQueue);
    [state.lastStudyMap, state.lastSpellMap, state.lastListenMap].forEach(map => {
      Object.keys(map || {}).forEach(k => {
        const snap = map[k];
        if (snap && Array.isArray(snap.queue)) snap.queue = snap.queue.filter(q => !same(q));
      });
    });
    if (state.studyStreak) delete state.studyStreak[wordKey];
    if (state.studyIndex > state.studyQueue.length) state.studyIndex = state.studyQueue.length;
    if (state.spellIndex > state.spellQueue.length) state.spellIndex = state.spellQueue.length;
    if (state.listenIndex > state.listenQueue.length) state.listenIndex = state.listenQueue.length;
  }

  /** v6：删除当前编辑中的这个词 */
  function deleteEditTarget() {
    if (!editContext) return;
    const ctx = editContext;
    const raw = ($('#editWord').value || ctx.word || '').trim();
    if (!raw) { toast('没有可删除的词'); return; }
    const key = window.VocabData.normalizeKey(raw);

    // 统计影响面，让用户确认
    let bookHits = 0;
    for (const b of state.books) {
      bookHits += b.words.filter(w => window.VocabData.normalizeKey(w.word) === key).length;
    }
    const wrongHit = state.wrongBook.some(w => window.VocabData.normalizeKey(w.word) === key);
    const dictHit = !!state.userDict[key];

    let msg;
    if (ctx.scope === 'dict') {
      if (!dictHit) { toast('字典里没有这个词'); return; }
      msg = `从「我的字典」删除「${raw}」？\n（单词本 / 错词本里已有的词不受影响）`;
    } else {
      if (!bookHits && !wrongHit) { toast('单词本与错词本里都没有这个词'); return; }
      msg = `删除「${raw}」？\n\n将从 ${bookHits} 处单词本记录、错词本${wrongHit ? '（有）' : '（无）'}中移除，`
        + `并清空它的学习进度，操作不可撤销。`;
    }
    if (!confirm(msg)) return;

    if (ctx.scope === 'dict') {
      delete state.userDict[key];
      window.VocabData.setUserDict(state.userDict);
      persist();
      closeEditModal();
      toast(`已从字典删除「${raw}」`);
      renderDict();
      return;
    }

    // 1) 单词本：删掉词条 + 清 mastered
    for (const b of state.books) {
      b.words = b.words.filter(w => window.VocabData.normalizeKey(w.word) !== key);
      b.progress.mastered.delete(key);
    }
    // 2) 错词本
    state.wrongBook = state.wrongBook.filter(w => window.VocabData.normalizeKey(w.word) !== key);
    // 3) 学习进度队列 / 快照
    purgeWordFromProgress(key);

    persist();
    closeEditModal();
    toast(`已删除「${raw}」并清空它的学习进度`);

    const activePanel = document.querySelector('.panel.active');
    if (activePanel?.id === 'panel-study') renderStudy();
    else if (activePanel?.id === 'panel-wrong') renderWrong();
    else if (activePanel?.id === 'panel-dict') renderDict();
    else if (activePanel?.id === 'panel-notebooks') renderBooks();
    else if (activePanel?.id === 'panel-spell') renderSpellInit();
    else if (activePanel?.id === 'panel-review') renderReview();
  }

  function bindEditModal() {
    $('#editModalClose').addEventListener('click', closeEditModal);
    $('#editCancel').addEventListener('click', closeEditModal);
    $('#editSave').addEventListener('click', saveEdit);
    $('#editDelete')?.addEventListener('click', deleteEditTarget);
    $('#editModal').addEventListener('click', (e) => {
      if (e.target.id === 'editModal') closeEditModal();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !$('#editModal').classList.contains('hidden')) closeEditModal();
    });
  }

  /* ---------- 11. 启动 ---------- */
  function init() {
    hydrate();
    window.state = state; // 暴露给同步层 (sync.js)
    // v5：恢复上次活动的词本 + 错词会话标志
    if (state.lastStudy?.activeBookId && state.books.find(b => b.id === state.lastStudy.activeBookId)) {
      state.activeBookId = state.lastStudy.activeBookId;
      state.activeWrongSession = !!state.lastStudy.activeWrongSession;
    } else if (state.books.length) {
      state.activeBookId = state.books[0].id;
      state.activeWrongSession = false;
    }
    bindTabs();
    bindHome();
    bindStudy();
    bindBooks();
    bindWrong();
    bindDict();
    bindEditModal();
    bindArticle();
    bindGlobalSpeak();
    bindAudioToggle();
    bindPrefs();
    updateParseHint();
    // 默认进背诵页，让用户能直接接着上次继续
    $all('.tab').forEach(t => t.classList.remove('active'));
    const studyTab = $('.tab[data-tab="study"]');
    if (studyTab) studyTab.classList.add('active');
    $all('.panel').forEach(p => p.classList.remove('active'));
    $('#panel-study').classList.add('active');
    renderStudy();
    renderSpellInit();
    renderReview();
    // 渲染完后弹个提示说明已恢复进度
    if (state.lastStudy && state.lastStudy.studyIndex > 0) {
      const w = state.lastStudy.studyQueue[state.lastStudy.studyIndex];
      if (w) setTimeout(() => toast(`↩ 已恢复进度：从第 ${state.lastStudy.studyIndex + 1} 个「${w.word}」继续`), 400);
    }
  }

  /* ---------- 12. 全局 🔊 按钮点击代理 ---------- */
  function bindGlobalSpeak() {
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-speak]');
      if (!btn) return;
      e.stopPropagation();
      e.preventDefault();
      manualSpeak(btn.dataset.speak);
    });
  }

  /* ---------- 12.4 v6：顶部一键关闭 / 开启朗读音频 ---------- */
  function bindAudioToggle() {
    const btn = $('#audioToggle');
    if (!btn) return;
    const syncUI = () => {
      Speech.setMuted(!!state.audioMuted);
      btn.textContent = state.audioMuted ? '🔇' : '🔊';
      btn.classList.toggle('off', !!state.audioMuted);
      btn.title = state.audioMuted ? '朗读已关闭 · 点击开启' : '朗读已开启 · 点击关闭';
    };
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      state.audioMuted = !state.audioMuted;
      if (state.audioMuted) {
        Speech.stop();
        toast('🔇 朗读音频已关闭');
      } else {
        Speech.setMuted(false);
        toast('🔊 朗读音频已开启');
        try { Speech.speak('audio on'); } catch (err) {}
      }
      persist();
      syncUI();
    });
    syncUI();
  }

  /* ---------- 12.5 用户偏好（自动朗读开关等） ---------- */
  function bindPrefs() {
    // 在 tab 切换时也 persist 一次（保证 userDict 之外的状态写入）
    document.body.addEventListener('click', (e) => {
      const tab = e.target.closest('.tab');
      if (!tab) return;
      // 保存当前进度（防止在面板内点 tab 时丢失中间状态）
      saveLastStudy();
    });

    // 全局键盘快捷键：进入 study/spell 自动发音的开关切换
    document.addEventListener('keydown', (e) => {
      // Ctrl/Cmd + Shift + S = 切换自动朗读
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 's') {
        state.autoSpeak = !state.autoSpeak;
        if (!state.autoSpeak) Speech.stop();
        persist();
        toast(`🔊 自动朗读已${state.autoSpeak ? '开启' : '关闭'}`);
      }
    });
  }

  document.addEventListener('DOMContentLoaded', init);

  /* ---------- 13. 云端同步（v5.8） ---------- */
  function initCloud() {
    const cloudBtn = $('#cloudBtn');
    const cloudModal = $('#loginModal');
    const dot = $('#syncDot');
    const text = $('#syncText');
    if (!cloudBtn || !cloudModal) return;

    function setLoggedInUI(email) {
      cloudBtn.textContent = email;
      cloudBtn.classList.add('logged');
      $('#loggedInEmail').textContent = email;
      $('#loggedInPanel').classList.remove('hidden');
      Array.from(cloudModal.querySelectorAll('.form-row, #loginMsg, #btnSignIn, #btnSignUp')).forEach(function (el) { el.style.display = 'none'; });
      text.textContent = '已同步';
      dot.className = 'sync-dot synced';
    }
    function setLoggedOutUI() {
      cloudBtn.textContent = '☁ 登录';
      cloudBtn.classList.remove('logged');
      $('#loggedInPanel').classList.add('hidden');
      Array.from(cloudModal.querySelectorAll('.form-row, #loginMsg, #btnSignIn, #btnSignUp')).forEach(function (el) { el.style.display = ''; });
      text.textContent = '未登录';
      dot.className = 'sync-dot offline';
    }
    function setMsg(msg, type) {
      const m = $('#loginMsg');
      m.textContent = msg || '';
      m.className = 'login-msg muted small' + (type ? ' ' + type : '');
    }
    function showModal() { cloudModal.classList.remove('hidden'); }
    function hideModal() { cloudModal.classList.add('hidden'); setMsg(''); }

    cloudBtn.onclick = showModal;
    $('#btnCloseLogin').onclick = hideModal;
    $('#btnCloseLogin2').onclick = hideModal;
    cloudModal.querySelector('.modal-mask').onclick = hideModal;

    $('#btnSignIn').onclick = async function () {
      const email = $('#loginEmail').value.trim();
      const pwd = $('#loginPwd').value;
      if (!email || !pwd) return setMsg('请输入邮箱和密码', 'error');
      setMsg('登录中…');
      try {
        await window.SB.signIn(email, pwd);
        await afterLogin();
      } catch (e) {
        setMsg('登录失败：' + (e.message || e), 'error');
      }
    };

    $('#btnSignUp').onclick = async function () {
      const email = $('#loginEmail').value.trim();
      const pwd = $('#loginPwd').value;
      if (!email || !pwd) return setMsg('请输入邮箱和密码', 'error');
      if (pwd.length < 6) return setMsg('密码至少 6 位', 'error');
      setMsg('注册中…');
      try {
        await window.SB.signUp(email, pwd);
        await afterLogin();
      } catch (e) {
        setMsg('注册失败：' + (e.message || e), 'error');
      }
    };

    $('#btnSignOut').onclick = async function () {
      if (!confirm('退出登录？\n本地数据会保留；云端数据不会删除。')) return;
      await window.SB.signOut();
      setLoggedOutUI();
      hideModal();
      toast('已退出登录');
    };

    $('#btnMigrate').onclick = async function () {
      setMsg('正在迁移本地数据到云端…');
      try {
        await window.SYNC.migrateToCloud();
        setMsg('✓ 迁移成功！数据已上传到云端。', 'success');
        toast('✓ 迁移成功');
      } catch (e) {
        setMsg('迁移失败：' + (e.message || e), 'error');
      }
    };

    document.addEventListener('sb-sync-status', function (e) {
      const s = e.detail;
      if (s.status === 'syncing') { text.textContent = '同步中…'; dot.className = 'sync-dot syncing'; }
      else if (s.status === 'error') {
        text.textContent = '同步失败';
        dot.className = 'sync-dot error';
        if (s.lastError) {
          const shortErr = s.lastError.length > 80 ? s.lastError.slice(0, 80) + '…' : s.lastError;
          toast('✗ 同步失败：' + shortErr, 'error', 5000);
          // 会话过期时自动打开登录框
          if (/登录已过期|JWT expired|token expired|unauthorized/i.test(s.lastError)) {
            setTimeout(function () { showModal(); setMsg('登录已过期，请重新登录', 'error'); }, 600);
          }
        }
      }
      else if (s.status === 'idle' && s.lastSync) {
        const t = new Date(s.lastSync);
        const hh = t.getHours().toString().padStart(2, '0');
        const mm = t.getMinutes().toString().padStart(2, '0');
        text.textContent = '已同步 ' + hh + ':' + mm;
        dot.className = 'sync-dot synced';
      }
    });

    // 同步进度事件（多本书并发时显示 "同步中 2/4"）
    document.addEventListener('sb-sync-progress', function (e) {
      const p = e.detail;
      if (p && p.total > 1 && p.done < p.total) {
        text.textContent = '同步中 ' + p.done + '/' + p.total;
      }
    });

    function applyCloudData(cloudData) {
      state.books = cloudData.books || [];
      state.wrongBook = cloudData.wrongBook || [];
      state.userDict = cloudData.userDict || {};
      if (cloudData.prefs) {
        state.autoSpeak = cloudData.prefs.autoSpeak !== false;
        state.wrongFilter = cloudData.prefs.wrongFilter || 'all';
        state.reviewFilter = cloudData.prefs.reviewFilter || 'all';
        if (cloudData.prefs.activeBookId) state.activeBookId = cloudData.prefs.activeBookId;
        if (cloudData.prefs.spellScope) state.spellScope = cloudData.prefs.spellScope;
        if (cloudData.prefs.listenScope) state.listenScope = cloudData.prefs.listenScope;
        if (cloudData.prefs.wrongSessionScope) state.wrongSessionScope = cloudData.prefs.wrongSessionScope;
        if (cloudData.prefs.wrongCardMode) state.wrongCardMode = cloudData.prefs.wrongCardMode;
      }
      state.lastStudy = stripMap(cloudData.lastStudy);
      state.lastSpell = stripMap(cloudData.lastSpell);
      state.lastListen = stripMap(cloudData.lastListen);
      // v5.9：按单词本分片的进度 map（本地已有的分片优先，避免覆盖进行中的进度）
      mergeProgressMap(state.lastStudyMap, readMap(cloudData.lastStudy));
      mergeProgressMap(state.lastSpellMap, readMap(cloudData.lastSpell));
      mergeProgressMap(state.lastListenMap, readMap(cloudData.lastListen));
      persist();
    }

    async function afterLogin() {
      const u = window.SB.getUser();
      if (!u) {
        setMsg('注册成功！请查收邮箱完成确认（如果开启了邮箱确认）', 'success');
        return;
      }
      setMsg('正在拉取云端数据…');
      try {
        const cloudData = await window.SYNC.pullFromCloud();
        const hasCloud = cloudData && cloudData.books && cloudData.books.length > 0;
        const hasLocal = state.books && state.books.length > 0;
        if (hasCloud && !hasLocal) {
          applyCloudData(cloudData);
          location.reload();
          return;
        } else if (hasLocal && !hasCloud) {
          setMsg('本地有数据，自动上传到云端…');
          await window.SYNC.migrateToCloud();
          setMsg('✓ 本地数据已上传到云端', 'success');
        } else if (hasLocal && hasCloud) {
          const choice = confirm('本地与云端都有数据。\n\n确定 = 上传本地到云端（覆盖云端）\n取消 = 保留本地，下载云端到本地');
          if (choice) {
            await window.SYNC.migrateToCloud();
            setMsg('✓ 本地数据已上传到云端', 'success');
          } else {
            applyCloudData(cloudData);
            location.reload();
            return;
          }
        }
        window.SYNC.setEnabled(true);
        setLoggedInUI(u.email);
        setMsg('✓ 登录成功，已开启云端同步', 'success');
        setTimeout(hideModal, 1000);
      } catch (e) {
        setMsg('拉取云端数据失败：' + (e.message || e), 'error');
      }
    }

    // 检查是否已登录
    if (window.SB.isLoggedIn()) {
      const u = window.SB.getUser();
      setLoggedInUI(u.email);
      window.SYNC.setEnabled(true);
      window.SYNC.pullFromCloud().then(function (cloudData) {
        if (cloudData && cloudData.books && cloudData.books.length > 0 && state.books.length === 0) {
          applyCloudData(cloudData);
          location.reload();
        }
      }).catch(function (e) { console.warn('pull from cloud failed', e); });
    } else {
      setLoggedOutUI();
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    setTimeout(initCloud, 50);
  });
})();
