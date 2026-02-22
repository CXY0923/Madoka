# Tasks

- [x] Task 1: 在翻译弹窗添加"问 AI"按钮
  - [x] 在译文区域底部左侧添加按钮
  - [x] 按钮样式与复制按钮保持一致
  - [x] 添加按钮图标和文字

- [x] Task 2: 实现按钮点击事件
  - [x] 绑定点击事件处理函数
  - [x] 获取当前原文
  - [x] 发送消息到 background
  - [x] 添加"已发送"视觉反馈

- [x] Task 3: 在 background 添加消息处理
  - [x] 监听 "askAI" 消息
  - [x] 调用 chrome.sidePanel.open() 打开侧边栏
  - [x] 存储原文供 sidepanel 获取

- [x] Task 4: 在 sidepanel 接收消息
  - [x] 监听来自 background 的消息
  - [x] 将原文填入输入框
  - [x] 自动触发发送

- [x] Task 5: 构建和测试
  - [x] 运行 npm run build
  - [x] 测试按钮显示
  - [x] 测试点击后侧边栏打开
  - [x] 测试原文自动填入
  - [x] 测试自动发送

# Task Dependencies

- Task 2 依赖于 Task 1
- Task 3 依赖于 Task 2
- Task 4 依赖于 Task 3
- Task 5 依赖于所有其他任务
