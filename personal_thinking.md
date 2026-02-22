关于页面元素提取的一些想法
目前我总共试了三种交互元素提取方法
1.脚本在交互元素上注入dom标签，方便提取，现在看来如果把reader的算法给反向一下，或者说直接在算法执行过程中把最终提取的元素加上dom标签，就可以直接根据提取后的md信息操作每个对应的元素
2.查看dom的listener,最开始是直接看button标签，但后来发现好多框架的网页的交互元素是用属性来表示的
3.看dom的html类型，最鸡肋的一种

现在看来可能结合具体的提取算法，同时提取时候添加标签应该还是相当可靠的
一、重新定义目标（很关键）
你要解决的 不是：
“找出所有可交互节点”
而是：
构造一个「可行动空间（Action Space）」
这个 Action Space 由三类元素组成：
1. 直接可触发的 Action
2. 状态触发型 Action（latent）
3. 上下文绑定型 Action
你插件的 Index 就是这个 Action Space。

二、你作为原生插件，能用到的“作弊级能力”
你现在有外部 Agent 永远没有的东西：
能力	外部 Agent	你
DOM API	❌	✅
getEventListeners	❌	✅（DevTools / 注入）
computedStyle	❌	✅
MutationObserver	❌	✅
Accessibility API	❌	✅
Monkey Patch	❌	✅
👉 所以下面的方法 不需要 ML，也不需要猜。

三、第一层：真正可靠的「可交互节点」获取方式（核心）
✅ 方法 1：事件监听器反向索引（最重要）
为什么这是“本质解法”？
因为：
如果一个元素能响应用户交互，它“一定”被绑定过事件
而不是“看起来像”。
实现方案（插件级）
1️⃣ Monkey-patch addEventListener（页面级）
(function () {
  const origAdd = EventTarget.prototype.addEventListener;
  window.__interactiveMap = new Map();

  EventTarget.prototype.addEventListener = function (type, listener, options) {
    if (["click", "change", "keydown", "input", "submit"].includes(type)) {
      if (!window.__interactiveMap.has(this)) {
        window.__interactiveMap.set(this, new Set());
      }
      window.__interactiveMap.get(this).add(type);
    }
    return origAdd.call(this, type, listener, options);
  };
})();
📌 你抓到的是「事实」，不是猜测

2️⃣ 扫描 inline handler（补充）
[...document.querySelectorAll("*")].filter(el =>
  el.onclick || el.onchange || el.onkeydown
);

✅ 方法 2：Accessibility Tree（语义真相层）
浏览器已经帮你算过一遍“哪些能交互”。
你该做的事
● 获取 AX Tree
● 映射到 DOM 节点
● 作为 高权重信号
你会发现大量：
● div → button
● span → link
● li → option
📌 这是 React / Vue / AntD 的救命稻草

✅ 方法 3：Style + Focus + Pointer（弱信号，但必要）
function looksClickable(el) {
  const s = getComputedStyle(el);
  return (
    s.cursor === "pointer" ||
    el.tabIndex >= 0 ||
    el.getAttribute("role")
  );
}
⚠️ 权重低，但能兜底。

四、第二层：解决「点击后才出现的交互」（状态型）
你现在不是“分析 DOM”，而是控制 DOM。
正确解法：状态探索（State Probing）
插件可做的步骤：
1. 对高概率节点（来自第一层）：
  ○ hover
  ○ click
2. 使用 MutationObserver
3. 捕获新增节点
4. 回滚状态（必要时）
示例
const observer = new MutationObserver(muts => {
  muts.forEach(m => {
    m.addedNodes.forEach(n => {
      if (n.nodeType === 1) {
        markAsLatentInteractive(n);
      }
    });
  });
});
observer.observe(document.body, { childList: true, subtree: true });
📌 你得到的是：
{
  "trigger": "#dropdown",
  "reveals": ["li.option"],
  "action": "select"
}
👉 这是“可行动空间”的扩展，不是 DOM 扫描

五、第三层：表格 / 列表中的「上下文绑定交互」
这是很多人搞不定的，但你有 DOM。
正确模型：Action = Context × Operation
插件级可行做法
1️⃣ 找最近语义容器
function findRowContext(el) {
  return el.closest("tr, [role='row'], .row");
}
2️⃣ 抽取 Row 的唯一语义特征
● 主键列
● 最左文本
● data-id
● aria-rowindex
3️⃣ Action Schema
{
  "type": "row_action",
  "row": {
    "key": "20231234",
    "label": "张三"
  },
  "operation": "查看详情"
}
📌 Agent 永远不直接点按钮，而是：
“对【张三】执行【查看详情】”

六、第四层：借鉴 Readability 的真正方式（重点）
Readability 教你的是：
“不要看标签，看密度与结构稳定性”
对交互的迁移版本：
你应该计算的是：
Interaction Density（交互密度）
单位 DOM 子树内：
- 事件节点数
- 可 focus 元素数
- role=button / option 数
Interaction Block 判定：
● 交互密度局部极大
● 有稳定文本提示
● DOM 层级集中
📌 这就是：
Form / Dropdown / Toolbar / Table

七、一个 Browser Cursor「正确的 Action Index 结构」
你最终给 Agent 的，不是 DOM，而是：
{
  "actions": [
    {
      "type": "search",
      "input": "#q",
      "submit": ".search-btn"
    },
    {
      "type": "dropdown",
      "trigger": "#sort",
      "options": ["时间", "相关度"]
    },
    {
      "type": "row_action",
      "row": "张三",
      "actions": ["查看", "编辑"]
    }
  ]
}
👉 Agent 不知道 DOM 细节，但知道“能做什么”

八、最重要的一句话（你这个版本一定要刻在脑子里）
你不是在“解析页面”，而是在“枚举用户可能采取的行动”。
浏览器插件 = 用户视角
Web Agent = 行为空间搜索器