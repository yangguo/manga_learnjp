# Mokuro 音色与阅读连续性 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 让 Mokuro Reader 只提供当前会话经实际合成验证的日语音色，打开生词本不卸载阅读器，并在重新选择同一目录后恢复阅读位置。

**Architecture:** 在 `src/lib/speech.ts` 增加无 DOM 依赖的音色候选、失败分类和回退函数；`useSpeech` 管理串行静音验证与实际朗读生命周期。新的 `src/lib/mokuro-progress.ts` 负责文档身份、进度序列化与校验恢复；`MokuroReader` 只同步其已有状态。生词本页面主体被提取为共享组件，由独立路由和阅读页可访问抽屉复用。

**Tech Stack:** Next.js App Router、React 19、TypeScript、Tailwind CSS、lucide-react、framer-motion、Zustand、Vitest、Web Speech API、localStorage。

**Validated design:** `docs/superpowers/specs/2026-07-11-mokuro-speech-and-reading-continuity-design.md`

## Global Constraints

- 不改 OCR、分析 API、JLPT 校准、词汇本数据模型或 Netlify runtime；无须同步 `netlify/src/lib`。
- 音色只在本次页面会话收到 Web Speech `onstart` 后才算可用；不得承诺修复浏览器在线服务、系统语言包或企业策略。
- 音色验证不写入 localStorage。阅读进度只保存位置，刷新后用户仍需手动选择目录。
- 图标按钮用 lucide，并提供 `aria-label` 和 `title`；抽屉支持关闭按钮和 Escape。
- 每项逻辑先写失败测试，再写最小实现；每个任务后独立提交。

## File Map

| 文件 | 动作 | 职责 |
|---|---|---|
| `src/lib/speech.ts` | 修改 | 纯音色筛选、错误分类和回退选择 |
| `src/lib/speech.test.ts` | 修改 | 音色纯函数测试 |
| `src/components/useSpeech.ts` | 修改 | 音色验证与朗读生命周期 |
| `src/lib/mokuro-progress.ts` | 新增 | 本地进度键、序列化和恢复 |
| `src/lib/mokuro-progress.test.ts` | 新增 | 阅读进度纯函数测试 |
| `src/components/MokuroReader.tsx` | 修改 | 接入验证音色和阅读进度 |
| `src/components/WordBank.tsx` | 新增 | 复用的生词本主体 |
| `src/components/WordBankDrawer.tsx` | 新增 | Reader 内抽屉 |
| `src/app/words/page.tsx` | 修改 | 独立页面复用主体 |
| `src/components/Header.tsx` | 修改 | 可选的打开抽屉回调 |
| `src/app/page.tsx` | 修改 | 管理抽屉开关且不卸载 Reader |

## Task 1: 定义可测试的音色可用性规则

**Files:**
- Modify: `src/lib/speech.ts`
- Modify: `src/lib/speech.test.ts`

1. 在现有测试中定义含 `lang`、`voiceURI`、`name` 的音色 fixture，写失败测试：
   - `getJapaneseVoices` 只保留 `ja` 主语言。
   - `getVerifiedVoices` 只输出已验证且不在不可用集合的 URI。
   - `isSpeechFailure('canceled')` 与 `isSpeechFailure('interrupted')` 为 false。
   - `voice-unavailable`、`synthesis-unavailable` 和 `timeout` 为 true。
   - `selectFallbackVoice` 先保留仍验证有效的指定 URI，否则按现有 `selectVoice` 回退。
2. Run: `npm test -- src/lib/speech.test.ts`
   Expected: FAIL，因函数尚未导出。
3. 扩展 `SpeechVoiceLike` 的可选 `voiceURI`，实现以上四个纯函数；不读取 `window`。
4. Run: `npm test -- src/lib/speech.test.ts`
   Expected: PASS。
5. Commit:
   ```bash
   git add src/lib/speech.ts src/lib/speech.test.ts
   git commit -m "test(speech): define verified voice selection"
   ```

## Task 2: 实现 useSpeech 的串行验证与失败处理

**Files:**
- Modify: `src/components/useSpeech.ts`

1. 把 hook 返回契约扩展为：
   ```ts
   verifiedVoices: SpeechSynthesisVoice[]
   isVerifying: boolean
   verifyVoices: () => Promise<void>
   speak: (text: string) => Promise<{ started: boolean; reason?: string }>
   ```
2. 实现内部 `speakWithVoice`：为每次 utterance 绑定 `onstart`、`onend`、`onerror` 和固定启动超时。仅 `onstart` 返回成功；每个完成路径清除定时器。
3. `verifyVoices` 按顺序处理日语候选。每项用极短日文与 `volume = 0` 验证；启动成功加入 verified URI，失败 URI 加入本会话不可用集合。验证期间不可并发，避免 `speechSynthesis.cancel()` 相互影响。
4. 正式 `speak` 只能使用 `verifiedVoices`。正式朗读失败时，除 canceled/interrupted 外移除该 URI、记录失败，并返回失败结果。取消和卸载要清理音频与计时器。
5. Run: `npm test -- src/lib/speech.test.ts && npm run lint -- --quiet`
   Expected: PASS，且没有新增 ESLint error。
6. Commit:
   ```bash
   git add src/components/useSpeech.ts
   git commit -m "fix(speech): verify voices before exposing them"
   ```

## Task 3: 新建阅读进度纯函数与测试

**Files:**
- Create: `src/lib/mokuro-progress.ts`
- Create: `src/lib/mokuro-progress.test.ts`

1. 写失败测试，使用两页 Mokuro fixture：
   - UUID 存在时 `createMokuroProgressKey` 使用 `title_uuid` + `volume_uuid`。
   - UUID 缺失时使用目录名、mokuro 文件名和页数的确定性回退。
   - 正常记录恢复为对应 `pageIndex` / `selectedBlockIndex`。
   - 无效 JSON、schema 不匹配、非整数、页码越界恢复首页无选块。
   - 页面有效但块超界时保留页码、清除选块。
2. Run: `npm test -- src/lib/mokuro-progress.test.ts`
   Expected: FAIL，模块不存在。
3. 实现：
   ```ts
   export const MOKURO_PROGRESS_STORAGE_PREFIX = 'manga-learnjp:mokuro-progress:'
   export const DEFAULT_MOKURO_PROGRESS = { pageIndex: 0, selectedBlockIndex: null }
   export const createMokuroProgressKey = (...)
   export const serializeMokuroProgress = (...)
   export const restoreMokuroProgress = (...)
   ```
   `restoreMokuroProgress` 捕获 JSON 错误，验证 `schemaVersion === 1`、有限整数范围和可选块索引；只持久化索引，绝不保存文本。
4. Run: `npm test -- src/lib/mokuro-progress.test.ts`
   Expected: PASS。
5. Commit:
   ```bash
   git add src/lib/mokuro-progress.ts src/lib/mokuro-progress.test.ts
   git commit -m "feat(mokuro): add validated reading progress storage"
   ```

## Task 4: Reader 接入音色验证和进度恢复

**Files:**
- Modify: `src/components/MokuroReader.tsx`

1. 改用 hook 的 `verifiedVoices`、`isVerifying`、`verifyVoices`。音色控制在浏览器支持语音时可见；验证前 select 禁用，验证后只渲染已验证音色。用 `RefreshCw` 图标按钮触发验证，提供中英文可访问文本和 loading 状态。
2. `speakSelection` 改为处理异步结果，仅当 voice list 已加载、未在验证且没有可用音色时显示一次“无日语音色”提示。验证列表变化后用 effect 清理已不合法的 `voiceURI`，回退到有效音色或 `null`。
3. 在 `importDirectoryFiles` 解析完 `.mokuro` 后、现有 state set 之前，读取同一 document key 的 localStorage 记录并用 `restoreMokuroProgress` 校验。用恢复页码替代 `setCurrentPageIndex(0)`；块仍有效时用当前解析 block 的 `getMokuroBlockText` 构造 `SelectedMokuroBlock`。
4. 新增 progress effect：有 Mokuro 文档时，使用当前页、当前页有效选块的 block index 和文档 key 写 localStorage。存储被禁用时只 `console.warn`，不阻塞阅读。翻页、键盘清除和 reset 沿用既有状态语义。
5. Run: `npm test -- src/lib/speech.test.ts src/lib/mokuro-progress.test.ts && npm run lint -- --quiet`
   Expected: PASS 且无新增 lint error。
6. Commit:
   ```bash
   git add src/components/MokuroReader.tsx
   git commit -m "fix(mokuro): restore reading progress and verified voices"
   ```

## Task 5: 将生词本嵌入阅读内抽屉

**Files:**
- Create: `src/components/WordBank.tsx`
- Create: `src/components/WordBankDrawer.tsx`
- Modify: `src/app/words/page.tsx`
- Modify: `src/components/Header.tsx`
- Modify: `src/app/page.tsx`

1. 把当前 `/words/page.tsx` 的文案、相对时间、`WordCard` 和 store UI 移入 `WordBank`。加入 `showBackHome?: boolean`，仅独立路由传 true；抽屉传 false，避免触发卸载 Reader 的导航。
2. 实现 `WordBankDrawer({ open, onClose })`。关闭时返回 null；打开时用固定遮罩和右侧面板，含 `role="dialog"`、`aria-modal="true"`、标题 `aria-labelledby` 和 X 图标按钮。effect 监听 Escape 并清理。
3. `Header` 新增可选 `onOpenWordBank`。有回调时将原 Link 换成 `button type="button"`，无回调时保留 Link，外观与数量徽标一致。
4. Home 新增 `isWordBankOpen` state，传递 Header 回调并渲染 Drawer。不得通过路由、key 或条件卸载 `MokuroReader`。
5. Run: `npm run lint -- --quiet && npm run build`
   Expected: lint 无 error，生产构建成功。
6. Commit:
   ```bash
   git add src/components/WordBank.tsx src/components/WordBankDrawer.tsx src/app/words/page.tsx src/components/Header.tsx src/app/page.tsx
   git commit -m "fix(word-bank): preserve reader state in drawer"
   ```

## Task 6: 完整验证、真实浏览器回归与交付

**Files:**
- Modify only if validation uncovers a scoped defect.

1. Run:
   ```bash
   npm test
   npm run lint
   npm run build
   git diff --check
   git status --short
   ```
   Expected: 测试、构建成功，lint 无 error，diff 无空白问题；记录现有但未新增的 <img> warning。
2. 启动 `npm run dev -- --port 3001`，按 @playwright 技能用浏览器验证：
   - Reader 中点生词本不改变 URL，关闭按钮和 Escape 都回到不变的 Reader。
   - 直接访问 `/words` 正常显示独立生词本。
   - 支持 Web Speech 的浏览器中，刷新验证时 select 禁用，完成后仅含实际启动成功的日语音色。
   - 在本地 Mokuro fixture/真实目录第 N 页选块，重新选择同一目录后恢复页码与高亮块。
3. 使用 @superpowers:requesting-code-review 审查分支 diff；修复真实问题后重跑本任务自动验证。
4. 使用 @superpowers:finishing-a-development-branch 完成合并和分支清理；禁止强制或破坏性 Git 命令。
