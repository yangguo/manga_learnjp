# OCR 文本块网格化迁移 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把「OCR 文本块」列表从右侧 aside 搬到图片区下方,改成横向自适应网格、不限高全部展开;右侧只留聚焦卡 + 分析面板,彻底解决文本块区被挤压的问题。

**Architecture:** 顶层布局不变(`grid xl:grid-cols-[minmax(0,1fr)_400px]`)。文本块网格作为新区块放进图区 `<section>` 内、图片容器之后,占据左列宽度(与图同宽)。网格用 CSS `grid-cols-[repeat(auto-fill,minmax(180px,1fr))]` 自适应列数,不限高全部展开。aside 去掉文本块区后只剩两块,移除 `flex-1 min-h-0` 抢空间机制,放宽聚焦卡/分析面板的 vh 上限。

**Tech Stack:** Next.js App Router, React 19, TypeScript, Tailwind CSS, Vitest(仅 `src/lib`)。

## Global Constraints

- 遵循项目约定:TypeScript、两空格缩进、单引号、无分号;`'use client'` 客户端组件;`@/` 别名导入。
- 不改动 `src/lib/types.ts`;不改后端/API/缓存逻辑;不动主图区覆盖层(图上可点击方框)。
- 不破坏 Yomitan 取词:网格项的日文文本必须保持 `lang="ja"` + `select-text` + `whitespace-pre-wrap break-words` + 真实可见文本节点(非 sr-only/aria-label)。
- 不破坏既有交互:点网格项仍触发 `handleBlockSelect(blockIndex, text)`;选中/已分析标记保留。
- 不破坏 W/S 快捷键(W/S 滚 `analysisScrollRef`,分析面板仍在 aside 内)。
- 交付前跑 `npm test`、`npm run lint`、`npm run build`。
- 唯一允许改动的文件:`src/components/MokuroReader.tsx`。

---

### Task 1: 把文本块网格迁到图区下方 + 精简 aside

**Files:**
- Modify: `src/components/MokuroReader.tsx`(从 aside 删除文本块区;在图区 `<section>` 图片容器后新增网格区;放宽 aside 内聚焦卡/分析面板上限)

**Interfaces:**
- Consumes: 现有 `currentBlocks`、`selectedBlock`、`analysisCache`、`getCacheKey`、`handleBlockSelect`、`analyzedCountForCurrentPage`、UI_TEXT(`t.ocrBlocks`/`t.emptyBlocks`)、`Search` 图标、`CheckCircle2` 图标。
- Produces: 图区下方一个自适应网格区(不限高);aside 仅含聚焦卡 + 条件分析面板;`analysisScrollRef` 仍指向分析面板(不变)。

- [ ] **Step 1: 在图区 `<section>` 图片容器之后插入文本块网格区**

定位:图区 `<section>` 内,图片容器闭合 `</div>`(当前约 1355 行,即 `<div className="relative mx-auto overflow-hidden rounded-lg bg-black">...` 的闭合)之后、`<section>` 闭合(约 1368 行)之前。

在该 `</div>`(图片容器结束)之后、`: (无图占位分支)` 之前插入网格区。注意:网格区应在 `currentImage ? (...) : (...)` 三元之后、`<section>` 闭合前,使其无论有无图都显示。

将 `<section>` 内现有的:

```tsx
              {currentImage ? (
                <div
                  className="relative mx-auto overflow-hidden rounded-lg bg-black"
                  style={{ maxWidth: currentPage.img_width }}
                >
                  ...图片与方框...
                </div>
              ) : (
                <div className="flex min-h-[420px] items-center justify-center rounded-lg border border-dashed border-white/15 bg-gray-950/60 p-8 text-center">
                  ...无图占位...
                </div>
              )}
            </div>
          </section>
```

改为(在三元结束后、`</div>` + `</section>` 前新增网格区):

```tsx
              {currentImage ? (
                <div
                  className="relative mx-auto overflow-hidden rounded-lg bg-black"
                  style={{ maxWidth: currentPage.img_width }}
                >
                  ...图片与方框(原样不动)...
                </div>
              ) : (
                <div className="flex min-h-[420px] items-center justify-center rounded-lg border border-dashed border-white/15 bg-gray-950/60 p-8 text-center">
                  ...无图占位(原样不动)...
                </div>
              )}

              <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="mb-3 flex items-center gap-2">
                  <Search size={16} className="text-cyan-300" />
                  <h3 className="font-semibold text-white">{t.ocrBlocks}</h3>
                  <span className="ml-auto rounded-full border border-white/10 px-2 py-0.5 text-xs text-gray-400">
                    {analyzedCountForCurrentPage} / {currentBlocks.length}
                  </span>
                </div>
                {currentBlocks.length > 0 ? (
                  <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-2">
                    {currentBlocks.map(({ blockIndex, text }) => {
                      const selection = { pageIndex: currentPageIndex, blockIndex, text }
                      const selected = selectedBlock?.pageIndex === currentPageIndex && selectedBlock.blockIndex === blockIndex
                      const analyzed = Boolean(analysisCache[getCacheKey(selection)])

                      return (
                        <button
                          key={`block-grid-${blockIndex}`}
                          type="button"
                          data-block-index={blockIndex}
                          onClick={() => handleBlockSelect(blockIndex, text)}
                          disabled={!text}
                          className={`flex h-full flex-col rounded-lg border p-3 text-left transition-colors ${
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
                    })}
                  </div>
                ) : (
                  <p className="rounded-lg border border-white/10 bg-gray-950/40 p-3 text-sm text-gray-400">
                    {t.emptyBlocks}
                  </p>
                )}
              </div>
            </div>
          </section>
```

要点:① 网格区在图片三元之后、`</section>` 前,有无图都显示;② 用 `grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-2` 自适应列数,不限高全部展开;③ 每项 `flex h-full flex-col` 使同行的卡片等高对齐;④ 日文 `<p>` 保留 `lang="ja"` + `select-text` + `whitespace-pre-wrap break-words`(Yomitan 取词前提);⑤ `key` 改 `block-grid-${blockIndex}` 避免与图上方框 button 的 key 冲突;⑥ 交互/选中/已分析标记沿用原逻辑。

- [ ] **Step 2: 从 aside 删除原文本块区**

删除 aside 内的文本块区(当前约 1421-1472 行),即从:

```tsx
            <div className="flex-1 min-h-0 flex flex-col rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="mb-3 flex shrink-0 items-center gap-2">
                ...t.ocrBlocks 头部...
              </div>
              <div className="flex-1 min-h-0 space-y-2 overflow-auto pr-1">
                ...currentBlocks.map(...)...
              </div>
            </div>
```

整段删除。删除后 aside 仅剩聚焦卡 + 条件分析面板两块。

- [ ] **Step 3: 放宽 aside 内聚焦卡/分析面板的 vh 上限**

aside 删掉文本块区后只剩两块,不再需要抢空间。把聚焦卡与分析面板的固定 vh 上限放宽,让内容自然展开(aside 仍 sticky,整体不超高由 `xl:max-h-[calc(100vh-2rem)] xl:overflow-hidden` 兜底)。

将聚焦卡容器(当前约 1371 行):

```tsx
            <div className="shrink-0 rounded-2xl border border-white/10 bg-white/5 p-4 xl:max-h-[30vh] xl:overflow-y-auto">
```

改为:

```tsx
            <div className="shrink-0 rounded-2xl border border-white/10 bg-white/5 p-4">
```

将分析面板包装器(当前约 1409 行):

```tsx
                className="shrink-0 rounded-2xl border border-white/10 bg-white/5 p-4 xl:max-h-[45vh] xl:overflow-y-auto"
```

改为:

```tsx
                className="shrink-0 rounded-2xl border border-white/10 bg-white/5 p-4 xl:overflow-y-auto"
```

保留分析面板的 `xl:overflow-y-auto`(W/S 滚动目标,内容超高时仍可滚),去掉 `45vh` 上限。聚焦卡去掉 `30vh` 上限与内部滚动(聚焦卡内容是单句,本就短)。

- [ ] **Step 4: 类型检查 + lint**

Run: `npx tsc --noEmit`
Expected: 无新错误(项目有 ~13 个预存 `src/lib/*.test.ts` 错误,与本改动无关,保持不变)。零错误于 `MokuroReader.tsx`。

Run: `npm run lint`
Expected: 0 错误(7 个预存 `<img>` 警告不变)。确认 `Search`/`CheckCircle2` 仍被使用(网格区用到),无未使用导入。

- [ ] **Step 5: 手动验证(开发服务器)**

Run: `npm run dev`,加载 Mokuro 目录,选一页。
验证:① 文本块网格出现在图片下方,横向多列自适应(宽屏 4-6 列),30 条全部展开不限高;② 右侧只剩聚焦卡 + 分析面板,不再拥挤;③ 网格项日文上悬停,Yomitan 弹词典(若装扩展且开 localhost);④ 点网格项 -> 选中 + 分析,聚焦卡更新、该项高亮、已分析标记正确;⑤ W/S 仍可滚分析面板;⑥ xl 以下堆叠布局正常。

- [ ] **Step 6: Commit**

```bash
git add src/components/MokuroReader.tsx
git commit -m "refactor(mokuro): move OCR blocks to a grid below the page image

Move the OCR text-block list out of the right aside and into a
full-width responsive grid below the manga page image, so the blocks
get the page width instead of being squeezed into a 400px column. The
aside now holds only the focus card and analysis panel, and their
fixed vh caps are removed since they no longer compete for space.
Grid items keep lang=ja + select-text for Yomitan lookup and the same
select/analyze interaction."
```

---

## Self-Review 记录

- **Spec 覆盖:** ① 文本块放图下方 ✓(Step 1) ② 横向多列网格 ✓(`repeat(auto-fill,minmax(180px,1fr))`) ③ 不限高全部展开 ✓(无 max-h) ④ 右侧只剩聚焦卡+分析 ✓(Step 2 删除) ⑤ 放宽 vh 上限 ✓(Step 3) ⑥ Yomitan 取词保留 ✓(`lang=ja`+`select-text`) ⑦ 交互不破坏 ✓(`handleBlockSelect`/选中/已分析) ⑧ W/S 不破坏 ✓(分析面板 `analysisScrollRef` 不变) ⑨ `npm test`/`lint`/`build`(Step 4 + Task 末尾) ⑩ 单文件改动 ✓。
- **Placeholder 扫描:** Step 1 用 `...原样不动...` 占位图片/无图分支是因它们不改动,实现时须保留原代码;此处已注明"原样不动",非缺失。其余步骤含完整代码。
- **类型一致性:** `handleBlockSelect(blockIndex, text)` 签名不变;`selection`/`selected`/`analyzed` 计算与原列表一致;`data-block-index` 保留(键盘导航 `scrollIntoView` 仍能定位,只是现在滚图区容器)。网格项 `key` 用 `block-grid-` 前缀,与图上方框 `key`(`currentPageIndex-blockIndex`)不冲突。
- **潜在副作用:** 网格项也带 `data-block-index`,与图上方框的 `data-block-index` 同值。`useMokuroKeyboardNav` 的 `scrollIntoView` 用 `pageContainerRef.querySelector('[data-block-index="..."]')`,会命中第一个匹配(图上方框),行为不变。无需处理,但实现时确认 `pageContainerRef` 仍包住图区(图上方框在网格项之前),`querySelector` 取到方框。
