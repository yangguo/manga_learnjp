# 修复:让 OpenAIService 尊重 OPENAI_BASE_URL(ARK 等兼容端点)+ 真实错误透传

## 根因(已诊断确认)

`重新分析` 报 `All batches failed to process`。真实根因是两层 bug 叠加:

1. **主因:`OpenAIService` 不读 `OPENAI_BASE_URL`。** 用户的 `.env.local` 配的是火山方舟 ARK:
   - `OPENAI_BASE_URL=https://ark.cn-beijing.volces.com/api/v3`
   - `OPENAI_API_KEY=<ark key>`, `OPENAI_MODEL=doubao-seed-evolving`
   - 但 `OpenAIService` 把 chat URL **硬编码成 `https://api.openai.com/v1/chat/completions`**(ai-service.ts 5 处:1201/1258/1326/1431/1522)。
   - ARK key 打官方 OpenAI 端点 → 401 → 每个批次 `throw 'OpenAI API error: 401'` → 全部失败。
   - **已实测验证**:直接用 `OPENAI_BASE_URL` + key + model 打 `{base}/chat/completions`(ARK 正确路径)返回 HTTP 200,正常出字。配置本身没问题,纯是代码没用它。
   - `improved-text-detection.ts:236` 同样硬编码(图像 OCR 预处理路径),同 bug 类别。

2. **副因:`combineBatchResults` 全失败时吞掉真实错误。** 每个批次的真实 `error`(如 `OpenAI API error: 401`)被存进 `BatchResult.error`,但全失败时 `combineBatchResults` 只抛通用 `'All batches failed to process'`(text-batching.ts:95),真实原因丢失,前端只看到通用消息,无法诊断。

3. **次因(误导性,非直接致错):`/api/providers` 无条件 push `openai-format`。** providers/route.ts:23-25 把 `openai-format` 无条件加入可用列表,即使没配 `OPENAI_FORMAT_*`。导致前端看到 `["openai-format"]`,误导以为是 format 路径,实际走的是 `openai`(硬编码端点)路径。这没致错,但诊断时严重误导。

## 方案

让 `OpenAIService` 像 `OpenAIFormatService` 一样支持自定义端点(后者已正确处理:`settings.endpoint.replace(/\/+$/,'')` + `${endpoint}/chat/completions`)。同时透传真实错误。

### Task 1:OpenAIService 支持 OPENAI_BASE_URL(TDD)

**`src/lib/ai-service.ts` - `OpenAIService` 类:**
- 构造函数增加 baseUrl 解析(镜像 OpenAIFormatService 模式):
  ```ts
  private chatCompletionsUrl: string
  constructor(apiKey: string, model?: string) {
    this.apiKey = apiKey
    this.model = model || process.env.OPENAI_MODEL || 'gpt-4-vision-preview'
    const base = (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/+$/, '')
    // 若 base 已含 /v1 或 /api/v3 等版本段,直接拼 /chat/completions;否则补 /v1
    this.chatCompletionsUrl = /\/v\d+(\/|$)/.test(base) ? `${base}/chat/completions` : `${base}/v1/chat/completions`
  }
  ```
  - 兼容:`api.openai.com/v1`(官方,无 BASE_URL)→ `…/v1/chat/completions`;`ark…/api/v3`(ARK)→ `…/api/v3/chat/completions`;裸域名 `example.com` → `example.com/v1/chat/completions`。
- 5 处硬编码 `'https://api.openai.com/v1/chat/completions'`(1201/1258/1326/1431/1522)→ `this.chatCompletionsUrl`。

**`src/lib/improved-text-detection.ts:236`:** 改用 `openaiService.chatCompletionsUrl`(暴露为 public readonly)而非硬编码 URL。需把 `chatCompletionsUrl` 设为 public。

**测试(新建 `src/lib/ai-service-url.test.ts`):** 不发真实请求,只断言 URL 构造:
- 无 `OPENAI_BASE_URL` → `https://api.openai.com/v1/chat/completions`
- `OPENAI_BASE_URL=https://ark.cn-beijing.volces.com/api/v3` → `…/api/v3/chat/completions`
- `OPENAI_BASE_URL=https://api.openai.com/v1`(带 /v1)→ `…/v1/chat/completions`
- 尾部斜杠被剥除
- 测试通过 `reset` env / 重新 new OpenAIService 验证。`OpenAIService` 构造函数目前是 export 的类,可直接 new。

### Task 2:combineBatchResults 全失败时透传真实错误(TDD)

**`src/lib/text-batching.ts:94-96`:** 全失败时把首批(或聚合)错误附上:
```ts
if (batches.every(b => b.status === 'failed')) {
  const firstError = batches.find(b => b.error)?.error ?? 'unknown'
  throw new Error(`All batches failed to process: ${firstError}`)
}
```
- 保留前缀 `All batches failed to process`(兼容现有测试的 `toThrow` 子串匹配,但现有测试用 `toBe` 精确匹配需更新)。

**`src/lib/text-batching.test.ts:102-105`:** 更新断言为 `toThrow('All batches failed to process')`(子串,仍通过)+ 新增一个测试断言错误消息包含首批 `error` 值。

### Task 3:providers route 不再无条件 push openai-format

**调查结论(已查):**
- 前端 `src/lib/store.ts:18-23` 调 `/api/providers` 读 `data.default` 设 `selectedProvider`。删无条件 push 后,用户配置下 `default` 从 `'openai-format'` 变 `'openai'`(因 Task 1 后 openai service 创建且指向 ARK 可用)--这是**正确**的修复方向,store.ts 已能处理。
- `ReadingModeViewer.tsx:39` 只用 `provider === 'openai-format'` 做显示标签,不构成依赖。
- **安全删除无条件 push**。

**`src/app/api/providers/route.ts:23-25`:** 删除 `if (!availableProviders.includes('openai-format')) { push }` 三行。`smartDefault` 逻辑(28 行)保留,但 `availableProviders.includes('openai') ? 'openai' : 'openai-format'` 在只剩 openai 时正确返回 openai;若都无则返回 openai-format(理论不会到这,因 route.ts 42 行已拦截无配置)。

### Task 4:文档化 OPENAI_BASE_URL

**`.env.example`:** 加注释说明 `OPENAI_BASE_URL` 用于官方端点之外的兼容端点(ARK/代理等),并给 ARK 示例。

### Task 5:Netlify 镜像同步

- `netlify/src/lib/ai-service.ts`:同样改 OpenAIService 构造函数 + 5 处硬编码(镜像 src)。
- `netlify/src/lib/improved-text-detection.ts`:同样改。
- `netlify/src/lib/text-batching.ts`:同样改 Task 2(全失败错误透传)。
- **`netlify/functions/providers.ts` 有额外风险**:它是 src 的超前/分叉版本,引用了 `gemini` provider(58 行,`AIProvider` 类型里不存在,属已存在的 netlify tsc 错误)。**只同步"删无条件 push openai-format"这一改动,不碰 gemini 分支**(避免引入更大改动)。需小心处理,确认删 push 后 gemini 逻辑仍自洽。

### Task 6:验证

- `npm test`、`npm run lint -- --quiet`、`npm run build`
- **端到端实测**:重启 dev server(让新代码生效),curl `/api/analyze` 文本分析,确认返回 200 + 正常分析结果(而非 500 All batches failed)。
- `npx tsc --noEmit -p netlify/tsconfig.json` 确认镜像编译。

## 分支策略

当前在 `fix/jlpt-checksum-crlf`(PR #18,OPEN)。这是独立问题,需新建分支 `fix/openai-base-url` 从 `main` 切出,独立 PR。

## 风险

- **Task 1 的 URL 拼接正则** `/\/v\d+(\/|$)/` 需覆盖 ARK(`/api/v3`)和官方(`/v1`)。测试覆盖这几种。
- **Task 3 删无条件 push** 可能影响前端 provider 下拉。需先 grep 前端依赖。若风险高,可保守:保留 push 但加注释,或改成只在确有 format 配置时 push。倾向先调查再定。
- `improved-text-detection.ts` 的 `openaiService` 参数是 `any`,改用 `.chatCompletionsUrl` 无类型保护,但运行时正确。
