# 运维自动化部署指南

本文档说明如何部署两个自动化任务：

1. **GitHub Actions 防休眠** — 每 3 天自动 ping 一次 Supabase
2. **本地定时备份** — 每周日 3:00 自动备份到 `~/Documents/工作台备份/`（Finder 显示为「用户/selene/文稿/工作台备份」）

---

## 1. GitHub Actions 防休眠

### 1.1 SQL：创建 keep_alive 函数（已完成）

文件：`vocab-platform/supabase/keep_alive.sql`

打开 Supabase 控制台 → SQL Editor → 粘贴并运行 **一次**。运行后 `keep_alive()` RPC 即可被 anon / authenticated 调用。

### 1.2 推送 GitHub Action 配置

文件已创建在 `vocab-platform/.github/workflows/keep-alive.yml`，代码已提交（下一步推送）。

### 1.3 配置 GitHub Secrets（**必须**手动操作）

打开你的 GitHub 仓库：
**https://github.com/Selene-sudo/ielts-vocab-workbench/settings/secrets/actions**

点 **"New repository secret"**，添加以下两条：

| Name | Value |
| --- | --- |
| `SUPABASE_URL` | `https://fheznzjgwxyqtpdezwny.supabase.co` |
| `SUPABASE_ANON_KEY` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZoZXpuempnd3h5cXRwZGV6d255Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg3NzEzMzAsImV4cCI6MjEwNDM0NzMzMH0.6yuVP-c4iwo4OJ4PSoh3KBqsmYVuLVvpX9AJ3R61hhI` |

### 1.4 触发与验证

1. 推送代码到 GitHub
2. 打开 https://github.com/Selene-sudo/ielts-vocab-workbench/actions
3. 找到 "Keep Supabase Alive" workflow
4. 点 **"Run workflow"** → 立即跑一次测试
5. 看日志：应输出 `✅ Supabase is alive` + `✅ Supabase keep_alive RPC succeeded`

之后每 3 天的 UTC 9:00（北京时间 17:00）会自动跑。

---

## 2. 本地定时备份

### 2.1 文件位置（已创建）

| 文件 | 作用 |
| --- | --- |
| `~/scripts/ielts-vocab-backup.sh` | 备份主脚本（chmod +x 已设） |
| `~/Library/LaunchAgents/com.user.ielts-vocab-backup.plist` | launchd 任务定义（chmod 600 已设） |

### 2.2 配置凭据

#### 方案 A：账号密码（明文，plist 文件中）

编辑 `~/Library/LaunchAgents/com.user.ielts-vocab-backup.plist`：

```xml
<key>VOCAB_EMAIL</key>
<string>你的真实邮箱</string>
<key>VOCAB_PASSWORD</key>
<string>你的真实密码</string>
```

> ⚠️ 此文件已是 600 权限（仅当前用户可读），但密码仍是明文。
> 如果 Mac 被别人物理接触，密码有泄漏风险。

#### 方案 B：service_role key（更安全，plist 文件中）

打开 Supabase 控制台 → Settings → API → 复制 **`service_role`** key（不是 anon public）

plist 文件改成：

```xml
<!-- 把 VOCAB_EMAIL / VOCAB_PASSWORD 整个 dict 替换成：-->
<key>EnvironmentVariables</key>
<dict>
  <key>VOCAB_SERVICE_ROLE</key>
  <string>eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...（你的 service_role 完整内容）</string>
</dict>
```

`service_role` key 权限极高，**泄露 = 数据全失**。但它**不会过期**，比 access_token 稳定。

### 2.3 立即测试

```bash
# 方式 1：直接执行（用 launchd 配的 env）
launchctl start com.user.ielts-vocab-backup

# 方式 2：手动执行（更直观）
/Users/selene/scripts/ielts-vocab-backup.sh
```

看输出：
- `✅ 登录成功` 或 `✅ user_id=...`（登录通过）
- `📥 拉取单词本/单词/错词...`（数据拉取）
- `💾 写入备份文件：/Users/selene/Documents/工作台备份/vocab-backup-20260907-193800.json`

### 2.4 启用 launchd 定时任务

```bash
# 加载 plist（立即开始按 schedule 跑）
launchctl load -w ~/Library/LaunchAgents/com.user.ielts-vocab-backup.plist

# 查看已加载的定时任务
launchctl list | grep ielts

# 取消定时
launchctl unload ~/Library/LaunchAgents/com.user.ielts-vocab-backup.plist
```

### 2.5 备份目录

```
~/Documents/工作台备份/   （Finder 中显示为「用户 > selene > 文稿 > 工作台备份」）
├── vocab-backup-20260831-030000.json   ← 最早保留
├── vocab-backup-20260901-030000.json
├── ...
└── vocab-backup-20260907-030000.json   ← 最新
├── backup.log                          ← 运行日志
```

自动保留最近 **7 份**（约 1 周），超出后自动删除最旧的。如需更多历史版本，备份文件可直接拷贝到 iCloud / 网盘。

---

## 3. 故障排查

| 现象 | 原因 | 解决 |
| --- | --- | --- |
| GitHub Actions 失败：`401 Unauthorized` | Secret 没设 / 拼写错 | 检查 Secrets 两条是否完整 |
| GitHub Actions 失败：`function keep_alive() does not exist` | 没在 Supabase 跑过 keep_alive.sql | 去 SQL Editor 跑 `vocab-platform/supabase/keep_alive.sql` |
| 本地备份失败：`登录失败` | 邮箱密码错，或 Confirm email 没关导致 access_token 没返回 | 检查账号；或改用 service_role |
| launchd 任务没跑 | Mac 关机 | 设置 StartCalendarInterval + RunAtLoad，开机自动补 |
| 想验证任务会在指定时间跑 | `launchctl start com.user.ielts-vocab-backup` 立即触发 | 触发后看 `/tmp/ielts-vocab-backup.log` |

---

## 4. 维护清单

- [ ] 每月初：检查 `~/Documents/工作台备份/` 文件夹，确认有最新备份
- [ ] 每季度：登录 GitHub → Actions → Keep Supabase Alive，查看最近 30 天运行历史
- [ ] 每年：更新 keep-alive.yml 的 cron 表达式（如有 Supabase 政策变化）
