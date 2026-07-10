# JLPT 词汇等级校准设计

日期: 2026-07-10
状态: 已实现
关联: `docs/superpowers/2026-07-10-jlpt-prep-assessment.md` 里程碑 M2A

实现提交: `4ba5f9a`（最终交付记录见后续文档提交）

## 一、背景

项目现有 `WordAnalysis.difficulty` 由 AI 生成,不同分析 prompt 混用 `N1-N5` 与 `beginner/intermediate/advanced`,运行时校验也没有验证每个词的等级。它不能支撑目标等级过滤、稳定的生词标签或后续导出。

新版 JLPT 官方明确表示不发布词汇、汉字和语法的逐项清单。因此本功能采用固定版本的社区词表作为「JLPT 参考等级」数据源,结果可复现且可追踪,但不声称是官方定级。界面仍使用「JLPT 等级」措辞,来源页集中说明数据性质、版本和许可证。

官方说明:

https://www.jlpt.jp/tw/reference/pdf/guidebook_s_e.pdf

## 二、目标

1. 以本地静态词表替代 AI 输出,成为词汇 JLPT 等级的唯一权威来源。
2. 对新分析、Mokuro 旧缓存和现有生词本使用同一套确定性校准规则。
3. 词表未命中时明确标为「未定级」,不隐藏词汇,不回退到 AI 估级。
4. 固定上游版本、许可证、生成统计和摘要,让数据更新可审查、可复现。
5. 为 M2B 的目标等级设置和四类展示提供稳定数据契约。

## 三、非目标

- 不在 M2A 增加目标等级选择器或基础/重点/超纲分组;这些属于 M2B。
- 不为语法点提供 N1-N5 等级;现有基础语法启发式过滤暂时保留。
- 不引入形态分析器、JMdict 全量词典、第三方运行时 API 或 AI 等级回退。
- 不处理 Anki/CSV 导出、SRS、账号、云同步、汉字分级或语法收藏。
- 不承诺覆盖所有活用形、异体字、俚语和专有名词;未可靠命中时宁可未定级。

## 四、数据源与版本

首版数据源选用 `jamsinclair/open-anki-jlpt-decks`:

- 仓库:https://github.com/jamsinclair/open-anki-jlpt-decks
- 固定提交:`1ad66734417aca9dbcca6b2d5ee440cb13ab3ba0`
- 上游提交日期:2025-08-11
- 许可证:MIT
- 上游说明:词表源自 Tanos 系列数据并由社区维护,不是 JLPT 官方清单。

对该提交的首轮审计结果:

| 指标 | 数值 |
|---|---:|
| N1-N5 CSV 记录 | 8,131 |
| 唯一「词形 + 读音」键 | 8,034 |
| 重复记录 | 97 |
| 跨等级冲突键 | 96 |
| 纯假名空读音修复 | 2 |
| 完整版本化 JSON 估算 | 300,904 bytes |

这些数字写入生成清单并作为首版回归基线。更新数据时允许数字变化,但脚本必须输出差异,由代码审查确认后才能提交。

首版 `datasetVersion` 固定为:

```text
open-anki-jlpt-decks@1ad66734417aca9dbcca6b2d5ee440cb13ab3ba0
```

## 五、数据契约

词汇核心字段和校准结果分离:

```ts
export type JLPTLevel = 'N5' | 'N4' | 'N3' | 'N2' | 'N1'

export interface JLPTClassification {
  level: JLPTLevel | null
  source: 'open-anki-jlpt-decks'
  datasetVersion: string
  match: 'exact' | 'normalized' | 'none'
}

export interface WordAnalysis {
  word: string
  reading: string
  meaning: string
  partOfSpeech: string
  difficulty?: string
  jlpt: JLPTClassification
}
```

`difficulty` 仅用于兼容旧 API 响应和历史缓存,标记为 deprecated。任何过滤、badge、收藏、导出或学习逻辑不得读取它。客户端把 API JSON 视为未校准输入,只有经过校准并带有必填 `jlpt` 的对象才能进入 UI、缓存和生词本。

`SavedWord` 同样保存完整 `jlpt` 快照。`datasetVersion` 变化时允许重新校准并更新等级,但不得改变词形、读音、释义、原句或收藏时间。

## 六、确定性匹配规则

### 6.1 键

源索引主键是原始 `[word, reading]`,使用 `JSON.stringify([word, reading])` 形成无碰撞字符串键,不使用简单字符串拼接。运行时加载器从源索引构建第二个标准化 Map:

- 先查源索引,命中时 `match = 'exact'`。
- 源索引未命中时再查标准化 Map,命中时 `match = 'normalized'`。
- 两个索引都未命中时 `match = 'none'`。

标准化 Map 只存在于内存,不在发布 JSON 中复制 8,034 个键,避免数据体积接近翻倍。生成器仍预先计算并报告标准化碰撞;首版审计未发现新增标准化碰撞。

### 6.2 标准化

只允许不会引入词义猜测的处理:

- Unicode NFKC 标准化。
- 去除首尾空白并统一内部连续空白。
- 读音统一为平假名,用于消除片假名/平假名形式差异。
- 词形保留汉字和假名信息,不做只凭读音的降级匹配。

先尝试原始字段的精确键;失败后尝试标准化键。禁止词干猜测、同音词匹配、模糊编辑距离和 AI 回退。

### 6.3 冲突

同一「词形 + 读音」出现在多个等级时,选择最早应掌握的等级:

`N5 -> N4 -> N3 -> N2 -> N1`

例如同一键同时出现在 N5 和 N3 时,最终等级为 N5。生成清单记录全部冲突数量,测试固定代表性样例。

### 6.4 未命中

未命中时:

```ts
{
  level: null,
  source: 'open-anki-jlpt-decks',
  datasetVersion: '<current-version>',
  match: 'none'
}
```

UI 显示「未定级」。它保持可见,不被当作任意等级,也不继承 AI 的 `difficulty`。

## 七、生成与发布架构

### 7.1 生成输入

仓库保存上游 URL、固定提交、许可证标识和预期文件列表。数据更新命令显式下载固定提交的 `src/n1.csv` 至 `src/n5.csv`,正常 `npm install`、测试、构建和运行均不访问上游。

### 7.2 生成校验

生成器必须:

- 用 CSV 解析器读取 `expression`、`reading` 和文件对应等级,不使用字符串拆列。
- 拒绝缺字段、空词形、未知等级和无法解析的输入。
- 对「读音为空且词形完全由平假名/片假名、长音符和空白组成」的记录,使用 `reading = expression` 做确定性修复并计数。其他空读音一律拒绝。首版恰有 2 条此类 N4 记录。
- 统计总记录、唯一键、同级重复和跨级冲突。
- 统计标准化后的键数量和新增冲突;新增冲突继续按最早应掌握等级解决并进入清单。
- 按已确认规则解决冲突并稳定排序。
- 计算输入提交、输出数据和许可证文件的 SHA-256。
- 先写临时输出并完成自检,成功后再替换已提交数据。

### 7.3 发布产物

规划产物:

- `public/data/jlpt-vocabulary.v1.json`:紧凑运行时索引。
- `public/data/jlpt-vocabulary.v1.manifest.json`:版本、提交、统计、摘要和生成时间。
- `public/licenses/open-anki-jlpt-decks-MIT.txt`:许可证副本。

运行时数据文件结构固定为:

```ts
interface JLPTVocabularyDataFile {
  schemaVersion: 1
  datasetVersion: 'open-anki-jlpt-decks@1ad66734417aca9dbcca6b2d5ee440cb13ab3ba0'
  entries: Record<string, JLPTLevel>
}
```

`entries` 的键是源数据 `[expression, reading]` 的 JSON 字符串。运行时索引按需加载并由浏览器缓存,不进入首屏 JavaScript。包含版本字段后的当前估算约 301 KB;首版设置 350 KB 未压缩上限,超过时生成测试失败并要求审查数据结构。

## 八、运行时数据流

统一数据流:

```text
AI / Netlify 原始 JSON
  -> 响应结构校验
  -> 加载本地 JLPT 索引
  -> 递归校准所有句子中的词汇
  -> canonical AnalysisResult / ReadingModeResult
  -> UI、Mokuro 缓存、生词本
```

`src/lib/client-api.ts` 是新分析结果的统一入口。`ImageUploader` 中绕过该模块的直接 `/api/analyze` 请求必须收拢,避免某条路径漏过校准。校准模块按句子数组工作,使图片分析、阅读模式、Mokuro 和仍在使用的兼容结果形状复用同一逻辑。

M2A 同时停止在学习者入口提前排除 N5 词汇。AI 返回有学习价值的完整词汇集合,当前 UI 在 M2B 交付前仍可用校准后的 N5 规则保持原有折叠/隐藏体验。阅读模式中硬编码的 `excludeN5=true` 必须移除,并同步检查 Netlify 镜像。AI 返回的等级字段可以暂时存在,但校准层始终忽略它。

## 九、缓存与生词本迁移

### 9.1 Mokuro 缓存

- 缓存格式升级为 v2,记录 `jlptDatasetVersion`。
- 解析器继续接受 v1;v1 加载后在内存中校准,下一次持久化时写成 v2。
- v2 的数据版本与当前词表不一致时重新校准。
- 重新校准不请求 AI,不改变翻译、释义、语法和原文。
- 目录缓存和 localStorage fallback 使用同一迁移函数。

### 9.2 生词本

- `word-bank-storage` 升级为 v2。
- v1 条目完整保留,词表加载成功后补充 `jlpt` 并持久化。
- 迁移前后的条目数量、去重键、原句和 `savedAt` 必须一致。
- 词表暂时加载失败时不把已有可靠 `jlpt` 覆盖为未定级。

## 十、UI 与来源说明

M2A 不增加目标等级选择器。现有词汇 badge 改为只显示 `jlpt.level` 或「未定级」,所有使用 `difficulty` 的颜色映射迁移到共享 JLPT badge helper。

新增来源页,至少展示:

- 当前数据集名称、版本和固定提交。
- 上游仓库链接与 MIT 许可证链接/副本。
- 「新版 JLPT 不发布官方逐词清单」说明和官方链接。
- 社区数据可能存在遗漏、冲突和错误的免责声明。
- 当前生成统计和最近更新时间。

Header 提供低干扰的来源入口;不在每张词卡重复免责声明。

## 十一、失败处理

- 本地数据文件 404、JSON 损坏、版本不匹配或摘要不一致时,校准状态进入 `error`。
- 翻译、释义、语法、收藏和阅读继续可用;新词统一显示未定级。
- 失败状态可为当前页面构造仅用于渲染的临时 null 分类,其 `datasetVersion` 使用代码内固定的预期版本;该临时结果不得写入缓存或生词本。
- 词汇区显示简短的非阻塞提示「JLPT 等级数据暂时不可用」。
- 发生临时加载失败时不覆盖缓存或生词本中已有且版本可识别的可靠分类。
- 不调用第三方 API,不使用 AI 估级,不静默接受部分数据。
- 更新脚本失败时保留当前已提交产物。

## 十二、测试与验收

### 12.1 自动化测试

- 生成器:合法 CSV、缺字段、空值、未知等级、同级重复、跨级冲突、稳定输出、摘要和体积上限。
- 标准化:Unicode、空白、片假名/平假名;同形异音保持不同键。
- 匹配:exact、normalized、none;禁止 reading-only 命中。
- 权威性:AI 返回 N1 但词表命中 N5 时结果为 N5;未命中结果为 null。
- 结果遍历:所有受支持分析结果形状中的词都带 `jlpt`。
- 缓存:v1 解析、重新校准、v2 序列化、数据版本升级、目录/localStorage 一致。
- 生词本:v1 到 v2 零丢失;加载失败不覆盖已有分类。
- 客户端入口:所有 `/api/analyze` 成功响应都经过校准。

### 12.2 手动验收

1. 图片分析和 Mokuro Reader 的同一词显示同一等级。
2. 未命中词显示「未定级」且仍可收藏。
3. 加载旧 Mokuro 缓存不触发 AI 请求,随后写出 v2。
4. 旧生词本刷新后条目数量、原句和时间不变。
5. 模拟数据文件失败时分析仍显示,已有可靠分类不被覆盖。
6. 来源页在桌面和移动端可访问,许可证和版本信息完整。
7. 浏览器网络面板没有第三方词典请求。

### 12.3 交付检查

- `npm test`
- `npm run lint`
- `npm run build`
- Netlify 运行时受影响文件的 TypeScript 检查
- `git diff --check`

## 十三、M2B 接口约束

M2B 单独编写设计与实施计划,但必须复用本设计的 `JLPTLevel` 和 `JLPTClassification`。已确认行为:

- 默认目标 N4。
- 目标等级本身为重点。
- 更容易等级为基础,默认折叠。
- 更难等级为超纲,保留并明确标记。
- 未定级单独保留,不参与难度推断。
- 图片分析和 Mokuro Reader 共用持久化设置。
- 生词不会因目标变化被隐藏、删除或重写。

M2A 验收前不启动 M2B 实现。
