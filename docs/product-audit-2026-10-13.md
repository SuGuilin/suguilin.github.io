# SuGuilin 产品与知识质量验收 · 2026-10-13

目标是让已有 Python/ML/LLM 经验的学习者持续深化：发现值得研究的问题，读懂机制，做出实验，写下自己的理解，再用复习与面试追问检验。资料数量、勾选次数、模型自动评分不能单独证明掌握。

## 本轮发现与修复

| 真实问题 | 用户影响 | 本轮处理 |
| --- | --- | --- |
| 面试页点击“算法”，URL 改变，列表仍为全部，选中状态未变 | 分类不可用，返回链接也无法恢复分类 | 分类与搜索从 URL 读取，专门更新题目列表；不再交给资料目录事件处理 |
| 大块模拟练习和进度介绍把题目推到首屏底部 | 来查一道题需要先读不必要的介绍 | 改为一行练习操作，知识补课入口折叠；题号固定为题目 ID |
| Agent 工程课程有基础，Transformer 与微调机制不足 | 难以回答 Attention、缓存、LoRA、DPO 的计算和追问 | 增加两篇完整机制课、6 道有算例的练习、两个数学/梯度 notebook、12 道面试题 |
| 雷达只有 Jev 一条深入推荐，旧搜索结果占据长页面 | 难以区分近期研究、学习机制和过去搜索 | 增加 Harness 组件研究与后训练深化，逐方向显示核实日期；旧缓存默认折叠，新搜索自动展开 |
| 新仓库、论文与已有讲解没有显式对应 | 找到资料后不知道从何处学 | 资料支持显式关联专题；源类型可与分类/关键词组合筛选 |
| 面经练习链接只显示“训练 35” | 无法判断链接解决哪个问题 | 显示真实问题标题，保留作者、日期和免费可读范围 |
| 实测发现题目外层 22px 与 summary 内层留白叠加，自评数字不即时更新 | 每题占约 119px，勾选后数字仍旧 | 去掉外层重复留白与列表 gap，计数即时更新并兼容移除的旧圆环 |
| 到会员官网提问后，复制内容只有正文和来源 | 从外部问答回到原笔记/章节不方便 | 复制上下文包含可信的本站精确回链；外部或含凭据的返回地址不接受 |
| 通用实验导入说明写“无训练”，但新实验实际进行小矩阵梯度下降 | 实验范围表述矛盾 | 为后训练报告说明真实小矩阵优化，并区分未执行的大模型训练 |
| 作者分享的核验说明整段展开 | 内容与操作空间被长说明占满 | 核验详情折叠可查；不删除证据边界 |

## 知识覆盖与质量标准

每篇讲解需解释机制与适用前提，有具体反例、参考答案、来源范围和对应代码实践；实验区分数学教学、真实 SDK、模型推理、训练与完整 benchmark。当前课程有 30 个专题，含 14 篇系统机制课与 16 篇项目/论文导读，88 道专题练习，42 道原创面试训练题。

| 学习方向 | 当前正文与实践 | 继续研究边界 |
| --- | --- | --- |
| 模型机制 | token/logits、Attention、mask、decoder、RoPE、GQA、缓存；逐元素实验 | MLA、MoE、量化为机制入口，未实现 GPU kernel 或完整训练 |
| 后训练 | SFT、数据分组、LoRA 梯度、DPO、PPO/GRPO 位置；有限差分与小矩阵下降 | CPU 实验不是 LLM 微调效果；TRL/PEFT main 明确为开发文档 |
| Agent 执行 | 合同、ReAct、Harness、LangGraph、Deep Agents、MCP、恢复、安全、多 Agent | 固定任务/SDK 实验与真实模型效果分开；SDK 版本有记录 |
| 知识与记忆 | RAG、RRF、rerank、时序记忆、上下文预算与冲突 | 检索 toy 数据不能代表真实企业召回；需要用户数据上的冻结评测 |
| 评测与部署 | 配对统计、可靠性、GAIA/τ/Harbor、推理指标与副作用 | 不将论文分数或作者观点写成本站复现成绩 |
| 面试 | 原理、模型基础、后训练、算法、工程、评测、设计与复盘；公开面经链接到题目与课文 | 9 篇面经来源为个人自述/汇编，不是企业确认；不宣称全公司的题目已穷尽 |

原 28 个专题、82 道题的 ID/提示和阅读锚点保留。新内容进入知识分组、阶段路线、全站搜索、Colab/下载、结果导入、笔记、提问与复习。用户原有进度与记录不因扩展而重新计算。

## 多平台调研证据与使用方式

搜索覆盖官方文档/论文、GitHub、中文技术博客、知乎、掘金、牛客、B 站、微信公众号、小红书与 Reddit；检索结果只是发现线索，不能把索引当已读正文。本轮只把取得并核对的内容写入知识结论。

| 来源 | 本轮读取范围 | 形成的内容 |
| --- | --- | --- |
| [Transformer 原论文](https://arxiv.org/abs/1706.03762)、[RoFormer](https://arxiv.org/html/2104.09864v5)、[GQA](https://arxiv.org/abs/2305.13245)、[FlashAttention](https://arxiv.org/abs/2205.14135) | 相关机制，RoPE §3；未复现论文分数 | 模型机制课，形状、掩码、旋转与 IO 边界 |
| [Transformers 缓存文档](https://huggingface.co/docs/transformers/en/cache_explanation)、[DeepSeek-V3 仓库](https://github.com/deepseek-ai/DeepSeek-V3) | 缓存条件与布局、历史架构介绍 | 增量等价实验，MLA 特殊布局提醒；不称历史模型为最新 |
| [LoRA](https://arxiv.org/abs/2106.09685)、[DPO 原论文 §3–4](https://arxiv.org/html/2305.18290v2) | 矩阵更新与偏好目标 | 原创算例、梯度核对、reference 方向实验 |
| [TRL SFT](https://huggingface.co/docs/trl/en/sft_trainer)、[DPO main](https://huggingface.co/docs/trl/main/en/dpo_trainer)、[PEFT LoRA main](https://huggingface.co/docs/peft/main/package_reference/lora) | 监督目标、模板、LoRA 配置与初始化 | 不提供未经运行的模型安装训练配方；区分稳定版与 main |
| [Beyond the Model · 2026-09-26 v1](https://arxiv.org/html/2609.32459v1) | 摘要、模型×任务×Harness 设计与组件结论 | Harness 正文补充；不能用“复杂任务必须多 Agent”代替配对消融 |
| [Microsoft 官方课程](https://github.com/microsoft/ai-agents-for-beginners)、[HF 课程](https://github.com/huggingface/agents-course)、[Zero2Agent](https://github.com/alienzhou/zero2agent)、[Agent Lightning](https://github.com/microsoft/agent-lightning) | 课程 README/目录、公开运行要求、Lightning v1.0/新闻 | 课程入口与既有讲解衔接；未运行这些仓库样例，不保证云资源免费 |
| [Hugo Zhu 企业 Runtime 博客](https://hugozhu.site/post/2026/143-enterprise-agent-runtime-five-layer-architecture/)、[中文 Harness 手册](https://harness.zhigouread.com/components/context-engineering) | 公开正文 | 作为作者观点，核对确定性、审计、MCP 和委派断言；不照搬成规范 |
| [知乎 Harness 实践](https://zhuanlan.zhihu.com/p/2058188813529244032)、掘金、B 站、Reddit | 知乎索引可见，直接正文超时；其余按实际取得范围识别 | 作为继续发现入口，未观看视频，不据排名/营销标题判断质量 |
| [快手面经](https://www.nowcoder.com/discuss/876505573997432832)、[美团汇编](https://www.nowcoder.com/discuss/927381887545245696) | 原帖免费部分；剩余 60% 付费，未读取 | 原创题意摘编、mask/状态/API/实验练习；不复制付费内容 |
| [GitHub 面试索引](https://github.com/DolbyUUU/Awesome-LLM-Interview-Questions-and-Answers)、[面试资料仓库](https://github.com/Imironman123/llm-interview-notes) | README 与主题目录 | 识别算法覆盖缺口；前者明确大量答案由模型生成，未据此认定答案正确 |
| 飞雪谈AI、公众号 Jev 线索、小红书课程贡献者帖子 | 公开搜索与直接访问；未取得能确认的正文 | 作者入口保留；未添加虚构原帖要点或声称阅读全文 |
| [Readwise 标注/笔记](https://docs.readwise.io/reader/docs/faqs/highlights-tags-notes)、[高亮复习](https://docs.readwise.io/readwise/docs/faqs/reviewing-highlights) | 产品官方文档 | 参考标注、上下文回链、主题复习与导出的关系；不把高亮次数当掌握度 |

逐项核实时间与范围保留；本次更新没有覆盖旧资料的核实日期。没有付费模型请求、账号开通或后端配置修改。

## 运行与交互验收

构建自动打包正文数据与界面，CSS/Notebook 变化参与缓存版本。自动检查覆盖筛选组合/重开 URL、来源类别、坏引用、面经回链、新实验的负检查保留、备份兼容及原学习功能。

实际线上第一轮：后训练筛选得到 5 题，叠加 DPO 得到 2 题；刷新保留筛选。GitHub +“课程”得到 4 条，原仓库与已有专题分别可进入；空结果清除恢复全部 132 条。手机 390×844 深色模式下，面试、雷达、计划、日志、知识库均无页面横向溢出，历史发现默认折叠。

沿 DPO 第 37 题进入后训练正文，正文 16px/25.6px。通过站内下载获得 finetuning-foundations.ipynb，SHA256 `1f27545a133d2b14a3c11d1355fa762974d4eb70c7fcc077304c70cee2eabd23`，与交付代码相同。实际执行所有格：LoRA 解析梯度/有限差分一致、基础矩阵不变，小矩阵 loss 从 0.2 降至约 4.94e-10；DPO 同差/正差/换标签 loss 为 0.6931/0.6444/0.7444。导入报告后 3 道作答仍为空；报告进入笔记、日志和提问上下文，复制含 LoRA/DPO 一手来源。所有数字属于教学计算，未进行真实大模型训练。

验收记录明确为产品测试，不能当成用户掌握度或学习成绩。最终复查、备份与清理在下一段记录。
