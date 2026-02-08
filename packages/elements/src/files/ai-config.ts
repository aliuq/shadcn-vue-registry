/**
 * Test env config — exercises the `registry:file` type.
 * target is REQUIRED for registry:file.
 */
export const defaultConfig = {
  apiEndpoint: '/api/chat',
  maxTokens: 4096,
  temperature: 0.7,
  streamEnabled: true,
} as const

export type AppConfig = typeof defaultConfig
