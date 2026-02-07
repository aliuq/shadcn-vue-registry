import type { RegistryItem } from 'shadcn-vue/schema'
import type { AssetFile, CollectorContext, CollectorResult, RegistryTypeConfig } from '../utils/types'
import { promises as fs } from 'node:fs'
import { basename, relative } from 'node:path'
import { config } from '../utils/config'
import { walkHookFiles } from '../utils/fileScanner'
import { REGISTRY_TYPE_CONFIGS } from '../utils/types'
import { BaseCollector, resolveTarget, toTitle, validateRegistryItem } from './baseCollector'

/**
 * Collects composable / hook files from `packages/elements/src/composables/`.
 *
 * Each `.ts` file becomes a separate registry item of type `registry:hook`.
 * The `target` is set to install into `composables/` on the consumer side.
 */
export class HookCollector extends BaseCollector {
  readonly typeConfig: RegistryTypeConfig = REGISTRY_TYPE_CONFIGS.hook

  async collect(ctx: CollectorContext): Promise<AssetFile[]> {
    const hookPaths = await walkHookFiles(ctx.composablesDir)
    const files: AssetFile[] = []

    for (const abs of hookPaths) {
      const raw = await fs.readFile(abs, 'utf-8')
      const parsed = raw.replace(/@repo\/elements\//g, `@/components/${config.baseName}/`)
      const rel = relative(ctx.composablesDir, abs).split('\\').join('/')

      files.push({
        type: 'registry:hook',
        path: `composables/${rel}`,
        content: parsed,
        // target is optional for registry:hook — resolved from meta.json if present
        target: resolveTarget(`composables/${rel}`, 'registry:hook', ctx),
      })
    }

    return files
  }

  buildItems(files: AssetFile[], ctx: CollectorContext): CollectorResult {
    const items: RegistryItem[] = []
    const outputs = new Map<string, Record<string, unknown>>()

    // Group hooks: each top-level hook file or directory becomes one item
    // For simplicity, each file is its own item
    for (const f of files) {
      const fileName = basename(f.path)
      const name = fileName.replace('.ts', '')
      const deps = this.analyzeFileDependencies([f], ctx)

      const item: RegistryItem = {
        name,
        type: 'registry:hook',
        title: toTitle(name),
        description: `${toTitle(name)} composable hook.`,
        files: [{
          path: f.path,
          type: f.type as 'registry:hook',
          ...(f.target ? { target: f.target } : {}),
        }],
      }
      items.push(item)

      const itemJson = {
        $schema: 'https://shadcn-vue.com/schema/registry-item.json',
        ...item,
        files: [f],
        dependencies: deps.dependencies,
        devDependencies: deps.devDependencies,
        registryDependencies: deps.registryDependencies,
      }

      if (validateRegistryItem(itemJson, `hook:${name}`)) {
        outputs.set(name, itemJson)
      }
      else {
        console.error(`Skipping invalid hook: ${name}`)
      }
    }

    return { files, items, outputs, typeConfig: this.typeConfig }
  }
}
