# Mokuro 音色与阅读连续性设计

日期: 2026-07-11
状态: 已确认，待实施
关联: `docs/superpowers/2026-07-10-word-bank-design.md`

## 背景

Mokuro Reader 当前有三处会中断学习流：

1. Edge 公开给 Web Speech API 的日语音色中，部分会在实际合成时失败或永不开始朗读，但仍出现在下拉列表。
2. 点击 Header 的「生词本」会跳转到 `/words`，卸载 Reader，导致已导入的目录、当前页和选中的文本块全部丢失。
3. Reader 导入 Mokuro 目录时总是将页码重置为首页；用户重新打开同一目录后不能回到上次阅读位置。

这些问题分别源于浏览器语音注册信息、Next.js 路由卸载和 Reader 状态未持久化。它们不需要改变 OCR、AI 分析、词汇本数据或服务端 API。

## 目标

1. 音色选择器只保留当前浏览器会话中已成功完成实际合成启动验证的日语音色；失败音色自动从可选项中移除，并回退到已验证音色。
2. 从 Mokuro Reader 打开生词本时保留 Reader 的内存状态，关闭生词本立即回到原页和原选块。
3. 重新导入同一 Mokuro 目录时恢复上次页码和仍然有效的选中块。
4. 不可用浏览器能力必须可预期地降级，且不让一次用户取消朗读误判为音色故障。

## 非目标

- 不保证 Edge 或操作系统已经注册但被网络、企业策略、语言包或服务端撤销的音色一定能合成。Web 应用无法绕过这些平台限制。
- 不在刷新后自动重新打开本地目录。`<input type="file" webkitdirectory>` 不能由网页恢复文件权限；用户仍需手动选择目录。
- 不把阅读进度上传到服务器、引入账号同步、IndexedDB 目录句柄或跨设备同步。
- 不改变独立 `/words` 路由；它仍是可直接访问的完整生词本页面。

## 方案比较

### A. 仅按 `localService` 过滤音色

实现成本低，但 `localService` 只表示音色是本地还是远程，不代表一次 `speechSynthesis.speak()` 会成功。它会错误隐藏可工作的在线 Edge 音色，也会保留可能失败的本地条目，不能满足「列表里的都能用」。

### B. 实际合成验证并维护会话可用列表（选定）

对每个候选日语音色发起短的静音验证 utterance，只有收到 `onstart` 才加入可选列表。错误、超时、`voice-unavailable`、`synthesis-unavailable` 等失败会将该 voice URI 在当前会话列为不可用。首次启用/刷新音色列表必须由用户手势触发，避免浏览器自动播放限制。成本是首次校验会有等待时间，但用户看到的每个条目都有本次浏览器实际合成成功的证据。

### C. 后端 TTS 代理

可统一音色和可用性，但增加密钥、流量、延迟、版权与部署成本，也不再是浏览器 Edge 音色。与当前本地朗读设计不匹配。

选择 B。

## 语音验证与朗读

`useSpeech` 负责语音能力、验证状态和实际朗读结果，而不是在调用 `speechSynthesis.speak()` 后立即返回成功。

### 状态与契约

- 候选音色: `speechSynthesis.getVoices()` 返回且语言以 `ja` 开头的条目。
- 已验证音色: 当前页面会话内用该 voice URI 的静音短 utterance 收到 `onstart` 的候选。选择器只渲染这些条目。
- 不可用音色: 验证或正常朗读收到非 `canceled` / `interrupted` 错误，或在有限等待时间内没有 `onstart`。该 URI 不再进入本会话的验证队列。
- 验证完成前，音色选择器处于禁用/加载状态；无可用音色时显示不可用状态并禁用朗读控制。
- 验证由显式的刷新/验证控制触发。初次默认音色也须先验证，不能直接把浏览器列出的第一个声音当作可用。

验证 utterance 使用极短日文文本与 `volume = 0`，验证目标是合成引擎启动而非让用户听到每个音色。每次只验证一个音色，前一个在启动后取消，再继续下一个，避免并发队列互相取消。验证设置固定启动超时；超时只影响当前会话，不写入 localStorage。

### 正常朗读

正常朗读返回一个异步结果，只在 `onstart` 后报告成功。若已验证音色在正式朗读时失败，hook 将其移出可用列表，取消当前 utterance，并选择下一个已验证日语音色。用户选择的持久化 voice URI 仅在仍通过验证时使用；否则改存回退 URI 或清除选择。用户快速切换块所触发的 `canceled` / `interrupted` 不黑名单音色。

这能保证「选择器中展示」的音色本会话实际被验证可启动；也诚实处理在线 Edge 音色在网络/策略变化后才失效的情况。

## 生词本的阅读内抽屉

将当前 `/words` 页主体提取为可复用 `WordBank` 内容组件。`/words` 继续以该组件作为独立页面呈现，保留其直接访问、删除、清空和空状态行为。

Home 中存在 Mokuro Reader 时，Header 的生词本入口改为打开一个客户端抽屉/对话层，而不是导航到 `/words`：

- 抽屉使用 `role="dialog"`、`aria-modal="true"`、明确的关闭按钮和 Escape 关闭。
- 关闭只更新 `isWordBankOpen`，不改路由、不卸载 `MokuroReader`，所以已导入的文件、当前页、缓存和选中块均原样保留。
- 非 Reader 上下文或直接进入 `/words` 时，Header/路由仍按现有独立页面语义工作。
- Header 接收可选的 `onOpenWordBank` 回调；提供回调时渲染按钮，无回调时渲染现有 `Link`。

不使用 `router.back()` 或 query 参数：它们会把打开/关闭与浏览器历史耦合，且 `/words` 的路由切换已经卸载 Reader，不能满足保留导入文件这一核心条件。

## Mokuro 阅读进度

新增纯函数模块负责生成稳定键、解析、校验、保存与恢复进度；组件只负责把文件解析结果和 UI 状态交给该模块。

### 本地数据

localStorage key 使用 `manga-learnjp:mokuro-progress:<document-id>`。`document-id` 优先使用 Mokuro 的稳定 `title_uuid` 与 `volume_uuid`；缺失时以目录名、`.mokuro` 文件名和页数形成确定性回退标识。避免仅用文件名导致不同作品的同名文件互相覆盖。

记录结构为：

```ts
interface MokuroReadingProgress {
  schemaVersion: 1
  pageIndex: number
  selectedBlockIndex: number | null
  savedAt: string
}
```

恢复时必须校验 schema、页码范围和 block 索引范围。非法、过期或无效 JSON 一律忽略并从第一页开始；不会阻止目录导入。块恢复时重新从已解析页面构造选中块文本，不信任持久化的文本内容。

### 数据流

1. 用户翻页或选择/清除文本块后，Reader 将当前页码和该页块索引写入 localStorage。
2. 用户重新选择目录，解析 `.mokuro` 文件后立即使用相同 document-id 读取进度。
3. Reader 在一次初始化中设置恢复后的页码及有效选块，然后渲染该页。
4. 新作品、找不到记录或记录不合法时维持现有首页行为。

进度只保存位置，不缓存或恢复图片文件、目录 handle、分析结果或朗读状态。刷新后用户必须重新选择目录，这是浏览器文件权限模型要求；选择相同目录后恢复进度。

## 文件范围

新增:

- `src/lib/mokuro-progress.ts`
- `src/lib/mokuro-progress.test.ts`
- 复用生词本主体的组件文件（从现有 `/words` 页面提取）

修改:

- `src/components/useSpeech.ts`
- `src/components/MokuroReader.tsx`
- `src/components/Header.tsx`
- `src/app/page.tsx`
- `src/app/words/page.tsx`
- 生词本相关样式/组件文件（仅为抽屉复用所需）

不改 `src/lib` 的服务端共享模块，因此无需同步 `netlify/src/lib`。

## 测试与验收

### 单元测试

`mokuro-progress.test.ts` 覆盖：

- 稳定 key 优先使用 UUID，缺失 UUID 时使用确定性回退。
- 记录写入/读取往返。
- 页码及块索引的边界校验和失效 JSON 降级。
- 页面或块已变化时的安全回退。

语音逻辑把可测试的 URI 过滤、失败分类、回退选择与验证状态转移抽为纯函数，并覆盖：

- 只输出已验证且未被标记不可用的日语音色。
- `canceled` / `interrupted` 不会黑名单。
- `voice-unavailable`、`synthesis-unavailable`、启动超时会黑名单并触发回退。

### 手动浏览器验收

1. Edge 中运行音色验证。列表只出现已收到启动事件的日语音色；选中每一项均能朗读测试文本。
2. 人为使一个在线音色失败或选择已失效音色时，界面移除该项并回退到可用音色；连续切块不误移除正常音色。
3. Reader 打开生词本，删除/清空或查看后用关闭按钮和 Escape 返回，原页、选块、已导入目录不变。
4. 进入独立 `/words` 仍可正常查看和管理词汇本。
5. 在 Mokuro 第 N 页选择一个块，关闭或刷新页面后手动重新选择同一目录，恢复到 N 页与该块。
6. 导入另一作品、删除/损坏进度记录、或原块不存在时安全打开首页，不报错。
7. 运行 `npm test`、`npm run lint`、`npm run build` 与 `git diff --check`。
