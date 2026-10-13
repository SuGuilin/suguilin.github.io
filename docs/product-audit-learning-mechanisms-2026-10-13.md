# 学习平台第二轮产品验收 · 2026-10-13

本轮沿“缺失概念→补课→正文→算例→实验→个人解释→面试追问→复习”核对已有体系。课程仍为30篇、88道专题练习、42道面试训练；优先深化已有正文和参考答案，没有用新增标题数替代质量。外部目录134条、公开面经10篇；目录、已读教材和实际运行结果分别记述。

## 真实问题与处理

| 问题 | 学习后果 | 修复 |
| --- | --- | --- |
| 前置概念只有提问按钮，站内模型尚未启用 | 遇到Attention/KV、训练目标等缺口后没有直接补课入口 | 为30篇显式建模前置机制，直接连到现有课文；基础篇/自建资料允许无补读链接，概念提问仍保留 |
| 面试题能回课文，课文缺少对应追问入口 | 学习和面试变成两套入口 | 按题目显式studyUnits关系在练习后折叠展示相关追问，不靠关键词猜关联 |
| 推理课对量化与投机解码仅概括 | 无法解释采样语义、分布等价与失速反例 | 补top-p、拒绝残差、接受率与成本、int8夹值、KV块浪费和分离服务代价；实际运行概率/内存算例 |
| RAG只给rank融合和Recall | 容易混淆近邻准确与知识相关，将复杂管线视为必然更好 | 补ANN/相关性两种召回、MRR/nDCG算例、MaxSim、过滤/索引条件和近期对照研究的局限 |
| RL说明没有具体归一化对照 | 同名算法中不同目标、mask和版本差异无法定位 | 手算sequence/token平均与参考KL，扩展可执行研究notebook；当前文档默认只作为核对快照 |
| 扩展实验可能破坏旧报告导入 | 用户过去记录不能回看 | 保留基础报告，接受完整扩展集合；部分缺项、未知项和字符串伪布尔拒绝；未通过项如实保留 |

所有原有章节锚点、专题与练习ID保留。本轮补充使用原章节中的小标题，不移动chapter-N的意义；不重置作答、不将实验运行记为用户掌握。

## 30篇覆盖核对

下表是现有知识/来源/实践范围核对，不是宣称每个外部项目已完整复现。本轮深入修订推理、RAG和RL三篇；其他正文沿用上一轮逐篇质量修订，统一补上共享导航和交互。每篇仍需要用户自己的任务、数据与实验强化。

| 专题 | 可学重点 | 实践范围与仍需真实资源的部分 |
| --- | --- | --- |
| Harness | 状态、恢复、副作用、预算、组件消融 | SQLite/SDK实验；无真实模型长任务benchmark |
| 工具可靠性 | 契约、幂等、冲突、重试、未知结果 | 并发/恢复合同；非真实支付服务 |
| 评测统计 | 实验单位、配对、伪重复、回归 | 合成配对实验；非用户任务效果 |
| 长期记忆 | 时序、来源、归属、删除、冲突 | 时间与用户隔离；非生产记忆系统 |
| Agent RL | old/current/ref、优势、mask、归一化、KL | 标准库裁剪/聚合；无模型训练 |
| 生产系统 | 队列、租约、审批、取消、容量、取舍 | 过期worker合同；无多副本压测 |
| LangGraph | 状态/reducer、路由、Send、工具、子图、stream、interrupt、恢复 | 1.2.15真实SDK+SQLite；无模型调用 |
| Deep Agents | 上下文、文件、委派、沙箱边界 | 组件合同实验；未运行完整框架任务 |
| MCP | 发现、schema、结构化结果、错误、身份、协议 | 2.3.0内存/stdio；未做HTTP/OAuth部署 |
| ReAct | 观察反馈、行动、证据、停止 | 固定只读循环；非模型推理成绩 |
| DSPy | signature、评分、数据划分、优化泛化 | 评分器负例；未运行优化器 |
| GAIA | 多工具证据依赖、附件、产物、可比性 | 原创附件join；非官方题集成绩 |
| τ系列 | 规则、状态、用户、pass@k与pass^k | 组合估计；未运行用户模拟器 |
| Terminal-Bench | 环境隔离、真实产物、grader攻击 | 合同负例；无容器benchmark |
| Mem0 | 抽取、冲突、有效期、检索、消融 | 时序fixture；未调用Mem0服务 |
| verl | rollout、优势、mask、策略版本、batch | CPU目标算例；无分布式训练 |
| Agent Lightning | Harness轨迹、重分词、归并、运行一致性 | 身份/mask检查；未运行Gateway |
| RAGEN | 多轮采样、信用分配、零方差、崩塌诊断 | 合成优势/分布；未复现训练 |
| Search-R1 | 检索动作、环境观察、策略目标 | action mask；无搜索模型训练 |
| DeepSeek-R1 | RL、冷启动、蒸馏、采样条件 | 目标与指标；未加载权重 |
| HelloAgents | 从教程模块缩成可验收任务 | 调用合同与有限循环；未逐例运行整库 |
| Jev | 类型化决策、概率、校准、错误代价、回退 | 合成校准；未调用Jev API |
| 模型调用 | 消息/工具身份、结构、语义、失败 | 严格类型/日期/金额；无远端模型 |
| RAG | 入库、分块、ACL、ANN、融合、重排、MaxSim、证据、指标 | 离线排序/矩阵；无embedding/数据库压测 |
| 上下文 | 必需状态、预算、压缩、卸载、缓存 | 成本单位fixture；非真实tokenizer预算 |
| 安全 | 威胁模型、可信身份、对象授权、能力/秘密 | 本地合同；非完整红队认证 |
| 多Agent | 拆分、委派合同、共享状态、冲突、总预算、协议 | 归并负例；无模型团队效果归因 |
| 推理服务 | TTFT/TPOT、KV、batching、采样、投机、量化、分页、传输 | 概率质量/内存算式；无GPU引擎性能 |
| 模型基础 | attention、mask、decoder、RoPE、GQA、增量缓存 | 标准库逐元素等价；非完整LM训练/kernel |
| 微调基础 | SFT、分组数据、LoRA梯度、DPO、方法选择 | 小矩阵优化/有限差分；非LLM微调效果 |

进一步的领域覆盖仍包括多模态、分布式训练与GPU kernel、真实模型Agent任务、生产级检索/红队等。这些不因写了术语或外部链接就算已覆盖，需独立的教材、资源条件与实跑证据。知识范围不以资料条数认证。

## 本轮调研与采纳

- [投机解码原论文算法1](https://arxiv.org/pdf/2211.17192)、[vLLM当前文档](https://docs.vllm.ai/en/latest/features/speculative_decoding/)：接受、残差和多步前缀；分别说明数学、实现、浮点保证。本站不复制其速度成绩。
- [Transformers生成参数](https://huggingface.co/docs/transformers/en/main_classes/text_generation)、[量化概念](https://huggingface.co/docs/transformers/en/quantization/concept_guide)：top-p支持集、低精度表达/校准。原创概率、int8夹值和块分配已运行。
- [Qdrant索引](https://qdrant.tech/documentation/manage-data/indexing/)、[ColBERT原论文](https://arxiv.org/abs/2004.12832)：读取索引/过滤文档和ColBERT摘要；MaxSim用原创矩阵讲解，不声称读过或运行全部实现。
- [近期六管线RAG研究v1](https://arxiv.org/html/2609.38473v1)：读方法、结果和限制。judge未见证据、query合成、编码器共同变化，不能据此声称真实faithfulness或单组件因果收益。
- [TRL GRPO](https://huggingface.co/docs/trl/en/grpo_trainer)：读取目标、归一化与配置；默认会变化，要求记录release、显式配置和batch分母，本站未运行TRL。
- [SGLang](https://github.com/sgl-project/sglang)、[Mini-SGLang](https://github.com/sgl-project/mini-sglang)、[架构入口](https://github.com/sgl-project/mini-sglang/blob/main/docs/structures.md)：读README/架构入口。Mini当前Linux/CUDA要求与主SGLang的平台支持不同，不误称Mac上已经跑通。
- [All-in-RAG](https://github.com/datawhalechina/all-in-rag)、[分块正文](https://github.com/datawhalechina/all-in-rag/blob/main/docs/chapter2/05_text_chunking.md)：更新原资料的已读范围，显式关联课文。示例chunk_size与注释不一致、导入需版本核对，不直接抄成可运行代码。
- [牛客蚂蚁面经](https://www.nowcoder.com/feed/main/detail/4247388b1f0e4e51b00962227843b24b?sourceSSR=post&weFlow=true)：读第1–14项，保留作者、自述年份/日期范围。只整理公开题意和原创追问，不编造未给出的hot100具体题或企业标准答案。
- 牛客另一三场经历帖取得正文，但有工具推广且缺少独立依据，未作为新的高可信面经纳入。B站搜索到标题和配套入口但未观看，不采用“最全”“99%避坑”等营销判断。
- 本轮亦搜索知乎、掘金、微信公众号、小红书与Reddit；知乎所选GRPO正文直接读取失败，微信公众号/小红书未取得可确认的新正文，掘金/Reddit索引作为继续发现线索。这些访问边界没有被改写为阅读全文。

## 自动验证

100项Node回归通过；134资料/30专题/15页面壳与引用一致性通过。13个标准库notebook及18段正文Python执行；改动的三份notebook分别核对概率/排名/损失，并包括非法维度、NaN、空标签、重复ID、零残差等反例。SDK实验沿用上一轮固定版本，未声称本轮重新压测所有外部系统。共享后端/状态/读取模块与公共配置没有修改。

交互与上线证据在发布后按实际结果补记。
