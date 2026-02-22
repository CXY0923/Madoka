# 合并 GitHub 远程更改 Spec

## Why

协作者推送了新的更改到 GitHub 主分支，需要将这些更改合并到本地代码中。但本地也有未提交的修改，存在冲突风险。

## What Changes

远程分支 `origin/main` (commit 2de93f1) 包含以下更改：
- feat: 接入 GitHub 找项目（/github、/find、/找项目）
- 可配置 GITHUB_TOKEN
- 更新 history-search 记录
- 新增 src/background/githubSearch.ts
- 修改 src/background/index.ts
- 修改 src/sidepanel/components/InputArea.tsx
- 修改 src/sidepanel/context/ChatContext.tsx
- 修改 src/shared/constants.ts
- 修改 src/shared/types.ts
- 修改 src/sidepanel/components/Message.tsx
- 修改 src/sidepanel/components/SettingsPanel.tsx
- 修改 src/sidepanel/hooks/useChat.ts
- 新增 docs/history-search.md

## Impact

- 需要处理本地修改与远程更改的冲突
- 特别是以下文件：
  - src/background/index.ts（本地添加了 askAI 功能）
  - src/sidepanel/components/InputArea.tsx（本地添加了 storage 监听）
  - src/sidepanel/context/ChatContext.tsx

## ADDED Requirements

### Requirement: 安全合并远程更改
The system SHALL merge remote changes without losing local modifications.

#### Scenario: 合并流程
- **GIVEN** 本地有未提交的修改
- **WHEN** 执行合并操作
- **THEN** 保留本地修改
- **AND** 合并远程更改
- **AND** 解决所有冲突

## MODIFIED Requirements

无

## REMOVED Requirements

无
