🧩 浏览器原生插件版 Cursor 架构设计
基于 Chrome 扩展（Chrome Extension / Manifest V3）实现
✅ 核心目标
让 AI 能像在 Cursor 中“理解代码并精确修改”一样，在网页中：
● 理解 DOM 结构
● 生成最小操作指令
● 安全执行 & 高亮预览
● 支持人工审查与一键撤销

🔧 整体架构图（分层模块）
+----------------------------+
|     用户界面 (Popup UI)     | ← 操作面板：输入指令、查看计划、确认/撤销
+--------------+-------------+
               |
               v
+----------------------------+
|   AI Agent 决策引擎 (Service Worker) | ← 接收指令、调用 LLM、生成 Action Plan
+--------------+-------------+
               |
               v
+----------------------------+
|   RAG + 页面结构索引 DB       | ← 存储常见页面模式、历史行为路径
+--------------+-------------+
               |
               v
+----------------------------+
|   内容脚本 (Content Script)    | ← 注入页面，执行 CDP-like 操作，反馈状态
+--------------+-------------+
               |
               v
+----------------------------+
|      当前网页 (DOM World)      | ← 实际被操作的目标环境
+----------------------------+
⚠️ 关键原则：所有 AI 决策不直接操作 DOM，必须通过结构化指令经由内容脚本执行

📦 模块详解（对应 page_content 类比）
Cursor 概念	浏览器插件等价物	技术实现方式
AST	DOM Tree 序列化	serializeNode()
 函数递归提取结构
LSP	DevTools Protocol（模拟）	内容脚本暴露查询接口（如 findElementByRole
）
Repo Index	页面/站点结构索引	IndexedDB + 向量嵌入（可选）
Diff	Action List / Patch	JSON DSL 描述操作序列
Human Review	Popup UI + 高亮预览	可视化展示下一步 + 确认按钮

1. AI Agent 决策引擎（Service Worker）
替代 Cursor 的 LLM 控制器，运行在后台无界面环境中。
功能：
● 接收用户自然语言指令（如：“抓取所有公告标题和链接”）
● 调用本地或远程 LLM API
● 使用 RAG 检索当前网站的历史结构知识
● 输出标准化的 Action Plan
示例输出（Action DSL）：
[
  {
    "op": "waitForSelector",
    "selector": "ul.notice-list",
    "timeout": 5000
  },
  {
    "op": "extract",
    "target": "li.notice-item",
    "fields": {
      "title": "a.title",
      "url": "a@href",
      "date": ".post-time"
    }
  },
  {
    "op": "highlight",
    "selector": "li.notice-item",
    "style": "outline: 2px dashed blue;"
  }
]
✅ 安全机制：禁止直接执行任意 JS 字符串

2. RAG + 页面结构索引数据库
对应原文中的 “Repo Index ↔ 页面/站点结构索引”
数据来源：
● 手动标注（用户训练常用流程）
● 自动学习（成功执行后记录 pattern）
● 社区共享 schema（如开源规则库）
存储格式（IndexedDB）：
{
  urlPattern: "jw.nju.edu.cn/*",
  name: "教务系统公告页",
  blocks: [
    {
      role: "notice-list",
      selector: "ul.news-list",
      items: "li",
      fields: { title: "a", date: ".time", link: "a@href" }
    }
  ],
  actions: ["paginate", "enter-detail"]
}
查询逻辑：
const context = await rag.search("提取公告列表", currentUrl);
// → 返回匹配的 schema + 示例操作
💡 这就像 Cursor 不会读整个 repo，而是只检索相关文件

3. 内容脚本（Content Script）—— 实际执行者
相当于 Cursor 的编辑器内核，负责与真实世界交互
注入方式：
// manifest.json
"content_scripts": [{
  "matches": ["<all_urls>"],
  "js": ["content.js"]
}]
提供能力：
方法	作用
queryElement(query)	安全查找元素（支持 text、role、CSS）
applyHighlight(node)	高亮待操作区域
executeAction(action)	执行 Action DSL 中的操作
getDOMSnapshot()	获取当前 DOM 结构快照（用于 diff）
示例高亮函数：
function highlight(node) {
  node.style.outline = "3px solid #ff4757";
  node.dataset.highlighted = "cursor-web";
}

4. Popup UI（人类审查中心）
对应 Cursor 的 diff 预览窗口
功能包括：
● 输入框：输入自然语言指令
● 计划预览：显示 AI 将要做的步骤（✔️ 可读性强）
● 可视化回放：点击“下一步”逐步确认
● 撤销栈：已执行操作可回退
● 日志控制台：显示错误、网络请求等
UI 示例：
[ 输入 ]：请帮我翻到下一页公告并导出所有标题

AI 计划：
1. ✅ 已完成：找到公告列表 ul.notice
2. 🔹 待确认：点击「下一页」按钮 (.pagination .next)
   → 预览高亮该按钮
   [确认] [跳过] [停止]

[导出结果] 按钮
✅ 安全模式：默认需要人工确认每一步关键操作

5. 通信机制（Message Passing）
Chrome 插件各模块间通过消息通信：
// Popup → Service Worker
chrome.runtime.sendMessage({
  type: 'RUN_AGENT',
  prompt: '登录我的账号'
});

// Service Worker → Content Script
chrome.tabs.sendMessage(tab.id, {
  type: 'EXECUTE_ACTIONS',
  actions: [...]
});
🔐 权限最小化：仅在用户激活时请求 activeTab 或特定域名权限

🛡️ 安全与沙箱设计
风险	防护措施
AI 错误操作敏感按钮	所有涉及 form submit / delete 的操作需强制确认
XSS 注入风险	禁止动态 eval()
 或 innerHTML
用户隐私泄露	本地处理为主，敏感数据不上报
恶意网站欺骗	显示当前 host 名，限制跨域自动操作

🔄 典型工作流程（端到端）
1. 用户打开 jw.nju.edu.cn 并激活插件
2. 在 Popup 输入：“抓取最近10条公告标题和日期”
3. Service Worker：
   - 检查 IndexedDB 是否有该站 schema
   - 构造 Prompt：“这是公告列表页，使用 ul.list > li.item …”
   - 调用 LLM 生成 Action Plan
4. 发送 Action 到 Content Script
5. 内容脚本：
   - 查找元素
   - 高亮匹配项
   - 提取数据
6. Popup 展示结果 + “导出为 CSV” 按钮
7. 用户点击“撤销” → 清除所有高亮

🧪 MVP 开发建议（三步走）
✅ 第一阶段：手动模式（验证可行性）
● 实现 DOM 序列化 + 高亮功能
● 手写 Action DSL 测试执行
● 在 popup 中展示提取结果
✅ 第二阶段：接入 LLM（自动化决策）
● 使用 GPT-4/Claude API 解析用户指令
● 加入简单 RAG（关键词匹配 URL + block role）
● 输出 Action List 并执行
✅ 第三阶段：自学习闭环
● 成功操作自动存入 IndexedDB
● 失败案例加入 negative examples
● 支持“录制→回放”模式降低 AI 依赖

🧰 技术栈推荐
组件	推荐技术
插件框架	Chrome Extension Manifest V3
前端 UI	React + Tailwind CSS（Popup）
状态管理	Zustand / Redux Toolkit
存储	IndexedDB（via idb-keyval）
LLM 接口	OpenAI API / Ollama（本地）
构建工具	Vite + @crxjs/vite-plugin

🎯 总结：这就是“浏览器版 Cursor”的本质
Cursor（代码世界）	浏览器插件版 Cursor（DOM 世界）
编辑器 = VS Code	浏览器 = Chrome
AST = 语法树	DOM Tree = 页面结构
LSP = 类型服务	CDP + 自定义 query API
Diff = 修改范围	Action DSL = 操作意图
Human Review = diff 预览	Popup UI = 可视化确认
Repo Index = 项目索引	IndexedDB = 站点行为记忆
✅ 核心思想一致：
不让 AI 直接动手，而是让它“提建议”，由系统安全执行