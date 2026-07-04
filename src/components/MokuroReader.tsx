'use client'

import { ChangeEvent, CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertCircle,
  BookOpenCheck,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  FolderOpen,
  Languages,
  Layers,
  Loader2,
  RotateCw,
  Search,
  Trash2,
  X,
  Zap
} from 'lucide-react'
import toast from 'react-hot-toast'
import MokuroAnalysisPanel from '@/components/MokuroAnalysisPanel'
import { analyzeText } from '@/lib/client-api'
import {
  MOKURO_ANALYSIS_CACHE_FILENAME,
  createMokuroAnalysisCacheKey,
  clampPageRange,
  createMokuroImageLookup,
  findMokuroPageImageFile,
  getMokuroBlockText,
  parseMokuroAnalysisCacheContent,
  parseMokuroFileContent,
  planMokuroDirectoryImport,
  serializeMokuroAnalysisCache,
  type MokuroImageCandidate
} from '@/lib/mokuro'
import { useAIProviderStore } from '@/lib/store'
import type { AnalysisLanguage, AnalysisResult, MokuroBlock, MokuroFile, MokuroPage } from '@/lib/types'

interface BrowserFileSystemWritableFileStream {
  write: (data: string) => Promise<void>
  close: () => Promise<void>
}

interface BrowserFileSystemFileHandle {
  kind: 'file'
  name: string
  getFile: () => Promise<File>
  createWritable: () => Promise<BrowserFileSystemWritableFileStream>
}

interface BrowserFileSystemDirectoryHandle {
  kind: 'directory'
  name: string
  values: () => AsyncIterableIterator<BrowserFileSystemHandle>
  getFileHandle: (
    name: string,
    options?: { create?: boolean }
  ) => Promise<BrowserFileSystemFileHandle>
}

type BrowserFileSystemHandle = BrowserFileSystemFileHandle | BrowserFileSystemDirectoryHandle

interface WindowWithDirectoryPicker extends Window {
  showDirectoryPicker?: (options?: { mode?: 'read' | 'readwrite' }) => Promise<BrowserFileSystemDirectoryHandle>
}

interface MokuroImportedFile extends MokuroImageCandidate {
  file: File
  webkitRelativePath?: string
}

interface MokuroImageWithUrl extends MokuroImportedFile {
  url: string
  size: number
  type: string
}

interface SelectedMokuroBlock {
  pageIndex: number
  blockIndex: number
  text: string
}

interface PageBlock {
  block: MokuroBlock
  blockIndex: number
  text: string
}

interface BatchProgress {
  total: number
  completed: number
  skipped: number
  failed: number
  currentPage?: number
  totalPages?: number
}

type CacheStorageMode = 'directory' | 'browser'

const UI_TEXT = {
  zh: {
    title: 'Mokuro Reader',
    subtitle: '选择 Mokuro 输出目录，点击文字框查看语法和词汇解析。',
    chooseDirectory: '选择 Mokuro 目录',
    reset: '重置',
    pages: '页数',
    matchedImages: '匹配图片',
    blocks: '当前文本块',
    provider: '模型',
    cache: '缓存',
    language: '解释语言',
    chinese: '中文',
    english: 'English',
    page: '第',
    of: '页，共',
    previousPage: '上一页',
    nextPage: '下一页',
    analyzePage: '分析本页全部语句',
    analyzingPage: '正在分析本页...',
    ocrBlocks: 'OCR 文本块',
    emptyBlocks: '这一页没有 OCR 文本块。',
    noImageTitle: '没有匹配到页面图片',
    noImageBody: '目录中需要包含 Mokuro 引用的图片文件：',
    loadStartTitle: '选择 Mokuro 输出目录开始',
    loadStartBody: `目录中应包含 .mokuro 文件和页面图片。分析结果会写入 ${MOKURO_ANALYSIS_CACHE_FILENAME}。`,
    noText: '这个文本块没有内容。',
    savedDirectory: '已保存到目录缓存文件',
    savedBrowser: '已保存到浏览器本地缓存',
    loadedDirectory: '目录已加载',
    loadedCache: '已加载历史分析缓存',
    noCache: '暂无缓存',
    unsupportedWrite: '当前浏览器不能直接写回目录，分析结果会保存到浏览器本地缓存。',
    batchComplete: '本页批量分析完成',
    analyzeRange: '批量分析范围',
    analyzingRange: '正在分析范围...',
    cancelBatch: '取消',
    fromPageLabel: '从第',
    toPageLabel: '页到第',
    rangeInvalid: '起始页不能大于结束页',
    rangeComplete: '范围批量分析完成',
    rangeCancelled: '已取消范围批量分析',
    pageOf: '第 {current} / {total} 页'
  },
  en: {
    title: 'Mokuro Reader',
    subtitle: 'Choose a Mokuro output directory, then click a text box for grammar and vocabulary analysis.',
    chooseDirectory: 'Choose Mokuro Folder',
    reset: 'Reset',
    pages: 'Pages',
    matchedImages: 'Matched Images',
    blocks: 'Current Blocks',
    provider: 'Provider',
    cache: 'Cache',
    language: 'Explanation Language',
    chinese: '中文',
    english: 'English',
    page: 'Page',
    of: 'of',
    previousPage: 'Previous page',
    nextPage: 'Next page',
    analyzePage: 'Analyze All Text On Page',
    analyzingPage: 'Analyzing page...',
    ocrBlocks: 'OCR Blocks',
    emptyBlocks: 'This page has no OCR blocks.',
    noImageTitle: 'No matching page image',
    noImageBody: 'The folder needs to include the image referenced by Mokuro:',
    loadStartTitle: 'Choose a Mokuro output folder to start',
    loadStartBody: `The folder should include the .mokuro file and page images. Results are saved to ${MOKURO_ANALYSIS_CACHE_FILENAME}.`,
    noText: 'This text block has no text.',
    savedDirectory: 'Saved to the folder cache file',
    savedBrowser: 'Saved to browser local cache',
    loadedDirectory: 'Directory loaded',
    loadedCache: 'Loaded saved analysis cache',
    noCache: 'No saved cache yet',
    unsupportedWrite: 'This browser cannot write back to the selected folder, so results are saved to browser local cache.',
    batchComplete: 'Page batch analysis complete',
    analyzeRange: 'Analyze range',
    analyzingRange: 'Analyzing range...',
    cancelBatch: 'Cancel',
    fromPageLabel: 'From page',
    toPageLabel: 'to page',
    rangeInvalid: 'Start page must not exceed end page',
    rangeComplete: 'Range batch analysis complete',
    rangeCancelled: 'Range batch analysis cancelled',
    pageOf: 'Page {current} / {total}'
  }
} satisfies Record<AnalysisLanguage, Record<string, string>>

const isImageFile = (file: File): boolean => {
  return file.type.startsWith('image/') || /\.(png|jpe?g|webp|bmp)$/i.test(file.name)
}

const getBlockStyle = (block: MokuroBlock, page: MokuroPage): CSSProperties => {
  const [left, top, right, bottom] = block.box
  const width = Math.max(0, right - left)
  const height = Math.max(0, bottom - top)

  return {
    left: `${(left / page.img_width) * 100}%`,
    top: `${(top / page.img_height) * 100}%`,
    width: `${(width / page.img_width) * 100}%`,
    height: `${(height / page.img_height) * 100}%`
  }
}

const getBrowserCacheKey = (mokuroName: string | null): string => {
  return `manga-learnjp:mokuro-analysis:${mokuroName ?? 'unknown'}`
}

const createImportedFile = (file: File, relativePath?: string): MokuroImportedFile => {
  const fileWithRelativePath = file as File & { webkitRelativePath?: string }

  return {
    file,
    name: file.name,
    webkitRelativePath: relativePath || fileWithRelativePath.webkitRelativePath || file.name
  }
}

const createImageWithUrl = (importedFile: MokuroImportedFile): MokuroImageWithUrl => {
  return {
    ...importedFile,
    url: URL.createObjectURL(importedFile.file),
    size: importedFile.file.size,
    type: importedFile.file.type
  }
}

const collectDirectoryFiles = async (
  directoryHandle: BrowserFileSystemDirectoryHandle,
  prefix = ''
): Promise<MokuroImportedFile[]> => {
  const files: MokuroImportedFile[] = []

  for await (const entry of directoryHandle.values()) {
    const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name

    if (entry.kind === 'file') {
      const file = await entry.getFile()
      files.push(createImportedFile(file, relativePath))
    } else {
      files.push(...await collectDirectoryFiles(entry, relativePath))
    }
  }

  return files
}

export default function MokuroReader() {
  const [mokuroFile, setMokuroFile] = useState<MokuroFile | null>(null)
  const [mokuroName, setMokuroName] = useState<string | null>(null)
  const [directoryName, setDirectoryName] = useState<string | null>(null)
  const [imageFiles, setImageFiles] = useState<MokuroImageWithUrl[]>([])
  const [currentPageIndex, setCurrentPageIndex] = useState(0)
  const [selectedBlock, setSelectedBlock] = useState<SelectedMokuroBlock | null>(null)
  const [analysisCache, setAnalysisCache] = useState<Record<string, AnalysisResult>>({})
  const analysisCacheRef = useRef<Record<string, AnalysisResult>>({})
  const [activeAnalysis, setActiveAnalysis] = useState<AnalysisResult | null>(null)
  const [analysisLanguage, setAnalysisLanguage] = useState<AnalysisLanguage>('zh')
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isBatchAnalyzing, setIsBatchAnalyzing] = useState(false)
  const [batchProgress, setBatchProgress] = useState<BatchProgress | null>(null)
  const [batchRangeFrom, setBatchRangeFrom] = useState('1')
  const [batchRangeTo, setBatchRangeTo] = useState('1')
  const [cacheStorageMode, setCacheStorageMode] = useState<CacheStorageMode>('browser')
  const [cacheStatus, setCacheStatus] = useState<string>(UI_TEXT.zh.noCache)
  const [error, setError] = useState<string | null>(null)
  const directoryInputRef = useRef<HTMLInputElement | null>(null)
  const directoryHandleRef = useRef<BrowserFileSystemDirectoryHandle | null>(null)
  const cancelBatchRef = useRef(false)
  const { selectedProvider } = useAIProviderStore()

  const t = UI_TEXT[analysisLanguage]

  useEffect(() => {
    return () => {
      imageFiles.forEach(image => URL.revokeObjectURL(image.url))
    }
  }, [imageFiles])

  const imageLookup = useMemo(() => createMokuroImageLookup(imageFiles), [imageFiles])

  // Keep a ref in sync with analysisCache so async handlers can read the latest
  // cache without capturing a stale closure, and update it immediately when they
  // compute a new cache so concurrent analyses don't overwrite each other.
  useEffect(() => {
    analysisCacheRef.current = analysisCache
  }, [analysisCache])
  const currentPage = mokuroFile?.pages[currentPageIndex] ?? null
  const currentImage = currentPage ? findMokuroPageImageFile(currentPage, imageLookup) : null
  const pageCount = mokuroFile?.pages.length ?? 0
  const matchedPageCount = useMemo(() => {
    if (!mokuroFile) return 0
    return mokuroFile.pages.filter(page => findMokuroPageImageFile(page, imageLookup)).length
  }, [imageLookup, mokuroFile])
  const currentBlocks = useMemo<PageBlock[]>(() => {
    if (!currentPage) return []
    return currentPage.blocks.map((block, blockIndex) => ({
      block,
      blockIndex,
      text: getMokuroBlockText(block)
    }))
  }, [currentPage])

  const getCacheKey = useCallback((selection: SelectedMokuroBlock) => {
    return createMokuroAnalysisCacheKey({
      provider: selectedProvider,
      language: analysisLanguage,
      pageIndex: selection.pageIndex,
      blockIndex: selection.blockIndex
    })
  }, [analysisLanguage, selectedProvider])

  const persistAnalysisCache = useCallback(async (
    nextCache: Record<string, AnalysisResult>,
    sourceMokuroFile = mokuroFile,
    sourceMokuroName = mokuroName
  ) => {
    const content = serializeMokuroAnalysisCache(nextCache, {
      title: sourceMokuroFile?.title ?? sourceMokuroName ?? undefined,
      pageCount: sourceMokuroFile?.pages.length
    })

    try {
      if (directoryHandleRef.current) {
        const cacheHandle = await directoryHandleRef.current.getFileHandle(MOKURO_ANALYSIS_CACHE_FILENAME, { create: true })
        const writable = await cacheHandle.createWritable()
        await writable.write(content)
        await writable.close()
        setCacheStatus(UI_TEXT[analysisLanguage].savedDirectory)
        return
      }

      window.localStorage.setItem(getBrowserCacheKey(sourceMokuroName), content)
      setCacheStatus(UI_TEXT[analysisLanguage].savedBrowser)
    } catch (saveError) {
      console.error('Failed to persist Mokuro analysis cache:', saveError)
      window.localStorage.setItem(getBrowserCacheKey(sourceMokuroName), content)
      setCacheStatus(UI_TEXT[analysisLanguage].savedBrowser)
    }
  }, [analysisLanguage, mokuroFile, mokuroName])

  useEffect(() => {
    if (!selectedBlock) {
      setActiveAnalysis(null)
      return
    }

    setActiveAnalysis(analysisCache[getCacheKey(selectedBlock)] ?? null)
  }, [analysisCache, getCacheKey, selectedBlock])

  const importDirectoryFiles = async (
    files: MokuroImportedFile[],
    selectedDirectoryName: string,
    storageMode: CacheStorageMode
  ) => {
    const plan = planMokuroDirectoryImport(files)
    const parsedMokuro = parseMokuroFileContent(await plan.mokuroFile.file.text())
    const loadedImages = plan.imageFiles
      .filter(importedFile => isImageFile(importedFile.file))
      .map(createImageWithUrl)
    let loadedCache: Record<string, AnalysisResult> = {}

    if (plan.cacheFile) {
      try {
        loadedCache = parseMokuroAnalysisCacheContent(await plan.cacheFile.file.text()).analyses
      } catch (cacheError) {
        console.warn('Failed to parse Mokuro analysis cache:', cacheError)
      }
    } else if (storageMode === 'browser') {
      const browserCache = window.localStorage.getItem(getBrowserCacheKey(plan.mokuroFile.name))
      if (browserCache) {
        try {
          loadedCache = parseMokuroAnalysisCacheContent(browserCache).analyses
        } catch (cacheError) {
          console.warn('Failed to parse browser Mokuro analysis cache:', cacheError)
        }
      }
    }

    setMokuroFile(parsedMokuro)
    setMokuroName(plan.mokuroFile.name)
    setDirectoryName(selectedDirectoryName)
    setImageFiles(loadedImages)
    setCurrentPageIndex(0)
    setSelectedBlock(null)
    analysisCacheRef.current = loadedCache
    setAnalysisCache(loadedCache)
    setActiveAnalysis(null)
    setBatchProgress(null)
    setBatchRangeFrom('1')
    setBatchRangeTo(String(parsedMokuro.pages.length))
    setCacheStorageMode(storageMode)
    setCacheStatus(Object.keys(loadedCache).length > 0 ? UI_TEXT[analysisLanguage].loadedCache : UI_TEXT[analysisLanguage].noCache)
    setError(null)
    toast.success(`${UI_TEXT[analysisLanguage].loadedDirectory}: ${parsedMokuro.pages.length} pages`)
  }

  const handleChooseDirectory = async () => {
    const pickerWindow = window as WindowWithDirectoryPicker

    if (!pickerWindow.showDirectoryPicker) {
      directoryHandleRef.current = null
      setCacheStorageMode('browser')
      toast(UI_TEXT[analysisLanguage].unsupportedWrite)
      directoryInputRef.current?.click()
      return
    }

    try {
      const directoryHandle = await pickerWindow.showDirectoryPicker({ mode: 'readwrite' })
      directoryHandleRef.current = directoryHandle
      const files = await collectDirectoryFiles(directoryHandle)
      await importDirectoryFiles(files, directoryHandle.name, 'directory')
    } catch (directoryError) {
      if (directoryError instanceof DOMException && directoryError.name === 'AbortError') {
        return
      }

      const message = directoryError instanceof Error ? directoryError.message : 'Failed to load Mokuro directory'
      setError(message)
      toast.error(message)
    }
  }

  const handleFallbackDirectoryChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []).map(file => createImportedFile(file))
    event.target.value = ''

    if (files.length === 0) return

    try {
      directoryHandleRef.current = null
      setCacheStorageMode('browser')
      await importDirectoryFiles(files, files[0].webkitRelativePath?.split('/')[0] ?? 'Mokuro folder', 'browser')
      toast(UI_TEXT[analysisLanguage].unsupportedWrite)
    } catch (directoryError) {
      const message = directoryError instanceof Error ? directoryError.message : 'Failed to load Mokuro directory'
      setError(message)
      toast.error(message)
    }
  }

  const goToPage = (pageIndex: number) => {
    if (!mokuroFile) return
    const nextPage = Math.min(Math.max(pageIndex, 0), mokuroFile.pages.length - 1)
    setCurrentPageIndex(nextPage)
    setSelectedBlock(null)
    setBatchProgress(null)
    setError(null)
  }

  const analyzeSelection = async (selection: SelectedMokuroBlock, force = false) => {
    const cacheKey = getCacheKey(selection)
    const cached = analysisCache[cacheKey]

    setSelectedBlock(selection)
    setError(null)

    if (cached && !force) {
      setActiveAnalysis(cached)
      return
    }

    setIsAnalyzing(true)
    setActiveAnalysis(null)

    try {
      const result = await analyzeText(selection.text, {
        provider: selectedProvider,
        language: analysisLanguage
      })
      const nextCache = {
        ...analysisCacheRef.current,
        [cacheKey]: result
      }
      analysisCacheRef.current = nextCache
      setAnalysisCache(nextCache)
      setActiveAnalysis(result)
      await persistAnalysisCache(nextCache)
      toast.success(analysisLanguage === 'zh' ? '已完成分析' : 'Analysis complete')
    } catch (analysisError) {
      const message = analysisError instanceof Error ? analysisError.message : 'Failed to analyze selected text'
      setError(message)
      toast.error(message)
    } finally {
      setIsAnalyzing(false)
    }
  }

  const analyzeCurrentPage = async () => {
    if (!currentPage || currentBlocks.length === 0 || isBatchAnalyzing) return

    const blocksToAnalyze = currentBlocks.filter(block => block.text.length > 0)
    let completed = 0
    let skipped = 0
    let failed = 0

    setIsBatchAnalyzing(true)
    setBatchProgress({ total: blocksToAnalyze.length, completed, skipped, failed })
    setError(null)

    for (const block of blocksToAnalyze) {
      const selection = {
        pageIndex: currentPageIndex,
        blockIndex: block.blockIndex,
        text: block.text
      }
      const cacheKey = getCacheKey(selection)

      if (analysisCacheRef.current[cacheKey]) {
        skipped += 1
        setBatchProgress({ total: blocksToAnalyze.length, completed, skipped, failed })
        continue
      }

      try {
        const result = await analyzeText(block.text, {
          provider: selectedProvider,
          language: analysisLanguage
        })
        const nextCache = {
          ...analysisCacheRef.current,
          [cacheKey]: result
        }
        analysisCacheRef.current = nextCache
        setAnalysisCache(nextCache)
        completed += 1
        await persistAnalysisCache(nextCache)
      } catch (batchError) {
        failed += 1
        console.error('Failed to analyze Mokuro page block:', batchError)
      }

      setBatchProgress({ total: blocksToAnalyze.length, completed, skipped, failed })
    }

    setIsBatchAnalyzing(false)
    toast.success(UI_TEXT[analysisLanguage].batchComplete)
  }

  const analyzePageRange = async () => {
    if (!mokuroFile || isBatchAnalyzing) return

    const range = clampPageRange(
      Number(batchRangeFrom),
      Number(batchRangeTo),
      mokuroFile.pages.length
    )
    if (!range) return

    const t = UI_TEXT[analysisLanguage]
    cancelBatchRef.current = false
    setIsBatchAnalyzing(true)
    setBatchProgress({
      total: 0,
      completed: 0,
      skipped: 0,
      failed: 0,
      currentPage: range.from,
      totalPages: range.to - range.from + 1
    })
    setError(null)

    for (let pageIdx = range.from - 1; pageIdx <= range.to - 1; pageIdx += 1) {
      if (cancelBatchRef.current) break

      const page = mokuroFile.pages[pageIdx]
      const blocks = (page?.blocks ?? [])
        .map((block, blockIndex) => ({ block, blockIndex, text: getMokuroBlockText(block) }))
        .filter(block => block.text.length > 0)

      setBatchProgress(prev => ({
        ...(prev ?? { completed: 0, skipped: 0, failed: 0, total: blocks.length }),
        total: blocks.length,
        completed: 0,
        skipped: 0,
        failed: 0,
        currentPage: pageIdx + 1
      }))

      for (const block of blocks) {
        if (cancelBatchRef.current) break

        const cacheKey = getCacheKey({
          pageIndex: pageIdx,
          blockIndex: block.blockIndex,
          text: block.text
        })

        if (analysisCacheRef.current[cacheKey]) {
          setBatchProgress(prev => ({
            ...(prev ?? { total: blocks.length, completed: 0, skipped: 0, failed: 0 }),
            skipped: (prev?.skipped ?? 0) + 1
          }))
          continue
        }

        try {
          const result = await analyzeText(block.text, {
            provider: selectedProvider,
            language: analysisLanguage
          })
          const nextCache = {
            ...analysisCacheRef.current,
            [cacheKey]: result
          }
          analysisCacheRef.current = nextCache
          setAnalysisCache(nextCache)
          setBatchProgress(prev => ({
            ...(prev ?? { total: blocks.length, completed: 0, skipped: 0, failed: 0 }),
            completed: (prev?.completed ?? 0) + 1
          }))
          await persistAnalysisCache(nextCache)
        } catch (batchError) {
          setBatchProgress(prev => ({
            ...(prev ?? { total: blocks.length, completed: 0, skipped: 0, failed: 0 }),
            failed: (prev?.failed ?? 0) + 1
          }))
          console.error('Failed to analyze Mokuro page block:', batchError)
        }
      }
    }

    const cancelled = cancelBatchRef.current
    setIsBatchAnalyzing(false)
    setBatchProgress(null)
    if (cancelled) {
      toast.error(t.rangeCancelled)
    } else {
      toast.success(t.rangeComplete)
    }
  }

  const cancelBatch = () => {
    cancelBatchRef.current = true
  }

  const handleBlockSelect = (blockIndex: number, text: string) => {
    if (!text) {
      toast.error(UI_TEXT[analysisLanguage].noText)
      return
    }

    void analyzeSelection({
      pageIndex: currentPageIndex,
      blockIndex,
      text
    })
  }

  const resetReader = () => {
    directoryHandleRef.current = null
    setMokuroFile(null)
    setMokuroName(null)
    setDirectoryName(null)
    setImageFiles([])
    setCurrentPageIndex(0)
    setSelectedBlock(null)
    analysisCacheRef.current = {}
    setAnalysisCache({})
    setActiveAnalysis(null)
    setBatchProgress(null)
    setBatchRangeFrom('1')
    setBatchRangeTo('1')
    setCacheStatus(UI_TEXT[analysisLanguage].noCache)
    setError(null)
  }

  const analyzedCountForCurrentPage = currentBlocks.filter(block => analysisCache[getCacheKey({
    pageIndex: currentPageIndex,
    blockIndex: block.blockIndex,
    text: block.text
  })]).length

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6">
      <div className="rounded-2xl border border-gray-700 bg-white/5 backdrop-blur-xl p-4 md:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 p-2 text-white">
                <BookOpenCheck size={20} />
              </div>
              <div className="min-w-0">
                <h2 className="text-xl font-semibold text-white">{t.title}</h2>
                <p className="text-sm text-gray-400">{t.subtitle}</p>
                {directoryName && (
                  <p className="mt-1 truncate text-xs text-gray-500" title={directoryName}>
                    {directoryName}
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              onClick={handleChooseDirectory}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-amber-500/20 px-3 py-2 text-sm font-medium text-amber-100 transition-colors hover:bg-amber-500/30"
            >
              <FolderOpen size={16} />
              {t.chooseDirectory}
            </button>
            <button
              onClick={resetReader}
              disabled={!mokuroFile && imageFiles.length === 0}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-gray-200 transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Trash2 size={16} />
              {t.reset}
            </button>
          </div>
        </div>

        <input
          ref={directoryInputRef}
          id="mokuro-directory-input"
          type="file"
          multiple
          aria-hidden="true"
          tabIndex={-1}
          className="hidden"
          onChange={handleFallbackDirectoryChange}
          {...{ webkitdirectory: '', directory: '' }}
        />

        <div className="mt-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-gray-950/40 p-1">
            <Languages size={16} className="ml-2 text-cyan-300" />
            <span className="px-1 text-xs text-gray-400">{t.language}</span>
            {(['zh', 'en'] as AnalysisLanguage[]).map(language => (
              <button
                key={language}
                type="button"
                onClick={() => setAnalysisLanguage(language)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  analysisLanguage === language
                    ? 'bg-white text-gray-950'
                    : 'text-gray-300 hover:bg-white/10'
                }`}
              >
                {language === 'zh' ? t.chinese : t.english}
              </button>
            ))}
          </div>

          {mokuroFile && (
            <button
              type="button"
              onClick={() => void analyzeCurrentPage()}
              disabled={isBatchAnalyzing || currentBlocks.length === 0}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-purple-500/20 px-3 py-2 text-sm font-medium text-purple-100 transition-colors hover:bg-purple-500/30 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isBatchAnalyzing ? <Loader2 size={16} className="animate-spin" /> : <Zap size={16} />}
              {isBatchAnalyzing ? t.analyzingPage : t.analyzePage}
            </button>
          )}

          {mokuroFile && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-gray-400">{t.fromPageLabel}</span>
              <input
                type="number"
                min={1}
                max={mokuroFile.pages.length}
                value={batchRangeFrom}
                onChange={event => setBatchRangeFrom(event.target.value)}
                disabled={isBatchAnalyzing}
                className="h-9 w-20 rounded-lg border border-white/10 bg-gray-950 px-2 text-center text-sm text-white disabled:opacity-50"
              />
              <span className="text-xs text-gray-400">{t.toPageLabel}</span>
              <input
                type="number"
                min={1}
                max={mokuroFile.pages.length}
                value={batchRangeTo}
                onChange={event => setBatchRangeTo(event.target.value)}
                disabled={isBatchAnalyzing}
                className="h-9 w-20 rounded-lg border border-white/10 bg-gray-950 px-2 text-center text-sm text-white disabled:opacity-50"
              />
              <button
                type="button"
                onClick={() => void analyzePageRange()}
                disabled={isBatchAnalyzing || Number(batchRangeFrom) > Number(batchRangeTo)}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-purple-500/20 px-3 py-2 text-sm font-medium text-purple-100 transition-colors hover:bg-purple-500/30 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isBatchAnalyzing ? <Loader2 size={16} className="animate-spin" /> : <Layers size={16} />}
                {isBatchAnalyzing ? t.analyzingRange : t.analyzeRange}
              </button>
              {isBatchAnalyzing && (
                <button
                  type="button"
                  onClick={cancelBatch}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm font-medium text-red-200 transition-colors hover:bg-red-500/20"
                >
                  <X size={16} />
                  {t.cancelBatch}
                </button>
              )}
              {Number(batchRangeFrom) > Number(batchRangeTo) && !isBatchAnalyzing && (
                <span className="text-xs text-red-300">{t.rangeInvalid}</span>
              )}
            </div>
          )}
        </div>

        {mokuroFile && (
          <div className="mt-4 grid gap-3 text-sm md:grid-cols-5">
            <div className="rounded-lg border border-white/10 bg-white/5 p-3">
              <p className="text-xs uppercase tracking-wide text-gray-500">{t.pages}</p>
              <p className="mt-1 font-semibold text-white">{mokuroFile.pages.length}</p>
            </div>
            <div className="rounded-lg border border-white/10 bg-white/5 p-3">
              <p className="text-xs uppercase tracking-wide text-gray-500">{t.matchedImages}</p>
              <p className="mt-1 font-semibold text-white">{matchedPageCount} / {mokuroFile.pages.length}</p>
            </div>
            <div className="rounded-lg border border-white/10 bg-white/5 p-3">
              <p className="text-xs uppercase tracking-wide text-gray-500">{t.blocks}</p>
              <p className="mt-1 font-semibold text-white">{currentBlocks.length}</p>
            </div>
            <div className="rounded-lg border border-white/10 bg-white/5 p-3">
              <p className="text-xs uppercase tracking-wide text-gray-500">{t.provider}</p>
              <p className="mt-1 font-semibold text-white">{selectedProvider.toUpperCase()}</p>
            </div>
            <div className="rounded-lg border border-white/10 bg-white/5 p-3">
              <p className="text-xs uppercase tracking-wide text-gray-500">{t.cache}</p>
              <p className="mt-1 text-xs font-semibold text-white">
                {cacheStatus}
              </p>
              <p className="mt-0.5 text-[11px] text-gray-500">
                {cacheStorageMode === 'directory' ? MOKURO_ANALYSIS_CACHE_FILENAME : 'localStorage'}
              </p>
            </div>
          </div>
        )}

        {batchProgress && (
          <div className="mt-4 rounded-lg border border-white/10 bg-gray-950/40 p-3">
            <div className="mb-2 flex items-center justify-between text-xs text-gray-400">
              <span>
                {batchProgress.currentPage
                  ? t.pageOf
                      .replace('{current}', String(batchProgress.currentPage))
                      .replace('{total}', String(batchProgress.totalPages ?? 0))
                  : t.analyzePage}
              </span>
              <span>
                {batchProgress.completed + batchProgress.skipped + batchProgress.failed} / {batchProgress.total}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-gray-800">
              <div
                className="h-full rounded-full bg-purple-400 transition-all"
                style={{
                  width: `${batchProgress.total === 0 ? 0 : ((batchProgress.completed + batchProgress.skipped + batchProgress.failed) / batchProgress.total) * 100}%`
                }}
              />
            </div>
            <p className="mt-2 text-xs text-gray-500">
              completed {batchProgress.completed}, cached {batchProgress.skipped}, failed {batchProgress.failed}
            </p>
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
          <div className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-300" />
            <p>{error}</p>
          </div>
        </div>
      )}

      {mokuroFile && currentPage ? (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_400px]">
          <section className="min-w-0 rounded-2xl border border-white/10 bg-white/5 p-3 md:p-4">
            <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h3 className="font-semibold text-white">
                  {analysisLanguage === 'zh'
                    ? `${t.page} ${currentPageIndex + 1} ${t.of} ${pageCount}`
                    : `${t.page} ${currentPageIndex + 1} ${t.of} ${pageCount}`}
                </h3>
                <p className="truncate text-xs text-gray-400" title={currentPage.img_path}>
                  {currentPage.img_path}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => goToPage(currentPageIndex - 1)}
                  disabled={currentPageIndex === 0}
                  className="rounded-lg border border-white/10 bg-white/5 p-2 text-gray-200 transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label={t.previousPage}
                >
                  <ChevronLeft size={18} />
                </button>
                <input
                  type="number"
                  min={1}
                  max={pageCount}
                  value={currentPageIndex + 1}
                  onChange={event => goToPage(Number(event.target.value) - 1)}
                  className="h-9 w-20 rounded-lg border border-white/10 bg-gray-950 px-2 text-center text-sm text-white"
                />
                <button
                  onClick={() => goToPage(currentPageIndex + 1)}
                  disabled={currentPageIndex >= pageCount - 1}
                  className="rounded-lg border border-white/10 bg-white/5 p-2 text-gray-200 transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label={t.nextPage}
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>

            <div className="overflow-auto rounded-xl bg-gray-950/70 p-2">
              {currentImage ? (
                <div
                  className="relative mx-auto overflow-hidden rounded-lg bg-black"
                  style={{ maxWidth: currentPage.img_width }}
                >
                  <img
                    src={currentImage.url}
                    alt={`Mokuro page ${currentPageIndex + 1}`}
                    className="block h-auto w-full select-none"
                  />
                  <div className="absolute inset-0">
                    {currentBlocks.map(({ block, blockIndex, text }) => {
                      const selection = { pageIndex: currentPageIndex, blockIndex, text }
                      const selected = selectedBlock?.pageIndex === currentPageIndex && selectedBlock.blockIndex === blockIndex
                      const analyzed = Boolean(analysisCache[getCacheKey(selection)])

                      return (
                        <button
                          key={`${currentPageIndex}-${blockIndex}`}
                          type="button"
                          aria-label={`OCR block ${blockIndex + 1}: ${text}`}
                          title={text || 'Empty OCR block'}
                          onClick={() => handleBlockSelect(blockIndex, text)}
                          disabled={isBatchAnalyzing}
                          style={getBlockStyle(block, currentPage)}
                          className={`absolute rounded-sm border transition-colors ${
                            selected
                              ? 'border-amber-300 bg-amber-300/25 shadow-[0_0_0_2px_rgba(251,191,36,0.35)]'
                              : analyzed
                                ? 'border-emerald-300/80 bg-emerald-300/10 hover:bg-emerald-300/25'
                                : 'border-cyan-300/70 bg-cyan-300/5 hover:bg-cyan-300/20'
                          }`}
                        >
                          <span className="sr-only">{text}</span>
                          {analyzed && (
                            <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-emerald-300 shadow" />
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ) : (
                <div className="flex min-h-[420px] items-center justify-center rounded-lg border border-dashed border-white/15 bg-gray-950/60 p-8 text-center">
                  <div className="max-w-md">
                    <FolderOpen className="mx-auto mb-3 h-10 w-10 text-gray-500" />
                    <h4 className="font-semibold text-white">{t.noImageTitle}</h4>
                    <p className="mt-2 text-sm text-gray-400">
                      {t.noImageBody} <span className="font-mono text-gray-300">{currentPage.img_path}</span>
                    </p>
                  </div>
                </div>
              )}
            </div>
          </section>

          <aside className="min-w-0 space-y-4">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="mb-3 flex items-center gap-2">
                <Search size={16} className="text-cyan-300" />
                <h3 className="font-semibold text-white">{t.ocrBlocks}</h3>
                <span className="ml-auto rounded-full border border-white/10 px-2 py-0.5 text-xs text-gray-400">
                  {analyzedCountForCurrentPage} / {currentBlocks.length}
                </span>
              </div>
              <div className="max-h-[360px] space-y-2 overflow-auto pr-1">
                {currentBlocks.length > 0 ? currentBlocks.map(({ blockIndex, text }) => {
                  const selection = { pageIndex: currentPageIndex, blockIndex, text }
                  const selected = selectedBlock?.pageIndex === currentPageIndex && selectedBlock.blockIndex === blockIndex
                  const analyzed = Boolean(analysisCache[getCacheKey(selection)])

                  return (
                    <button
                      key={`block-list-${blockIndex}`}
                      type="button"
                      onClick={() => handleBlockSelect(blockIndex, text)}
                      disabled={!text || isBatchAnalyzing}
                      className={`w-full rounded-lg border p-3 text-left transition-colors ${
                        selected
                          ? 'border-amber-300/70 bg-amber-400/20'
                          : analyzed
                            ? 'border-emerald-300/40 bg-emerald-400/10 hover:bg-emerald-400/15'
                            : 'border-white/10 bg-gray-950/40 hover:bg-white/10'
                      } disabled:cursor-not-allowed disabled:opacity-40`}
                    >
                      <div className="mb-1 flex items-center justify-between text-xs text-gray-500">
                        <span>Block {blockIndex + 1}</span>
                        <span className="inline-flex items-center gap-1">
                          {analyzed && <CheckCircle2 size={12} className="text-emerald-300" />}
                          {text.length} chars
                        </span>
                      </div>
                      <p className="line-clamp-3 font-japanese text-sm leading-relaxed text-gray-100">
                        {text || 'Empty block'}
                      </p>
                    </button>
                  )
                }) : (
                  <p className="rounded-lg border border-white/10 bg-gray-950/40 p-3 text-sm text-gray-400">
                    {t.emptyBlocks}
                  </p>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="mb-3 flex justify-end">
                <button
                  type="button"
                  onClick={() => selectedBlock && void analyzeSelection(selectedBlock, true)}
                  disabled={!selectedBlock || isAnalyzing || isBatchAnalyzing}
                  className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-gray-200 transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {isAnalyzing ? <Loader2 size={14} className="animate-spin" /> : <RotateCw size={14} />}
                  {analysisLanguage === 'zh' ? '重新分析' : 'Reanalyze'}
                </button>
              </div>
              <MokuroAnalysisPanel
                analysisResult={activeAnalysis}
                isAnalyzing={isAnalyzing}
                selectedText={selectedBlock?.text ?? null}
                language={analysisLanguage}
              />
            </div>
          </aside>
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-white/15 bg-white/5 p-8 text-center">
          <FolderOpen className="mx-auto mb-3 h-10 w-10 text-gray-500" />
          <h3 className="font-semibold text-white">{t.loadStartTitle}</h3>
          <p className="mt-2 text-sm text-gray-400">{t.loadStartBody}</p>
        </div>
      )}
    </div>
  )
}
