export type ReviewEntry =
  | { mode: 'inline'; onStart: () => void }
  | { mode: 'route'; href: '/review' }

export const resolveReviewEntry = (onStart?: () => void): ReviewEntry =>
  onStart ? { mode: 'inline', onStart } : { mode: 'route', href: '/review' }
