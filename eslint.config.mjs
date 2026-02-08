import antfu from '@antfu/eslint-config'

export default antfu(
  {
    vue: true,
    typescript: true,
    pnpm: true,
    markdown: false,
    ignores: [
      '**/.nitro/**',
      'packages/registry/server/assets/**',
    ],
  },
  {
  // Without `files`, they are general rules for all files
    rules: {
      'pnpm/json-enforce-catalog': 0,
    },
  },
  {
    ignores: ['packages/shadcn-vue', 'pnpm-workspace.yaml'],
  },
)
