# 雅思词汇工作台

一个离线可用的雅思词汇学习工作台，覆盖刷词、听音辨义、拼写、错词复习、艾宾浩斯记忆曲线等。

## 线上地址（当前生效）

**https://ielts-vocab-workbench-97952.app.workbuddy.host/**

> 旧地址 `https://29434aabec424d5f960282f5c0ffa5a2.app.workbuddy.link/` 已无法从本工作区更新，代码停留在旧版本，请勿再使用。

云端数据托管在同一个 Supabase 项目（ref `fheznzjgwxyqtpdezwny`），页面内「云同步」登录后可在多设备同步单词本、错词本与学习进度。

## 技术栈
- 原生 HTML / CSS / JavaScript，零外部依赖
- 数据存浏览器 localStorage（不上传服务器）
- 轻量 Node 静态服务器（仅本地开发用）

## 本地运行
```bash
node server.js
# 打开 http://127.0.0.1:8765
```

## 部署
本项目是纯静态站，可直接托管到 Render / Vercel / Netlify / GitHub Pages，无需启动命令或环境变量。

- **Render**：仓库根目录已含 `render.yaml` 蓝图（静态站类型）。在 Render 控制台 `New + Blueprint` 连接本仓库即可一键创建。
- **Vercel / Netlify**：导入仓库后，构建命令留空，发布目录选 `.`。
- **GitHub Pages**：启用 Pages 后发布分支的根目录即可。

> 数据安全：所有学习数据只存在你浏览器本地的 localStorage，部署到任何平台都不会上传到服务器；换设备需用页面内的「导出 JSON 备份 / 导入恢复」迁移。
