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
  Volume2,
  X,
  Zap
} from 'lucide-react'
import toast from 'react-hot-toast'
import MokuroAnalysisPanel from '@/components/MokuroAnalysisPanel'
import { useMokuroKeyboardNav } from '@/components/useMokuroKeyboardNav'
import { useSpeech } from '@/components/useSpeech'
import { runWithBatchAwake } from '@/lib/batch-awake'
import { analyzeText } from '@/lib/client-api'
import { runConcurrentTasks } from '@/lib/concurrency'
import {
  MOKURO_ANALYSIS_CACHE_DIRNAME,
  MOKURO_ANALYSIS_CACHE_FILENAME,
  clampPageRange,
  createMokuroAnalysisCacheKey,
  createMokuroImageLookup,
  filterAnalysesByPageIndex,
  findMokuroPageImageFile,
  getMokuroPageAnalysisConcurrency,
  getPageCacheFilename,
  getMokuroBlockText,
  groupAnalysesByPageIndex,
  isMokuroPageAnalysisComplete,
  parseMokuroAnalysisCacheContent,
  parseMokuroFileContent,
  parseMokuroPageAnalysisCacheContent,
  planMokuroDirectoryImport,
  serializeMokuroAnalysisCache,
  serializeMokuroPageAnalysisCache,
  shouldStopMokuroRangeAfterPageAnalysis,
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
  getDirectoryHandle: (
    name: string,
    options?: { create?: boolean }
  ) => Promise<BrowserFileSystemDirectoryHandle>
  getFileHandle: (
    name: string,
    options?: { create?: boolean }
  ) => Promise<BrowserFileSystemFileHandle>
  removeEntry: (name: string, options?: { recursive?: boolean }) => Promise<void>
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

interface BatchFailure {
  pageIndex: number
  blockIndex: number
  text: string
  error: string
}

type CacheStorageMode = 'directory' | 'browser'

const DIRECTORY_CACHE_DISPLAY_PATH = `${MOKURO_ANALYSIS_CACHE_DIRNAME}/page-*.json`

// Distance the analysis panel scrolls on each W/S keyboard shortcut.
const ANALYSIS_PANEL_SCROLL_STEP_PX = 160

const UI_TEXT = {
  zh: {
    title: 'Mokuro Reader',
    subtitle: '选择 Mokuro 输出目录，点击文字框查看语法和词汇解析。',
    selectedText: '选中文本',
    reanalyze: '重新分析',
    analyzing: '分析中...',
    focusHint: '点击页面文字框，在此处取词或查看解析。',
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
    loadStartBody: `目录中应包含 .mokuro 文件和页面图片。分析结果会写入 ${DIRECTORY_CACHE_DISPLAY_PATH}。`,
    noText: '这个文本块没有内容。',
    savedDirectory: '已保存到目录缓存文件',
    savedBrowser: '已保存到浏览器本地缓存',
    loadedDirectory: '目录已加载',
    loadedCache: '已加载历史分析缓存',
    noCache: '暂无缓存',
    unsupportedWrite: '当前浏览器不能直接写回目录，分析结果会保存到浏览器本地缓存。',
    noJapaneseVoice: '未检测到日语语音，请在系统设置中安装日语语音包后再朗读。',
    voiceLabel: '音色',
    voiceAuto: '自动',
    batchComplete: '本页批量分析完成',
    analyzeRange: '批量分析范围',
    analyzingRange: '正在分析范围...',
    cancelBatch: '取消',
    fromPageLabel: '从第',
    toPageLabel: '页到第',
    rangeInvalid: '起始页不能大于结束页',
    rangeComplete: '范围批量分析完成',
    rangeCancelled: '已取消范围批量分析',
    pageIncomplete: '第 {page} 页还有 {count} 条语句未完成。重新运行会跳过已缓存内容。',
    rangeCompleteWithFailures: '范围批量分析完成，{count} 条语句失败。重新运行会重试失败项。',
    failedBlocksTitle: '失败语句',
    failedBlockMeta: '第 {page} 页 · block {block}',
    pageOf: '第 {current} / {total} 页'
  },
  en: {
    title: 'Mokuro Reader',
    subtitle: 'Choose a Mokuro output directory, then click a text box for grammar and vocabulary analysis.',
    selectedText: 'Selected text',
    reanalyze: 'Reanalyze',
    analyzing: 'Analyzing...',
    focusHint: 'Click a text box on the page to look up words or view analysis here.',
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
    loadStartBody: `The folder should include the .mokuro file and page images. Results are saved to ${DIRECTORY_CACHE_DISPLAY_PATH}.`,
    noText: 'This text block has no text.',
    savedDirectory: 'Saved to the folder cache file',
    savedBrowser: 'Saved to browser local cache',
    loadedDirectory: 'Directory loaded',
    loadedCache: 'Loaded saved analysis cache',
    noCache: 'No saved cache yet',
    unsupportedWrite: 'This browser cannot write back to the selected folder, so results are saved to browser local cache.',
    noJapaneseVoice: 'No Japanese voice found. Install a Japanese voice package in your system settings to hear sentences.',
    voiceLabel: 'Voice',
    voiceAuto: 'Auto',
    batchComplete: 'Page batch analysis complete',
    analyzeRange: 'Analyze range',
    analyzingRange: 'Analyzing range...',
    cancelBatch: 'Cancel',
    fromPageLabel: 'From page',
    toPageLabel: 'to page',
    rangeInvalid: 'Start page must not exceed end page',
    rangeComplete: 'Range batch analysis complete',
    rangeCancelled: 'Range batch analysis cancelled',
    pageIncomplete: 'Page {page} still has {count} unfinished sentences. Rerun to skip cached results.',
    rangeCompleteWithFailures: 'Range batch analysis finished with {count} failed sentences. Rerun to retry failures.',
    failedBlocksTitle: 'Failed sentences',
    failedBlockMeta: 'Page {page} · block {block}',
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

const getErrorMessage = (error: unknown, fallback = 'Unknown error'): string => {
  if (error instanceof Error) return error.message
  if (typeof error === 'string' && error.trim()) return error
  return fallback
}

const isAbortError = (error: unknown): boolean => {
  return error instanceof DOMException && error.name === 'AbortError'
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
  const [batchFailures, setBatchFailures] = useState<BatchFailure[]>([])
  const [batchRangeFrom, setBatchRangeFrom] = useState('1')
  const [batchRangeTo, setBatchRangeTo] = useState('1')
  const [cacheStorageMode, setCacheStorageMode] = useState<CacheStorageMode>('browser')
  const [cacheStatus, setCacheStatus] = useState<string>(UI_TEXT.zh.noCache)
  const [error, setError] = useState<string | null>(null)
  const directoryInputRef = useRef<HTMLInputElement | null>(null)
  const directoryHandleRef = useRef<BrowserFileSystemDirectoryHandle | null>(null)
  const cancelBatchRef = useRef(false)
  const speechHintShownRef = useRef(false)
  const analysisScrollRef = useRef<HTMLDivElement | null>(null)
  const batchAbortControllerRef = useRef<AbortController | null>(null)
  const { selectedProvider } = useAIProviderStore()
  const [voiceURI, setVoiceURI] = useState<string | null>(null)
  const {
    speak,
    cancel: cancelSpeech,
    supported: speechSupported,
    ready: speechReady,
    voices: speechVoices
  } = useSpeech({ voiceURI })
  const japaneseVoices = useMemo(
    () => speechVoices.filter(voice => voice.lang.toLowerCase().startsWith('ja')),
    [speechVoices]
  )
  const speakSelection = (text: string) => {
    if (!speechSupported || !text.trim()) return
    // Only hint at a missing voice once voices have loaded, so the async
    // voice list doesn't trigger a false "no Japanese voice" toast.
    if (!speak(text) && speechReady && !speechHintShownRef.current) {
      speechHintShownRef.current = true
      toast(UI_TEXT[analysisLanguage].noJapaneseVoice)
    }
  }

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

  // Indices of blocks with text on the current page; empty blocks are skipped
  // so keyboard navigation never lands on an unanalyzable target.
  const keyboardBlockIndices = useMemo(
    () => currentBlocks.filter(b => b.text.length > 0).map(b => b.blockIndex),
    [currentBlocks]
  )

  const getCacheKey = useCallback((selection: SelectedMokuroBlock) => {
    return createMokuroAnalysisCacheKey({
      provider: selectedProvider,
      language: analysisLanguage,
      pageIndex: selection.pageIndex,
      blockIndex: selection.blockIndex
    })
  }, [analysisLanguage, selectedProvider])

  const handleWakeLockError = useCallback((wakeLockError: unknown) => {
    console.warn(
      'Mokuro batch wake lock unavailable:',
      wakeLockError instanceof Error ? wakeLockError.message : wakeLockError
    )
  }, [])

  const handleSystemAwakeError = useCallback((systemAwakeError: unknown) => {
    console.warn(
      'Mokuro batch system awake lock unavailable:',
      systemAwakeError instanceof Error ? systemAwakeError.message : systemAwakeError
    )
  }, [])

  const persistPageCache = useCallback(async (
    pageIndex: number,
    nextCache: Record<string, AnalysisResult>,
    sourceMokuroFile = mokuroFile,
    sourceMokuroName = mokuroName
  ) => {
    const fallbackContent = () => serializeMokuroAnalysisCache(nextCache, {
      title: sourceMokuroFile?.title ?? sourceMokuroName ?? undefined,
      pageCount: sourceMokuroFile?.pages.length
    })

    try {
      if (directoryHandleRef.current && sourceMokuroFile) {
        const cacheDir = await directoryHandleRef.current.getDirectoryHandle(MOKURO_ANALYSIS_CACHE_DIRNAME, { create: true })
        const filename = getPageCacheFilename(pageIndex, sourceMokuroFile.pages.length)
        const fileHandle = await cacheDir.getFileHandle(filename, { create: true })
        const pageAnalyses = filterAnalysesByPageIndex(nextCache, pageIndex)
        const writable = await fileHandle.createWritable()
        await writable.write(serializeMokuroPageAnalysisCache(pageIndex, pageAnalyses))
        await writable.close()
        setCacheStatus(UI_TEXT[analysisLanguage].savedDirectory)
        return
      }

      window.localStorage.setItem(getBrowserCacheKey(sourceMokuroName), fallbackContent())
      setCacheStatus(UI_TEXT[analysisLanguage].savedBrowser)
    } catch (saveError) {
      console.error('Failed to persist Mokuro page analysis cache:', saveError)
      window.localStorage.setItem(getBrowserCacheKey(sourceMokuroName), fallbackContent())
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

  // Reset the analysis panel scroll when the selected block or its analysis
  // state changes, so the translation at the top stays visible instead of
  // remaining scrolled down where the reader left it while browsing vocab.
  useEffect(() => {
    analysisScrollRef.current?.scrollTo({ top: 0 })
  }, [selectedBlock, activeAnalysis, isAnalyzing])

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

    for (const cachePageFile of plan.cachePageFiles) {
      try {
        const parsed = parseMokuroPageAnalysisCacheContent(await cachePageFile.file.text())
        loadedCache = { ...loadedCache, ...parsed.analyses }
      } catch (cacheError) {
        console.warn('Failed to parse Mokuro page analysis cache:', cacheError)
      }
    }

    if (plan.legacyCacheFile) {
      try {
        const legacy = parseMokuroAnalysisCacheContent(await plan.legacyCacheFile.file.text())
        loadedCache = { ...legacy.analyses, ...loadedCache }
      } catch (cacheError) {
        console.warn('Failed to parse legacy Mokuro analysis cache:', cacheError)
      }
    } else if (storageMode === 'browser') {
      const browserCache = window.localStorage.getItem(getBrowserCacheKey(plan.mokuroFile.name))
      if (browserCache) {
        try {
          loadedCache = { ...parseMokuroAnalysisCacheContent(browserCache).analyses, ...loadedCache }
        } catch (cacheError) {
          console.warn('Failed to parse browser Mokuro analysis cache:', cacheError)
        }
      }
    }

    // Migrate the legacy single file into per-page files (directory mode only).
    if (directoryHandleRef.current && parsedMokuro && plan.legacyCacheFile) {
      try {
        const cacheDir = await directoryHandleRef.current.getDirectoryHandle(MOKURO_ANALYSIS_CACHE_DIRNAME, { create: true })
        const groups = groupAnalysesByPageIndex(loadedCache)
        for (const [pageIndex, pageAnalyses] of Array.from(groups.entries())) {
          const filename = getPageCacheFilename(pageIndex, parsedMokuro.pages.length)
          const fileHandle = await cacheDir.getFileHandle(filename, { create: true })
          const writable = await fileHandle.createWritable()
          await writable.write(serializeMokuroPageAnalysisCache(pageIndex, pageAnalyses))
          await writable.close()
        }
        await directoryHandleRef.current.removeEntry(MOKURO_ANALYSIS_CACHE_FILENAME)
      } catch (migrationError) {
        console.warn('Failed to migrate legacy Mokuro analysis cache:', migrationError)
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
    setBatchFailures([])
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
    cancelSpeech()
    const nextPage = Math.min(Math.max(pageIndex, 0), mokuroFile.pages.length - 1)
    setCurrentPageIndex(nextPage)
    setSelectedBlock(null)
    if (!isBatchAnalyzing) {
      setBatchProgress(null)
    }
    setError(null)
  }

  const analyzeSelection = async (selection: SelectedMokuroBlock, force = false) => {
    const cacheKey = getCacheKey(selection)
    const cached = analysisCache[cacheKey]

    setSelectedBlock(selection)
    setError(null)

    // Read the selected sentence aloud. Cached results re-read too, so the
    // user always hears the block they clicked. When the browser supports
    // speech but has no Japanese voice, hint once that a voice pack is needed.
    speakSelection(selection.text)

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
      await persistPageCache(selection.pageIndex, nextCache)
      toast.success(analysisLanguage === 'zh' ? '已完成分析' : 'Analysis complete')
    } catch (analysisError) {
      const message = analysisError instanceof Error ? analysisError.message : 'Failed to analyze selected text'
      setError(message)
      toast.error(message)
    } finally {
      setIsAnalyzing(false)
    }
  }

  const analyzePageBlocks = async ({
    pageIndex,
    blocks,
    progressPageNumber,
    progressTotalPages,
    signal
  }: {
    pageIndex: number
    blocks: PageBlock[]
    progressPageNumber?: number
    progressTotalPages?: number
    signal?: AbortSignal
  }) => {
    let completed = 0
    let skipped = 0
    let failed = 0
    let dirty = false
    const pendingBlocks: PageBlock[] = []
    const failures: BatchFailure[] = []
    let nextPageCache = analysisCacheRef.current

    const createPageResult = (cancelled: boolean) => ({
      cancelled,
      dirty,
      total: blocks.length,
      completed,
      skipped,
      failed,
      failures,
      complete: isMokuroPageAnalysisComplete({
        total: blocks.length,
        completed,
        skipped,
        failed,
        cancelled
      })
    })

    const publishProgress = () => {
      setBatchProgress({
        total: blocks.length,
        completed,
        skipped,
        failed,
        ...(progressPageNumber && progressTotalPages
          ? {
              currentPage: progressPageNumber,
              totalPages: progressTotalPages
            }
          : {})
      })
    }

    for (const block of blocks) {
      if (cancelBatchRef.current || signal?.aborted) {
        publishProgress()
        return createPageResult(true)
      }

      const cacheKey = getCacheKey({
        pageIndex,
        blockIndex: block.blockIndex,
        text: block.text
      })

      if (analysisCacheRef.current[cacheKey]) {
        skipped += 1
      } else {
        pendingBlocks.push(block)
      }
    }

    publishProgress()

    await runConcurrentTasks({
      items: pendingBlocks,
      concurrency: getMokuroPageAnalysisConcurrency(pendingBlocks.length),
      shouldContinue: () => !cancelBatchRef.current && !signal?.aborted,
      task: async block => {
        const cacheKey = getCacheKey({
          pageIndex,
          blockIndex: block.blockIndex,
          text: block.text
        })
        const result = await analyzeText(block.text, {
          provider: selectedProvider,
          language: analysisLanguage,
          signal
        })

        return { cacheKey, result }
      },
      onSettled: taskResult => {
        if (taskResult.status === 'fulfilled') {
          nextPageCache = {
            ...analysisCacheRef.current,
            ...nextPageCache,
            [taskResult.value.cacheKey]: taskResult.value.result
          }
          analysisCacheRef.current = nextPageCache
          setAnalysisCache(nextPageCache)
          completed += 1
          dirty = true
        } else {
          if (cancelBatchRef.current || signal?.aborted || isAbortError(taskResult.reason)) {
            return
          }
          failed += 1
          const failure = {
            pageIndex,
            blockIndex: taskResult.item.blockIndex,
            text: taskResult.item.text,
            error: getErrorMessage(taskResult.reason)
          }
          failures.push(failure)
          setBatchFailures(prev => [...prev, failure])
          console.warn('Failed to analyze Mokuro page block:', taskResult.reason)
        }

        publishProgress()
      }
    })

    if (dirty) {
      analysisCacheRef.current = nextPageCache
      setAnalysisCache(nextPageCache)
    }

    return createPageResult(cancelBatchRef.current || signal?.aborted || false)
  }

  const analyzeCurrentPage = async () => {
    if (!currentPage || currentBlocks.length === 0 || isBatchAnalyzing) return

    const blocksToAnalyze = currentBlocks.filter(block => block.text.length > 0)

    cancelBatchRef.current = false
    const batchAbortController = new AbortController()
    batchAbortControllerRef.current = batchAbortController
    setIsBatchAnalyzing(true)
    setBatchProgress({ total: blocksToAnalyze.length, completed: 0, skipped: 0, failed: 0 })
    setBatchFailures([])
    setError(null)

    try {
      await runWithBatchAwake(async () => {
        const result = await analyzePageBlocks({
          pageIndex: currentPageIndex,
          blocks: blocksToAnalyze,
          signal: batchAbortController.signal
        })
        if (result.dirty) {
          await persistPageCache(currentPageIndex, analysisCacheRef.current)
        }
        if (result.cancelled) {
          toast.error(UI_TEXT[analysisLanguage].rangeCancelled)
        } else if (!result.complete) {
          const unfinishedCount = Math.max(0, result.total - result.completed - result.skipped)
          const message = UI_TEXT[analysisLanguage].pageIncomplete
            .replace('{page}', String(currentPageIndex + 1))
            .replace('{count}', String(unfinishedCount))
          setError(message)
          toast.error(message)
        } else {
          toast.success(UI_TEXT[analysisLanguage].batchComplete)
        }
      }, {
        onSystemAwakeError: handleSystemAwakeError,
        onWakeLockError: handleWakeLockError
      })
    } finally {
      if (batchAbortControllerRef.current === batchAbortController) {
        batchAbortControllerRef.current = null
      }
      setIsBatchAnalyzing(false)
      setBatchProgress(null)
    }
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
    const batchAbortController = new AbortController()
    batchAbortControllerRef.current = batchAbortController
    setIsBatchAnalyzing(true)
    setBatchProgress({
      total: 0,
      completed: 0,
      skipped: 0,
      failed: 0,
      currentPage: range.from,
      totalPages: range.to - range.from + 1
    })
    setBatchFailures([])
    setError(null)

    let cancelled = false
    let failedSentenceCount = 0
    try {
      await runWithBatchAwake(async () => {
        for (let pageIdx = range.from - 1; pageIdx <= range.to - 1; pageIdx += 1) {
          if (cancelBatchRef.current) {
            cancelled = true
            break
          }

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

          const result = await analyzePageBlocks({
            pageIndex: pageIdx,
            blocks,
            progressPageNumber: pageIdx + 1,
            progressTotalPages: range.to - range.from + 1,
            signal: batchAbortController.signal
          })
          if (result.dirty) {
            await persistPageCache(pageIdx, analysisCacheRef.current)
          }
          failedSentenceCount += result.failures.length
          if (shouldStopMokuroRangeAfterPageAnalysis(result)) {
            cancelled = true
            break
          }
        }
      }, {
        onSystemAwakeError: handleSystemAwakeError,
        onWakeLockError: handleWakeLockError
      })

      if (cancelled) {
        toast.error(t.rangeCancelled)
      } else if (failedSentenceCount > 0) {
        const message = t.rangeCompleteWithFailures.replace('{count}', String(failedSentenceCount))
        setError(message)
        toast.error(message)
      } else {
        toast.success(t.rangeComplete)
      }
    } catch (rangeError) {
      const message = rangeError instanceof Error ? rangeError.message : 'Failed to analyze page range'
      setError(message)
      toast.error(message)
    } finally {
      if (batchAbortControllerRef.current === batchAbortController) {
        batchAbortControllerRef.current = null
      }
      setIsBatchAnalyzing(false)
      setBatchProgress(null)
    }
  }

  const cancelBatch = () => {
    cancelBatchRef.current = true
    batchAbortControllerRef.current?.abort()
  }

  const selectBlock = (blockIndex: number) => {
    const block = currentBlocks.find(b => b.blockIndex === blockIndex)
    if (!block || !block.text) return
    setSelectedBlock({ pageIndex: currentPageIndex, blockIndex, text: block.text })
    // Keyboard navigation highlights a block without analyzing it; read it
    // aloud anyway so moving the highlight speaks the block under it.
    speakSelection(block.text)
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

  const pageContainerRef = useMokuroKeyboardNav({
    handlers: {
      selectBlock,
      analyzeSelected: () => {
        const targetIndex =
          selectedBlock && selectedBlock.pageIndex === currentPageIndex
            ? selectedBlock.blockIndex
            : keyboardBlockIndices[0] ?? null
        if (targetIndex === null) return
        const block = currentBlocks.find(b => b.blockIndex === targetIndex)
        if (!block || !block.text) return
        void analyzeSelection({
          pageIndex: currentPageIndex,
          blockIndex: targetIndex,
          text: block.text
        })
      },
      goToNextPage: () => goToPage(currentPageIndex + 1),
      goToPreviousPage: () => goToPage(currentPageIndex - 1),
      clearSelection: () => setSelectedBlock(null),
      scrollAnalysisUp: () => {
        analysisScrollRef.current?.scrollBy({ top: -ANALYSIS_PANEL_SCROLL_STEP_PX, behavior: 'smooth' })
      },
      scrollAnalysisDown: () => {
        analysisScrollRef.current?.scrollBy({ top: ANALYSIS_PANEL_SCROLL_STEP_PX, behavior: 'smooth' })
      }
    },
    state: {
      enabled: Boolean(mokuroFile) && !isBatchAnalyzing,
      isAnalyzing,
      blockIndices: keyboardBlockIndices,
      selectedIndex:
        selectedBlock && selectedBlock.pageIndex === currentPageIndex ? selectedBlock.blockIndex : null
    }
  })

  const resetReader = () => {
    cancelSpeech()
    cancelBatchRef.current = true
    batchAbortControllerRef.current?.abort()
    batchAbortControllerRef.current = null
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

        <div className="mt-5 flex flex-col gap-3">
          {/* Settings: explanation language + TTS voice */}
          <div className="flex flex-wrap items-center gap-3">
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

            {speechSupported && japaneseVoices.length > 0 && (
              <div className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-gray-950/40 py-1 pl-2 pr-1">
                <Volume2 size={16} className="text-cyan-300" />
                <span className="text-xs text-gray-400">{t.voiceLabel}</span>
                <select
                  value={voiceURI ?? ''}
                  onChange={event => setVoiceURI(event.target.value || null)}
                  aria-label={t.voiceLabel}
                  title={t.voiceLabel}
                  className="h-7 rounded-md border border-white/10 bg-gray-950 px-2 text-sm text-white"
                >
                  <option value="">{t.voiceAuto}</option>
                  {japaneseVoices.map(voice => (
                    <option key={voice.voiceURI} value={voice.voiceURI}>
                      {voice.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Analysis actions: current page + page range */}
          {mokuroFile && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void analyzeCurrentPage()}
                disabled={isBatchAnalyzing || currentBlocks.length === 0}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-purple-500/20 px-3 py-2 text-sm font-medium text-purple-100 transition-colors hover:bg-purple-500/30 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isBatchAnalyzing ? <Loader2 size={16} className="animate-spin" /> : <Zap size={16} />}
                {isBatchAnalyzing ? t.analyzingPage : t.analyzePage}
              </button>

              <div className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-gray-950/40 px-2 py-1.5">
                <Layers size={14} className="text-purple-300" />
                <input
                  type="number"
                  min={1}
                  max={mokuroFile.pages.length}
                  value={batchRangeFrom}
                  onChange={event => setBatchRangeFrom(event.target.value)}
                  disabled={isBatchAnalyzing}
                  aria-label={t.fromPageLabel}
                  className="h-7 w-14 rounded-md border border-white/10 bg-gray-950 px-1.5 text-center text-sm text-white disabled:opacity-50"
                />
                <span className="text-xs text-gray-500">–</span>
                <input
                  type="number"
                  min={1}
                  max={mokuroFile.pages.length}
                  value={batchRangeTo}
                  onChange={event => setBatchRangeTo(event.target.value)}
                  disabled={isBatchAnalyzing}
                  aria-label={t.toPageLabel}
                  className="h-7 w-14 rounded-md border border-white/10 bg-gray-950 px-1.5 text-center text-sm text-white disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={() => void analyzePageRange()}
                  disabled={isBatchAnalyzing || Number(batchRangeFrom) > Number(batchRangeTo)}
                  className="inline-flex items-center justify-center gap-1.5 rounded-md bg-purple-500/20 px-2.5 py-1.5 text-sm font-medium text-purple-100 transition-colors hover:bg-purple-500/30 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isBatchAnalyzing ? <Loader2 size={14} className="animate-spin" /> : null}
                  {t.analyzeRange}
                </button>
                {Number(batchRangeFrom) > Number(batchRangeTo) && !isBatchAnalyzing && (
                  <span className="text-xs text-red-300">{t.rangeInvalid}</span>
                )}
              </div>

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
                {cacheStorageMode === 'directory' ? DIRECTORY_CACHE_DISPLAY_PATH : 'localStorage'}
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

      {batchFailures.length > 0 && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
          <div className="mb-3 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 flex-shrink-0 text-amber-200" />
            <h3 className="font-semibold">{t.failedBlocksTitle}</h3>
          </div>
          <div className="space-y-2">
            {batchFailures.slice(-12).map(failure => (
              <div
                key={`${failure.pageIndex}:${failure.blockIndex}:${failure.error}`}
                className="rounded-lg border border-amber-300/20 bg-black/20 p-3"
              >
                <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-amber-200">
                  <span>
                    {t.failedBlockMeta
                      .replace('{page}', String(failure.pageIndex + 1))
                      .replace('{block}', String(failure.blockIndex))}
                  </span>
                  <span className="text-amber-300/60">·</span>
                  <span className="break-all text-amber-100/80">{failure.error}</span>
                </div>
                <p className="whitespace-pre-wrap break-words text-xs text-amber-50/90">
                  {failure.text}
                </p>
              </div>
            ))}
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

            <div ref={pageContainerRef} className="overflow-auto rounded-xl bg-gray-950/70 p-2">
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
                          data-block-index={blockIndex}
                          aria-label={`OCR block ${blockIndex + 1}: ${text}`}
                          title={text || 'Empty OCR block'}
                          onClick={() => handleBlockSelect(blockIndex, text)}
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

          <aside className="min-w-0 flex flex-col gap-4 self-start xl:sticky xl:top-4 xl:max-h-[calc(100vh-2rem)] xl:overflow-hidden">
            <div className="shrink-0 rounded-2xl border border-white/10 bg-white/5 p-4 xl:max-h-[30vh] xl:overflow-y-auto">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-xs text-gray-500">{t.selectedText}</p>
                <div className="flex items-center gap-2">
                  {isAnalyzing && (
                    <span className="inline-flex items-center gap-1 text-xs text-purple-300">
                      <Loader2 size={12} className="animate-spin" />
                      {t.analyzing}
                    </span>
                  )}
                  {selectedBlock && (
                    <button
                      type="button"
                      onClick={() => void analyzeSelection(selectedBlock, true)}
                      disabled={isAnalyzing || isBatchAnalyzing}
                      className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-xs font-medium text-gray-200 transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {isAnalyzing ? <Loader2 size={12} className="animate-spin" /> : <RotateCw size={12} />}
                      {t.reanalyze}
                    </button>
                  )}
                </div>
              </div>
              {selectedBlock ? (
                <p
                  lang="ja"
                  className="font-japanese text-xl font-medium leading-relaxed text-white whitespace-pre-wrap break-words select-text"
                >
                  {selectedBlock.text}
                </p>
              ) : (
                <p className="text-sm text-gray-400">{t.focusHint}</p>
              )}
            </div>

            {selectedBlock && (
              <div
                ref={analysisScrollRef}
                className="shrink-0 rounded-2xl border border-white/10 bg-white/5 p-4 xl:max-h-[45vh] xl:overflow-y-auto"
              >
                <MokuroAnalysisPanel
                  analysisResult={activeAnalysis}
                  isAnalyzing={isAnalyzing}
                  selectedText={selectedBlock.text}
                  language={analysisLanguage}
                  hideSelectedText
                />
              </div>
            )}

            <div className="flex-1 min-h-0 flex flex-col rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="mb-3 flex shrink-0 items-center gap-2">
                <Search size={16} className="text-cyan-300" />
                <h3 className="font-semibold text-white">{t.ocrBlocks}</h3>
                <span className="ml-auto rounded-full border border-white/10 px-2 py-0.5 text-xs text-gray-400">
                  {analyzedCountForCurrentPage} / {currentBlocks.length}
                </span>
              </div>
              <div className="flex-1 min-h-0 space-y-2 overflow-auto pr-1">
                {currentBlocks.length > 0 ? currentBlocks.map(({ blockIndex, text }) => {
                  const selection = { pageIndex: currentPageIndex, blockIndex, text }
                  const selected = selectedBlock?.pageIndex === currentPageIndex && selectedBlock.blockIndex === blockIndex
                  const analyzed = Boolean(analysisCache[getCacheKey(selection)])

                  return (
                    <button
                      key={`block-list-${blockIndex}`}
                      type="button"
                      data-block-index={blockIndex}
                      onClick={() => handleBlockSelect(blockIndex, text)}
                      disabled={!text}
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
                      <p
                        lang="ja"
                        className="font-japanese text-sm leading-relaxed text-gray-100 whitespace-pre-wrap break-words select-text"
                      >
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
