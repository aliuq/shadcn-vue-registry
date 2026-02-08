import type { RegistryItem } from 'shadcn-vue/schema'
import type { AssetFile, CollectorContext, CollectorResult, RegistryTypeConfig } from '../utils/types'
import { promises as fs } from 'node:fs'
import { basename, join } from 'node:path'
import { config } from '../utils/config'
import { REGISTRY_TYPE_CONFIGS } from '../utils/types'
import { BaseCollector, toTitle, validateRegistryItem } from './baseCollector'

/**
 * Collects example / block files from `packages/examples/src/`.
 *
 * Each `.vue` file becomes a separate registry item of type `registry:block`.
 */
export class ExampleCollector extends BaseCollector {
  readonly typeConfig: RegistryTypeConfig = REGISTRY_TYPE_CONFIGS.block

  async collect(ctx: CollectorContext): Promise<AssetFile[]> {
    const files: AssetFile[] = []

    try {
      const entries = await fs.readdir(ctx.examplesDir, { withFileTypes: true })
      const candidates = entries
        .filter(e => e.isFile() && e.name.endsWith('.vue'))
        .map(e => join(ctx.examplesDir, e.name))

      for (const abs of candidates) {
        const raw = await fs.readFile(abs, 'utf-8')
        const parsed = raw.replace(/@repo\/elements\//g, `@/components/${config.baseName}/`)
        const name = basename(abs)

        files.push({
          type: 'registry:block',
          path: `components/${config.baseName}/examples/${name}`,
          content: parsed,
          // target is optional for registry:block
        })
      }
    }
    catch {
      // examples directory may not exist – that's fine
    }

    return files
  }

  buildItems(files: AssetFile[], ctx: CollectorContext): CollectorResult {
    const items: RegistryItem[] = []
    const outputs = new Map<string, Record<string, unknown>>()

    for (const ef of files) {
      const fileName = basename(ef.path)
      const name = fileName.replace('.vue', '')
      const deps = this.analyzeFileDependencies([ef], ctx)

      const item: RegistryItem = {
        name,
        type: 'registry:block',
        title: `${toTitle(name)} Example`,
        description: `Example implementation of ${toTitle(name)}.`,
        files: [{
          path: ef.path,
          type: ef.type as 'registry:block',
          ...(ef.target ? { target: ef.target } : {}),
        }],
      }
      items.push(item)

      const itemJson = {
        $schema: 'https://shadcn-vue.com/schema/registry-item.json',
        ...item,
        files: [ef],
        dependencies: deps.dependencies,
        devDependencies: deps.devDependencies,
        registryDependencies: deps.registryDependencies,
      }

      if (validateRegistryItem(itemJson, `block:${name}`)) {
        outputs.set(name, itemJson)
      }
      else {
        console.error(`Skipping invalid example: ${name}`)
      }
    }

    return { files, items, outputs, typeConfig: this.typeConfig }
  }
}
