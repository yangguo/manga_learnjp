# M4 Basic SRS Design

日期: 2026-07-12
状态: 详细设计完成，待实施

## 目标

在现有本地生词本上增加可持续的间隔复习流程。用户每天打开复习页，先完成到期词，再学习有限数量的新词；每次回忆后使用“忘记 / 困难 / 良好 / 简单”四档评分。所有状态保存在本机，不增加账号、服务端或云同步。

## 核心决策

- 调度器采用 `ts-fsrs`，不自行实现 SM-2 或固定间隔表。
- 使用 FSRS 原生四档 `Again / Hard / Good / Easy`。
- 默认目标回忆率为 0.9，首版不开放参数设置或训练个人参数。
- 每个本地自然日最多引入 10 张新词卡；到期卡不设上限。
- 只复习已收藏词汇；语法复习不进入 M4。
- 生词、JLPT 校准和 Anki 导出结构不因 SRS 改变。

依据:

- https://github.com/open-spaced-repetition/ts-fsrs
- https://github.com/open-spaced-repetition/fsrs4anki/wiki/ABC-of-FSRS

`ts-fsrs` 为 MIT 许可，提供 `createEmptyCard()`、`repeat()`、`next()`、四档评分和序列化映射。实现时固定经过测试的具体版本并提交 lockfile。

## 范围外

- 不实现账号、跨设备同步、通知、排行榜或连续学习奖励。
- 不实现 FSRS 参数优化、复习日志导入、撤销历史或统计仪表盘。
- 不允许用户直接编辑 stability、difficulty 或 due。
- 不把复习状态写入 M3 TSV；Anki 与本应用分别管理调度。

## 数据模型

`SavedWord` 保持不变。SRS 状态在 `word-bank-storage` 内用词条稳定 key 独立保存：

```ts
interface SavedReviewCard {
  key: string
  due: string
  stability: number
  difficulty: number
  elapsedDays: number
  scheduledDays: number
  learningSteps: number
  reps: number
  lapses: number
  state: 0 | 1 | 2 | 3
  lastReview: string | null
  introducedAt: string
}

interface ReviewState {
  cards: Record<string, SavedReviewCard>
}
```

`key` 继续使用 `savedWordKey(word, reading)`。日期一律以 ISO 字符串持久化，进入 `ts-fsrs` 前转换为 `Date`，返回后立即转换回 JSON 安全结构。`introducedAt` 只用于每日新卡限额，不参与 FSRS 计算。

删除一个生词时同步删除同 key 的复习卡；清空生词本同时清空复习卡。重新校准 JLPT 等级不得修改复习状态。

## Store 迁移

`word-bank-storage` 从 v2 升级到 v3：

- v1/v2 的 `words` 原样保留。
- 缺少或非法的 `review.cards` 回退为空对象。
- 每张复习卡逐字段校验；非法日期、负数计数、未知 state 或不存在的词条 key 被丢弃。
- migration 不创建新卡；未复习生词仍由 `words` 推导为 New。
- `calibrationStatus` 继续是运行时状态，不持久化为 ready/loading。

迁移必须证明收藏数量、词条顺序、原句、保存时间和 JLPT 快照零丢失。

## 调度适配层

新增 `src/lib/srs.ts`，隔离第三方类型：

- `toFSRSCard(saved)` / `fromFSRSCard(card, key, introducedAt)`。
- `createReviewCard(key, now)`。
- `scheduleReview(saved, rating, now)`。
- `previewReviewIntervals(saved, now)`。
- `isDue(saved, now)`。
- `localDateKey(date)`。
- `buildDailyReviewQueue(words, cards, now, newLimit)`。

应用层只使用自己的 DTO，不把 `ts-fsrs` 类型暴露给 React 组件或 Zustand migration。调度器参数集中为常量，测试时关闭 fuzz 或注入确定时间，避免随机区间导致脆弱断言；生产保留库的推荐 fuzz 行为。

## 每日队列

启动一次复习会话时生成并冻结 key 队列：

1. 选择 `due <= now` 的已存在卡，按 due 升序。
2. 统计本地当天 `introducedAt` 的数量。
3. 从尚无复习卡的生词中按 `savedAt` 降序选择剩余新卡名额，最多补足 10 张。
4. 为被引入的新词创建空 FSRS 卡并写入 `introducedAt`，确保刷新或重新进入页面不会绕过每日上限。
5. 过滤已被用户删除的 key。

评分后卡片从当前队列移除。若 FSRS 将其安排到数分钟后，本次会话不等待；到期后重新进入或刷新复习页即可出现。这样避免倒计时阻塞，同时保持 due 的绝对时间正确。

## 复习界面

新增 `/review` 页面和 Header“复习”入口。入口徽标显示“当前到期卡 + 今日可引入新卡”的数量，hydration 前不显示错误的 0。

页面第一屏就是复习工具：

- 顶部显示今日进度、剩余到期数和新卡数。
- 正面显示日文词形和收藏原句，不显示读音和释义。
- “显示答案”后展示读音、释义、词性和 JLPT badge。
- 底部四个固定尺寸评分按钮显示标签和 `repeat()` 预览的下一间隔。
- 答案显示前评分按钮不可用。
- 空队列显示“今日复习完成”，并提供返回阅读和生词本入口。

支持 Space 显示答案、1–4 评分，但不在页面放大段快捷键说明。移动端评分按钮使用稳定两列布局，桌面使用四列；长释义和原句允许换行，不能改变卡片操作区位置。

## 状态与错误处理

- 页面通过 store action 原子提交评分结果；React 不直接拼装持久状态。
- `ts-fsrs` 抛错时保留当前卡和旧状态，显示错误 toast，不前进队列。
- 系统时间回拨导致 `now < lastReview` 时拒绝评分并提示检查时间，不写入负 elapsed day。
- localStorage 读取失败时显示只读错误状态，不创建虚假复习进度。
- 多标签页通过 `storage` 事件刷新摘要；正在显示的会话不自动换卡，下一次评分前重新确认 key 仍存在。

## 测试

单元测试覆盖：

- DTO 与 FSRS Card 双向转换、日期序列化。
- 四档评分、due 更新、计数和 state 转换。
- 到期优先、排序、10 张新卡上限、本地日期边界和刷新不超额。
- 删除词清理卡、非法迁移丢弃、旧 v1/v2 零丢失。
- 系统时间回拨和调度异常不写状态。

浏览器验收覆盖：

- 旧生词本升级后数量不变。
- 正反面隐藏规则、四档按钮和区间预览。
- 评分后队列前进，刷新后 due 保持。
- 空状态、桌面和 375px 移动布局。
- Header 徽标与 `/review` 队列一致。

## 完成定义

- 所有已收藏词可进入 FSRS 调度，旧收藏零丢失。
- 同一本地日最多引入 10 张新卡，到期卡全部可复习。
- 四档评分持久化后刷新可复现。
- 无账号、无网络请求、无自研调度公式。
- 单元测试、lint、生产构建和浏览器验收全部通过。
