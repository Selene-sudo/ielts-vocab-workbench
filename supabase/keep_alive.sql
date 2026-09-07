-- 雅思词汇工作台 · 保持 Supabase 项目活跃的 RPC 函数
-- 在 Supabase 控制台 → SQL Editor → 粘贴并运行（只跑一次）

-- keep_alive() 用于 GitHub Actions 定时调用，产生 Database Activity
-- security definer 让函数以创建者权限执行，anon 也能调用
create or replace function public.keep_alive()
returns void
language sql
security definer
as $$
  -- 简单的 DB 操作（更新元数据 + 返回时间），足够让 Supabase 判定为活跃
  select set_config('app.last_keepalive', now()::text, false);
$$;

-- 允许 anon / authenticated 角色调用
grant execute on function public.keep_alive() to anon, authenticated;

-- 可选：手动验证
-- select keep_alive();
