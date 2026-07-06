# Mokuro 阅读模式键盘快捷键设计

日期: 2026-07-06
状态: 已确认设计,待编写实现计划

## 背景

`src/components/MokuroReader.tsx` 当前完全依赖鼠标操作:翻页靠点击上一页/下一页按钮或页码输入框,选中 OCR 文本块靠点击图片上的覆盖块或侧边栏列表项,分析靠点击触发的 `handleBlockSelect` → `analyzeSelection`(会自动调 API)。代码库中目前没有任何键盘事件处理(`addEventListener('keydown')` / `onKeyDown` / `useKey` 等均无匹配)。

本设计为 Mokuro 阅读模式增加键盘快捷键,实现「用方向键在 OCR 文本块间逐个切换并自动滚动定位,用方向键翻页,回车分析」的纯键盘浏览流程。

## 目标

- 用方向键在当前页的 OCR 文本块之间逐个切换,自动滚动到对应位置,不自动调用 AI 分析 API。
- 用方向键翻页,方向贴合 manga 右开本阅读方向。
- 回车显式触发当前块的分析,控制 API 调用成本。
- 键盘逻辑与 `MokuroReader` 组件解耦,可独立单元测试。

## 非目标

- 不改变现有鼠标点击行为(图片覆盖块、侧边栏列表项、按钮)。
- 不为 Image Analyzer 等其他模式做通用快捷键抽象(YAGNI,留到第二个模式需要时再做)。
- 不引入块导航跨页翻页的联动行为(块导航停在首/尾块,翻页用独立键)。

## 键位表

| 键 | 行为 |
|---|---|
| `↑` | 选中上一个文本块(命中缓存则显示,否则仅选中),自动滚动定位 |
| `↓` | 选中下一个文本块,自动滚动定位 |
| `←` | 下一页(manga 右开本,进度从右往左) |
| `→` | 上一页 |
| `Enter` | 分析当前选中的块;无选中则分析第一个有文本的块 |
| `Esc` | 清除当前选中,回到无高亮状态 |
| `Home` | 跳到本页第一个文本块 |
| `End` | 跳到本页最后一个文本块 |

### 翻页方向说明

manga 为右开本,阅读进度从右往左。因此 `←`(左键)对应「下一页」,`→`(右键)对应「上一页」,与 Tachiyomi/Mihon 等主流 manga 阅读器一致。

### 边界行为

- 翻页到边界时(第 1 页按 `→`,最后一页按 `←`)静默忽略,不报错不滚动。
- 块导航到边界时(第一个块按 `↑`,最后一个块按 `↓`)停在该块,不跨页。
- 块导航不触发翻页,翻页不依赖块选中状态。

## 状态与接口

### 新增纯选中函数

在 `MokuroReader` 内新增 `selectBlock(blockIndex: number)`,与分析解耦——只更新 `selectedBlock` 状态(高亮 + 显示缓存),不调用 AI API:

```ts
const selectBlock = (blockIndex: number) => {
  const block = currentBlocks.find(b => b.blockIndex === blockIndex)
  if (!block || !block.text) return
  setSelectedBlock({ pageIndex: currentPageIndex, blockIndex, text: block.text })
}
```

分析仍走现有 `analyzeSelection(selection, force?)`,由 `Enter` 触发。`analyzeSelection` 内部已有「命中缓存且非 force 则直接显示不调 API」的逻辑,因此 `Enter` 命中缓存时不会重复调用 API。

### hook 入参契约

新增 `src/components/useMokuroKeyboardNav.ts`(hook 与 `MokuroReader` 同目录;纯逻辑单独放在 `src/lib/`):

```ts
interface MokuroKeyboardNavHandlers {
  selectBlock: (blockIndex: number) => void    // 纯选中
  analyzeSelected: () => void                   // 回车 → 复用现有 analyzeSelection
  goToNextPage: () => void                       // ←
  goToPreviousPage: () => void                   // →
  clearSelection: () => void                     // Esc
}

interface MokuroKeyboardNavState {
  enabled: boolean                               // 无 mokuroFile 或批量分析中 = false
  isAnalyzing: boolean                           // 单块分析中
  blockIndices: number[]                         // 当前页有文本的块的 blockIndex 列表(空块跳过)
  selectedIndex: number | null                   // selectedBlock?.blockIndex,跨页时为 null
}
```

- `goToNextPage` / `goToPreviousPage` 内部调用现有 `goToPage(currentPageIndex ± 1)`,边界由 `goToPage` 的 clamp + 按钮 disabled 状态自然处理。
- `analyzeSelected` 判空:无选中 → `selectBlock(blockIndices[0])` 后再分析(即「无选中分析第一块」)。

### 返回值

hook 返回 `listContainerRef: RefObject<HTMLDivElement | null>`,挂在侧边栏块列表容器上,作为自动滚动的目标。

## 文件结构

为让核心计算逻辑脱离 React/DOM 可测,拆成两层:

1. `src/lib/mokuro-keyboard-nav.ts` —— 纯函数模块,导出:
   - `computeNextBlockIndex(blockIndices, selectedIndex, direction): number | null`
   - `shouldHandleKey(target: EventTarget | null): boolean`(input/textarea/select/[contenteditable] 判定)
   - `resolveAction(key, state): Action`(key → action 映射,含禁用规则)
   - `Action` 联合类型:`'prev-block' | 'next-block' | 'next-page' | 'prev-page' | 'analyze' | 'clear' | 'home' | 'end' | null`

2. `src/components/useMokuroKeyboardNav.ts` —— React hook,负责:
   - 在 `window` 上挂 `keydown` 监听
   - 调用纯函数判定,分发到 handlers
   - 维护 `listContainerRef` 和选中变化时的 `scrollIntoView` 副作用
   - `preventDefault()` 匹配到行为的事件

3. `src/lib/mokuro-keyboard-nav.test.ts` —— 纯函数单测。

## 键位分发逻辑

单个 `keydown` 监听挂在 `window` 上,流程:

1. `enabled === false`(无文件 / 批量分析中)→ 忽略。
2. 事件目标在 `input` / `textarea` / `select` / `[contenteditable]` 中 → 忽略(交还浏览器)。
3. `isAnalyzing` 为 true → 仅允许 `Esc` / `Home` / `End` / 翻页(`←`/`→`),禁用块导航(`↑`/`↓`)和 `Enter`(避免选中态与分析态错配)。
4. 按 `key` 分发到对应 action。
5. 匹配到非 null action 的事件 → `preventDefault()`(阻止方向键滚动页面、`Enter` 默认行为等)。

### 块导航计算

以 `↑` 为例(`↓` 对称):

- `blockIndices` 为空 → 忽略(整页无文本块)。
- `selectedIndex === null` → 选中 `blockIndices[0]`。
- `selectedIndex` 是第一个 → 停在第一个(不跨页)。
- 否则 → 选中 `blockIndices[currentIndex - 1]`,其中 `currentIndex = blockIndices.indexOf(selectedIndex)`。

用 `blockIndices.indexOf(selectedIndex)` 定位游标而非数组下标,因为 `blockIndices` 已过滤空块,blockIndex 可能不连续。

### 禁用矩阵

| 状态 | 块导航(↑/↓) | 翻页(←/→) | Enter | Esc/Home/End |
|---|---|---|---|---|
| 无文件 / 批量分析中 | ✗ 全禁用 | ✗ | ✗ | ✗ |
| input/textarea 聚焦中 | ✗(交还浏览器) | ✗ | ✗ | ✗ |
| 单块分析中(isAnalyzing) | ✗ | ✓ | ✗ | ✓ |
| 正常 | ✓ | ✓ | ✓ | ✓ |

单块分析中允许翻页和 `Esc`:翻页会取消当前选中(现有 `goToPage` 已 `setSelectedBlock(null)`),`Esc` 清除选中,都不干扰进行中的 API。禁用块导航和 `Enter` 是为避免选中态与分析态错配。

## 自动滚动实现

- hook 返回 `listContainerRef`,挂在侧边栏块列表容器(现有 `<div className="max-h-[360px] ... overflow-auto">`)上。
- 给侧边栏块列表的每个 button 加 `data-block-index={blockIndex}` 属性作为定位锚点(现无,改动很小)。
- 选中块变化时,`useEffect` 监听 `selectedIndex`,通过 `listContainerRef.current.querySelector('[data-block-index="N"]')` 找到对应按钮,调 `scrollIntoView({ block: 'nearest' })`。
  - `block: 'nearest'`:只滚动到刚可见,不强制顶到顶部,对长列表更自然。
  - 不使用 `behavior: 'smooth'`:连续按方向键时平滑滚动会卡顿滞后,用默认 instant 更跟手。
- 切键盘选中时,图片上对应的覆盖块会同步高亮(因 `selectedBlock` 变化),但**不**自动滚动左栏图片容器,左栏图片保持当前视口。

## MokuroReader 集成改动

1. 新增 `selectBlock(blockIndex)` 纯选中函数。
2. 计算 `blockIndices`:`currentBlocks.filter(b => b.text.length > 0).map(b => b.blockIndex)`(可 `useMemo`)。
3. 调用 `useMokuroKeyboardNav({ handlers, state })`,其中:
   - `handlers.selectBlock` = `selectBlock`
   - `handlers.analyzeSelected` = 包裹 `analyzeSelection` 的函数,处理无选中 → 第一块
   - `handlers.goToNextPage` = `() => goToPage(currentPageIndex + 1)`
   - `handlers.goToPreviousPage` = `() => goToPage(currentPageIndex - 1)`
   - `handlers.clearSelection` = `() => setSelectedBlock(null)`
   - `state.enabled` = `Boolean(mokuroFile) && !isBatchAnalyzing`
   - `state.isAnalyzing` = `isAnalyzing`
   - `state.blockIndices` = 上述 `blockIndices`
   - `state.selectedIndex` = `selectedBlock?.pageIndex === currentPageIndex ? selectedBlock.blockIndex : null`(跨页时为 null)
4. 把返回的 `listContainerRef` 挂到侧边栏块列表容器 div 上。
5. 给侧边栏块列表每个 button 加 `data-block-index={blockIndex}`。

## 测试计划

### 单元测试(`src/lib/mokuro-keyboard-nav.test.ts`,纯函数)

1. `↑` 从 `null` → 第一个块;从第一个块 → 停在第一个。
2. `↓` 从最后一个块 → 停在最后一个;从中间块 → 下一个。
3. 空块被过滤:`blockIndices` 不含无文本块。
4. `blockIndices` 为空时块导航返回 `null`。
5. `Enter` 无选中 → action 为 `analyze`(由 handler 落实「分析第一块」)。
6. `shouldHandleKey` 在 `input` / `textarea` / `[contenteditable]` 聚焦时返回 `false`。
7. `resolveAction` 在 `enabled=false` / `isAnalyzing` 时的禁用规则。
8. `Home` / `End` → 首 / 尾块;`Esc` → `clear`;未知键 → `null`。
9. `←` → `next-page`,`→` → `prev-page`(锁定方向映射,防回归)。

### 手动测试清单(组件集成,写入实现计划供验证)

- 方向键翻页(`←` 下一页、`→` 上一页)、切块、回车分析、`Esc` 清除、`Home`/`End`。
- 焦点在页码输入框 / 批量范围输入框时按键不触发导航。
- 批量分析中按键被禁用。
- 单块分析中:翻页和 `Esc` 可用,块导航和 `Enter` 被禁用。
- 切块后侧边栏列表滚动到对应项可见(`block: 'nearest'`)。
- 翻页/切块到边界静默忽略。

## 验证标准

实现完成后须通过:

- `npm test`(含新增 `mokuro-keyboard-nav.test.ts`)
- `npm run lint`
- `npm run build`
- 上述手动测试清单全部通过
