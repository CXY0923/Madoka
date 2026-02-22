# 搜索模块修改记录 (history-search)

用于记录在「搜索」负责范围内，每次修改的位置与修改内容。

**格式**：`第 n 次修改` + 修改的简要内容概括。

---


第1次修改 落地多轮搜索策略：`shared/types.ts` 为 SearchResult 增加可选 `fromQuery`；`shared/constants.ts` 增加 MULTI_SEARCH_MAX_ROUNDS、RESULTS_PER_ROUND、MULTI_SEARCH_MAX_TOTAL；`background/search.ts` 新增 generateSearchQueries（启发式生成 2～3 条变体 query）、searchAndReadMultiRound（多轮调用 searchAndRead、按 URL 去重、总结果上限）；`background/index.ts` 智能对话改为调用 searchAndReadMultiRound（显式 action=search 仍用 searchAndRead）；`background/api.ts` 构建给模型的结构化消息时透传 from_query。

第2次修改 落地 Condense Question：`shared/constants.ts` 增加 CONDENSE_QUESTION_PROMPT、FOLLOW_UP_INDICATORS、CONDENSE_MAX_HISTORY_TURNS、CONDENSE_FOLLOW_UP_MAX_LEN；`background/api.ts` 新增 formatChatHistory、isFollowUp、condenseQuestion（追问时用 LLM 将当前输入重写为独立可搜索问题）；`background/index.ts` 在得到 searchQuery 后、调用 searchAndReadMultiRound 前调用 condenseQuestion(searchQuery, request.history)。
