# SuGuilin · Agent Workspace

面向持续深化的个人 Agent 学习工作台。保留 SuGuilin 品牌及历史博客，以机制、算法、源码、评测、产品工程和岗位能力连接学习与实践。

第一版包含 84 条资料入口、12 个深化阶段 / 36 个任务、4 条项目主线、6 篇原创导读与 30 道原创面试训练题。资料核实于 2026-10-11；代表性研究精选不代表穷尽行业。GitHub、官方文档、论文、课程和岗位为主要来源，B站、知乎、掘金、公众号、X、YouTube、小红书及 Reddit 为发现入口。每条注明来源与核实范围。

网站为静态应用，无第三方运行时依赖，可直接使用 GitHub Pages。新工作台不依赖旧博客的 CDN、动画或 Live2D。

## 本地预览

在仓库根目录运行：

```sh
python3 -m http.server 8000 --bind 127.0.0.1
```

打开 <http://127.0.0.1:8000/>。按 `Ctrl+C` 停止服务。页面使用从站点根目录开始的资源路径，请通过 HTTP 服务访问，并在部署时使用域名根目录。

## 工作台功能与数据

- 总览连接当前阶段、知识与实践；路线任务、项目里程碑和面试掌握度可勾选。
- 全站搜索支持 `⌘K` / `Ctrl+K`；知识库支持分类、关键词、网格/列表与分页。
- 资料可查看来源与核实说明、访问官方入口、收藏。
- 日志支持新建、编辑、删除/撤销、常用 Markdown 阅读、单篇 Markdown 导出及 JSON 备份。
- JSON 导入先校验并展示摘要，再合并；同 ID 笔记保留较新的版本，已有学习节奏保留。
- 阶段/项目提供协作学习提示词；模拟面试提供计时、原创自查维度与复盘保存。
- 浅色/深色、响应式导航、键盘焦点和减少动态效果偏好均受支持。

个人数据保存在当前浏览器 `localStorage`，不会自动公开或跨设备同步。换设备或清理浏览器前导出备份。编辑器显式保存；未保存离开会提醒。当前没有模型 API 调用或账号后端。公开站点资料位于仓库，私人笔记不进入 Git。

## 源码与维护

- `src/shell.html`：公共 HTML 外壳；`scripts/build.mjs`：生成独立静态路由与 sitemap。
- `assets/workspace.js` / `workspace.css`：路由、交互与设计系统。
- `assets/state.js` / `markdown.js`：数据校验、合并与安全文本阅读。
- `content/workspace.json`：资料、阶段、项目、训练题、导读和岗位证据。添加条目时补齐一手链接、核实日期与访问范围，避免编造学习完成情况、跑分或真实面试题。
- `blog/index.html` 与原文章/归档路径：保留原博客。

Node.js 22+ 可运行以下命令；没有 npm 依赖需要安装：

```sh
node scripts/build.mjs
node scripts/verify.mjs
node --test scripts/state.test.mjs
```

修改外壳后运行 build；样式或功能变更后在浏览器检查桌面、手机与深色模式，以及搜索、持久化、笔记、导入/导出和原文章路由。

## 设计参考

本轮研究 [Linear](https://linear.app/) 的导航与信息层级、[Vercel](https://vercel.com/) 的网格和细线、[Anthropic Engineering](https://www.anthropic.com/engineering) 的编辑式阅读布局，以及 [Hugging Face Learn](https://huggingface.co/learn) 的学习内容组织。工作台保留自己的品牌、暖白/苔绿配色与原创 Agent 循环示意；未复制这些产品的代码、插图或标志。

## 发布

GitHub Pages 当前从 `gh-pages` 分支的根目录发布；`main` 保存维护代码。两者保留独立历史，旧文章和主题存在既有差异。发布时将本次修改应用到最新 `gh-pages`，保留该分支上的旧博客内容，不能直接用 `main` 覆盖全部发布文件。推送后核实 Pages Actions 部署成功及线上资源。

## 历史博客

- 友链的正式路径是 `/link/`，旧路径 `/links/` 会跳转到正式页面。
- `/share/`、`/photos/`、`/music/`、`/movies/`、`/comment/` 是保留的独立静态页面；`/about/` 已升级为工作台介绍。
- 音乐和影视目前显示空状态，添加真实条目后可替换正文；留言板使用邮件和 QQ 联系方式，没有在线留言存储服务。
- 气泡效果使用本地 `/js/chocolate.js`；部分图标、主题扩展和外部图片仍依赖网络。

仓库不包含 Hexo 的 `source/`、主题源码、`_config.yml` 或 `package.json`，因此不能在这里运行 `hexo generate`。以后若从原 Hexo 项目重新生成站点，应先将页面、导航和气泡脚本的修改同步回源项目，避免发布时覆盖。
