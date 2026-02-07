import type { RegistryItem } from 'shadcn-vue/schema'
import type { AssetFile, CollectorContext, CollectorResult, RegistryTypeConfig } from '../utils/types'
import { promises as fs } from 'node:fs'
import { relative } from 'node:path'
import { config } from '../utils/config'
import { walkComponentFiles } from '../utils/fileScanner'
import { REGISTRY_TYPE_CONFIGS } from '../utils/types'
import { BaseCollector, toTitle, validateRegistryItem } from './baseCollector'

/**
 * Collects UI primitive files (type `registry:ui`).
 *
 * Scans `packages/elements/src/ui/` (if it exists).
 * Files are grouped by their top-level directory, similar to components.
 * Each group becomes a registry item of type `registry:ui`.
 */
export class UiCollector extends BaseCollector {
  readonly typeConfig: RegistryTypeConfig = REGISTRY_TYPE_CONFIGS.ui

  protected getSourceDir(ctx: CollectorContext): string {
    return `${ctx.elementsDir}/src/ui`
  }

  async collect(ctx: CollectorContext): Promise<AssetFile[]> {
    const sourceDir = this.getSourceDir(ctx)
    const files: AssetFile[] = []

    let paths: string[] = []
    try {
      paths = await walkComponentFiles(sourceDir, sourceDir)
    }
    catch {
      return files
    }

    for (const abs of paths) {
      const raw = await fs.readFile(abs, 'utf-8')
      const parsed = raw
        .replace(/@repo\/shadcn-vue\//g, '@/')
        .replace(/@repo\/elements\//g, `@/components/${config.baseName}/`)
      const rel = relative(sourceDir, abs).split('\\').join('/')

      files.push({
        type: 'registry:ui',
        path: `components/ui/${rel}`,
        content: parsed,
        // target is optional for registry:ui
      })
    }

    return files
  }

  buildItems(files: AssetFile[], ctx: CollectorContext): CollectorResult {
    // Group by top-level directory
    const groupMap = new Map<string, AssetFile[]>()
    for (const f of files) {
      const rel = f.path.replace('components/ui/', '')
      const group = rel.split('/')[0]
      if (!groupMap.has(group))
        groupMap.set(group, [])
      groupMap.get(group)!.push(f)
    }

    const items: RegistryItem[] = []
    const outputs = new Map<string, Record<string, unknown>>()

    for (const [group, groupFiles] of groupMap) {
      const deps = this.analyzeFileDependencies(groupFiles, ctx, { currentGroup: group })

      const item: RegistryItem = {
        name: group,
        type: 'registry:ui',
        title: toTitle(group),
        description: `${toTitle(group)} UI primitive.`,
        files: groupFiles.map(f => ({
          path: f.path,
          type: f.type as 'registry:ui',
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

      if (validateRegistryItem(itemJson, `ui-${group}`)) {
        outputs.set(group, itemJson)
      }
      else {
        console.error(`Skipping invalid UI component: ${group}`)
      }
    }

    return { files, items, outputs, typeConfig: this.typeConfig }
  }
}
