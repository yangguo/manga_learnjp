import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import manifest from '../../../public/data/jlpt-vocabulary.v1.manifest.json'

export default function SourcesPage() {
  return (
    <main className="min-h-screen bg-gray-950 text-gray-100">
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-gray-300 transition-colors hover:text-white">
          <ArrowLeft className="h-4 w-4" />
          返回首页
        </Link>

        <header className="mt-8 border-b border-white/10 pb-6">
          <h1 className="text-2xl font-semibold text-white">JLPT 数据来源</h1>
          <p className="mt-3 text-sm leading-6 text-amber-200">
            新版 JLPT 不发布官方逐词清单。本应用显示的 JLPT 等级来自固定版本的社区参考数据,可能存在遗漏、冲突或错误。
          </p>
        </header>

        <section className="border-b border-white/10 py-6">
          <h2 className="text-lg font-medium text-white">词表版本</h2>
          <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
            <div><dt className="text-gray-500">数据集</dt><dd>{manifest.source.name}</dd></div>
            <div><dt className="text-gray-500">完整版本</dt><dd className="break-all">{manifest.datasetVersion}</dd></div>
            <div><dt className="text-gray-500">固定提交</dt><dd className="break-all">{manifest.source.commit}</dd></div>
            <div><dt className="text-gray-500">提交日期</dt><dd>{manifest.source.commitDate}</dd></div>
            <div><dt className="text-gray-500">生成时间</dt><dd>{manifest.generatedAt}</dd></div>
          </dl>
        </section>

        <section className="border-b border-white/10 py-6">
          <h2 className="text-lg font-medium text-white">语法参考状态</h2>
          <p className="mt-3 text-sm leading-6 text-amber-200">
            本应用当前只提供语法收藏，不显示 JLPT 语法等级。Tanos 的许可页可审查，但 N1–N5 grammar list 页面在本次数据准入时均返回 HTTP 500，无法生成可追踪的静态等级字典。
          </p>
          <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
            <div><dt className="text-gray-500">参考作者</dt><dd>Jonathan Waller</dd></div>
            <div><dt className="text-gray-500">许可</dt><dd>Creative Commons BY（发布者未注明版本）</dd></div>
            <div><dt className="text-gray-500">许可页抓取时间</dt><dd>2026-07-12T03:10:27Z</dd></div>
            <div><dt className="text-gray-500">许可页 SHA-256</dt><dd className="break-all">ec041fa5ed97b59dd4d7d9749d4f3828049422a8da0404700ac12f64f32a8a56</dd></div>
          </dl>
        </section>

        <section className="border-b border-white/10 py-6">
          <h2 className="text-lg font-medium text-white">数据统计</h2>
          <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <div><dt className="text-gray-500">原始行</dt><dd>{manifest.stats.rows}</dd></div>
            <div><dt className="text-gray-500">唯一词条</dt><dd>{manifest.stats.uniqueEntries}</dd></div>
            <div><dt className="text-gray-500">等级冲突</dt><dd>{manifest.stats.conflictingKeys}</dd></div>
            <div><dt className="text-gray-500">读音修复</dt><dd>{manifest.stats.repairedReadings}</dd></div>
          </dl>
        </section>

        <section className="py-6 text-sm leading-6">
          <h2 className="text-lg font-medium text-white">参考链接</h2>
          <ul className="mt-3 space-y-2 text-sky-300">
            <li><a href={manifest.source.repository} target="_blank" rel="noreferrer" className="hover:text-sky-200">上游社区词表仓库</a></li>
            <li><a href="/licenses/open-anki-jlpt-decks-MIT.txt" className="hover:text-sky-200">MIT 许可证</a></li>
            <li><a href="https://www.tanos.co.uk/jlpt/sharing/" target="_blank" rel="noreferrer" className="hover:text-sky-200">Tanos 数据共享说明</a></li>
            <li><a href="/licenses/tanos-sharing-CC-BY.txt" className="hover:text-sky-200">Tanos 许可页快照</a></li>
            <li><a href="https://www.jlpt.jp/e/guideline/" target="_blank" rel="noreferrer" className="hover:text-sky-200">JLPT 官方指南</a></li>
          </ul>
        </section>
      </div>
    </main>
  )
}
