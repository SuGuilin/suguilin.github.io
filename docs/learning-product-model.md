# 学习产品模型与本轮研究

2026-10-12。这是实现与验收依据，不是宣称产品已经成熟。当前面向已有 Python、ML、LLM 经验的个人学习者；免费本机使用、可备份，后端保持既有状态。

## 从学习者的批评开始

| 学习者可能怎样吐槽 | 实际问题 | 本轮处理 | 仍需验证 |
| --- | --- | --- | --- |
| 点进标题，还是几个概念和链接 | 16 个导读缺少连续解释 | 增加机制、案例、失败分析、验证与深化路径；22 个现有单元均有正文 | 多数项目尚未实测，不能称完整课程 |
| 入口太多，下一步在哪里 | 学习、框架、项目、路线、助手处于同一导航层 | 每日计划、专题、日志优先；资料单列；路线实践按需展开 | 新导航的视觉与实际使用复核未完成 |
| 我有自己的疑问，复制后上下文丢了 | 导读补充来源未进入提问 | 讲解来源与原导读来源合并，去重并进入复制/保存问题 | AI 没有真实调用，不能认证回答质量 |
| 跑完代码，结果没地方接回去 | Jev notebook 没有报告导入 | 验证合成概率报告，保留原思考，接到作答、日志和备份 | 未在 Colab 网页执行，已本机 CPU 执行 |
| 第一次标注后还让我“开始标注” | 空态和计数没有立即更新 | 实时更新空态、计数与标注列表 | 本轮较早的真实浏览器已验证 |
| 一次复习打开几屏旧内容 | 前次报告和旧作答默认铺开 | 旧证据可展开对照；列表先展示自己的理解 | 原文、编辑、搜索与备份保留全部内容 |
| 标了最新，实际只有一份旧摘要 | 日期和阅读范围混在一起 | 逐篇记录机制核对日期与实际读到的来源范围 | 没有自动保证所有资料持续最新 |

## 学习的对象与关系

基座不是把功能页堆在一起。需要追踪同一知识问题在不同阶段的状态。

| 对象 | 必须回答的问题 | 当前连接 |
| --- | --- | --- |
| 来源与版本 | 作者是谁、是什么日期/版本、实际读到了哪里 | 官方文档、论文指定章节、作者观点、发现线索分别声明 |
| 专题讲解 | 要解决什么问题、机制为何成立、有哪些反例 | 正文→案例→验证→限制→原始依据 |
| 标注与收藏 | 值得回看的是什么，为什么 | 标注附原文和自己的思考；收藏回到同一学习单元 |
| 问题 | 哪个细节不理解，已经知道什么 | 选文/作答/实验观察与来源进入提问、保存疑问 |
| 练习与实验 | 能否独立解释、能否用产物验证 | 作答先于参考思路；报告导入不覆盖已有解释 |
| 复习尝试 | 与上次相比理解改变了什么 | 新作答独立保存；旧证据按需对照；自评安排复习 |
| 日志 | 如何回到上下文并继续 | 单元、原文位置、个人记录互相返回 |
| 推荐 | 为什么此时学这个 | 到期复习、未解疑问、未自检作答及剩余时间优先 |

当前自评和时间预算只是调度依据，不是掌握程度的客观认证。学习收益需要跨天独立复习与真实实践观察；本轮同日复习只验证功能。

## 调研如何判断够不够

资料数、平台数或总字数不证明全面。对每个专题建立问题覆盖：定义与前置→算法/数据流→具体算例→错误与边界→运行方式→结果如何验证→版本迁移。只读到摘要时，不能交付“完整算法课”；只跑合成示例时，不能交付“模型效果已验证”。

核心机制优先回到官方文档、源码或论文正文；厂商文章用于架构观点和案例；社交分享用于发现问题与不同观点，技术结论再回查直接依据。日期也分别看：原文发布、项目 release、页面核对时间、实际实验环境。出现新版本后，用已有失败与恢复样例重测，而不是只更新“最新”标签。

本轮新正文约 2.2 万字符，覆盖 16 个原导读。数字只说明改动规模；正文仍是机制和最小验证层，多数还没有真实模型、完整 benchmark 或训练复现。原有六篇系统专题继续保留。121 条原资料加四篇已读工程文章为 125 条；资料库条数不等于课程数量。

## 学习与阅读产品参考

以下按实际公开资料理解功能模式。浏览器视觉访问被保存的权限设置拦截，未声称亲自体验它们的登录后界面或付费课程。

| 产品/资料 | 实际阅读范围 | 用到本产品的判断 |
| --- | --- | --- |
| [Hugging Face Agents Course](https://huggingface.co/learn/agents-course/unit0/introduction) | 课程介绍、前置条件、理论/实践/挑战组织 | 专题要有明确前置与实践目标，不把链接当讲解 |
| [DeepLearning.AI Agentic AI](https://www.deeplearning.ai/courses/agentic-ai) | 官方课程介绍与模块结构 | 把大主题拆成可学习问题；不复制课程内容 |
| [FSDL LLM Bootcamp](https://fullstackdeeplearning.com/llm-bootcamp/) | 2023 课程结构 | 机制、项目、UX、运维需关联；旧课程不是最新 API 依据 |
| [Datawhale](https://www.datawhale.cn/learn)、[HelloAgents](https://github.com/datawhalechina/hello-agents) | 开源学习入口与课程 README | 有经验者按问题选读，固定任务比较实现 |
| [Educative](https://www.educative.io/learn-to-code) | 官方文字课程、练习与项目说明 | 阅读和练习贴近，避免离开正文才找得到练习 |
| [Exercism](https://exercism.org/) | 官方概念练习与指导说明 | 作答、比较、反馈和再次尝试，而不只是完成打勾 |
| [Brilliant](https://brilliant.org/) | 官方互动学习介绍 | 机制需要可操作算例；未据营销说明声称学习效果 |
| [roadmap.sh](https://roadmap.sh/ai-engineer) | 公开路线结构 | 路线是定位工具，不让每天学习承担整条路线的负担 |
| [Readwise Reader](https://docs.readwise.io/reader/docs/faqs/highlights-tags-notes) | 标注、笔记与导出说明 | 思考附原文，记录能回到上下文 |
| [Readwise review](https://docs.readwise.io/readwise/docs/faqs/reviewing-highlights) | 日常与主题复习说明 | 回看不等于掌握；本站保持独立作答与旧内容分开 |
| [Obsidian Backlinks](https://obsidian.md/help/plugins/backlinks) | 反向链接及上下文说明 | 导出保留原始来源和返回位置，备份可再导入 |
| [NN/g Progressive Disclosure](https://www.nngroup.com/articles/progressive-disclosure/) | 按需展示的设计原则 | 常用操作可见，旧证据和进阶入口按需展开 |

## 技术依据与时效范围

每篇讲解末尾给出直接来源。不能把“打开了全文页面”写成“读完全部全文”。本轮重点如下。

| 方向 | 本轮实际阅读 | 本轮未完成 |
| --- | --- | --- |
| LangGraph | persistence、interrupts；恢复重跑与状态边界 | 生产 saver 部署与故障测试 |
| Deep Agents | 当前 overview、规划启用变更、工具/backend/权限 | 真实模型与 sandbox 运行 |
| MCP | [2026-07-28 架构](https://modelcontextprotocol.io/docs/2026-07-28/learn/architecture) | 完整 transport / auth 实现 |
| ReAct | [全文](https://arxiv.org/html/2210.03629v3) §2、§3.1、§3.3：行动空间与失败对照 | 原论文模型与任务成绩复现 |
| DSPy | [全文](https://arxiv.org/html/2310.03714v1) Signature、Predict trace、bootstrapping 相关段落与当前 README | 实际优化器实验与完整消融 |
| GAIA | 官方公开数据卡的题目、附件、split 与访问范围 | 受限数据与官方评测运行 |
| τ 系列 | 当前 τ³ README、release 和 grader 更新说明 | 模型与用户模拟器的固定域运行 |
| Terminal-Bench / Harbor | 官方 task 文档索引节选与运行入口 | 镜像、verifier 隔离与 benchmark 运行 |
| Mem0 | README、开源 overview、REST 文档公开索引节选 | 真实提取、检索、冲突与删除链路 |
| verl | GRPO 算法页；归一化和 mask 的离线算例 | GPU rollout 与训练 |
| Agent Lightning | 重构后的 v1.0 README 三组件职责 | 网关采集与训练样本对齐实测 |
| RAGEN | [全文](https://arxiv.org/html/2504.20073v2) §4.2、§4.3、低方差相关分析 | 完整 reward、代码与训练消融 |
| Search-R1 | 当前 README 的 inference / training / 历史后端范围 | 检索服务与训练 |
| DeepSeek-R1 | README 的模型路径与评测协议 | 模型推理、量化与评测 |
| Jev | Introduction、Confidence、1.13 jaggedness；8 样本离线实际输出 | Jev API 响应及目标场景校准 |

## 国内外工程观点与社交发现

已补入知识库并带阅读问题：

- [腾讯云 ADP 工程实践](https://adp.tencent.com/zh/blog/agent-harness-engineering-adp-practice)：实际读取运行时、状态、权限与反馈正文；作为作者架构观点，未复现团队效果。
- [LangChain 评测实践](https://www.langchain.com/blog/how-we-benchmark-deep-agents)：已读多域端到端评测和重复运行说明；作者报告不作为本站成绩。
- [Anthropic Managed Agents](https://www.anthropic.com/engineering/managed-agents)：已读事件日志、上下文、harness、sandbox 和凭证代理的职责分离。
- [Google 行为评测](https://developers.googleblog.com/en/the-anatomy-of-harness-engineering-how-to-evaluate-iterate-and-guard-ai-coding-agents/)：已读行为检查与端到端评测的互补范围。

社区检索也实际执行了“飞雪谈AI / feixue_ai_talking”、微信公众号 Harness、XHS Agent 帖子与牛客面经等查询。索引出现噪声时没有采纳为技术依据。飞雪与小红书原帖正文未取得，保留原有发现入口；不能宣称已阅读或总结其近期文章。牛客汇总中找到[腾讯原帖](https://www.nowcoder.com/feed/main/detail/144c6ae334b24c0aa643ed43ccfebaac)，但当前返回轻量页面，没有得到原帖正文；未伪造真题或照抄汇总答案。

公众号转载页找到阿里云开发者的原始微信链接，转述包含强绝对化判断，仍需要原文与实验条件核对。本轮没有把“专才永远胜过通才”等观点当成普遍事实。

## 发布门槛与后续缺口

本轮可检查的门槛是：16 篇正文打开完整、章节与目录一一对应；收藏、提问、笔记和练习入口保留；来源进入问题；报告不覆盖原思考；旧复习记录可回看；JSON / Obsidian 保留原始数据；构建、测试、路径验证通过；只同步改动文件，保留历史博客与现有后端。

离成熟个人学习产品仍有具体差距：RAG/检索、多模态、推理服务与成本、安全、协议授权等方向的逐章深度不均；许多算法没有全文与源码逐行对照；模型训练需要真实环境；新界面需要桌面、移动、深色视觉和真实使用复核；跨设备与站内 AI 需真实账号/密钥按既有后端方案启用。不能以本轮发布代替这些验收。

优先继续按知识缺口完善已开始的专题，增加失败对照和可复现实验，再扩展新专题。社区高质量观点先进入来源记录，保留作者、时间、问题和核实范围，再形成讲解与练习；不会把每条发现链接自动包装为已掌握知识。
