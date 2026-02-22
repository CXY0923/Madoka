# Tasks

- [ ] Task 1: 移除立即执行调用
  - [ ] 删除第 1530 行的 initializeExtension() 调用
  - [ ] 保留 onInstalled 和 onStartup 事件监听

- [ ] Task 2: 添加可选链保护
  - [ ] 使用 chrome.action?.onClicked?.addListener
  - [ ] 确保代码更加健壮

- [ ] Task 3: 构建并验证
  - [ ] 运行 npm run build
  - [ ] 确认没有编译错误

# Task Dependencies

- Task 2 依赖于 Task 1
- Task 3 依赖于 Task 2
