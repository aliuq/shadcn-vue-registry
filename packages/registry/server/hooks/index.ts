import type { Nitro } from 'nitro/types'
import { generateRegistryAssets } from '../utils/registryBuilder'

export const buildHooks = {
  'build:before': async (nitro: Nitro) => {
    await generateRegistryAssets({
      rootDir: nitro.options.rootDir,
    })
  },
}
