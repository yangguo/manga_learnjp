# M2B JLPT 目标等级体验设计

日期: 2026-07-11
状态: 已确认，待实施
关联: `docs/superpowers/2026-07-10-jlpt-prep-assessment.md`、`docs/superpowers/specs/2026-07-10-jlpt-level-calibration-design.md`

## 背景

M2A 已把词汇等级统一为固定社区词表提供的 `JLPTClassification`，但分析面板仍沿用过渡期规则：直接隐藏 N5，并显示硬编码的“N4+”文案。这个行为无法支持不同目标等级，也会让基础词从结果中消失。

M2B 将确定性等级转化为面向学习者的目标等级体验。它只处理词汇，不为语法制造未经验证的 N1–N5 分类。

## 已确认目标

1. 提供 N5–N1 目标等级设置，新用户默认 N4。
2. 图片分析和 Mokuro Reader 使用同一个设置，刷新后保持。
3. 目标等级本身是“重点”；更容易等级是“基础”；更难等级是“超纲”；无等级是“未定级”。
4. 基础词默认折叠，但可查看、收藏，不从分析结果删除。
5. 超纲词和未定级词保持可见。
6. 改变目标等级不隐藏、删除或重写生词本条目。
7. 语法继续使用现有基础语法过滤，不提供目标等级分组。

## 非目标

- 不实现 Anki/CSV 导出、SRS、账号或云同步。
- 不改变 M2A 词表、匹配规则、数据版本或缓存格式。
- 不给语法、汉字、句子或听力内容推断 JLPT 等级。
- 不增加独立设置页。
- 不按目标等级过滤 AI 请求；完整词汇先校准，再在客户端分组。

## 方案选择

### 方案 A：共享分析面板内设置和分组（选定）

`MokuroAnalysisPanel` 已由 Mokuro Reader、图片阅读模式和整页图片分析共同使用。把目标选择器和词汇分组放在该组件中，只实现一次即可保证三条入口一致。设置放入独立 Zustand persist store，所有面板实例实时同步。

### 方案 B：Header 全局设置

可见性高，但会让已经拥挤的 Header 增加五档控制，并把只影响分析结果的设置扩散到所有页面。移动端布局成本较高。

### 方案 C：各阅读器分别保存设置

局部实现简单，但图片分析和 Mokuro 会产生两个状态源，不满足共用设置和一致展示。

选择 A。

## 数据模型与纯函数

新增 `src/lib/jlpt-target.ts`：

```ts
export type JLPTVocabularyBand =
  | 'foundation'
  | 'focus'
  | 'stretch'
  | 'unclassified'

export interface JLPTVocabularyGroups<T> {
  foundation: T[]
  focus: T[]
  stretch: T[]
  unclassified: T[]
}

export const classifyJLPTLevelForTarget = (
  level: JLPTLevel | null,
  target: JLPTLevel
): JLPTVocabularyBand

export const groupVocabularyByTarget = <T extends { jlpt?: JLPTClassification }>(
  words: T[],
  target: JLPTLevel
): JLPTVocabularyGroups<T>
```

`JLPT_LEVELS` 的顺序是 N5 → N1。等级索引小于目标为基础，等于目标为重点，大于目标为超纲，`null` 或缺少分类为未定级。分组保持输入顺序，不修改词对象。

新增 `src/lib/jlpt-target-store.ts`，使用 Zustand persist：

- localStorage key：`jlpt-target-storage`。
- version：1。
- `targetLevel` 默认 `N4`。
- `setTargetLevel` 只接受 `JLPTLevel`。
- 存储损坏或未知值时迁移/回退到 N4。

该状态不进入分析缓存、生词本数据或 API 参数。

## UI

新增 `JLPTTargetSelector`，在词汇 section 标题下方显示 N5、N4、N3、N2、N1 分段按钮：

- 当前目标使用高对比选中态及 `aria-pressed`。
- 选择器使用固定尺寸和可换行布局，移动端不溢出。
- 中英文标签分别为“目标等级 / Target level”。
- 目标变化立即重新分组现有结果，不重新请求 AI、不重新校准。

词汇区域按以下顺序显示：

1. 重点：目标等级本身，默认展开。
2. 超纲：所有更难等级，默认展开。
3. 未定级：词表未命中的词，默认展开。
4. 基础：所有更容易等级，使用原生 `details`，默认折叠。

每组标题显示分类名称、对应等级范围和数量。单词卡继续使用现有 `JLPTBadge` 和收藏按钮。零条目组显示紧凑空状态，避免用户误以为数据被过滤。

硬编码“N4+”词汇文案删除。语法区域保留现有 `filterLearningGrammar`，空状态改为与目标无关的通用文案。

## 生词本

`WordBank` 继续显示所有收藏词及其 `JLPTBadge`。它不按目标等级过滤或重排，也不把 band 写入 `SavedWord`。因此目标变化只影响分析视图，不改变收藏数量、原句、时间或分类快照。

后续 M3 导出如需目标 band，必须在导出时根据当前目标动态计算，不应把 band 固化进条目。

## 错误与兼容

- 旧用户没有目标设置时默认 N4。
- localStorage 不可用时 Zustand 使用内存默认值，分析仍可用。
- 词表加载失败产生的未定级词进入“未定级”，不会被隐藏。
- M2A 的历史 N5 过滤函数不再用于词汇 UI；基础语法过滤保持不变。
- 不修改服务端和 `netlify/src/lib`。

## 测试

纯函数测试覆盖：

- N4 目标下 N5→基础、N4→重点、N3/N2/N1→超纲、null→未定级。
- 每个目标等级的边界，尤其 N5 无基础、N1 无超纲。
- 分组保持输入顺序且不修改输入。
- 缺少分类进入未定级。
- store 迁移对合法等级保留、非法值回退 N4。

组件/浏览器验收覆盖：

1. 新会话默认 N4。
2. 图片分析和 Mokuro 任一处切换目标，另一入口读取同一值。
3. 刷新后目标保持。
4. 基础组默认折叠，可展开、查看和收藏。
5. 重点、超纲、未定级始终可见。
6. 改变目标不触发分析 API 请求，不改变生词本条目。
7. 桌面和移动端选择器不溢出。
8. `npm test`、`npm run lint`、`npm run build`、`git diff --check` 全部通过。

