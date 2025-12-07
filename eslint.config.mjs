import nextConfig from 'eslint-config-next/core-web-vitals'

const config = [
  ...nextConfig,
  {
    ignores: ['netlify/.netlify/**'],
  },
]

/** @type {import('eslint').Linter.FlatConfig[]} */
export default config
