import { defineNitroConfig } from 'nitro/config'
import { buildHooks } from './server/hooks'

// https://nitro.build/config
export default defineNitroConfig({
  compatibilityDate: 'latest',
  serverDir: 'server',
  preset: 'cloudflare_module',
  hooks: buildHooks,
  serverAssets: [
    {
      baseName: 'registry',
      dir: './assets/registry',
    },
  ],
  cloudflare: {
    nodeCompat: true,
    deployConfig: true,
  },
  vercel: {
    functions: {
      runtime: 'bun1.x',
    },
  },
  unenv: {
    alias: {
      // https://github.com/nitrojs/nitro/issues/3170
      'safer-buffer': 'node:buffer',
    },
  },
})
