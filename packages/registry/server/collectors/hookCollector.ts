import type { RegistryItem } from 'shadcn-vue/schema'
import type { AssetFile, CollectorContext, CollectorResult, RegistryTypeConfig } from '../utils/types'
import { promises as fs } from 'node:fs'
import { relative } from 'node:path'
import { config } from '../utils/config'
import { walkHookFiles } from '../utils/fileScanner'
import { REGISTRY_TYPE_CONFIGS } from '../utils/types'
import { BaseCollector, groupFilesByDirectory, resolveTarget, toTitle, validateRegistryItem } from './baseCollector'

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

    // Group by top-level directory or standalone file
    const groupMap = groupFilesByDirectory(files, 'composables/')

    for (const [group, groupFiles] of groupMap) {
      const deps = this.analyzeFileDependencies(groupFiles, ctx, { currentGroup: group })
      const specialName = group === 'index' ? 'composables' : group

      const item: RegistryItem = {
        name: specialName,
        type: 'registry:hook',
        title: toTitle(group),
        description: `${toTitle(group)} composable hook.`,
        files: groupFiles.map(f => ({
          path: f.path,
          type: f.type as 'registry:hook',
          ...(f.target ? { target: f.target } : {}),
        })),
      }
      items.push(item)

      const itemJson = {
        $schema: 'https://shadcn-vue.com/schema/registry-item.json',
        ...item,
        files: groupFiles,
        dependencies: deps.dependencies,
        devDependencies: deps.devDependencies,
        registryDependencies: deps.registryDependencies,
      }

      if (validateRegistryItem(itemJson, `hook:${specialName}`)) {
        outputs.set(specialName, itemJson)
      }
      else {
        console.error(`Skipping invalid hook: ${specialName}`)
      }
    }

    return { files, items, outputs, typeConfig: this.typeConfig }
  }
}
