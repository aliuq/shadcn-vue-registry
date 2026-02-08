import type { RegistryItem } from 'shadcn-vue/schema'
import type { AssetFile, CollectorContext, CollectorResult, RegistryTypeConfig } from '../utils/types'
import { promises as fs } from 'node:fs'
import { relative } from 'node:path'
import { config } from '../utils/config'
import { walkComponentFiles } from '../utils/fileScanner'
import { REGISTRY_TYPE_CONFIGS } from '../utils/types'
import { BaseCollector, toTitle, validateRegistryItem } from './baseCollector'

/**
 * Collects component files from `packages/elements/src/components/`.
 *
 * Components are grouped by their top-level directory name.
 * Each group becomes a separate registry item of type `registry:component`.
 */
export class ComponentCollector extends BaseCollector {
  readonly typeConfig: RegistryTypeConfig = REGISTRY_TYPE_CONFIGS.component

  async collect(ctx: CollectorContext): Promise<AssetFile[]> {
    const componentPaths = await walkComponentFiles(ctx.srcDir, ctx.srcDir)
    const files: AssetFile[] = []

    for (const abs of componentPaths) {
      const raw = await fs.readFile(abs, 'utf-8')
      const parsed = raw
        .replace(/@repo\/shadcn-vue\//g, '@/')
        .replace(/@repo\/elements\//g, `@/components/${config.baseName}/`)
      const rel = relative(ctx.srcDir, abs).split('\\').join('/')

      files.push({
        type: 'registry:component',
        path: `components/${config.baseName}/${rel}`,
        content: parsed,
        // target is optional for registry:component – not set (uses shadcn-vue default)
      })
    }

    return files
  }

  buildItems(files: AssetFile[], ctx: CollectorContext): CollectorResult {
    // Group files by their top-level directory
    const groupMap = new Map<string, AssetFile[]>()
    for (const f of files) {
      const rel = f.path.replace(`components/${config.baseName}/`, '')
      const group = rel.split('/')[0]
      if (!groupMap.has(group))
        groupMap.set(group, [])
      groupMap.get(group)!.push(f)
    }

    const items: RegistryItem[] = []
    const outputs = new Map<string, Record<string, unknown>>()

    for (const [group, groupFiles] of groupMap) {
      // Analyze dependencies for this group
      const deps = this.analyzeFileDependencies(groupFiles, ctx, {
        currentGroup: group,
        skipInternalDeps: false,
      })

      const item: RegistryItem = {
        name: group,
        type: 'registry:component',
        title: toTitle(group),
        description: `${toTitle(group)} components.`,
        files: groupFiles.map(f => ({
          path: f.path,
          type: f.type as 'registry:component',
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

      if (validateRegistryItem(itemJson, `component-${group}`)) {
        outputs.set(group, itemJson)
      }
      else {
        console.error(`Skipping invalid component: ${group}`)
      }
    }

    return { files, items, outputs, typeConfig: this.typeConfig }
  }
}
