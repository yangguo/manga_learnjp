# 文本阅读模式:逐句分栏展示

## 目标

文本输入分析当前把所有句子的词汇/语法 `flatMap` 扁平成两个长列表(`TextViewer` -> `MokuroAnalysisPanel` + `getVocabularyInTextOrder`),丢掉了逐句结构,结果太长不好读。

改为 Mokuro 风格的左右分栏:左侧表格化逐句列表(序号+原句+翻译),点击选中;右侧 sticky 显示选中句的翻译/词汇/语法。复用 `MokuroAnalysisPanel` 渲染单句分析,复用 `ReadingModeViewer` 的 `createSentenceAnalysisResult` 适配器把单句包成 `AnalysisResult`。

## 关键设计决策

- **切换展示,不懒分析**:纯文本模式一次性分析全文,`AnalysisResult.sentences[]` 已含每句的 words/grammar。点击只是切换展示哪句,不触发新 API 请求(同 ReadingModeViewer,异于 Mokuro 的按块懒分析+缓存)。
- **直接重写 `TextViewer`**:它是 43 行的薄包装,内部逻辑全换。`page.tsx` 的 text 分发点(`<TextViewer analysisResult language />`,line 153-156)和 props 签名不变,零改动。
- **`MokuroAnalysisPanel` 原样复用**:传单句 `AnalysisResult` + `hideSelectedText`(选中句在左侧列表已显示,右侧不重复)。不再传整个 `analysisResult`(那会触发扁平化)。

## 改动文件

### 1. `src/components/TextViewer.tsx`(重写内部)

复刻 `ReadingModeViewer` 的分栏骨架,去掉图片相关逻辑(纯文本无图):

- **状态**:`const [selectedIndex, setSelectedIndex] = useState(0)`
- **派生选中句**:
  ```ts
  const effectiveSelectedIndex = analysisResult.sentences.length === 0
    ? null
    : Math.min(selectedIndex, analysisResult.sentences.length - 1)
  const selectedSentence = effectiveSelectedIndex == null ? null : analysisResult.sentences[effectiveSelectedIndex] ?? null
  ```
- **单句适配器**(从 ReadingModeViewer:42-61 提一个本地版,签名简化--不需要 `ReadingModeResult['jlptCalibration']`,直接用 `analysisResult.jlptCalibration`):
  ```ts
  const createSentenceAnalysisResult = (sentence: SentenceAnalysis): AnalysisResult => ({
    extractedText: sentence.sentence,
    sentences: [sentence],   // 单句直接整体塞入,words/grammar 已在 sentence 内
    translation: sentence.translation,
    summary: sentence.context || '',
    provider: analysisResult.provider,
    jlptCalibration: analysisResult.jlptCalibration,
    grammarCalibration: analysisResult.grammarCalibration
  })
  ```
  注意:不复制 ReadingModeViewer 那版逐字段重建 sentence 对象,直接 `sentences: [sentence]`--`SentenceAnalysis` 结构一致,无需转换。
- **布局**:`<div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_400px]">`(同 ReadingModeViewer:155)
  - **左侧 `<section>`**:标题 + 逐句列表。每项一个 `<button>`,显示序号(`句 N`)、原句(`line-clamp-3 font-japanese`)、翻译(`line-clamp-2`)。选中态 `border-amber-300/70 bg-amber-400/20`,未选中 `border-white/10 bg-gray-950/40 hover:bg-white/10`(同 ReadingModeViewer:227-231)。列表容器 `max-h-[60vh] overflow-auto`(比 ReadingMode 的 360px 更高,文本模式句数可能多)。
  - **右侧 `<aside className="xl:sticky xl:top-4">**:`<MokuroAnalysisPanel analysisResult={selectedAnalysis} isAnalyzing={false} selectedText={selectedSentence?.sentence ?? null} language={language} hideSelectedText />`
- **空态**:若 `analysisResult.sentences.length === 0`,左侧显示"没有识别到句子"提示(同 ReadingModeViewer 的 noSentences 文案)。
- **UI 文案**:`UI_TEXT` 双语(zh/en),title 改为体现逐句模式,如 zh「文本分析结果」subtitle「点击左侧句子,右侧显示其翻译、词汇与语法。」

### 2. 文档登记(防止 CI check:docs 失败)

本次是 UI 改动,规模中等(单文件重写,无新类型/新 API)。按 CLAUDE.md 的 spec-driven 约定,可选写 spec/plan。鉴于改动集中在一个组件、复用现有模式,我倾向**不写独立 spec/plan**,直接实现 + 测试。但 `docs/superpowers/README.md` 索引不需要动(没新增 spec/plan 文件)。

## 不改的部分

- `page.tsx` 分发逻辑(props 不变)
- `MokuroAnalysisPanel.tsx`(原样复用)
- `analysis-order.ts`(`getVocabularyInTextOrder` 仍被 Mokuro 单块场景用,不动)
- `types.ts`(`SentenceAnalysis`/`AnalysisResult` 已满足)
- netlify 后端(纯前端改动)

## 测试

`TextViewer` 目前无单测。本次加一个轻量渲染测试(Vitest + @testing-library/react,项目已用):
- 传入多句 `AnalysisResult`,默认选中第 0 句,右侧 panel 显示第 0 句的 translation
- 点击第 2 句,右侧切换到第 2 句的 translation
- 空句子数组显示空态提示

## 验证

- `npm test`(新测试 + 现有 258 全过)
- `npm run lint`(0 errors)
- `rm -rf .next && npm run build`(clean build,对齐 CI)
- `npx tsc --noEmit -p netlify/tsconfig.json`(0,本改动不碰 netlify 但确认无回归)
- `npm run check:docs`(OK)
- 手动 smoke test:粘贴那段 13 句国旗法案文本,确认左侧出现 13 句列表、点击切换右侧分析
