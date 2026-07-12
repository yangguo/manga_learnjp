import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import manifest from '../../../public/data/jlpt-vocabulary.v1.manifest.json'
import grammarManifest from '../../../public/data/jlpt-grammar.v1.manifest.json'

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
          <h2 className="text-lg font-medium text-white">语法参考版本</h2>
          <p className="mt-3 text-sm leading-6 text-amber-200">
            JLPT 官方不发布逐项语法清单。本应用使用 Tanos 的同源公开 N1–N5 grammar list 文档生成固定参考等级；仅导入语法构式与等级，不导入解释、例句、音频或付费内容。
          </p>
          <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
            <div><dt className="text-gray-500">数据集</dt><dd>{grammarManifest.source.name}</dd></div>
            <div><dt className="text-gray-500">完整版本</dt><dd className="break-all">{grammarManifest.datasetVersion}</dd></div>
            <div><dt className="text-gray-500">参考作者</dt><dd>{grammarManifest.source.author}</dd></div>
            <div><dt className="text-gray-500">许可</dt><dd>{grammarManifest.source.license}</dd></div>
            <div><dt className="text-gray-500">生成时间</dt><dd>{grammarManifest.generatedAt}</dd></div>
            <div><dt className="text-gray-500">词典 SHA-256</dt><dd className="break-all">{grammarManifest.checksums.dataSha256}</dd></div>
            <div><dt className="text-gray-500">许可页 SHA-256</dt><dd className="break-all">{grammarManifest.checksums.licenseSha256}</dd></div>
          </dl>
        </section>

        <section className="border-b border-white/10 py-6">
          <h2 className="text-lg font-medium text-white">语法数据统计</h2>
          <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <div><dt className="text-gray-500">原始构式</dt><dd>{grammarManifest.stats.rawPatterns}</dd></div>
            <div><dt className="text-gray-500">唯一构式</dt><dd>{grammarManifest.stats.uniquePatterns}</dd></div>
            <div><dt className="text-gray-500">别名展开</dt><dd>{grammarManifest.stats.aliases}</dd></div>
            <div><dt className="text-gray-500">等级冲突</dt><dd>{grammarManifest.stats.conflictingPatterns}</dd></div>
          </dl>
          <ul className="mt-4 space-y-2 text-sm">
            {Object.entries(grammarManifest.source.documents).map(([level, document]) => (
              <li key={level} className="grid gap-1 sm:grid-cols-[3rem_1fr]">
                <span className="text-gray-500">{level}</span>
                <span className="break-all text-gray-300">
                  <a href={document.url} target="_blank" rel="noreferrer" className="text-sky-300 hover:text-sky-200">源文档</a>
                  <span className="text-gray-500"> / SHA-256: </span>{document.sha256}
                </span>
              </li>
            ))}
          </ul>
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
            <li><a href={grammarManifest.source.licenseUrl} target="_blank" rel="noreferrer" className="hover:text-sky-200">Tanos 许可原链接</a></li>
            <li><a href="https://www.jlpt.jp/e/guideline/" target="_blank" rel="noreferrer" className="hover:text-sky-200">JLPT 官方指南</a></li>
          </ul>
        </section>
      </div>
    </main>
  )
}
