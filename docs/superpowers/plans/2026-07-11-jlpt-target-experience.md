# M2B JLPT Target Experience Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 为图片分析和 Mokuro Reader 增加共享、持久化的 JLPT 目标等级，并把完整词汇结果分成基础、重点、超纲和未定级四类。

**Architecture:** 纯函数模块根据 `JLPT_LEVELS` 和目标等级确定词汇 band，Zustand persist store 保存默认 N4 的共享目标。`MokuroAnalysisPanel` 是三条分析入口共用的 UI，只在这里接入分段选择器和四类展示；服务端、缓存与生词本数据不变。

**Tech Stack:** Next.js App Router、React 19、TypeScript、Zustand persist、Tailwind CSS、Vitest、Playwright。

**Validated design:** `docs/superpowers/specs/2026-07-11-jlpt-target-experience-design.md`

## Constraints

- 默认目标 N4，localStorage key 为 `jlpt-target-storage`。
- 顺序固定为 N5 → N1：更容易=foundation、相等=focus、更难=stretch、null=unclassified。
- 所有词继续显示；foundation 默认折叠，其他组展开。
- 不修改 AI 请求、Mokuro 缓存、生词本结构或 Netlify runtime。
- 语法不使用目标等级，只保留现有基础语法过滤。
- 新逻辑先测试失败再实现；React 代码遵循 @react-best-practices。

## Task 1: 目标等级分组纯函数

**Files:**
- Create: `src/lib/jlpt-target.ts`
- Create: `src/lib/jlpt-target.test.ts`

1. 写失败测试，覆盖 N4 的四类映射、N5/N1 边界、缺少分类、输入顺序不变、输入数组不被修改，以及 `getJLPTLevelsForBand` 返回正确等级范围。
2. Run: `npm test -- src/lib/jlpt-target.test.ts`
   Expected: FAIL，模块不存在。
3. 实现 `JLPTVocabularyBand`、`JLPTVocabularyGroups<T>`、`classifyJLPTLevelForTarget`、`groupVocabularyByTarget`、`getJLPTLevelsForBand`。
4. Run: `npm test -- src/lib/jlpt-target.test.ts`
   Expected: PASS。
5. Commit:
   ```bash
   git add src/lib/jlpt-target.ts src/lib/jlpt-target.test.ts
   git commit -m "feat(jlpt): add target vocabulary grouping"
   ```

## Task 2: 持久化目标等级 store

**Files:**
- Create: `src/lib/jlpt-target-store.ts`
- Create: `src/lib/jlpt-target-store.test.ts`

1. 写失败测试验证 `migrateJLPTTargetState`：合法 N1–N5 保留，缺失/非法/非对象回退 N4。
2. Run: `npm test -- src/lib/jlpt-target-store.test.ts`
   Expected: FAIL，模块不存在。
3. 实现 `DEFAULT_JLPT_TARGET = 'N4'`、纯迁移函数和 Zustand persist store：
   ```ts
   interface JLPTTargetState {
     targetLevel: JLPTLevel
     setTargetLevel: (level: JLPTLevel) => void
   }
   ```
   配置 `name: 'jlpt-target-storage'`、`version: 1`、`migrate`。
4. Run: `npm test -- src/lib/jlpt-target-store.test.ts`
   Expected: PASS。
5. Commit:
   ```bash
   git add src/lib/jlpt-target-store.ts src/lib/jlpt-target-store.test.ts
   git commit -m "feat(jlpt): persist target level setting"
   ```

## Task 3: 共享目标等级选择器

**Files:**
- Create: `src/components/JLPTTargetSelector.tsx`
- Modify: `src/components/MokuroAnalysisPanel.tsx`

1. 读取 @react-best-practices。
2. 新建 `JLPTTargetSelector({ language })`，从 store 读取目标和 setter，渲染固定尺寸、可换行的 N5–N1 segmented buttons。每个按钮带 `type="button"`、`aria-pressed`、中英文 group label。
3. 在 `MokuroAnalysisPanel` 词汇标题下渲染该选择器；面板从同一 store 读取 `targetLevel`，不增加跨组件 prop。
4. Run: `npm run lint -- --quiet`
   Expected: 无 ESLint error。
5. Commit:
   ```bash
   git add src/components/JLPTTargetSelector.tsx src/components/MokuroAnalysisPanel.tsx
   git commit -m "feat(jlpt): add shared target level selector"
   ```

## Task 4: 四类词汇展示

**Files:**
- Modify: `src/components/MokuroAnalysisPanel.tsx`
- Modify: `src/lib/analysis-filters.ts`
- Modify: `src/lib/analysis-filters.test.ts`

1. 用 `groupVocabularyByTarget(vocabulary, targetLevel)` 替换 `filterLearningVocabulary`，移除词汇 N5 过滤导出及对应过渡测试；语法过滤测试保持。
2. 在面板内提取小型 `VocabularyCard` 和 `VocabularyGroup`，避免复制收藏逻辑。组顺序固定 focus、stretch、unclassified、foundation。
3. focus/stretch/unclassified 始终渲染标题、等级范围和数量；foundation 用原生 `details` 且无 `open`，默认折叠。组内所有词保留 badge 和收藏按钮。
4. 更新中英文文案：重点、超纲、未定级、基础、空组文本；删除硬编码 N4+。语法空状态改为目标无关文案。
5. Run: `npm test -- src/lib/jlpt-target.test.ts src/lib/analysis-filters.test.ts && npm run lint -- --quiet`
   Expected: PASS，无 ESLint error。
6. Commit:
   ```bash
   git add src/components/MokuroAnalysisPanel.tsx src/lib/analysis-filters.ts src/lib/analysis-filters.test.ts
   git commit -m "feat(jlpt): group vocabulary by target level"
   ```

## Task 5: 路线图、完整验证和浏览器验收

**Files:**
- Modify: `docs/superpowers/2026-07-10-jlpt-prep-assessment.md`
- Modify only if verification exposes a scoped defect.

1. 将路线图更新为 M2B 已完成、M3 下一步，记录最终功能提交和验收证据。
2. Run:
   ```bash
   npm test
   npm run lint
   npm run build
   git diff --check
   ```
   Expected: 全部测试通过，lint 无 error（仅既有 img warning），生产构建通过。
3. 启动本地服务器，按 @playwright 在桌面和移动 viewport 验证：
   - 新会话显示默认 N4。
   - 切换等级后刷新保持。
   - 四组标题、数量和 foundation 默认折叠正确。
   - 选择器在 Mokuro 和图片分析共用 store，URL/网络无额外请求。
4. 使用 @superpowers:requesting-code-review 审查分支 diff；修复问题后重新运行完整验证。
5. 使用 @superpowers:finishing-a-development-branch 完成本地 merge 与 worktree 清理。

