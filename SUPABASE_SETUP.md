# Supabase 配置指南

本项目用 Supabase 作为云端数据存储（Postgres + Auth）。**数据自动同步到云端，多设备共用一份；换设备/浏览器登录账号即可。**

---

## 你需要做的（5 分钟）

### 第 1 步：注册 Supabase（30 秒）

打开 https://supabase.com/dashboard/sign-up

- 用 **GitHub 账号** 登录（你已有 GitHub，最快）
- 同意条款

### 第 2 步：创建项目（1-2 分钟）

1. 登录后点 **New Project**
2. 填写：
   - **Name**：`ielts-vocab`（或任意）
   - **Database Password**：设一个强的（**记下来**，重置需用）
   - **Region**：选 **Singapore**（Southeast Asia 区域，离国内最近）
3. 点 **Create new project**
4. 等待 1-2 分钟（控制台会显示 "Setting up project..."）

### 第 3 步：复制凭证并发给我（30 秒）

1. 项目创建完成后，左侧导航点 **Settings → API**
2. 复制下面两个值，**发给我**：

| 字段 | 在哪里 | 样子 |
| --- | --- | --- |
| **Project URL** | "Project URL" 框右侧 | `https://xxxxxxxxxxxx.supabase.co` |
| **anon public key** | "Project API keys" 下 "anon public" 右侧 | `eyJhbGciOi...` 一长串 |

> ⚠️ **不要复制** service_role key（那是管理员权限，只服务端用）

### 第 4 步（你发凭证后我做的）：建表

我会在你项目的 **SQL Editor** 跑 `supabase/schema.sql` 脚本（已写好），自动建表 + 启用安全策略。

### 第 5 步：关闭邮箱确认（即注册即用，30 秒）

默认 Supabase 注册要邮箱确认（你去邮箱点链接），为了你**即注册即用**：

1. Supabase 控制台左侧 **Authentication → Providers**
2. 点 **Email**
3. 关闭 **"Confirm email"** 开关
4. 保存

---

## 我拿到凭证后会做

1. 在你的 Supabase 跑建表 SQL
2. 改造前端：加 **登录/注册/同步** UI（用邮箱+密码，30 秒注册）
3. 部署到 Render（用之前的 render.yaml）
4. 提供 **数据迁移工具**：你点一下就把现有 localStorage 数据传到云端
5. 之后任意设备登录账号 → 数据自动同步

---

## 关于数据安全

- 数据存 Supabase 全球 Postgres（Singapore 区域）
- 启用 RLS（行级安全）：**只有你登录后才能读写自己的数据**，别人看不见也改不了
- 旧数据（localStorage 里）迁移后仍保留在原浏览器作为离线缓存
