# 翻译弹窗 UI 优化 Spec

## Why

当前翻译弹窗的 UI 存在以下问题：
1. 样式属性名错误（`fontSize` 应为 `font-size`，`lineHeight` 应为 `line-height`）
2. 界面设计较为简单，缺乏现代感和视觉层次
3. 加载状态、错误状态、成功状态的视觉反馈不够明显
4. 弹窗尺寸固定，对于长文本的展示不够友好

## What Changes

- 修复样式属性名错误
- 优化整体视觉设计，采用更现代的卡片式风格
- 改进加载动画，增加品牌感
- 优化原文和译文的排版和视觉层次
- 增加复制按钮，方便用户复制翻译结果
- 优化错误状态的展示
- 支持自适应高度，更好地展示长文本

## Impact

-  affected code: `src/content/translation-popup.ts`
- 用户体验提升：更美观、更易用的翻译弹窗

## ADDED Requirements

### Requirement: 现代化视觉设计
The system SHALL provide a modern, clean translation popup UI.

#### Scenario: 弹窗外观
- **GIVEN** 用户选中文本触发翻译
- **WHEN** 弹窗显示时
- **THEN** 弹窗应采用圆角卡片设计，带有柔和阴影
- **AND** 头部使用渐变色背景，显示品牌标识
- **AND** 内容区域有清晰的视觉层次

### Requirement: 加载状态优化
The system SHALL display an elegant loading state.

#### Scenario: 翻译中
- **GIVEN** 翻译请求已发送
- **WHEN** 等待响应时
- **THEN** 显示优雅的加载动画（脉冲圆点或旋转图标）
- **AND** 显示"正在翻译..."提示文字
- **AND** 加载动画应有品牌色

### Requirement: 复制功能
The system SHALL allow users to copy translation results.

#### Scenario: 复制译文
- **GIVEN** 翻译结果已显示
- **WHEN** 用户点击复制按钮
- **THEN** 译文被复制到剪贴板
- **AND** 显示"已复制"提示反馈

### Requirement: 自适应高度
The system SHALL support adaptive height for long text.

#### Scenario: 长文本展示
- **GIVEN** 原文或译文较长
- **WHEN** 内容超出默认高度
- **THEN** 弹窗高度自适应
- **AND** 内容区域可滚动
- **AND** 最大高度限制在视口范围内

## MODIFIED Requirements

### Requirement: 原文展示
**Current**: 原文显示在灰色背景框中，样式简单
**Modified**: 
- 原文使用引文样式展示
- 字体颜色为深灰色，与译文区分
- 添加引号装饰

### Requirement: 译文展示
**Current**: 译文显示在渐变背景框中
**Modified**:
- 译文使用更大的字体，突出显示
- 添加复制按钮在译文旁边
- 背景使用浅色卡片样式

### Requirement: 错误状态
**Current**: 错误信息简单显示，带有警告图标
**Modified**:
- 错误状态使用红色边框卡片
- 添加重试按钮
- 错误信息更加友好

## REMOVED Requirements

无
