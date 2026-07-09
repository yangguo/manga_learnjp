# Yomitan 右侧取词区设计

日期: 2026-07-09
状态: 待实现

## 背景

Yomitan 取词依赖 `document.caretRangeFromPoint` / `caretPositionFromPoint`:在鼠标悬停坐标下找到可见的真实文本节点,再分词查词。两个前提同时满足:

1. 文本是真正的 DOM 文本节点(不是 `aria-label` / `title` 属性);
2. 文本节点位于鼠标坐标处、且尺寸非零可见(不是 `sr-only` 的 1px 裁剪)。

当前 `MokuroReader.tsx` 的右侧 OCR 文本块列表每项用 `line-clamp-2` 截断、整体在 `max-h-[240px]` 滚动容器内;主图区则把 OCR 文字藏在 `<span class="sr-only">` + `aria-label` 里(有意为之的「可点击方框、不可见文字」设计)。结果是:主图区对 Yomitan 完全不可见,右侧列表只能悬停可见的截断部分、长句取不全。

## 目标

把右侧面板改造为一等公民的 Yomitan 取词区,提供两处可悬停查词的文本:

- 顶部「选中句大字聚焦卡」;
- 底部「本页全文(不截断)」。

两处都渲染真实可见的日文文本节点,满足 Yomitan 取词前提。

## 非目标(YAGNI)

- 不改动主图区覆盖层(保留 CLAUDE.md 的「可点击方框」设计;图上直接取词若需要另做透明文字层)。
- 不新增分析功能,不改动后端 / API / 缓存逻辑。
- 不改键盘导航的语义,仅适配新的滚动容器。

## 右侧布局

aside 从上到下三个区块:

### Zone 1 · 聚焦卡(取词区 #1)

- 显示当前选中块的完整日文文本。
- 字体:`text-xl`、`font-japanese`、`leading-relaxed`、`whitespace-pre-wrap`、`break-words`、`lang="ja"`、`select-text`。
- 状态:
  - 未选中 -> 占位提示(沿用现有「未选择文本」文案)。
  - 选中 -> 始终显示全文;分析中时显示「分析中」徽标(聚焦卡本身仍可见可取词)。
- 「重新分析」按钮放在这里(从原 `MokuroAnalysisPanel` 内迁出),复用现有 `canReanalyze` / `isAnalyzing` 判定。

### Zone 2 · AI 分析

- 复用 `MokuroAnalysisPanel` 的翻译 / 词汇 / 语法三段及分析中 / 等待占位。
- 移除 `MokuroAnalysisPanel` 内部的「选中文本」段及其「重新分析」按钮(已迁至 Zone 1,避免重复)。

### Zone 3 · 本页全文(取词区 #2)

- 替换现有截断的 OCR 文本块列表。
- 每行显示该块**完整不截断**日文:去掉 `line-clamp-2`,改 `whitespace-pre-wrap`、`break-words`、`lang="ja"`、`select-text`。
- 该区域内部可滚动(高度比现有 `max-h-[240px]` 更大,具体值在 sticky 布局下由 flex 决定)。
- 行交互沿用现有行为:点击 -> `handleBlockSelect(blockIndex, text)`(选中 + 分析);选中行高亮;已分析标记 + 字数保留。

## 滚动模型变更

用 **sticky aside** 替换现有「`position: fixed` 跟随选中框 + rAF 测量」逻辑:

- aside 容器:`position: sticky; top: 1rem; align-self: start; max-height: calc(100vh - 2rem)`。
- 内部 flex 列布局:Zone 1 / Zone 2 `shrink-0`,Zone 3 `flex-1` 自身滚动。
- 删除现有约 60 行 rAF / 测量代码(`panelTop` / `panelAnchor` / `panelMaxHeight` / `analysisScrollRef` 相关 effect 及 `PANEL_TOP_LIFT_PX`)。

行为:滚动左侧长漫画图时,整个右侧面板常驻视口可见,聚焦卡与全文区始终可达。

取舍:面板顶部不再对齐被点击的图上方框,而是停在视口顶部。对「右侧阅读 / 取词」场景反而更好。

W/S 快捷键:当前滚 `analysisScrollRef`;改造后指向 Zone 2 AI 分析区(保留「分析面板滚动」语义与 `ANALYSIS_PANEL_SCROLL_STEP_PX` 命名一致)。Zone 2 在内容超出时自身可滚动;若其高度不溢出,快捷键为无操作,不报错。

## 组件改动

### `src/components/MokuroReader.tsx`

- 新增 Zone 1 聚焦卡渲染(选中块完整日文大字 + 状态徽标 + 重新分析按钮)。
- 重排 aside 顺序为 聚焦卡 -> AI 分析 -> 本页全文(现 OCR 列表移到底部)。
- Zone 3 行渲染:去 `line-clamp-2`,加 `lang="ja"` / `select-text` / `whitespace-pre-wrap break-words`。
- 移除 `position: fixed` 面板逻辑及相关 state / effect / 常量,改用 sticky aside + flex 布局。
- W/S 快捷键指向新滚动容器。

### `src/components/MokuroAnalysisPanel.tsx`

- 移除「选中文本」段(`selectedTextHeader` 与顶部 section 内的同名段)及内部「重新分析」按钮。
- 保留翻译 / 词汇 / 语法三段、分析中与等待占位。
- 「重新分析」与「选中文本」展示职责移交 `MokuroReader` 的 Zone 1。
- 实现时 grep 确认 `MokuroAnalysisPanel` 仅被 `MokuroReader` 使用,移除 props 不影响其他调用方。

## 测试

- 组件层以 UI 为主,无新 lib 工具则不新增单测;若实现中抽出带逻辑的辅助函数,则在 `src/lib` 旁补 Vitest。
- 交付前跑 `npm test`、`npm run lint`、`npm run build`。

### 手动验证矩阵

1. Yomitan 在 Zone 1 聚焦卡悬停取词,弹词典。
2. Yomitan 在 Zone 3 全文行悬停取词,弹词典。
3. 长句在两区均完整不截断显示。
4. 点击 Zone 3 行 -> 选中 + 分析,聚焦卡更新为该句,选中行高亮正确。
5. Zone 1 重新分析按钮可用且复用 `canReanalyze` 判定。
6. W/S 快捷键仍可滚动目标区。
7. xl 断点以下堆叠布局正常,聚焦卡与全文区可用。
8. `MokuroAnalysisPanel` 不再重复显示选中文本。

## 共享类型

本设计不改动 `src/lib/types.ts`。聚焦卡 / 全文区均使用现有 `MokuroBlock` 的 `lines` 文本(经 `getMokuroBlockText`),无新类型契约。
