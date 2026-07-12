# M5 Grammar Level And Bank Design

日期: 2026-07-12
状态: 已完成：同源 Tanos `.doc` grammar list 的固定等级、收藏与四分组交付

## 目标

为 AI 分析返回的语法点增加可追踪的 JLPT 参考等级，并允许用户收藏语法、保留解释、例句和漫画原句。等级必须来自固定版本的外部参考列表，不能使用 AI 自报等级或启发式规则冒充权威数据。

## 数据源决策

首选 Tanos JLPT Grammar N1–N5 列表：

- 语法入口: https://www.tanos.co.uk/jlpt/skills/grammar/
- 许可说明: https://www.tanos.co.uk/jlpt/sharing/

Tanos 明确允许站点非售卖内容按 Creative Commons BY 用于商业或非商业用途，并要求署名。其页面没有声明具体 CC 版本，因此产品来源页必须显示“CC BY，版本未由发布者注明”，保留原链接和作者 Jonathan Waller。实现前把许可页面文本快照、抓取日期和 SHA-256 写入仓库；如果许可页内容变化或无法访问，更新脚本必须失败，不能静默换源。

Hanabira 暂不作为发布数据源：虽然它提供结构化 N1–N5 JSON 并允许署名复用，但仓库只写“Creative Commons License”，未明确具体许可证版本，且站点同时列出教材来源。可作为人工交叉检查，不打包其解释或例句。

JLPT 官方不发布逐项语法清单，因此所有 UI 继续使用“JLPT 参考等级”，来源页明确非官方性质。

## 数据生成与版本

新增显式更新脚本 `scripts/update-jlpt-grammar.ts`：

1. 下载 Tanos 五个等级公开链接的 `.doc` grammar list 文档，而不是抓取商业音频或教材内容。
2. 使用 `word-extractor@1.0.4` 读取 Word 正文，禁止解析 HTML 或复制解释内容。
3. 提取 pattern 和 level，不复制解释、例句或付费内容。
4. 对 pattern 做 NFKC、空白和波浪占位符规范化。
5. 输出冲突、空值、重复项、各等级数量和总量摘要。
6. 对每个源页面保存 URL、抓取时间、响应 SHA-256 和生成器版本。
7. 原子写入 `public/data/jlpt-grammar.v1.json`、manifest 和 attribution 文本。

正常安装、构建和运行只读取已提交静态数据，不访问 Tanos。数据更新是人工执行并审查的维护动作。由于网站没有 commit pin，manifest 的源 payload 哈希就是可复现边界；任何哈希变化都生成明确 diff。

## 类型

词汇分类类型不扩展 source union，语法使用独立契约：

```ts
interface GrammarJLPTClassification {
  level: JLPTLevel | null
  source: 'tanos-jlpt-grammar'
  datasetVersion: string
  match: 'exact' | 'normalized' | 'none'
}

interface GrammarPattern {
  pattern: string
  explanation: string
  example: string
  jlpt?: GrammarJLPTClassification
}

interface SavedGrammar {
  pattern: string
  explanation: string
  example: string
  sourceSentence: string | null
  language: AnalysisLanguage
  jlpt?: GrammarJLPTClassification
  savedAt: string
}
```

运行时校准完成的 grammar 必须带 `jlpt`，但 API、旧缓存和降级路径继续接受缺失字段。

## 确定性匹配

新增 `src/lib/jlpt-grammar-dictionary.ts`：

- pattern 使用 NFKC。
- `〜`、`～` 和 `~` 统一为一个占位符。
- 删除普通空白和仅用于包围的标点，不删除日文助词或词干。
- 对源列表中明确以 `/`、`・` 分隔的等价写法生成独立 alias，并在 manifest 记录。
- 只按规范化后的完整 pattern 匹配；禁止 substring、解释文本、例句、读音或 AI 等级回退。
- 同一规范化 pattern 跨等级冲突时选择最早学习的较易等级，并输出冲突清单供人工审查。
- 未命中稳定返回 `level:null`、`match:'none'`。

为了提高命中率，AI prompt 只要求返回标准语法构式（例如 `～わけではない`），不得要求模型输出 JLPT 等级。模型格式仍不可信，最终等级只由本地字典决定。

## 校准数据流

语法校准复用 M2A 的边界原则，但保持独立状态：

- API 原始结果先校准词汇，再校准 grammar，最后进入 UI 和缓存。
- Mokuro、图片分析、Reading Mode 和 Netlify mirror 使用同一 helper 与测试向量。
- 旧缓存加载时在本地重新校准，不调用 AI、不改变翻译或解释。
- Mokuro cache 版本升级，记录 grammar datasetVersion；旧版本继续可读。
- 字典加载失败时 grammar 全部显示为未定级，分析和收藏仍可用，但不持久化临时等级。
- `/sources` 增加语法来源、许可措辞、版本、哈希和免责声明。

现有 prompt 会排除 N5/basic grammar，M5 必须改为“返回句子中有教学价值的完整语法构式，忽略孤立助词”。`filterLearningGrammar` 只移除空模式，不隐藏可靠 N5 项。所有 provider 与 Netlify prompt 必须保持 parity。

## 目标等级体验

语法使用与词汇相同的目标等级语义：

- 比目标容易: 基础。
- 与目标相同: 重点。
- 比目标困难: 超纲。
- 未命中或数据失败: 未定级。

`MokuroAnalysisPanel` 的语法区域改为四组完整展示；基础默认折叠，其他组展开，所有返回的语法都可查看和收藏。语法 badge 使用独立 classification 类型，但视觉与来源 tooltip 保持一致。

## 语法收藏

使用独立 `grammar-bank-storage`，避免扩大 word store 迁移和 M4 调度边界。稳定 key 为规范化 pattern；同一构式不因解释语言或不同漫画原句重复收藏。

首次收藏保存当时的 explanation、example、language、sourceSentence 和 savedAt。再次遇到已收藏 pattern 时星标显示已收藏；首版不自动覆盖原解释，用户可删除后重新收藏。JLPT 数据可随 datasetVersion 重新校准，但不得修改解释、例句、原句、语言或收藏时间。

生词本页面与 drawer 改为“词汇 / 语法”两个 tabs：

- 词汇 tab 保持 M1–M4 行为和 Anki 导出。
- 语法 tab 显示 pattern、JLPT badge、解释、例句、来源原句、语言和收藏时间。
- Header 收藏数量徽标显示词汇与语法总数；复习徽标仍只统计词汇。
- M4 不自动把语法加入 SRS；语法复习是未来独立范围。

## Store 与迁移

`grammar-bank-storage` v1 独立创建，无旧数据迁移。纯函数覆盖 key、add、remove、toggle、isSaved 和 reclassify。删除/清空语法不影响词汇、阅读缓存或复习状态。

如果 grammar dictionary 更新：

- store hydration 后按新版本重新校准。
- 数据加载失败时保留已有可靠等级；新收藏可无等级保存。
- 成功后统一更新 classification 快照，不改变收藏顺序。

## 错误处理

- 数据文件、manifest 或哈希不一致视为 grammar dataset error，禁止部分加载。
- 单个 pattern 不匹配不是错误，归入未定级。
- provider 返回缺字段时沿用现有运行时兜底，收藏按钮只对合法 pattern 启用。
- localStorage 写入失败显示 toast，星标不得先乐观变更为已收藏。
- 数据源更新统计超出审查阈值、出现空列表或大量冲突时脚本失败并保留旧发布文件。

## 测试

生成器测试：

- 合法 HTML、缺失列表、页面结构变化、重复、跨等级冲突、许可页变化、payload 哈希和原子发布。
- 固定 fixture 证明不抓取解释、例句或商业内容。

字典与校准测试：

- NFKC、波浪符、空白、完整 pattern、alias、冲突和禁止 substring。
- provider parity、旧缓存重校准、数据失败降级和不可持久化临时等级。
- N5–N1 四组边界及输入不可变。

收藏测试：

- pattern 去重、添加/删除/toggle、语言保留、原句保留、重新校准零丢失。
- grammar store 与 word/SRS store 相互隔离。

浏览器验收：

- 三个分析入口显示一致等级和收藏状态。
- 默认 N4 的四组语法展示正确，基础默认折叠。
- 收藏在页面与 drawer 同步，刷新后保留。
- 数据失败时未定级但仍可收藏。
- `/sources` 显示 Tanos attribution、哈希和非官方免责声明。

## 数据准入门槛

实施 M5 前必须同时满足：

1. Tanos 许可页面快照可审查，产品接受“CC BY，版本未注明”的归档措辞。
2. 五级 grammar list 可以由结构化 parser 稳定提取。
3. fixture 抽样确认 pattern 与等级，不复制商业内容。
4. 生成统计和冲突清单通过人工审查。

若任一门槛失败，M5 降级为“语法收藏”交付，不展示或持久化 JLPT 语法等级；不得用 AI 自报等级替代。

## 2026-07-12 Source Gate Record

- 许可页 `https://www.tanos.co.uk/jlpt/sharing/` 于 `2026-07-12T03:10:27Z` 返回 HTTP 200；完整响应 SHA-256 为 `ec041fa5ed97b59dd4d7d9749d4f3828049422a8da0404700ac12f64f32a8a56`。页面写明非售卖内容以 Creative Commons "BY" 许可并要求署名，版本未注明。
- N1–N5 的 HTML list 页面仍返回 HTTP 500；同一语法入口链接的 `GrammarList.N1.doc` 至 `GrammarList.N5.doc` 均返回 HTTP 200，并只包含模式与等级。脚本以文档二进制 SHA-256 固定其版本。
- 生成器使用同源文档生成 284 个唯一构式，包含 4 个别名展开和 5 个跨级冲突（统一选择较易等级）。数据、manifest 与许可快照均已提交并在运行时校验。
- HTML 端点的故障不再阻塞本设计；更新时仍需验证许可页措辞、五份文档非空和生成统计。

## 完成定义

- 语法等级只来自固定静态字典，来源、许可、哈希和版本可追踪。
- 所有分析入口使用同一校准逻辑，旧缓存无需重新调用 AI。
- 未命中稳定为未定级，数据失败时分析与收藏继续工作。
- 语法收藏可添加、查看、删除、清空和持久化，且与词汇/SRS 隔离。
- 单元测试、provider parity、lint、生产构建和桌面/移动浏览器验收全部通过。

## 降级交付记录

降级语法收藏已作为本次完整等级交付的基础保留：Anki、复习和 SRS 仍只属于词汇；语法收藏独立持久化并可随着字典版本重新校准。
