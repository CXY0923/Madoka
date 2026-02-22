# 添加一键提问功能 Spec

## Why

用户在查看翻译结果时，可能希望针对原文向 AI 提问（如询问语法、用法、同义词等）。当前需要手动复制原文，打开侧边栏，粘贴到输入框，操作繁琐。需要在翻译弹窗左下角添加一个"问 AI"按钮，一键将原文发送到侧边栏并自动提问。

## What Changes

- 在翻译弹窗结果区域的左下角添加"问 AI"按钮
- 点击按钮后，自动打开侧边栏（如果未打开）
- 将原文自动填入侧边栏输入框
- 自动发送消息到 AI
- 添加视觉反馈，让用户知道操作成功

## Impact

- affected code: 
  - `src/content/translation-popup.ts` - 添加按钮和事件处理
  - `src/content/index.ts` - 处理与 background 的通信
  - `src/background/index.ts` - 添加打开侧边栏和发送消息的处理
  - `src/sidepanel/components/InputArea.tsx` - 接收外部消息并填充输入框

## ADDED Requirements

### Requirement: 问 AI 按钮
The system SHALL provide an "Ask AI" button in the translation popup.

#### Scenario: 按钮显示
- **GIVEN** 翻译结果已显示
- **WHEN** 用户查看弹窗
- **THEN** 在弹窗左下角显示"问 AI"按钮
- **AND** 按钮样式与复制按钮保持一致

#### Scenario: 点击按钮
- **GIVEN** 用户点击"问 AI"按钮
- **WHEN** 按钮被点击
- **THEN** 发送消息到 background 打开侧边栏
- **AND** 将原文发送到侧边栏输入框
- **AND** 自动发送消息
- **AND** 显示"已发送"反馈

### Requirement: 侧边栏通信
The system SHALL handle communication between content script and sidepanel.

#### Scenario: 打开侧边栏
- **GIVEN** 用户点击"问 AI"按钮
- **WHEN** Content Script 发送消息
- **THEN** Background 调用 chrome.sidePanel.open()
- **AND** 发送原文到 sidepanel

#### Scenario: 接收消息
- **GIVEN** Sidepanel 已打开
- **WHEN** 收到来自 background 的消息
- **THEN** 将原文填入输入框
- **AND** 自动触发发送

## MODIFIED Requirements

无

## REMOVED Requirements

无
