'use client'

import { ChangeEvent, CSSProperties, useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  BookOpenCheck,
  ChevronLeft,
  ChevronRight,
  FileJson,
  Images,
  Search,
  Trash2
} from 'lucide-react'
import toast from 'react-hot-toast'
import MokuroAnalysisPanel from '@/components/MokuroAnalysisPanel'
import { analyzeText } from '@/lib/client-api'
import {
  createMokuroImageLookup,
  findMokuroPageImageFile,
  getMokuroBlockText,
  parseMokuroFileContent,
  type MokuroImageCandidate
} from '@/lib/mokuro'
import { useAIProviderStore } from '@/lib/store'
import type { AnalysisResult, MokuroBlock, MokuroFile, MokuroPage } from '@/lib/types'

interface MokuroImageWithUrl extends MokuroImageCandidate {
  url: string
  size: number
  type: string
}

interface SelectedMokuroBlock {
  pageIndex: number
  blockIndex: number
  text: string
}

const getAnalysisCacheKey = (selection: SelectedMokuroBlock, provider: string): string => {
  return `${provider}:${selection.pageIndex}:${selection.blockIndex}`
}

const getBlockStyle = (block: MokuroBlock, page: MokuroPage): CSSProperties => {
  const [left, top, right, bottom] = block.box
  const width = Math.max(0, right - left)
  const height = Math.max(0, bottom - top)
  const fontSize = Math.max(10, Math.min(22, block.font_size * 0.6))

  return {
    left: `${(left / page.img_width) * 100}%`,
    top: `${(top / page.img_height) * 100}%`,
    width: `${(width / page.img_width) * 100}%`,
    height: `${(height / page.img_height) * 100}%`,
    fontSize: `${fontSize}px`,
    lineHeight: 1.1,
    writingMode: block.vertical ? 'vertical-rl' : 'horizontal-tb'
  }
}

const isImageFile = (file: File): boolean => {
  return file.type.startsWith('image/') || /\.(png|jpe?g|webp|bmp)$/i.test(file.name)
}

const toImageWithUrl = (file: File): MokuroImageWithUrl => {
  const fileWithRelativePath = file as File & { webkitRelativePath?: string }

  return {
    name: file.name,
    webkitRelativePath: fileWithRelativePath.webkitRelativePath || undefined,
    url: URL.createObjectURL(file),
    size: file.size,
    type: file.type
  }
}

export default function MokuroReader() {
  const [mokuroFile, setMokuroFile] = useState<MokuroFile | null>(null)
  const [mokuroName, setMokuroName] = useState<string | null>(null)
  const [imageFiles, setImageFiles] = useState<MokuroImageWithUrl[]>([])
  const [currentPageIndex, setCurrentPageIndex] = useState(0)
  const [selectedBlock, setSelectedBlock] = useState<SelectedMokuroBlock | null>(null)
  const [analysisCache, setAnalysisCache] = useState<Record<string, AnalysisResult>>({})
  const [activeAnalysis, setActiveAnalysis] = useState<AnalysisResult | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { selectedProvider } = useAIProviderStore()

  useEffect(() => {
    return () => {
      imageFiles.forEach(image => URL.revokeObjectURL(image.url))
    }
  }, [imageFiles])

  const imageLookup = useMemo(() => createMokuroImageLookup(imageFiles), [imageFiles])
  const currentPage = mokuroFile?.pages[currentPageIndex] ?? null
  const currentImage = currentPage ? findMokuroPageImageFile(currentPage, imageLookup) : null
  const pageCount = mokuroFile?.pages.length ?? 0
  const matchedPageCount = useMemo(() => {
    if (!mokuroFile) return 0
    return mokuroFile.pages.filter(page => findMokuroPageImageFile(page, imageLookup)).length
  }, [imageLookup, mokuroFile])
  const currentBlocks = useMemo(() => {
    if (!currentPage) return []
    return currentPage.blocks.map((block, blockIndex) => ({
      block,
      blockIndex,
      text: getMokuroBlockText(block)
    }))
  }, [currentPage])

  useEffect(() => {
    if (!selectedBlock) {
      setActiveAnalysis(null)
      return
    }

    const cacheKey = getAnalysisCacheKey(selectedBlock, selectedProvider)
    setActiveAnalysis(analysisCache[cacheKey] ?? null)
  }, [analysisCache, selectedBlock, selectedProvider])

  const goToPage = (pageIndex: number) => {
    if (!mokuroFile) return
    const nextPage = Math.min(Math.max(pageIndex, 0), mokuroFile.pages.length - 1)
    setCurrentPageIndex(nextPage)
    setSelectedBlock(null)
    setError(null)
  }

  const handleMokuroFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    try {
      const content = await file.text()
      const parsed = parseMokuroFileContent(content)
      setMokuroFile(parsed)
      setMokuroName(file.name)
      setCurrentPageIndex(0)
      setSelectedBlock(null)
      setAnalysisCache({})
      setActiveAnalysis(null)
      setError(null)
      toast.success(`Loaded ${parsed.pages.length} Mokuro pages`)
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : 'Failed to load Mokuro file'
      setMokuroFile(null)
      setMokuroName(null)
      setSelectedBlock(null)
      setActiveAnalysis(null)
      setError(message)
      toast.error(message)
    }
  }

  const handleImageFilesChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []).filter(isImageFile)
    event.target.value = ''

    if (files.length === 0) {
      toast.error('Select page images exported with the Mokuro file.')
      return
    }

    setImageFiles(files.map(toImageWithUrl))
    setSelectedBlock(null)
    setActiveAnalysis(null)
    setError(null)
    toast.success(`Loaded ${files.length} image files`)
  }

  const analyzeSelection = async (selection: SelectedMokuroBlock, force = false) => {
    const cacheKey = getAnalysisCacheKey(selection, selectedProvider)
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
      const result = await analyzeText(selection.text, { provider: selectedProvider })
      setAnalysisCache(previous => ({
        ...previous,
        [cacheKey]: result
      }))
      setActiveAnalysis(result)
      toast.success('Mokuro text analyzed')
    } catch (analysisError) {
      const message = analysisError instanceof Error ? analysisError.message : 'Failed to analyze selected text'
      setError(message)
      toast.error(message)
    } finally {
      setIsAnalyzing(false)
    }
  }

  const handleBlockSelect = (blockIndex: number, text: string) => {
    if (!text) {
      toast.error('This Mokuro block has no text.')
      return
    }

    void analyzeSelection({
      pageIndex: currentPageIndex,
      blockIndex,
      text
    })
  }

  const resetReader = () => {
    setMokuroFile(null)
    setMokuroName(null)
    setImageFiles([])
    setCurrentPageIndex(0)
    setSelectedBlock(null)
    setAnalysisCache({})
    setActiveAnalysis(null)
    setError(null)
  }

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6">
      <div className="rounded-2xl border border-gray-700 bg-white/5 backdrop-blur-xl p-4 md:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 p-2 text-white">
                <BookOpenCheck size={20} />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-white">Mokuro Reader</h2>
                <p className="text-sm text-gray-400">
                  Load a .mokuro file, pair it with page images, then click any OCR block for LLM grammar and vocabulary analysis.
                </p>
              </div>
            </div>
          </div>

          <button
            onClick={resetReader}
            disabled={!mokuroFile && imageFiles.length === 0}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-gray-200 transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Trash2 size={16} />
            Reset
          </button>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-white/10 bg-gray-950/40 p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
              <FileJson size={16} className="text-amber-300" />
              Mokuro JSON
            </div>
            <input
              id="mokuro-json-file"
              type="file"
              accept=".mokuro,application/json"
              className="sr-only"
              onChange={handleMokuroFileChange}
            />
            <label
              htmlFor="mokuro-json-file"
              className="inline-flex w-full cursor-pointer items-center justify-center rounded-lg bg-amber-500/20 px-3 py-2 text-sm font-medium text-amber-100 transition-colors hover:bg-amber-500/30"
            >
              Choose .mokuro File
            </label>
            <p className="mt-2 truncate text-xs text-gray-400" title={mokuroName ?? undefined}>
              {mokuroName ?? 'No Mokuro file selected'}
            </p>
          </div>

          <div className="rounded-xl border border-white/10 bg-gray-950/40 p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
              <Images size={16} className="text-cyan-300" />
              Page Images
            </div>
            <input
              id="mokuro-image-files"
              type="file"
              accept="image/*"
              multiple
              className="sr-only"
              onChange={handleImageFilesChange}
            />
            <label
              htmlFor="mokuro-image-files"
              className="inline-flex w-full cursor-pointer items-center justify-center rounded-lg bg-cyan-500/20 px-3 py-2 text-sm font-medium text-cyan-100 transition-colors hover:bg-cyan-500/30"
            >
              Choose Images
            </label>
            <p className="mt-2 text-xs text-gray-400">
              {imageFiles.length > 0 ? `${imageFiles.length} image files loaded` : 'Select exported page images'}
            </p>
          </div>

          <div className="rounded-xl border border-white/10 bg-gray-950/40 p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
              <Images size={16} className="text-emerald-300" />
              Image Folder
            </div>
            <input
              id="mokuro-image-folder"
              type="file"
              accept="image/*"
              multiple
              className="sr-only"
              onChange={handleImageFilesChange}
              {...{ webkitdirectory: '', directory: '' }}
            />
            <label
              htmlFor="mokuro-image-folder"
              className="inline-flex w-full cursor-pointer items-center justify-center rounded-lg bg-emerald-500/20 px-3 py-2 text-sm font-medium text-emerald-100 transition-colors hover:bg-emerald-500/30"
            >
              Choose Folder
            </label>
            <p className="mt-2 text-xs text-gray-400">
              Keeps nested image paths when the browser supports folder upload.
            </p>
          </div>
        </div>

        {mokuroFile && (
          <div className="mt-4 grid gap-3 text-sm md:grid-cols-4">
            <div className="rounded-lg border border-white/10 bg-white/5 p-3">
              <p className="text-xs uppercase tracking-wide text-gray-500">Pages</p>
              <p className="mt-1 font-semibold text-white">{mokuroFile.pages.length}</p>
            </div>
            <div className="rounded-lg border border-white/10 bg-white/5 p-3">
              <p className="text-xs uppercase tracking-wide text-gray-500">Matched Images</p>
              <p className="mt-1 font-semibold text-white">{matchedPageCount} / {mokuroFile.pages.length}</p>
            </div>
            <div className="rounded-lg border border-white/10 bg-white/5 p-3">
              <p className="text-xs uppercase tracking-wide text-gray-500">Current Blocks</p>
              <p className="mt-1 font-semibold text-white">{currentBlocks.length}</p>
            </div>
            <div className="rounded-lg border border-white/10 bg-white/5 p-3">
              <p className="text-xs uppercase tracking-wide text-gray-500">Provider</p>
              <p className="mt-1 font-semibold text-white">{selectedProvider.toUpperCase()}</p>
            </div>
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
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
          <section className="min-w-0 rounded-2xl border border-white/10 bg-white/5 p-3 md:p-4">
            <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h3 className="font-semibold text-white">
                  Page {currentPageIndex + 1} of {pageCount}
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
                  aria-label="Previous page"
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
                  aria-label="Next page"
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
                      const selected = selectedBlock?.pageIndex === currentPageIndex && selectedBlock.blockIndex === blockIndex

                      return (
                        <button
                          key={`${currentPageIndex}-${blockIndex}`}
                          type="button"
                          title={text || 'Empty OCR block'}
                          onClick={() => handleBlockSelect(blockIndex, text)}
                          style={getBlockStyle(block, currentPage)}
                          className={`absolute overflow-hidden rounded-sm border px-0.5 py-0 text-left font-japanese text-white shadow-sm transition-colors ${
                            selected
                              ? 'border-amber-300 bg-amber-400/45 shadow-amber-500/30'
                              : 'border-cyan-300/70 bg-cyan-400/15 hover:bg-cyan-300/35'
                          }`}
                        >
                          <span className="drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">{text}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              ) : (
                <div className="flex min-h-[420px] items-center justify-center rounded-lg border border-dashed border-white/15 bg-gray-950/60 p-8 text-center">
                  <div className="max-w-md">
                    <Images className="mx-auto mb-3 h-10 w-10 text-gray-500" />
                    <h4 className="font-semibold text-white">No matching page image</h4>
                    <p className="mt-2 text-sm text-gray-400">
                      Load the image file referenced by <span className="font-mono text-gray-300">{currentPage.img_path}</span>.
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
                <h3 className="font-semibold text-white">OCR Blocks</h3>
              </div>
              <div className="max-h-[360px] space-y-2 overflow-auto pr-1">
                {currentBlocks.length > 0 ? currentBlocks.map(({ blockIndex, text }) => {
                  const selected = selectedBlock?.pageIndex === currentPageIndex && selectedBlock.blockIndex === blockIndex

                  return (
                    <button
                      key={`block-list-${blockIndex}`}
                      type="button"
                      onClick={() => handleBlockSelect(blockIndex, text)}
                      disabled={!text}
                      className={`w-full rounded-lg border p-3 text-left transition-colors ${
                        selected
                          ? 'border-amber-300/70 bg-amber-400/20'
                          : 'border-white/10 bg-gray-950/40 hover:bg-white/10'
                      } disabled:cursor-not-allowed disabled:opacity-40`}
                    >
                      <div className="mb-1 flex items-center justify-between text-xs text-gray-500">
                        <span>Block {blockIndex + 1}</span>
                        <span>{text.length} chars</span>
                      </div>
                      <p className="line-clamp-3 font-japanese text-sm leading-relaxed text-gray-100">
                        {text || 'Empty block'}
                      </p>
                    </button>
                  )
                }) : (
                  <p className="rounded-lg border border-white/10 bg-gray-950/40 p-3 text-sm text-gray-400">
                    This page has no OCR blocks.
                  </p>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <MokuroAnalysisPanel
                analysisResult={activeAnalysis}
                isAnalyzing={isAnalyzing}
                selectedText={selectedBlock?.text ?? null}
              />
            </div>
          </aside>
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-white/15 bg-white/5 p-8 text-center">
          <FileJson className="mx-auto mb-3 h-10 w-10 text-gray-500" />
          <h3 className="font-semibold text-white">Load a Mokuro file to start</h3>
          <p className="mt-2 text-sm text-gray-400">
            Use the Colab output or local Mokuro output folder. The .mokuro file provides OCR boxes; page images provide the visual reader.
          </p>
        </div>
      )}

    </div>
  )
}
