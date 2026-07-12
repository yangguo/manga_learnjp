import { describe, expect, it } from 'vitest'
import { resolveReviewEntry } from './review-entry'

describe('resolveReviewEntry', () => {
  it('uses inline review when the reader supplies a start callback', () => {
    const onStart = () => undefined

    expect(resolveReviewEntry(onStart)).toEqual({ mode: 'inline', onStart })
  })

  it('keeps standalone pages on the review route', () => {
    expect(resolveReviewEntry()).toEqual({ mode: 'route', href: '/review' })
  })
})
