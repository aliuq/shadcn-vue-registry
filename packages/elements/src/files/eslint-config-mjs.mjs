import antfu from '@antfu/eslint-config'

export default antfu(
  {
    // use markdownlint for markdown files
    markdown: false,
  },
  {
    rules: {
      'no-console': 'off',
      'unused-imports/no-unused-vars': 'off',
    },
  },
  {
    files: ['**/*.vue'],
    rules: {
      'ts/no-use-before-define': 'off',
    },
  },
  {
    files: ['**/*.yml', '**/*.yaml'],
    rules: {
      'yaml/quotes': ['error', { avoidEscape: true, prefer: 'double' }],
      'yml/plain-scalar': 'off',
    },
  },
)
