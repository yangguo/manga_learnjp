# Yomitan 右侧取词区 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 MokuroReader 右侧 aside 改造为 Yomitan 可取词区——顶部「选中句大字聚焦卡」、中部「AI 分析」、底部「本页全文(不截断)」,三处布局用 sticky aside 常驻可见。

**Architecture:** 移除现有 `position: fixed` + rAF 测量的面板定位,改为 `xl:sticky` flex 列 aside:聚焦卡与分析区 `shrink-0`、全文区 `flex-1 min-h-0` 自身滚动。聚焦卡与全文区都渲染 `lang="ja"` 的真实可见文本节点(非 `sr-only`/非 `aria-label`),满足 Yomitan `caretRangeFromPoint` 取词前提。给 `MokuroAnalysisPanel` 增加可选 `hideSelectedText` 以在 MokuroReader 中避免与聚焦卡重复显示选中文本。

**Tech Stack:** Next.js App Router, React 19, TypeScript, Tailwind CSS, Vitest(仅 `src/lib`)。

## Global Constraints

- 遵循项目约定:TypeScript、两空格缩进、单引号、无分号;`'use client'` 客户端组件;`@/` 别名导入。
- 不改动 `src/lib/types.ts`(无新类型契约);不改后端/API/缓存逻辑;不动主图区覆盖层。
- 交付前跑 `npm test`、`npm run lint`、`npm run build`。
- **Spec 偏差说明(已确认):** 设计文档原假设 `MokuroAnalysisPanel` 仅被 `MokuroReader` 使用,可整体移除其「选中文本」段。实际 grep 发现它被三个 viewer 使用(`MokuroReader`、`ReadingModeViewer:257`、`ImagePageAnalysisViewer:71`),后两者依赖该段展示选中文本。故改为**可选 `hideSelectedText` prop**(MokuroReader 传 true,其余不变),而非整体移除。`onReanalyze`/`canReanalyze` 仅 MokuroReader 传过,可安全移除——重新分析按钮改由聚焦卡承担。

---

### Task 1: Sticky aside + 全文取词区(替换 fixed 面板定位)

**Files:**
- Modify: `src/components/MokuroReader.tsx`(移除 fixed 定位逻辑;aside 改 sticky flex;OCR 列表移到分析面板下方并改为不截断可滚动全文区)

**Interfaces:**
- Consumes: 现有 `currentBlocks`、`analysisScrollRef`、`MokuroAnalysisPanel`、`analyzedCountForCurrentPage`、`getCacheKey`、`handleBlockSelect`、UI_TEXT。
- Produces: aside 为 sticky flex 列;`analysisScrollRef` 指向分析面板包装器(W/S 滚动目标);全文区为 `flex-1 min-h-0` 自滚动;`asideRef`/`ocrListRef`/`panelTop`/`panelAnchor`/`panelMaxHeight`/`PANEL_TOP_LIFT_PX` 及其测量 effect 被删除。

- [ ] **Step 1: 移除 fixed 定位常量**

在 `src/components/MokuroReader.tsx` 删除这段(约 128-131 行):

```ts
// Lift the analysis panel a bit above the focused OCR box's top edge instead
// of flush-aligning with it, so the panel reads as floating slightly above the
// sentence it explains.
const PANEL_TOP_LIFT_PX = 96
```

保留紧随其后的 `ANALYSIS_PANEL_SCROLL_STEP_PX` 常量(W/S 仍用)。

- [ ] **Step 2: 移除 fixed 定位相关 state 与 ref**

删除 `analysisScrollRef` 之后、`batchAbortControllerRef` 之前的两个 ref 与三个 state(约 334-338 行),使该区域变为:

```ts
  const analysisScrollRef = useRef<HTMLDivElement | null>(null)
  const batchAbortControllerRef = useRef<AbortController | null>(null)
```

即删除 `asideRef`、`ocrListRef`、`panelTop`、`panelAnchor`、`panelMaxHeight`。保留 `analysisScrollRef`。

- [ ] **Step 3: 移除 rAF 测量 effect**

整段删除「Keep the analysis panel vertically aligned…」注释开头的 `useEffect`(约 481-539 行,以 `}, [mokuroFile, selectedBlock, currentPageIndex])` 结尾)。这段依赖被删的 `asideRef`/`ocrListRef`/`panelTop` 等,必须移除。

保留其上方的 scroll-reset effect(约 470-472 行,`analysisScrollRef.current?.scrollTo({ top: 0 })`,deps `[selectedBlock, activeAnalysis, isAnalyzing]`)。

- [ ] **Step 4: 重写 aside JSX**

将整个 `<aside>...</aside>` 块(约 1438-1514 行,从 `<aside ref={asideRef} ...>` 到对应 `</aside>`)替换为:

```tsx
          <aside className="min-w-0 flex flex-col gap-4 self-start xl:sticky xl:top-4 xl:max-h-[calc(100vh-2rem)] xl:overflow-hidden">
            <div
              ref={analysisScrollRef}
              className="shrink-0 rounded-2xl border border-white/10 bg-white/5 p-4 xl:max-h-[45vh] xl:overflow-y-auto"
            >
              <MokuroAnalysisPanel
                analysisResult={activeAnalysis}
                isAnalyzing={isAnalyzing}
                selectedText={selectedBlock?.text ?? null}
                language={analysisLanguage}
                onReanalyze={selectedBlock ? () => void analyzeSelection(selectedBlock, true) : undefined}
                canReanalyze={Boolean(selectedBlock) && !isAnalyzing && !isBatchAnalyzing}
              />
            </div>

            <div className="flex-1 min-h-0 flex flex-col rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="mb-3 flex shrink-0 items-center gap-2">
                <Search size={16} className="text-cyan-300" />
                <h3 className="font-semibold text-white">{t.ocrBlocks}</h3>
                <span className="ml-auto rounded-full border border-white/10 px-2 py-0.5 text-xs text-gray-400">
                  {analyzedCountForCurrentPage} / {currentBlocks.length}
                </span>
              </div>
              <div className="flex-1 min-h-0 space-y-2 overflow-auto pr-1">
                {currentBlocks.length > 0 ? currentBlocks.map(({ blockIndex, text }) => {
                  const selection = { pageIndex: currentPageIndex, blockIndex, text }
                  const selected = selectedBlock?.pageIndex === currentPageIndex && selectedBlock.blockIndex === blockIndex
                  const analyzed = Boolean(analysisCache[getCacheKey(selection)])

                  return (
                    <button
                      key={`block-list-${blockIndex}`}
                      type="button"
                      data-block-index={blockIndex}
                      onClick={() => handleBlockSelect(blockIndex, text)}
                      disabled={!text}
                      className={`w-full rounded-lg border p-3 text-left transition-colors ${
                        selected
                          ? 'border-amber-300/70 bg-amber-400/20'
                          : analyzed
                            ? 'border-emerald-300/40 bg-emerald-400/10 hover:bg-emerald-400/15'
                            : 'border-white/10 bg-gray-950/40 hover:bg-white/10'
                      } disabled:cursor-not-allowed disabled:opacity-40`}
                    >
                      <div className="mb-1 flex items-center justify-between text-xs text-gray-500">
                        <span>Block {blockIndex + 1}</span>
                        <span className="inline-flex items-center gap-1">
                          {analyzed && <CheckCircle2 size={12} className="text-emerald-300" />}
                          {text.length} chars
                        </span>
                      </div>
                      <p
                        lang="ja"
                        className="font-japanese text-sm leading-relaxed text-gray-100 whitespace-pre-wrap break-words select-text"
                      >
                        {text || 'Empty block'}
                      </p>
                    </button>
                  )
                }) : (
                  <p className="rounded-lg border border-white/10 bg-gray-950/40 p-3 text-sm text-gray-400">
                    {t.emptyBlocks}
                  </p>
                )}
              </div>
            </div>
          </aside>
```

要点:① aside 改 `flex flex-col gap-4 self-start xl:sticky xl:top-4 xl:max-h-[calc(100vh-2rem)] xl:overflow-hidden`;② 分析面板包装器 `shrink-0` + `xl:max-h-[45vh] xl:overflow-y-auto`(W/S 滚动目标,溢出时才滚);③ 全文区 `flex-1 min-h-0 flex flex-col`,内层列表 `flex-1 min-h-0 overflow-auto`;④ 全文 `<p>` 去掉 `line-clamp-2`,加 `lang="ja"`、`whitespace-pre-wrap break-words select-text`;⑤ 不再有 `ref={asideRef}`/`ref={ocrListRef}`/`style={fixed...}`/`data-fixed`。

- [ ] **Step 5: 类型检查 + lint**

Run: `npx tsc --noEmit`
Expected: 无错误(确认 `asideRef`/`ocrListRef`/`panelTop` 等无残留引用)。

Run: `npm run lint`
Expected: 无错误。

- [ ] **Step 6: 手动验证(开发服务器)**

Run: `npm run dev`,打开 Mokuro Reader,加载目录,选一页。
验证:① 右侧分两块:上=分析面板、下=本页全文,全文不截断、长句完整换行;② 滚动左侧长图时右侧整体 sticky 常驻;③ 在全文区某日文词上悬停,Yomitan 弹词典(若装了扩展);④ 点全文行→选中+分析,选中行高亮、已分析标记正确;⑤ W/S 在分析面板内容超 45vh 时可滚动,不超则无操作不报错。

- [ ] **Step 7: Commit**

```bash
git add src/components/MokuroReader.tsx
git commit -m "refactor(mokuro): sticky aside with full-text transcript for Yomitan lookup

Replace the fixed-position analysis panel and rAF measurement with a
sticky flex-column aside. Move the OCR block list below the analysis
panel and render each block as non-truncating, selectable Japanese text
(lang=ja, whitespace-pre-wrap) so Yomitan can hover-scan it. The
transcript zone is the flex-1 self-scrolling region; the analysis panel
caps at 45vh at xl so W/S can still scroll it."
```

---

### Task 2: 顶部「选中句大字聚焦卡」(取词区 #1)

**Files:**
- Modify: `src/components/MokuroReader.tsx`(新增聚焦卡 Zone 1;新增 UI_TEXT 文案;`RotateCw` 图标导入;分析面板改为仅在有选中块时渲染)。

**Interfaces:**
- Consumes: `selectedBlock`、`isAnalyzing`、`isBatchAnalyzing`、`analyzeSelection`、UI_TEXT。
- Produces: aside 顶部聚焦卡,显示选中块完整日文大字(`lang="ja"`、`select-text`、`whitespace-pre-wrap`)、分析中徽标、重新分析按钮;无选中时显示提示。Yomitan 可在聚焦卡悬停取词。

- [ ] **Step 1: 新增 UI_TEXT 文案**

在 `src/components/MokuroReader.tsx` 的 `UI_TEXT.zh` 对象内(任意稳定位置,建议紧随 `subtitle` 后)加入:

```ts
    selectedText: '选中文本',
    reanalyze: '重新分析',
    analyzing: '分析中...',
    focusHint: '点击页面文字框，在此处取词或查看解析。',
```

在 `UI_TEXT.en` 对象内对应位置加入:

```ts
    selectedText: 'Selected text',
    reanalyze: 'Reanalyze',
    analyzing: 'Analyzing...',
    focusHint: 'Click a text box on the page to look up words or view analysis here.',
```

(注意 `UI_TEXT` 用 `satisfies Record<AnalysisLanguage, Record<string, string>>`,zh 与 en 键集必须一致,故两边都要加。)

- [ ] **Step 2: 导入 RotateCw 图标**

将 lucide-react 导入行(约 4-19 行):

```ts
import {
  AlertCircle,
  BookOpenCheck,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  FolderOpen,
  Languages,
  Layers,
  Loader2,
  Search,
  Trash2,
  Volume2,
  X,
  Zap
} from 'lucide-react'
```

改为(加入 `RotateCw`,保持字母序):

```ts
import {
  AlertCircle,
  BookOpenCheck,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  FolderOpen,
  Languages,
  Layers,
  Loader2,
  RotateCw,
  Search,
  Trash2,
  Volume2,
  X,
  Zap
} from 'lucide-react'
```

- [ ] **Step 3: 在 aside 顶部插入聚焦卡,并让分析面板仅在选中时渲染**

将 Task 1 产出的 aside 第一个子 `<div ref={analysisScrollRef} ...>...</div>`(分析面板包装器)整段,替换为「聚焦卡 + 条件渲染的分析面板」:

```tsx
            <div className="shrink-0 rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-xs text-gray-500">{t.selectedText}</p>
                <div className="flex items-center gap-2">
                  {isAnalyzing && (
                    <span className="inline-flex items-center gap-1 text-xs text-purple-300">
                      <Loader2 size={12} className="animate-spin" />
                      {t.analyzing}
                    </span>
                  )}
                  {selectedBlock && (
                    <button
                      type="button"
                      onClick={() => void analyzeSelection(selectedBlock, true)}
                      disabled={isAnalyzing || isBatchAnalyzing}
                      className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-xs font-medium text-gray-200 transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {isAnalyzing ? <Loader2 size={12} className="animate-spin" /> : <RotateCw size={12} />}
                      {t.reanalyze}
                    </button>
                  )}
                </div>
              </div>
              {selectedBlock ? (
                <p
                  lang="ja"
                  className="font-japanese text-xl font-medium leading-relaxed text-white whitespace-pre-wrap break-words select-text"
                >
                  {selectedBlock.text}
                </p>
              ) : (
                <p className="text-sm text-gray-400">{t.focusHint}</p>
              )}
            </div>

            {selectedBlock && (
              <div
                ref={analysisScrollRef}
                className="shrink-0 rounded-2xl border border-white/10 bg-white/5 p-4 xl:max-h-[45vh] xl:overflow-y-auto"
              >
                <MokuroAnalysisPanel
                  analysisResult={activeAnalysis}
                  isAnalyzing={isAnalyzing}
                  selectedText={selectedBlock.text}
                  language={analysisLanguage}
                  onReanalyze={() => void analyzeSelection(selectedBlock, true)}
                  canReanalyze={!isAnalyzing && !isBatchAnalyzing}
                />
              </div>
            )}
```

要点:① 聚焦卡 `shrink-0` 放最顶;② 选中时显示大字 `text-xl` + `lang="ja"` + `select-text` + `whitespace-pre-wrap break-words`,Yomitan 可取词;③ 分析中徽标 + 重新分析按钮(复用 `analyzeSelection(..., true)`);④ 无选中时聚焦卡显示 `focusHint`,分析面板不渲染(避免与聚焦卡重复占位);⑤ 分析面板包装器仍带 `analysisScrollRef`(W/S 目标),仅在 `selectedBlock` 时挂载,无选中时 `analysisScrollRef.current` 为 null,W/S 的 `?.` 安全无操作。

- [ ] **Step 4: 类型检查 + lint**

Run: `npx tsc --noEmit`
Expected: 无错误。

Run: `npm run lint`
Expected: 无错误(`RotateCw` 已被使用)。

- [ ] **Step 5: 手动验证**

Run: `npm run dev`。
验证:① 右侧三块从上到下:聚焦卡、分析面板、本页全文;② 未选中时聚焦卡显示提示、分析面板不出现;③ 点全文行→聚焦卡显示该句大字、分析面板出现并分析;④ 在聚焦卡日文上悬停,Yomitan 弹词典;⑤ 聚焦卡「重新分析」按钮可触发重分析,分析中禁用;⑥ 键盘选中(不分析)时聚焦卡显示该句、分析面板显示「等待分析」占位。

- [ ] **Step 6: Commit**

```bash
git add src/components/MokuroReader.tsx
git commit -m "feat(mokuro): add selected-sentence focus card as Yomitan lookup zone

Add a top focus card to the MokuroReader aside showing the selected
block's full Japanese text at large size (lang=ja, selectable) so
Yomitan can hover-scan it. Includes an analyzing badge and a reanalyze
button. The analysis panel now only renders when a block is selected to
avoid duplicating the selected-text placeholder."
```

---

### Task 3: 去重——`MokuroAnalysisPanel` 增加 `hideSelectedText`,移除 `onReanalyze`/`canReanalyze`

**Files:**
- Modify: `src/components/MokuroAnalysisPanel.tsx`(props 调整;条件渲染选中文本;移除重新分析按钮)。
- Modify: `src/components/MokuroReader.tsx`(调用处去掉 `onReanalyze`/`canReanalyze`,加 `hideSelectedText`)。

**Interfaces:**
- Consumes: Task 2 的聚焦卡已承担选中文本展示与重新分析。
- Produces: `MokuroAnalysisPanel` 新签名 `{ analysisResult, isAnalyzing, selectedText, language, hideSelectedText? }`;`ReadingModeViewer`/`ImagePageAnalysisViewer` 不传 `hideSelectedText`(默认 false,行为不变)。MokuroReader 传 `hideSelectedText`,不再传 `onReanalyze`/`canReanalyze`。

- [ ] **Step 1: 调整 `MokuroAnalysisPanel` props 与签名**

在 `src/components/MokuroAnalysisPanel.tsx` 将接口(约 8-15 行):

```ts
interface MokuroAnalysisPanelProps {
  analysisResult: AnalysisResult | null
  isAnalyzing: boolean
  selectedText: string | null
  language: AnalysisLanguage
  onReanalyze?: () => void
  canReanalyze?: boolean
}
```

改为:

```ts
interface MokuroAnalysisPanelProps {
  analysisResult: AnalysisResult | null
  isAnalyzing: boolean
  selectedText: string | null
  language: AnalysisLanguage
  hideSelectedText?: boolean
}
```

将组件函数签名(约 71-78 行):

```tsx
export default function MokuroAnalysisPanel({
  analysisResult,
  isAnalyzing,
  selectedText,
  language,
  onReanalyze,
  canReanalyze
}: MokuroAnalysisPanelProps) {
```

改为:

```tsx
export default function MokuroAnalysisPanel({
  analysisResult,
  isAnalyzing,
  selectedText,
  language,
  hideSelectedText = false
}: MokuroAnalysisPanelProps) {
```

- [ ] **Step 2: 移除 RotateCw 导入**

将该文件导入行(约 4 行):

```ts
import { BookOpen, Loader2, Quote, RotateCw, Sparkles } from 'lucide-react'
```

改为:

```ts
import { BookOpen, Loader2, Quote, Sparkles } from 'lucide-react'
```

(重新分析按钮将被移除,`RotateCw` 不再使用。)

- [ ] **Step 3: 让 `selectedTextHeader` 受 `hideSelectedText` 控制**

将(约 80-85 行):

```tsx
  const selectedTextHeader = selectedText ? (
    <div className="rounded-2xl border border-white/10 bg-gray-950/40 p-3">
      <p className="text-xs text-gray-500">{t.selectedText}</p>
      <p className="font-japanese text-sm font-medium text-white">{selectedText}</p>
    </div>
  ) : null
```

改为:

```tsx
  const selectedTextHeader = !hideSelectedText && selectedText ? (
    <div className="rounded-2xl border border-white/10 bg-gray-950/40 p-3">
      <p className="text-xs text-gray-500">{t.selectedText}</p>
      <p className="font-japanese text-sm font-medium text-white">{selectedText}</p>
    </div>
  ) : null
```

- [ ] **Step 4: 重写结果态 section,移除重新分析按钮并条件渲染选中文本**

将结果态返回中的第一个 `<section>`(约 147-171 行,从 `<section className="rounded-2xl border border-gray-950/40 p-3">` 到其闭合 `</section>`,含「选中文本」标签、重新分析按钮、选中文本 `<p>`、翻译块):

```tsx
      <section className="rounded-2xl border border-white/10 bg-gray-950/40 p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-xs text-gray-500">{t.selectedText}</p>
          {onReanalyze && (
            <button
              type="button"
              onClick={onReanalyze}
              disabled={!canReanalyze}
              className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-xs font-medium text-gray-200 transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isAnalyzing ? <Loader2 size={12} className="animate-spin" /> : <RotateCw size={12} />}
              {t.reanalyze}
            </button>
          )}
        </div>
        <p className="font-japanese text-base font-medium leading-relaxed text-white">{selectedText}</p>
        {analysisResult.translation && (
          <div className="mt-2 border-t border-white/10 pt-2">
            <p className="mb-1 text-xs text-gray-500">{t.translation}</p>
            <p className="text-sm leading-relaxed text-gray-100">
              {analysisResult.translation}
            </p>
          </div>
        )}
      </section>
```

替换为:

```tsx
      <section className="rounded-2xl border border-white/10 bg-gray-950/40 p-3">
        {!hideSelectedText && selectedText && (
          <>
            <p className="mb-1 text-xs text-gray-500">{t.selectedText}</p>
            <p className="font-japanese text-base font-medium leading-relaxed text-white">{selectedText}</p>
          </>
        )}
        {analysisResult.translation && (
          <div className={!hideSelectedText && selectedText ? 'mt-2 border-t border-white/10 pt-2' : ''}>
            <p className="mb-1 text-xs text-gray-500">{t.translation}</p>
            <p className="text-sm leading-relaxed text-gray-100">
              {analysisResult.translation}
            </p>
          </div>
        )}
      </section>
```

要点:① 移除重新分析按钮及其 `onReanalyze`/`canReanalyze`/`RotateCw` 用法;② 选中文本标签与正文仅在 `!hideSelectedText && selectedText` 时渲染;③ 翻译块顶部分隔线仅在上方有选中文本时出现,避免孤立边框。

- [ ] **Step 5: 移除 panel UI_TEXT 中不再使用的 `reanalyze` 文案**

在 `src/components/MokuroAnalysisPanel.tsx` 的 `UI_TEXT.zh`(约 33-50 行)删除行:

```ts
    reanalyze: '重新分析'
```

在 `UI_TEXT.en`(约 51-68 行)删除行:

```ts
    reanalyze: 'Reanalyze'
```

(该文案已迁至 MokuroReader 聚焦卡。注意删除后逗号正确:被删行若是对象末属性则将其前一行的尾逗号去掉,否则直接删行。)

- [ ] **Step 6: 更新 MokuroReader 调用处**

在 `src/components/MokuroReader.tsx` Task 2 产出的分析面板调用处,将:

```tsx
                <MokuroAnalysisPanel
                  analysisResult={activeAnalysis}
                  isAnalyzing={isAnalyzing}
                  selectedText={selectedBlock.text}
                  language={analysisLanguage}
                  onReanalyze={() => void analyzeSelection(selectedBlock, true)}
                  canReanalyze={!isAnalyzing && !isBatchAnalyzing}
                />
```

改为:

```tsx
                <MokuroAnalysisPanel
                  analysisResult={activeAnalysis}
                  isAnalyzing={isAnalyzing}
                  selectedText={selectedBlock.text}
                  language={analysisLanguage}
                  hideSelectedText
                />
```

- [ ] **Step 7: 类型检查 + lint**

Run: `npx tsc --noEmit`
Expected: 无错误(确认 `ReadingModeViewer`/`ImagePageAnalysisViewer` 未传已删 props——它们本就只传 `analysisResult`/`isAnalyzing`/`selectedText`/`language`,不受影响)。

Run: `npm run lint`
Expected: 无错误。

- [ ] **Step 8: 手动验证 + 完整回归**

Run: `npm run dev`。
验证矩阵(覆盖三个 viewer):
1. Mokuro Reader:聚焦卡显示选中文本大字;分析面板不再重复显示「选中文本」段,直接显示翻译/词汇/语法;Yomitan 在聚焦卡与全文区均可取词。
2. Mokuro Reader:重新分析按钮在聚焦卡可用;分析中徽标正确。
3. Image Analyzer(上传图片走 `ImagePageAnalysisViewer`):右侧分析面板仍显示「选中文本」段(因未传 `hideSelectedText`),翻译/词汇/语法正常。
4. Image Analyzer reading 模式(`ReadingModeViewer`):点击句子后分析面板仍显示选中文本与解析,行为与改动前一致。
5. W/S 在 Mokuro Reader 分析面板超 45vh 时可滚动。
6. xl 以下堆叠布局:三块依次排列、可滚动/页面滚动正常。

- [ ] **Step 9: 跑测试套件 + 生产构建**

Run: `npm test`
Expected: 全部通过(无新增 lib 测试,现有测试不应受影响)。

Run: `npm run build`
Expected: 构建成功。

- [ ] **Step 10: Commit**

```bash
git add src/components/MokuroAnalysisPanel.tsx src/components/MokuroReader.tsx
git commit -m "refactor(mokuro): dedupe selected text via hideSelectedText prop

MokuroAnalysisPanel now takes an optional hideSelectedText prop instead
of onReanalyze/canReanalyze. MokuroReader passes hideSelectedText (its
focus card already shows the selected text and reanalyze button), while
ReadingModeViewer and ImagePageAnalysisViewer are unchanged. Removes the
panel's internal reanalyze button and its now-unused copy."
```

---

## Self-Review 记录

- **Spec 覆盖:** ① 聚焦卡(Task 2)✓ ② AI 分析中位(Task 1/2 排序 + Task 3 去重)✓ ③ 全文不截断取词区(Task 1)✓ ④ sticky 替换 fixed + 删 rAF 逻辑(Task 1)✓ ⑤ W/S 指向分析区(Task 1 `analysisScrollRef` + `xl:max-h-[45vh] xl:overflow-y-auto`)✓ ⑥ `MokuroAnalysisPanel` 不重复显示选中文本(Task 3 `hideSelectedText`)✓ ⑦ 不动主图区/后端/types ✓ ⑧ `npm test`/`lint`/`build`(Task 3 Step 9)✓ ⑨ 手动验证矩阵(Task 1/2/3)✓。
- **Placeholder 扫描:** 无 TBD/TODO;所有代码步骤含完整代码;命令含预期输出。
- **类型一致性:** `MokuroAnalysisPanel` 新签名 `{ analysisResult, isAnalyzing, selectedText, language, hideSelectedText? }` 在 Task 3 定义并被 MokuroReader(Task 3 Step 6)、ReadingModeViewer/ImagePageAnalysisViewer(不变)一致使用;`analysisScrollRef` 在 Task 1/2 均指向分析面板包装器;`t.selectedText`/`t.reanalyze`/`t.analyzing`/`t.focusHint` 在 Task 2 加进 zh+en 双语,`satisfies` 约束满足。
- **偏差:** `hideSelectedText` prop 替代 spec 原设的「整体移除选中文本段」,原因见 Global Constraints(三 viewer 共用),已在 Task 3 落实。
