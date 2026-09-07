# Render 部署指南

本项目是**纯静态站**（数据全部存在浏览器 localStorage），最适合用 Render 的 **Static Site（静态站）** 类型部署：完全免费、无冷启动、无需 Node 进程、无需启动命令与环境变量。

仓库根目录已含 `render.yaml` 蓝图，连上仓库即可一键创建。

---

## 方式一：Blueprint 一键部署（推荐）

1. 打开 https://dashboard.render.com ，用 **GitHub 账号**登录（或邮箱注册，免费）。
2. 点右上角 **New +** → 选 **Blueprint**。
3. 首次会提示 **Connect GitHub**，授权 Render 访问你的 GitHub 仓库。
4. 在列表里选中仓库 **`ielts-vocab-workbench`**。
5. Render 会自动读取 `render.yaml`，预览出一个服务：**Static Site「ielts-vocab-workbench」**。
6. 点 **Apply**（应用），等待 1–2 分钟部署完成。
7. 部署完成后，进入服务页顶部即可看到你的访问链接（形如 `https://ielts-vocab-workbench.onrender.com`）。

> 之后每次 `git push` 到 `main` 分支，Render 会**自动重新部署**，无需手动操作。

---

## 方式二：手动创建 Static Site（不用 Blueprint）

1. Render 控制台 **New +** → **Static Site**。
2. 连接 GitHub 后选择仓库 `ielts-vocab-workbench`。
3. 配置如下：
   - **Build Command（构建命令）**：留空
   - **Publish Directory（发布目录）**：`.`
4. 点 **Create Static Site**，等待部署完成。

---

## 关于「启动命令」和「环境变量」

- **静态站方案（推荐）**：不需要启动命令，也不需要任何环境变量。
- **Web Service 方案（可选）**：如果你想用 `node server.js` 跑一个常驻进程（不推荐，会占免费额度且有冷启动），也可以。仓库里的 `server.js` 已改成兼容 Render 自动注入的 `PORT` 环境变量。配置为：
  - Build Command：留空
  - Start Command：`node server.js`
  - 环境变量：无需手动配置（Render 会自动注入 `PORT`）

> 除非你有特殊需求，否则**强烈建议用静态站方案**，更快更省。

---

## 数据安全提醒

- 所有学习数据（单词本、错词本、打卡记录）只存在**你浏览器本地的 localStorage**，不会上传到 Render 服务器。
- 换设备或换浏览器时，用页面内「设置 → 数据管理」的 **导出 JSON 备份 / 导入恢复** 迁移数据。
- 部署后的链接是公开可访问的，但数据不共享，别人打开看到的是**他们自己浏览器里的空数据**，不会看到你的数据。
