-- =============================================================
-- !! 警告：这是 SQL 文件，不是 JavaScript !!
-- 请把整个文件的内容（从本行一直到文件末尾）原样粘贴到
-- Supabase 控制台 → SQL Editor → New query → Run
-- =============================================================

-- ============ 1. 单词本 ============
create table if not exists vocab_books (
  id text primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  source text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists vocab_books_user_id_idx on vocab_books(user_id);

-- ============ 2. 单词 ============
create table if not exists vocab_words (
  book_id text references vocab_books(id) on delete cascade not null,
  word text not null,
  type text,
  meaning text,
  example text,
  mastered boolean default false,
  srs jsonb,
  added_at timestamptz default now(),
  primary key (book_id, word)
);
create index if not exists vocab_words_book_id_idx on vocab_words(book_id);

-- ============ 3. 错词本 ============
create table if not exists wrong_book (
  user_id uuid references auth.users(id) on delete cascade not null,
  word text not null,
  type text,
  meaning text,
  sources jsonb,
  srs jsonb,
  correct_count int default 0,
  last_seen timestamptz,
  primary key (user_id, word)
);

-- ============ 4. 用户词典（手动加的释义） ============
create table if not exists user_dict (
  user_id uuid references auth.users(id) on delete cascade not null,
  word text not null,
  entry jsonb,
  primary key (user_id, word)
);

-- ============ 5. 用户偏好与最近进度 ============
create table if not exists user_state (
  user_id uuid references auth.users(id) on delete cascade primary key,
  prefs jsonb,
  last_study jsonb,
  last_spell jsonb,
  last_listen jsonb,
  updated_at timestamptz default now()
);

-- ============ 启用行级安全 (RLS) ============
alter table vocab_books enable row level security;
alter table vocab_words enable row level security;
alter table wrong_book enable row level security;
alter table user_dict enable row level security;
alter table user_state enable row level security;

-- ============ 用户隔离策略 ============
-- 单词本：用户只能读写自己的
create policy "用户隔离 vocab_books" on vocab_books
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 单词：通过所属单词本间接归属
create policy "用户隔离 vocab_words" on vocab_words
  for all using (
    exists (select 1 from vocab_books b where b.id = vocab_words.book_id and b.user_id = auth.uid())
  ) with check (
    exists (select 1 from vocab_books b where b.id = vocab_words.book_id and b.user_id = auth.uid())
  );

-- 错词本：按 user_id
create policy "用户隔离 wrong_book" on wrong_book
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 用户词典：按 user_id
create policy "用户隔离 user_dict" on user_dict
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 用户状态：按 user_id
create policy "用户隔离 user_state" on user_state
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
