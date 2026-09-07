/* supabase.js — 极简 Supabase 客户端（零外部依赖，仅用 fetch API）
   暴露 window.SB：auth + REST CRUD
   配置：URL + anon key（前端公开，配合 RLS 保证安全） */
(function () {
  'use strict';
  const SUPABASE_URL = 'https://fheznzjgwxyqtpdezwny.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZoZXpuempnd3h5cXRwZGV6d255Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg3NzEzMzAsImV4cCI6MjEwNDM0NzMzMH0.6yuVP-c4iwo4OJ4PSoh3KBqsmYVuLVvpX9AJ3R61hhI';

  // ====== Session 本地持久化 ======
  const SESSION_KEY = 'sb_session_v1';
  let session = null;
  try { const s = localStorage.getItem(SESSION_KEY); if (s) session = JSON.parse(s); } catch (e) { session = null; }
  function saveSession(s) {
    session = s;
    if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s));
    else localStorage.removeItem(SESSION_KEY);
  }
  function accessToken() { return (session && session.access_token) || SUPABASE_ANON_KEY; }

  // ====== 底层 fetch 封装 ======
  async function rest(method, path, body, options) {
    options = options || {};
    const url = SUPABASE_URL + path;
    const headers = {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': 'Bearer ' + accessToken(),
      'Content-Type': 'application/json'
    };
    if (options.prefer) headers['Prefer'] = options.prefer;
    const opts = { method, headers };
    if (body !== undefined && body !== null) opts.body = JSON.stringify(body);
    const resp = await fetch(url, opts);
    const text = await resp.text();
    let data;
    try { data = text ? JSON.parse(text) : null; } catch (e) { data = text; }
    if (!resp.ok) {
      const err = new Error((data && (data.message || data.error_description || data.msg)) || ('HTTP ' + resp.status));
      err.status = resp.status;
      err.data = data;
      throw err;
    }
    return data;
  }

  const SB = {
    config: { url: SUPABASE_URL, anonKey: SUPABASE_ANON_KEY },

    isLoggedIn: function () { return !!(session && session.user && session.user.id); },
    getUser: function () { return session && session.user; },
    getSession: function () { return session; },

    signUp: async function (email, password) {
      const data = await rest('POST', '/auth/v1/signup', { email, password });
      if (data && data.access_token) {
        saveSession({ access_token: data.access_token, refresh_token: data.refresh_token, user: data.user });
      }
      return data;
    },

    signIn: async function (email, password) {
      const data = await rest('POST', '/auth/v1/token?grant_type=password', { email, password });
      saveSession({ access_token: data.access_token, refresh_token: data.refresh_token, user: data.user });
      return data;
    },

    signOut: async function () {
      try { if (session && session.access_token) await rest('POST', '/auth/v1/logout', {}); } catch (e) {}
      saveSession(null);
    },

    refresh: async function () {
      if (!session || !session.refresh_token) throw new Error('no refresh token');
      const data = await rest('POST', '/auth/v1/token?grant_type=refresh_token', { refresh_token: session.refresh_token });
      saveSession({ access_token: data.access_token, refresh_token: data.refresh_token, user: data.user });
      return session;
    },

    // ====== REST CRUD ======
    select: function (table, query) { return rest('GET', '/rest/v1/' + table + (query || '')); },

    insert: function (table, rows) {
      const arr = Array.isArray(rows) ? rows : [rows];
      return rest('POST', '/rest/v1/' + table, arr, { prefer: 'return=representation' });
    },

    upsert: function (table, rows, onConflict) {
      const arr = Array.isArray(rows) ? rows : [rows];
      let prefer = 'resolution=merge-duplicates';
      if (onConflict) prefer += ',' + onConflict;
      return rest('POST', '/rest/v1/' + table, arr, { prefer: prefer });
    },

    update: function (table, match, patch) {
      const qs = Object.keys(match).map(function (k) { return k + '=eq.' + encodeURIComponent(match[k]); }).join('&');
      return rest('PATCH', '/rest/v1/' + table + '?' + qs, patch, { prefer: 'return=representation' });
    },

    remove: function (table, match) {
      const qs = Object.keys(match).map(function (k) { return k + '=eq.' + encodeURIComponent(match[k]); }).join('&');
      return rest('DELETE', '/rest/v1/' + table + '?' + qs);
    }
  };

  window.SB = SB;
})();
