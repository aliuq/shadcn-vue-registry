import process from 'node:process'

/**
 * Global project configuration used by the registry builder.
 * Values come from environment variables with sensible defaults.
 */
export const config = {
  baseName: process.env.BASE_NAME || 'self',
  homepage: process.env.HOMEPAGE || 'https://example.com',
  baseUrl: process.env.BASE_URL || 'http://localhost:3001',
  registryTitle: process.env.REGISTRY_TITLE || 'All Elements',
  registryDescription: process.env.REGISTRY_DESCRIPTION || 'A collection of all elements.',
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
  'themes',
  'styles',
] as const
