import type { Nitro, NitroHooks } from 'nitro/types'
import { generateRegistryAssets } from '../utils/registryBuilder'

export const buildHooks: Partial<NitroHooks> = {
  'build:before': async (nitro: Nitro) => {
    await generateRegistryAssets({
      rootDir: nitro.options.rootDir,
    })
  },
  'rollup:before': async (nitro: Nitro, config) => {
    // Patch vercel build error:
    // Cannot resolve entry module xxxxx/nitro/dist/presets/vercel/runtime/vercel.{format}.
    if (nitro.options.preset === 'vercel' && config.input && typeof config.input === 'string') {
      config.input = config.input.replace('{format}', 'node.mjs')
    }
  },
}
