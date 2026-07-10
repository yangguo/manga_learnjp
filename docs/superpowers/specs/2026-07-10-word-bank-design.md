# 个人词汇本(生词库)设计

日期: 2026-07-10
状态: 待实现
关联: `docs/superpowers/2026-07-10-jlpt-prep-assessment.md` 里程碑 1

## 背景

JLPT 备考评估指出:当前 app 看过的词用完即弃、零留存,没有任何个人词汇积累。SRS / Anki 导出 / 级别过滤等后续能力都以「能把词收起来」为前提。本设计是评估里的**里程碑 1**:建立缺失的数据模型与持久化,提供收藏入口与查看/删除界面,为后续里程碑打地基。本里程碑先不依赖级别校准,允许收藏任意 `WordAnalysis` 词。

## 目标

1. 阅读中(Mokuro Reader / 图片分析面板)把不认识的词一键收藏到个人生词本。
2. 在独立的 `/words` 页查看收藏列表。
3. 在 `/words` 页删除收藏。

## 非目标(YAGNI)

- 目标级别设置 / 级别感知过滤(里程碑 2)。
- 字典校准 JLPT 标注(里程碑 2)。
- SRS 间隔复习(里程碑 3)。
- Anki / CSV 导出(里程碑 3)。
- 搜索 / 排序 / 分组 / 标签。
- 用户账号 / 云同步 / 跨设备。
- 语法点的收藏(本里程碑只收词汇)。

## 原句粒度决策

`MokuroAnalysisPanel` 现在把所有句子的词 `flatMap` 成一张扁平表展示,丢失了「每个词属于哪句」的信息。「收藏时连带的原句」有两个取法:

- **A · 块级原句(选定)**:原句 = 传给面板的 `selectedText`(被分析的那段文本块)。Mokuro 里一个块≈一个气泡≈1–2 句,作为原句够好;图片分析阅读模式下面板本就显示单句,`selectedText`≈那句。零侵入:不动 `flatMap` 与 `analysis-filters` 的输入形状。
- B · 词级原句:改 `flatMap` 把父句 `sentence` 带到每个词上,原句精确到词所在句。更精细但要改面板渲染与过滤函数输入形状,侵入大。

**选 A**。契合「词+原句」的范围,成本最低,原句质量对 Mokuro / 阅读模式已足够。只有「整页分析」fallback 路径下 `selectedText`=整页文本偏粗,可接受。

## 数据模型

新增类型(写入 `src/lib/types.ts`):

```ts
export interface SavedWord {
  word: string
  reading: string
  meaning: string
  partOfSpeech: string
  difficulty: string
  sourceSentence: string | null  // 收藏时的 selectedText;无则 null
  savedAt: string                // ISO 时间戳,默认倒序用
}
```

`difficulty` 沿用 `WordAnalysis.difficulty` 的取值集合(`beginner|intermediate|advanced|N5|N4|N3|N2|N1`),但存为 `string`,不在此做校验(与现有「LLM 生成、不校验」现状一致;校准留待里程碑 2)。

**去重 key = `word + reading`**。日语有同形异音词(如 橋/箸),按 `word` 单字段会误并;按 `word+reading` 不丢信息。重复收藏 = 不新增(toggle 语义:已存在则移除,不存在则新增)。

## 存储

新文件 `src/lib/word-bank.ts`:纯函数 + 类型,可单测。导出:

- `savedWordKey(word: string, reading: string): string` - 生成去重 key。用 `JSON.stringify([word, reading])` 形式(如 `["橋","はし"]`),天然带分隔、不会因空字符串或拼接产生歧义,实现简单且可测。
- `addWord(words: SavedWord[], entry: SavedWord): SavedWord[]` — key 不存在则前置插入,存在则保持原数组不变(去重)。
- `removeWord(words: SavedWord[], word: string, reading: string): SavedWord[]` — 按 key 移除。
- `toggleWord(words: SavedWord[], entry: SavedWord): SavedWord[]` — key 存在则移除,不存在则 `addWord`。
- `isSaved(words: SavedWord[], word: string, reading: string): boolean`。
- 辅助:`toSavedWord(w: WordAnalysis, sourceSentence: string | null): SavedWord` — 从 `WordAnalysis` + 原句构造条目,内部用传入或当前时间戳(时间戳由 store 层注入以保持纯函数可测;见下)。

> 时间戳注入:`toSavedWord` 不自取时间戳(纯函数约束),`savedAt` 由 store 的 `addWord`/`toggleWord` 动作在调用 `toSavedWord` 时传入 `new Date().toISOString()`。纯函数层只负责结构转换与数组操作。

新文件 `src/lib/word-bank-store.ts`:zustand + `persist`,localStorage key `word-bank-storage`,`version: 1`,沿用 `src/lib/store.ts` 既有模式。状态:

```ts
interface WordBankState {
  words: SavedWord[]
  addWord: (w: WordAnalysis, sourceSentence: string | null) => void
  removeWord: (word: string, reading: string) => void
  toggleWord: (w: WordAnalysis, sourceSentence: string | null) => void
  isSaved: (word: string, reading: string) => boolean
  clearAll: () => void
}
```

store 动作薄封装:把当前 `words` 与构造好的 `SavedWord`(含时间戳)交给 `word-bank.ts` 纯函数,`set` 新数组。`isSaved` 用 `get().words` 查询。

localStorage 对数千词绰绰有余,不引入 IndexedDB。无 `migrate` 需求(v1 起步)。

## 收藏入口(捕获)

`src/components/MokuroAnalysisPanel.tsx` 词卡(当前 172–191 行的 `<li>`)右上角、难度 badge 旁加一个星标按钮:

- 未收藏 -> 空心星(`Star` 图标,灰);已收藏 -> 实心星(`Star` `fill-current`,琥珀)。
- 点击调用 `useWordBankStore` 的 `toggleWord(word, selectedText)`。
- 已收藏态由 `isSaved(word.word, word.reading)` 决定。

`MokuroAnalysisPanel` 是 Mokuro Reader / `ReadingModeViewer` / `ImagePageAnalysisViewer` 三处共用组件,改一次全覆盖。`selectedText` 已是该组件的 prop,直接用,不需新增 prop。注意:词卡当前用 `index` 作 key,星标按钮点击需正确传入对应 `word` 与 `selectedText`(闭包捕获当前 map 项,无歧义)。

## /words 页(查看 + 删除)

新路由 `src/app/words/page.tsx`(`'use client'`),读 `useWordBankStore`:

- 顶部:标题「生词本」+ 数量。
- 列表:每张卡片显示 `word`(大字日文 `lang="ja"`)、`reading`、`meaning`、`difficulty` badge(复用 `MokuroAnalysisPanel` 的颜色映射,抽到共享处或就地复制一致色表)、`sourceSentence`(若有,小字日文,`lang="ja"` `select-text` 保留 Yomitan 取词)、`savedAt`(相对时间,如「3 天前」)。
- 默认按 `savedAt` 倒序(最新在前)。
- 每卡一个删除按钮(垃圾桶 `Trash2` 图标)-> `removeWord(word, reading)`。
- 空状态:提示文案 + 返回首页(`/`)链接。
- 头部「清空全部」按钮,带 `window.confirm` 确认 -> `clearAll()`。

文案中英双语:本里程碑沿用项目既有 `UI_TEXT` 风格,`/words` 页与面板新增的收藏相关文案都补 `zh`/`en` 两套。

## Header 链接

`src/components/Header.tsx` 右侧组(当前 GitHub 与「Made with heart」之间或之后)加「生词本」链接 -> `/words`,带数量徽标(读 `useWordBankStore(s => s.words.length)`)。Header 已是客户端组件。用 Next.js `Link`。

## 与现有系统的关系

- **分析缓存**:无关。词汇本是独立的客户端持久化,不读写 `mokuro-analysis-cache`。
- **`analysis-filters.ts`**:不改。面板仍先用 `filterLearningVocabulary` 过滤展示,星标按钮加在**过滤后**的词卡上(只对已展示的词可收藏)。
- **后端 / API / `ai-service.ts`**:完全不动。
- **Netlify 镜像**:本里程碑纯客户端(localStorage + 组件),无 `src/lib` 的后端共享逻辑改动,不涉及 `netlify/src/lib`。

## 文件清单

新增:
- `src/lib/word-bank.ts`(纯函数 + 类型转换,可测)
- `src/lib/word-bank.test.ts`
- `src/lib/word-bank-store.ts`(zustand store)
- `src/app/words/page.tsx`

修改:
- `src/lib/types.ts`(加 `SavedWord`)
- `src/components/MokuroAnalysisPanel.tsx`(词卡加星标按钮 + 双语文案)
- `src/components/Header.tsx`(加链接 + 数量徽标 + 双语文案)

## 测试

`src/lib/word-bank.test.ts` 覆盖纯函数:

- `savedWordKey`:同词同读音同 key;同词异读音不同 key。
- `addWord`:新词前置插入;key 已存在则数组不变(去重)。
- `removeWord`:按 key 精确移除;移除不存在的 key 无副作用。
- `toggleWord`:未存在 -> 新增;已存在 -> 移除(双向)。
- `isSaved`:存在/不存在判定。
- `toSavedWord`:正确搬运 `WordAnalysis` 字段 + `sourceSentence`。

组件层以 UI 为主,不新增单测(遵循项目既有惯例:`src/lib` 才有 Vitest)。交付前跑 `npm test`、`npm run lint`、`npm run build`。

### 手动验证

1. Mokuro Reader:分析一个块,在词汇卡点星标 -> 变实心;再点 -> 变空心。
2. 图片分析(阅读模式 + 整页 fallback):星标同样可用。
3. Header 徽标数量随收藏实时变化。
4. `/words` 页:列出已收藏词,含原句与相对时间,按时间倒序。
5. `/words` 页删除单条 -> 列表与 Header 徽标同步减少。
6. `/words` 页「清空全部」带确认,确认后清空。
7. 刷新页面后收藏仍在(localStorage 持久化)。
8. 重复收藏同一词不产生重复条目。
9. 同形异音词(如 橋/箸)各自独立收藏,不误并。
10. `lang="ja"` + `select-text` 在 `/words` 原句与面板词上保留,Yomitan 可取词。

## 共享类型

改动 `src/lib/types.ts`:新增 `SavedWord` 接口。不改既有类型。`SavedWord` 是 UI / store / 纯函数层之间的契约;后端不感知(本里程碑无后端改动)。
