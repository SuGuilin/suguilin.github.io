# SuGuilin · 个人 Agent 学习平台

保留 SuGuilin 品牌和历史博客，面向已有 Python、ML、LLM 经验的开发者。专题学习、关键要点、实践、面试准备与私人记录形成持续学习流程。

当前有 109 条资料、6 篇深入专题、15 份资源导读、12 个阶段 / 36 个任务、4 条项目主线、6 篇机制短篇、30 道原创面试训练题；另有 6 篇公开面经索引和 5 份练习资料。研究快照核实于 2026-10-11，访问范围逐条注明。面经是作者自述，不能视为企业确认题库。

## 可直接使用

- 首页继续学习；专题有核心要点、前置知识、代码、实验、自检、目录和一手来源。
- 知识库分类、搜索、分页、收藏及 15 份要点 / 误区 / 练习 / 自检导读。
- 路线任务、阅读完成、项目里程碑、面试掌握度保存到本机；日志支持 Markdown、编辑和删除撤销。
- 面试页区分原创训练、公开面经与练习资料，可按公司筛选。
- 技术雷达“一键搜索并补充”：调用 GitHub、Crossref、Hacker News 公开接口，每个来源最多 6 条，按时间范围发现并去重保存到“资料收件箱”。另有小红书、牛客、知乎、掘金、B站搜索入口，受限内容需在原平台阅读。
- 检查 6 个官方仓库最新稳定发布，显示发布 / 读取时间，失败保留旧结果。
- 完整 JSON 导出与预览导入；同 ID 内容差异保留两份，重复导入去重。
- Obsidian ZIP 包含中文 Markdown 笔记、AI 对话、收藏、进度与完整 JSON。解压后可作为库打开；Markdown 编辑不会自动回传，回到网站使用原生 JSON 导入。
- 13 个静态路由、浅色 / 深色、响应式导航、键盘焦点、全站 ⌘K / Ctrl+K 搜索。

实时发现结果是未读原文的线索，不能冒充已核实知识。GitHub 日期是代码更新日期，论文日期来自出版元数据，讨论日期是发表时间；近期更新不等于近期首次发布。公开接口可能限流或暂不可用，失败逐来源显示，旧结果带原检索时间。

## 后端状态与费用

Supabase Auth、按账号隔离的同步、离线队列、版本冲突、删除传播、服务端 OpenAI Responses 流式问答及可选联网搜索已实现。当前公开配置留空，**真实 Supabase 项目和模型服务尚未启用**。页面因此显示“云端待连接 / 模型服务待接入”，没有模拟 AI 回答。

采用 Supabase Free：闲置可能暂停，本机使用、备份、再导入仍保留。OpenAI API 与联网工具另行按用量计费，与 ChatGPT 订阅不同；三来源公开搜索不需要模型密钥。

见 [后端接入说明](docs/backend-setup.md) 和 [完整要求、设计研究与验收](docs/product-acceptance.md)。个人记录不进入 GitHub；密钥不进入静态文件或导出备份。

## 本地开发

Node.js 22+、pnpm。SDK 已打包到同站 assets/vendor，线上无需 CDN 或 Node 服务。

```sh
pnpm install --frozen-lockfile
pnpm build
pnpm test
python3 -m http.server 8000 --bind 127.0.0.1
```

访问 http://127.0.0.1:8000/ 。资源从域名根目录引用。

## 源码

- src/shell.html、scripts/build.mjs：外壳、导航、13 路由与 sitemap。
- assets/product.js / product.css：首页、专题、知识库与统一视觉。
- assets/workspace.js：路线、项目、日志、资料详情、搜索与路由。
- assets/discovery.js / updates.js：实时发现、资料收件箱与发布动态。
- assets/platform.js / sync.js / backup.js：账号、问答、同步、JSON 与 Obsidian。
- assets/state.js / markdown.js：旧 v1 兼容、校验、合并与安全阅读。
- content/workspace.json / lessons.json：公开资料、专题、要点、练习与来源证据。
- supabase/：迁移、RLS、同步 RPC、成员授权、问答函数；知识快照由 scripts/knowledge.mjs 生成。
- scripts/*.test.mjs：恢复、并发、离线、ZIP、实时发现、鉴权、流式响应测试。网络测试用 mock，不代表真实云端部署通过。

## 发布与历史博客

main 保存维护代码，GitHub Pages 从 gh-pages 根目录发布。两分支的旧博客有历史差异，发布只迁移本次工作台变更，保留线上旧文章与主题，不能用 main 覆盖 gh-pages 全部文件。推送后确认 Pages Actions 和线上文件。

原 /blog/、文章、归档及独立页保留。/link/ 是正式友链路径，/links/ 跳转；气泡脚本本地化为 /js/chocolate.js。历史音乐 / 影视页仍为空状态，旧博客部分外部资源依赖网络。仓库没有 Hexo 原始 source、主题源码或配置；当前 package.json 用于工作台，不能作为 Hexo 生成项目。
