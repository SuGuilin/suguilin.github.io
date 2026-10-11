# Supabase Free 与服务端学习助手

当前代码已实现；真实项目、数据库迁移与模型调用尚未启用。以下配置针对私人工作台。

## 免费项目、授权与登录

1. 在 Supabase Free 组织建立项目，不升级套餐或启用付费附加项。闲置暂停规则见 [官方说明](https://supabase.com/docs/guides/platform/free-project-pausing)。
2. 在 SQL Editor 依次执行 supabase/migrations/202610110001_workspace.sql 和 202610110002_study.sql，或用已登录的官方 CLI 链接项目后执行 supabase db push。迁移尚未在真实项目执行。
3. Authentication → Users 管理员入口创建自己的用户并验证邮箱。前端 shouldCreateUser:false，不自行注册。
4. 在 SQL Editor 授权确切账号，核对仅预期用户被加入：

```sql
insert into private.workspace_members(user_id)
select id from auth.users where email = 'YOUR_VERIFIED_EMAIL'
on conflict do nothing;
```

成员表与 AI 配额表位于 private schema。客户端仅可读取自己的文档，写入经有版本比较的 RPC。非成员即使登录也不能读写或调用模型。

Auth Site URL 设置为 https://suguilin.github.io ，Redirect URLs 加 https://suguilin.github.io/account/ 。本地调试可另加 http://127.0.0.1:8000/account/ ，不用宽泛通配符。邮件模板使用有效登录链接或验证码，PKCE 链接在请求邮件的浏览器完成。

## 公开连接参数

assets/public-config.json 仅填写 URL 与 publishable key（或 legacy anon key）：

```json
{
  "supabaseUrl": "https://YOUR_PROJECT.supabase.co",
  "supabasePublishableKey": "YOUR_PUBLIC_KEY",
  "assistantFunction": "learning-assistant",
  "synthesisFunction": "learning-synthesis",
  "enableWebSearch": false
}
```

不能填写 service_role、secret key 或 OpenAI key。发布公开配置后，账号页启用登录。登录前本机记录单独保留；登录后选择“合并登录前的本机记录”，先预览再合并。

## 服务端模型

在 Supabase Edge Function Secrets 安全界面配置，不在聊天、Git 或前端中填写密钥。

| Secret | 用途 |
| --- | --- |
| OPENAI_API_KEY | OpenAI 项目密钥，仅服务端 |
| OPENAI_MODEL | 账号可用、支持 Responses 与严格 Structured Outputs 的模型 ID |
| ALLOWED_ORIGINS | 默认 https://suguilin.github.io；调试可追加逗号分隔的 localhost origin |
| OPENAI_WEB_SEARCH | 默认 false；确认模型支持与工具费用后才设 true |

平台注入 SUPABASE_URL / SUPABASE_ANON_KEY。函数使用真实用户 token 验证 Auth 与成员资格，不使用管理员数据权限。问答与 AI 整理共用每日 40 次、至少间隔 3 秒的请求限制，不是免费模型额度或货币硬上限。

```sh
node scripts/knowledge.mjs
supabase functions deploy learning-assistant
supabase functions deploy learning-synthesis
```

config.toml 的 verify_jwt=false 是因为 handler 自行验证用户与成员授权，兼容 publishable key；不能删除实际鉴权。联网默认关闭。服务端开启并真实验收后才把公开配置 enableWebSearch 设 true；用户勾选时才要求调用 web_search，最多 2 次工具调用，回答带可点击引用，可保存到个人日志。

OpenAI API / web_search 另行计费，不含在 ChatGPT Plus / Pro 中，以 [官方价格](https://developers.openai.com/api/docs/pricing) 为准。可在 OpenAI 控制台配置适合自己的用量与通知。

## 必须执行的真实验收

1. 未登录课程可读、本机可记；云端与模型拒绝访问。
2. 非成员登录仍不能读表或写 RPC，不能调用模型。
3. 授权账号创建笔记、收藏、阅读进度，第二设备看到一致内容。
4. 两设备同时修改同一记录，展示冲突，两份可导出，选择后一致。
5. 离线修改 / 取消收藏 / 删除，恢复网络后传播；丢失响应重试不重复写入。
6. 实际模型流式回答、停止、断线保留、来源链接和服务端密钥隔离。
7. 实际联网问题检索近期原始资料，核对时间和引用；关闭时不调用工具。
8. 实际读取 README / 摘要并生成 AI 单元，验证正文依据、练习参考思路、排期及失败时不保存半成品。
9. JSON / Obsidian 导出，第二浏览器预览导入，学习单元、作答与复习日期保留；冲突作答另存到日志。
10. 项目暂停后，本机继续保存并导出；恢复项目或导入后同步。

## 暂停与备份

云端不可用时修改进入本机待同步队列，刷新仍保留，状态不谎称已上云。未取得数据的另一台设备需要备份才能离线恢复。建议每周导出完整 JSON 或 Obsidian，恢复暂停项目后重试，不自动升级付费。

导出包含笔记、对话、收藏、阅读、任务与项目进度、个人学习单元、作答、复盘、时间预算与复习日期，不含 token、API key 或内部同步队列。Obsidian Markdown 可独立阅读编辑，但网站恢复使用原生完整 JSON；同 ID 内容差异另存。

## 无后端的公开实时发现

GitHub / Crossref / Hacker News 仅发送公开技术关键词，不读取私人笔记。最多 18 条 / 轮、30 秒冷却、18 秒超时，失败独立显示。检索结果先保存为待核实线索，默认继续从固定公开接口读取 GitHub README、Crossref 摘要或 HN 主帖，摘取关键陈述、生成规则练习并排入计划。未读到正文的结果不能成为学习单元；受限帖子需用户粘贴公开节选。

接口规则见 [GitHub Search](https://docs.github.com/en/rest/search/search)、[Crossref 公开访问](https://www.crossref.org/documentation/retrieve-metadata/rest-api/access-and-authentication/)、[HN Search API](https://hn.algolia.com/api)。结果取决于上游索引，不能保证行业覆盖完整或即时收录。

## 会员官网整理与证据检查

无需后端时，可在资料整理面板复制含实际正文的结构化任务，在 Gemini / ChatGPT 会员官网粘贴，再把 JSON 结果导回本站。复制动作不自动上传；用户在官网提交时才发送正文。导入绑定本次来源，逐条检查 evidence 是否原样出现在正文中，并限制数量与长度。该检查用于回查依据，不能证明总结的语义正确，结果仍标注“待核验”。

Gemini 消费者会员与 API 配额分开，见 [Google 官方团队说明](https://discuss.ai.google.dev/t/google-ai-studio-pro-version-and-free-tier/169368/2) 和 [Gemini API 计费](https://ai.google.dev/gemini-api/docs/billing/)。本站没有借用官网 Cookie 或登录状态。

learning-synthesis 只请求服务端 OpenAI Responses，store:false，使用严格 JSON Schema；正文依据通过检查后才返回单元。README 中的指令作为素材处理，不执行其中的安装、投稿或分享动作。读取适配器只访问固定供应方接口，有 15 秒超时、400 KB 读取上限与 24,000 字符节选范围；实际范围在单元中保留。
