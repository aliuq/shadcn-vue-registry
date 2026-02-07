import type { RegistryItem } from 'shadcn-vue/schema'
import type { AssetFile, CollectorContext, CollectorResult, RegistryTypeConfig } from '../utils/types'
import { promises as fs } from 'node:fs'
import { basename, relative } from 'node:path'
import { config } from '../utils/config'
import { walkFiles } from '../utils/fileScanner'
import { REGISTRY_TYPE_CONFIGS } from '../utils/types'
import { BaseCollector, resolveTarget, toTitle, validateRegistryItem } from './baseCollector'

/**
 * Collects library / utility files (type `registry:lib`).
 *
 * Scans `packages/elements/src/lib/` (if it exists).
 * Each `.ts` file becomes a separate registry item.
 * The `target` is set to `lib/<filename>` on the consumer side.
 */
export class LibCollector extends BaseCollector {
  readonly typeConfig: RegistryTypeConfig = REGISTRY_TYPE_CONFIGS.lib

  /** Override to point at a different directory if needed */
  protected getSourceDir(ctx: CollectorContext): string {
    // Default: packages/elements/src/lib
    return `${ctx.elementsDir}/src/lib`
  }

  async collect(ctx: CollectorContext): Promise<AssetFile[]> {
    const sourceDir = this.getSourceDir(ctx)
    const files: AssetFile[] = []

    let paths: string[] = []
    try {
      paths = await walkFiles(sourceDir, { extensions: ['.ts'] })
    }
    catch {
      // lib directory may not exist yet
      return files
    }

    for (const abs of paths) {
      const raw = await fs.readFile(abs, 'utf-8')
      const parsed = raw
        .replace(/@repo\/shadcn-vue\//g, '@/')
        .replace(/@repo\/elements\//g, `@/components/${config.baseName}/`)
      const rel = relative(sourceDir, abs).split('\\').join('/')

      files.push({
        type: 'registry:lib',
        path: `lib/${rel}`,
        content: parsed,
        // target is optional for registry:lib — resolved from meta.json if present
        target: resolveTarget(`lib/${rel}`, 'registry:lib', ctx),
      })
    }

    return files
  }

  buildItems(files: AssetFile[], ctx: CollectorContext): CollectorResult {
    const items: RegistryItem[] = []
    const outputs = new Map<string, Record<string, unknown>>()

    for (const f of files) {
      const fileName = basename(f.path)
      const name = fileName.replace('.ts', '')
      const deps = this.analyzeFileDependencies([f], ctx)

      const item: RegistryItem = {
        name,
        type: 'registry:lib',
        title: toTitle(name),
        description: `${toTitle(name)} utility library.`,
        files: [{
          path: f.path,
          type: f.type as 'registry:lib',
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

      if (validateRegistryItem(itemJson, `lib:${name}`)) {
        outputs.set(name, itemJson)
      }
      else {
        console.error(`Skipping invalid lib: ${name}`)
      }
    }

    return { files, items, outputs, typeConfig: this.typeConfig }
  }
}
