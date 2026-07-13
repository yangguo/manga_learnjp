# 纯文本输入设计

日期: 2026-07-13
状态: 设计中

## 一、目标

让用户能直接粘贴日文文本或上传 `.txt` 文件进行分析,复用现有 AI 讲解 + JLPT 分级 + 生词本 + SRS 闭环,不必先有漫画图片或 Mokuro 产物。

这是强化独占格「漫画/文本 × AI 块级讲解 × JLPT × 内置 SRS」的最低成本动作:`analyzeText` 管线已完整实现并生产使用,后端零业务逻辑新增,主要工作是输入入口与展示引导。

## 二、背景与现状(已核实)

### 已有能力

`src/lib/ai-service.ts` 的 `analyzeText(text)` 内部已实现整段->分批->合并:

1. `splitTextIntoSentences(text)` 按 `。！？…～♪♫` 切句,保留结尾标点,过滤空句(行 235)。
2. ≤3 句走 `analyzeSingleBatch` 一次分析;>3 句走 `createTextBatches(sentences, 3)` 每 3 句一批(行 268)。
3. 每批独立调 AI,**某批失败 `continue`,不阻断其他批**(行 1280)。
4. `combineBatchResults(batchResults)` 合并 sentences / translation / extractedText(行 277)。
5. 返回完整 `AnalysisResult`。

`src/lib/client-api.ts:30` 的 `analyzeText(text, options)` 是前端入口,POST `/api/analyze` 带 `{ text, provider, analysisLanguage }`,`src/app/api/analyze/route.ts:86` 路由到 `aiService.analyzeText`。MokuroReader 已在用这条路径喂 OCR 文本。

展示侧 `src/components/TextAnalyzer.tsx` 已存在,接收 `AnalysisResult` 渲染,但其空状态文案是 "Upload an image to get started"(当前服务 Image Analyzer),需改为文本输入引导。

### 现有问题(本次一并修复)

这三个问题存在于 `analyzeText` 共享路径,Mokuro 文本分析也走这里,长文本场景会把它们放大:

1. **`combineBatchResults` 的 summary 是占位符**:`'Combined analysis of N sentences from M batches.'`(行 296),不是真总结。多批合并时 summary 字段无信息量。
2. **批失败静默 `continue`**:某批失败,那几句直接从结果里消失,用户不知道少了内容(行 1280)。长文本时静默丢句是正确性隐患。
3. **`createTextBatches` 固定 3 句/批**:一句整段对话和一句拟声词混计,批间 token 量极不均衡,长句批可能使 AI 输出超过 `max_tokens: 2000` 被截断,导致 JSON 解析失败、整批丢失。

### 不做(YAGNI)

- `.txt` 以外格式(EPUB/PDF/网页是独立后续项)。
- 内联展开文本视图(体验更好但属锦上添花,首版用一次性整段分析 + 展开结果)。
- 按句按需分析(与 `analyzeText` 整段批量行为相悖,不引入假按需)。

## 三、方案

### 范围

- **输入层**:粘贴框 + `.txt` 文件上传,新建客户端组件。
- **调用层**:复用 `analyzeText`,零业务逻辑改动。
- **合并层(后端修复)**:修 `combineBatchResults` 的 summary;修批失败标记;重写 `createTextBatches` 为按字符预算分批。带单元测试。
- **展示层**:复用 `TextAnalyzer`,改空状态文案与引导。

### 组件与数据流

```
TextInput (新组件,粘贴框 + .txt 上传)
  -> analyzeText(text, { language })   [client-api.ts, 复用]
  -> POST /api/analyze { text }        [route.ts, 复用]
  -> aiService.analyzeText             [ai-service.ts, 修复分批/合并]
  -> CalibratedAnalysisResult
  -> TextAnalyzer (复用, 改空状态文案)
```

纯文本模式产出的 `AnalysisResult` 与 Image/Mokuro 模式同构,生词本收藏、JLPT 分级、SRS 复习、Anki 导出全部自动复用,无需额外接线。

### 输入层设计

新组件 `src/components/TextInput.tsx`(命名对齐 `ImageUploader.tsx`):

- **粘贴框**:`<textarea>`,placeholder 引导粘贴日文文本。粘贴即待分析,点「分析」按钮触发。
- **文件上传**:接受 `.txt`,UTF-8 读取。读出后填入粘贴框(统一入口,用户可在上传后微调)。
- **大小上限**:100KB(约 3-5 万日文字符)。超出提示用户截取。理由:过大的文本分析耗时长、token 成本高,且分段后批数过多易触发限流;100KB 覆盖常见短篇/章节。
- **语言**:复用现有 `analysisLanguage`,中文默认(对齐 Image Analyzer 与 CLAUDE.md 约定)。
- **空状态**:无文本时引导用户粘贴或上传,不调 API。

文件读取用 `FileReader.readAsText(file, 'UTF-8')`;若检测到乱码(常见于 Shift-JIS 的 `.txt`),提示用户转存为 UTF-8。不做自动编码检测(YAGNI,UTF-8 是现代默认)。

### 展示层调整

`TextAnalyzer.tsx` 的空状态分支(行 31-42)从 "Upload an image to get started" 改为文本输入引导。复用其余展示逻辑(词卡、语法卡、翻译、summary、provider 信息、复制按钮)。

`TextAnalyzer` 当前不接收「触发分析」职责(它只渲染 `analysisResult` prop)。输入与触发放在 `TextInput`,分析完成后由父组件(page)把 `AnalysisResult` 传给 `TextAnalyzer` 渲染。这条边界保持不变。

### 后端修复(合并层)

#### 修复 1:`combineBatchResults` 的 summary

现状是机械拼接占位字符串。改为:

- 单批:直接用该批原 summary。
- 多批:summary 设为基于已合并句子的简短说明,显式标注「多段合并」,不伪造整体总结。例如:`'已合并 N 段分析结果(共 M 句)。整体总结见各段翻译与语法标注。'`。诚实优于假总结——AI 没有看过全文,强行生成整体 summary 会幻觉。

#### 修复 2:批失败标记

现状失败批 `continue` 后句子消失。改为在合并结果里保留失败信息:

- `combineBatchResults` 接收每批的状态(成功/失败/失败原因)。
- 失败批对应的句子以占位句形式保留:占位句定义为 **`grammar=[]` 且 `vocabulary=[]`** 的句对象(这样才能被 `filterLearningGrammar` 等下游过滤逻辑正确跳过),`sentence` 字段标明「第 N 段分析失败:原因」,`translation` 为空。失败批的原文就是该批在 `createTextBatches` 里的句子切片,无需额外回溯。
- 这样用户可见哪段失败,而非内容凭空减少。

实现要点:`analyzeText` 分批循环里捕获每批的 `{ sentences, status, error? }`,`combineBatchResults` 据此生成占位句。占位句的空 grammar/vocabulary 保证下游 `filterLearningGrammar`、`getLearningGrammarInTextOrder`、词汇卡渲染自动跳过,不破坏展示。

#### 修复 3:按字符预算分批

现状 `createTextBatches(sentences, 3)` 固定 3 句。改为按字符预算:

- 每批字符上限 `MAX_BATCH_CHARS`(初值 800)。理由:`analyzeSingleBatch` 输出 `max_tokens: 2000`,日文输入约 1 字 ≈ 1-2 token,800 字输入 + prompt 开销 + 2000 输出 token 处于安全区,长对话句也不会单批爆掉。
- 累积句子到预算上限即成批,保证**不切断句子**(仍以 `splitTextIntoSentences` 的完整句为单位)。
- 单句超预算时(罕见,极长段落无标点),该句独占一批并记为「超长句」,不强行切断。
- `createTextBatches(sentences, maxBatchChars)` 签名改为接收字符预算。调用处(`analyzeText` 行 1263 / 1715)同步更新。

`MAX_BATCH_CHARS` 提为模块常量,带测试覆盖边界(空、单句、恰满、超长句、多批)。

### 错误处理

- **全部批失败**:保持现状抛 `'All batches failed to process'`(行 1287),由 route.ts 的 fallback 返回友好错误。
- **部分批失败**:见修复 2,占位句标记,不抛错。
- **输入校验**:空文本 / 仅空白不调 API;超 100KB 拒绝并提示。
- **文件读取失败**:非 UTF-8 / 损坏文件,提示用户转存。
- **网络/超时**:复用 `fetchWithTimeout` 与现有 `CLIENT_ANALYSIS_FETCH_TIMEOUT_MS`。

## 四、测试范围

本次改的是 `analyzeText` 共享路径,Mokuro 也走这里,测试必须先锁现有行为再改。测试与被测模块同级,对齐项目约定(`src/lib/*.test.ts`)。

### 新增/补充(纯函数,可独立测)

- `splitTextIntoSentences`:覆盖空、纯标点、多种结尾符、无标点长句、含换行。当前无测试,补齐。
- `createTextBatches`(改后):覆盖空、单句成批、累积满批、单句超预算独占、多批顺序保持。
- `combineBatchResults`(改后):覆盖单批直通、多批合并、批失败占位句、全失败抛错、占位句不破坏词汇/语法过滤。

这三个函数当前是 `ai-service.ts` 内部非导出函数。为可测,导出它们(或抽到独立模块 `src/lib/text-batching.ts`)。**推荐抽到独立模块**:`ai-service.ts` 已 2245+ 行过大,把这三个纯函数及其测试独立出来,既可测又改善文件聚焦(符合「文件变大常是职责过多信号」)。`ai-service.ts` 改为从 `text-batching` 导入。

### 既有测试回归

- `src/lib/client-api.test.ts`:`analyzeText` 间接覆盖,确保改后契约不变(CalibratedAnalysisResult 形状)。
- `src/lib/mokuro.test.ts`:Mokuro 文本路径走 `analyzeText`,确保分批改动不破坏缓存键与持久化。
- `src/lib/analysis-order.test.ts`、`analysis-filters.test.ts`:确保占位句(空 grammar/vocabulary)被现有过滤逻辑正确跳过。

### 手动验收

- 短文本(≤3 句):单批直通,summary 正常。
- 长文本(>3 句,多批):合并展示,无静默丢句;summary 标注多段合并。
- 故意构造一批失败(如注入超长句触发截断):该批占位句可见,其余批正常。
- `.txt` 上传:UTF-8 正常;Shift-JIS 提示转存。
- 中文语言默认;生词本收藏、SRS、Anki 导出对纯文本来源的词正常工作。

## 五、验证清单(实现完成后)

- `npm test`(含新增 text-batching 测试与回归)
- `npm run lint -- --quiet`
- `npm run build`
- Netlify 运行时代码检查:`netlify/src/lib/` 若有 `analyzeText` 镜像,同步分批改动(CLAUDE.md 提示 mirror 易漂移)
- 桌面/移动端手动验证输入与展示

## 六、风险与权衡

- **抽出 `text-batching.ts` 是顺手重构**:不在原始「纯文本输入」范围内,但它使三个债务可测、且改善 `ai-service.ts` 过大。符合「改正在碰的代码」原则。风险:抽离需保证 `ai-service.ts` 导入路径正确,build 通过。
- **占位句的下游兼容**:占位句带空 vocabulary/grammar,必须确认 `filterLearningGrammar`、`getLearningGrammarInTextOrder`、词汇卡渲染都正确跳过。这是实现时的高优先验证点,已在测试范围列出。
- **`MAX_BATCH_CHARS=800` 是经验值**:不同模型 token 计数不同。设为常量便于调整,不硬编码进调用处。若线上出现截断,调小即可。
- **不自动检测编码**:Shift-JIS `.txt`(Windows 日文系统常见)会乱码,靠提示用户转存。若反馈多,后续加 `encoding-japanese` 检测;首版 YAGNI。
