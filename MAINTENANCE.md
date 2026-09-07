# 雅思词汇工作台 · 日常维护指南

> 适用版本：v5.8（已部署到 Supabase 云端同步）
> 部署链接：https://29434aabec424d5f960282f5c0ffa5a2.app.workbuddy.link

---

## 1. 数据保存（最重要）

### 1.1 自动保存 — 已开启，无需操作

登录后，每次添加单词、答对答错、修改设置，**都会在 1.5 秒内自动同步到 Supabase 云端**。状态指示器在顶栏右侧：

- 🟢 **已同步** — 数据已上云
- 🟡 **同步中…** — 正在上传
- ⚪ **未登录** — 仅本地存储

### 1.2 手动备份到本地 JSON（强烈建议每周一次）

1. 打开网站 → 点右上角「**☁ 登录**」（如果已登录可跳过）
2. 进入「**单词本**」tab → 找到**「导出全部数据」**按钮（页面底部）
3. 下载 `vocabmaster-export-YYYYMMDD.json`，改名带日期存到电脑/Dropbox/网盘

> ⚠️ 这一步是把数据**单独留一份**到本地，**和云端同步无关**。即使将来 Supabase 出问题，你也有完整备份。

### 1.3 校验数据完整性

打开网站，浏览器开发者工具 → Application → Local Storage → 看 `vocabmaster.v1` 键存在即表示本地有数据。
再看 `sb_session_v1` 键，里面包含 access_token，证明云端 session 正常。

---

## 2. 代码更新流程（每次你新增功能时）

### 2.1 本地开发 → GitHub → 部署，三步走

| 步骤 | 操作 | 验证方式 |
| --- | --- | --- |
| ① 本地改代码 | 编辑 `/Users/selene/WorkBuddy/2026-09-06-15-01-23/vocab-platform/` 下的文件 | `cd vocab-platform && node server.js` → 访问 `http://127.0.0.1:8765/` 测试 |
| ② 推送到 GitHub | `cd vocab-platform && git add -A && git commit -m "说明" && git push origin main` | 访问 https://github.com/Selene-sudo/ielts-vocab-workbench 看 commit 出现 |
| ③ 重新部署 | 告诉我"重新部署"，我会用 workbuddy_sites_deploy 推送最新代码 | 访问线上链接，看新功能生效 |

### 2.2 修改前先备份

```bash
cd /Users/selene/WorkBuddy/2026-09-06-15-01-23
rm -f ielts-vocab-workbench.zip
zip -r ielts-vocab-workbench.zip vocab-platform/
```

> 每次改完代码后跑一次，把 zip 备份更新到当日版本。

---

## 3. 跨设备 / 换电脑使用

### 3.1 新设备使用

1. 打开链接 → 点「**☁ 登录**」→ 输入**同一邮箱密码**
2. 系统自动拉取云端所有数据
3. 完成 ✅

### 3.2 旧设备导出给新设备（不需要重传云端）

1. 旧设备点「导出全部数据」→ 下载 JSON
2. 新设备点「**导入 JSON 备份**」（在单词本底部）→ 选择 3 种模式之一：
   - **合并**：新旧数据合二为一
   - **覆盖**：完全替换
   - **仅字典**：只导入手动添加的释义

---

## 4. 常见问题与排查

### 4.1 同步状态卡在「同步失败」

**原因**：通常是 Supabase 服务暂时不可用（每月 1-2 次）或网络波动。

**解决**：
1. 等 1 分钟再试
2. 刷新页面（F5）→ 数据已写入 localStorage，不会丢
3. 还不行就点「退出登录」→ 重新登录

### 4.2 单词释义显示「待补充」

**原因**：这个单词不在内置 DICT 词典里。

**解决**：
1. 进入「单词本」tab → 找到该词 → 点右侧「**✎**」编辑按钮
2. 填入中文释义 → 保存 → 释义立即生效

### 4.3 拼写按 Enter 键不响应

**原因**：浏览器焦点没在输入框。

**解决**：先点一下输入框，再按 Enter。

### 4.4 浏览器清缓存后数据消失

**原因**：localStorage 被清了。

**解决**：
1. 不要慌 — 你的数据在 Supabase 云端
2. 重新打开链接 → 「☁ 登录」→ 输入账号 → 数据自动拉回

### 4.5 Supabase 认证过期

**原因**：默认 access_token 1 小时后过期，但我们有 refresh_token 自动续期。

**解决**：如果点了任何操作都没反应：
1. 「退出登录」→ 重新登录

---

## 5. 紧急情况处理

### 5.1 数据全部丢失（云端 + 本地都没了）

1. 打开网站 → 「☁ 登录」→ 输入账号 → 看能否从云端拉回
2. 如果云端也没了，从**本地 JSON 备份**导入：单词本 → 导入 JSON 备份 → 选「覆盖」模式
3. 如果连本地 JSON 都没有——**找最近的网盘/Dropbox 备份**

> 💡 **预防**：每月 1 日导出一份 JSON 存到网盘。

### 5.2 想换 Supabase 账号

1. 在新 Supabase 项目里执行 `supabase/schema.sql`（同一份 SQL 即可）
2. 改 `supabase.js` 第 6-7 行的 `SUPABASE_URL` 和 `SUPABASE_ANON_KEY`
3. 重新部署

### 5.3 想清空云端数据

在 Supabase 控制台 → SQL Editor 执行：
```sql
TRUNCATE vocab_books, vocab_words, wrong_book, user_dict, user_state CASCADE;
DELETE FROM auth.users; -- 同时清掉所有账号（慎用！）
```

---

## 6. 定期检查清单（建议每月一次）

- [ ] 浏览器开发者工具 → Network → 刷新页面 → 看 app.js / sync.js / supabase.js 加载 200
- [ ] 顶栏同步指示器显示「已同步」
- [ ] 导出 JSON 备份到网盘
- [ ] 检查 zip 备份文件已更新到最新版本
- [ ] 测一次新设备登录能否拉取数据（用朋友的设备或浏览器无痕模式）

---

## 7. 重要文件位置

| 文件 | 作用 |
| --- | --- |
| `/Users/selene/WorkBuddy/2026-09-06-15-01-23/vocab-platform/app.js` | 主应用（约 2200+ 行） |
| `/Users/selene/WorkBuddy/2026-09-06-15-01-23/vocab-platform/supabase.js` | Supabase 客户端 |
| `/Users/selene/WorkBuddy/2026-09-06-15-01-23/vocab-platform/sync.js` | 同步层 |
| `/Users/selene/WorkBuddy/2026-09-06-15-01-23/vocab-platform/supabase/schema.sql` | Supabase 建表 SQL |
| `/Users/selene/WorkBuddy/2026-09-06-15-01-23/vocab-platform/SUPABASE_SETUP.md` | Supabase 配置指南 |
| `/Users/selene/WorkBuddy/2026-09-06-15-01-23/ielts-vocab-workbench.zip` | 完整代码 zip 备份 |
| `/Users/selene/WorkBuddy/2026-09-06-15-01-23/.workbuddy/memory/2026-09-07.md` | 工作日志（我写的） |

---

## 8. 联系我的时机

以下情况**直接告诉我**，我会帮你处理：

- 🆕 想**新增功能**（暗色模式、复习计划导出、词频统计等）
- 🐛 发现 **bug** 或异常行为
- 🚀 想**重新部署**（代码改了想上线）
- ❓ **任何**使用上的问题

> 我**不建议**你自己改 SQL 表结构或 RLS 策略（可能破坏数据）。需要改请告诉我。
