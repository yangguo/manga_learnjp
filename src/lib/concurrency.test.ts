import { describe, expect, it } from 'vitest'
import { runConcurrentTasks } from './concurrency'

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

describe('runConcurrentTasks', () => {
  it('caps the number of active tasks', async () => {
    let active = 0
    let maxActive = 0

    const results = await runConcurrentTasks({
      items: [1, 2, 3, 4],
      concurrency: 2,
      task: async item => {
        active += 1
        maxActive = Math.max(maxActive, active)
        await delay(5)
        active -= 1
        return item * 2
      }
    })

    expect(maxActive).toBe(2)
    expect(results.map(result => result.status)).toEqual(['fulfilled', 'fulfilled', 'fulfilled', 'fulfilled'])
    expect(results.map(result => result.status === 'fulfilled' ? result.value : null)).toEqual([2, 4, 6, 8])
  })

  it('can run every item on a page concurrently when concurrency equals item count', async () => {
    let active = 0
    let maxActive = 0

    const results = await runConcurrentTasks({
      items: [1, 2, 3, 4, 5],
      concurrency: 5,
      task: async item => {
        active += 1
        maxActive = Math.max(maxActive, active)
        await delay(5)
        active -= 1
        return item
      }
    })

    expect(maxActive).toBe(5)
    expect(results).toHaveLength(5)
  })

  it('captures rejections without stopping other active tasks', async () => {
    const results = await runConcurrentTasks({
      items: [1, 2, 3],
      concurrency: 2,
      task: async item => {
        if (item === 2) {
          throw new Error('bad item')
        }
        return item
      }
    })

    expect(results).toHaveLength(3)
    expect(results[1].status).toBe('rejected')
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(2)
  })

  it('stops scheduling new tasks when cancelled', async () => {
    let cancelled = false

    const results = await runConcurrentTasks({
      items: [1, 2, 3],
      concurrency: 1,
      shouldContinue: () => !cancelled,
      task: async item => item,
      onSettled: () => {
        cancelled = true
      }
    })

    expect(results).toHaveLength(1)
    expect(results[0]).toMatchObject({
      status: 'fulfilled',
      item: 1,
      index: 0
    })
  })

  it('treats non-positive or NaN concurrency as a single worker', async () => {
    let maxActive = 0
    let active = 0

    await runConcurrentTasks({
      items: [1, 2, 3],
      concurrency: 0,
      task: async item => {
        active += 1
        maxActive = Math.max(maxActive, active)
        await delay(5)
        active -= 1
        return item
      }
    })

    expect(maxActive).toBe(1)
  })

  it('returns an empty result set when there are no items', async () => {
    const results = await runConcurrentTasks({
      items: [],
      concurrency: 4,
      task: async item => item
    })

    expect(results).toEqual([])
  })

  it('caps worker count at the item count', async () => {
    let maxActive = 0
    let active = 0

    const results = await runConcurrentTasks({
      items: [1, 2],
      concurrency: 100,
      task: async item => {
        active += 1
        maxActive = Math.max(maxActive, active)
        await delay(5)
        active -= 1
        return item
      }
    })

    expect(maxActive).toBe(2)
    expect(results).toHaveLength(2)
  })

  it('preserves result order by index even when rejections interleave', async () => {
    const results = await runConcurrentTasks({
      items: ['a', 'b', 'c', 'd'],
      concurrency: 4,
      task: async item => {
        if (item === 'b' || item === 'd') {
          throw new Error(`bad ${item}`)
        }
        return item.toUpperCase()
      }
    })

    expect(results.map(result => result.index)).toEqual([0, 1, 2, 3])
    expect(results[0]).toMatchObject({ status: 'fulfilled', value: 'A' })
    expect(results[1].status).toBe('rejected')
    expect(results[2]).toMatchObject({ status: 'fulfilled', value: 'C' })
    expect(results[3].status).toBe('rejected')
  })

  it('lets in-flight tasks settle when cancelled mid-flight', async () => {
    let cancelled = false
    const settled: number[] = []

    await runConcurrentTasks({
      items: [1, 2, 3, 4],
      concurrency: 2,
      shouldContinue: () => !cancelled,
      task: async item => {
        await delay(10)
        return item
      },
      onSettled: result => {
        settled.push(result.index)
        if (result.index === 0) {
          cancelled = true
        }
      }
    })

    // The two in-flight tasks (indices 0 and 1) both settle; nothing later is
    // scheduled once shouldContinue flips to false.
    expect(settled).toHaveLength(2)
    expect([...settled].sort((a, b) => a - b)).toEqual([0, 1])
  })
})
