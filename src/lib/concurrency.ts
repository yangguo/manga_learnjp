export type ConcurrentTaskResult<T, R> =
  | {
      status: 'fulfilled'
      item: T
      index: number
      value: R
    }
  | {
      status: 'rejected'
      item: T
      index: number
      reason: unknown
    }

interface RunConcurrentTasksOptions<T, R> {
  items: readonly T[]
  concurrency: number
  task: (item: T, index: number) => Promise<R>
  shouldContinue?: () => boolean
  onSettled?: (result: ConcurrentTaskResult<T, R>) => void
}

export async function runConcurrentTasks<T, R>({
  items,
  concurrency,
  task,
  shouldContinue,
  onSettled
}: RunConcurrentTasksOptions<T, R>): Promise<Array<ConcurrentTaskResult<T, R>>> {
  if (items.length === 0) return []

  const workerCount = Math.min(
    items.length,
    Math.max(1, Math.floor(Number.isFinite(concurrency) ? concurrency : 1))
  )
  const results: Array<ConcurrentTaskResult<T, R> | undefined> = []
  let nextIndex = 0

  const runWorker = async () => {
    while (nextIndex < items.length) {
      if (shouldContinue && !shouldContinue()) return

      const index = nextIndex
      nextIndex += 1
      const item = items[index]

      try {
        const value = await task(item, index)
        const result = { status: 'fulfilled', item, index, value } satisfies ConcurrentTaskResult<T, R>
        results[index] = result
        onSettled?.(result)
      } catch (reason) {
        const result = { status: 'rejected', item, index, reason } satisfies ConcurrentTaskResult<T, R>
        results[index] = result
        onSettled?.(result)
      }
    }
  }

  await Promise.all(Array.from({ length: workerCount }, () => runWorker()))

  return results.filter((result): result is ConcurrentTaskResult<T, R> => Boolean(result))
}
