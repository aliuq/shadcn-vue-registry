import process from 'node:process'

/**
 * Global project configuration used by the registry builder.
 * Values come from environment variables with sensible defaults.
 */
export const config = {
  baseName: process.env.NITRO_BASE_NAME || 'specific-base-name',
  homepage: process.env.NITRO_HOMEPAGE || 'https://example.com',
  baseUrl: process.env.NITRO_BASE_URL || 'http://localhost:3000',
} as const

/**
 * Storage subdirectories where registry items are written / looked up.
 * Shared between the builder (write) and routes (read) so they stay in sync.
 * The order determines lookup priority in route handlers — first match wins.
 */
export const REGISTRY_SEARCH_DIRS = [
  'components',
  'hooks',
  'lib',
  'ui',
  'examples',
  'pages',
  'files',
  'composables',
  'themes',
  'styles',
] as const
