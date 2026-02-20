# 搜索模块修改记录 (history-search)

用于记录在「搜索」负责范围内，每次修改的位置与修改内容。

**格式**：`第 n 次修改` + 修改的简要内容概括。

---


第1次修改 落地多轮搜索策略：`shared/types.ts` 为 SearchResult 增加可选 `fromQuery`；`shared/constants.ts` 增加 MULTI_SEARCH_MAX_ROUNDS、RESULTS_PER_ROUND、MULTI_SEARCH_MAX_TOTAL；`background/search.ts` 新增 generateSearchQueries（启发式生成 2～3 条变体 query）、searchAndReadMultiRound（多轮调用 searchAndRead、按 URL 去重、总结果上限）；`background/index.ts` 智能对话改为调用 searchAndReadMultiRound（显式 action=search 仍用 searchAndRead）；`background/api.ts` 构建给模型的结构化消息时透传 from_query。

第2次修改 落地 Condense Question：`shared/constants.ts` 增加 CONDENSE_QUESTION_PROMPT、FOLLOW_UP_INDICATORS、CONDENSE_MAX_HISTORY_TURNS、CONDENSE_FOLLOW_UP_MAX_LEN；`background/api.ts` 新增 formatChatHistory、isFollowUp、condenseQuestion（追问时用 LLM 将当前输入重写为独立可搜索问题）；`background/index.ts` 在得到 searchQuery 后、调用 searchAndReadMultiRound 前调用 condenseQuestion(searchQuery, request.history)。

第3次修改 接入 GitHub 找项目（类 Copilot）：从 callpeek 的 `github/githubSearch.js` 逻辑接入，LLM 生成搜索串 → GitHub Search API → 重排 → 仅展示项目卡片、不产生对话回复，与对话流式调用分离。`shared/types.ts` 增加 GitHubRepoItem、Message.githubItems、AppConfig.githubToken；`shared/constants.ts` 增加 GITHUB_SEARCH_QUERY_PROMPT、GITHUB_SEARCH_MAX_REPOS、GITHUB_API_PER_PAGE；`background/githubSearch.ts` 新建（userQueryToGitHubSearchQuery 用 Madoka 配置的 Tongyi 非流式、searchGitHubRepositories 支持可选 githubToken、rankRepos、handleGitHubSearch）；`background/index.ts` 增加 action=githubSearch 消息处理；`sidepanel/context/ChatContext.tsx` 的 FINISH_RESPONSE 支持 payload 含 githubItems、finishResponse(content, githubItems?)；`sidepanel/hooks/useChat.ts` 识别 /github、/find、/找项目 前缀时只发 githubSearch、用 finishResponse 写回卡片；`sidepanel/components/Message.tsx` 根据 githubItems 渲染仓库卡片；`sidepanel/components/SettingsPanel.tsx` 增加 GitHub Token（可选）配置项；`sidepanel/components/InputArea.tsx` 增加「找项目」快捷按钮。

**第3次修改 - 使用方法**  
- **触发方式**：在输入框输入以 `/github `、`/find ` 或 `/找项目 ` 开头的自然语言描述，或点击输入区快捷按钮「找项目」后再输入描述。例如：`/github Python 异步 Web 框架`、`/find chrome extension autocomplete`。  
- **结果展示**：助手消息会展示 GitHub 仓库卡片列表（仓库名、描述、Star 数、语言、更新时间、链接），点击卡片可跳转仓库。  
- **可选配置**：在 **Settings → API Configuration** 中填写 **GitHub Token**（如 `ghp_xxx`）可提高 GitHub API 限流上限；不填也可使用，仅未认证限流更严。
