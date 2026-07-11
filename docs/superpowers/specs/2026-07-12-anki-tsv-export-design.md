# M3 Anki TSV Export Design

日期: 2026-07-12
状态: 已确认，待实施

## 目标

从现有生词本一次性导出全部词汇为 Anki 可导入的 UTF-8 TSV 文件。首版只交付文本导出，不支持筛选、字段配置、牌组/笔记类型指定、媒体或 `.apkg`。

## 已确认决策

- 导出范围是生词本全部词汇，不增加选择状态。
- 文件格式固定为 UTF-8 TSV，文件名为 `manga-learnjp-words-YYYY-MM-DD.tsv`。
- 字段固定为 Word、Reading、Meaning、PartOfSpeech、JLPT、SourceSentence、SavedAt、Tags。
- 每行标签包含 `manga_learnjp` 和 `jlpt::N1` 至 `jlpt::N5`；未定级使用 `jlpt::unclassified`。
- 导出不修改生词本、localStorage 或服务端数据。

## 文件格式

文件顶部使用 Anki 2.1.54+ 支持的文本导入声明：

```text
#separator:Tab
#html:false
#tags column:8
#columns:Word\tReading\tMeaning\tPartOfSpeech\tJLPT\tSourceSentence\tSavedAt\tTags
```

正文每个 `SavedWord` 一行。第一列使用词语，便于 Anki 以第一字段执行重复检测。字段中的制表符、回车和换行压缩为单个空格；其他 Unicode 内容原样保留。文件以换行结尾，空生词数组只生成声明，不由 UI 触发下载。

依据: https://docs.ankiweb.net/importing/text-files.html

## 架构

新增 `src/lib/anki-export.ts`：

- `sanitizeAnkiField(value)` 规范化字段。
- `getAnkiTags(word)` 生成稳定标签。
- `serializeWordsForAnki(words)` 生成完整 TSV。
- `createAnkiExportFilename(date)` 生成稳定文件名。
- `downloadTextFile(content, filename, environment?)` 隔离 Blob、对象 URL 和临时链接生命周期；可注入最小环境以便 Node 单测。

`WordBank` 继续只订阅 `words` 和现有操作。导出按钮在点击时读取当前数组、生成 TSV 并下载，不新增 React state，符合事件驱动数据读取模式。

## UI

生词本标题栏在“清空全部”之前增加带 `Download` 图标的“导出 Anki”按钮：

- hydration 完成且有生词时可用。
- 空生词本时禁用，不增加额外卡片。
- 成功显示“已导出 N 个生词”。
- 浏览器 API 抛错时显示“导出失败，请重试”，不修改任何词条。
- 桌面和移动端都保持固定高度，并允许标题栏换行，避免窄屏溢出。

## 测试与验收

- 单元测试覆盖声明、列顺序、标签、未定级、Unicode、空白规范化、稳定输出、输入不可变和日期文件名。
- 下载测试覆盖 MIME、download 文件名、点击、节点清理和 URL 释放。
- 浏览器验证空生词状态、有词下载、成功提示、真实下载内容及移动端布局。
- 完整运行 `npm test`、`npm run lint`、`npm run build` 和 `git diff --check`。
