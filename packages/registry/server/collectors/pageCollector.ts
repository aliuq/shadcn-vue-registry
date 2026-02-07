import type { RegistryItem } from 'shadcn-vue/schema'
import type { AssetFile, CollectorContext, CollectorResult, RegistryTypeConfig } from '../utils/types'
import { promises as fs } from 'node:fs'
import { basename, relative } from 'node:path'
import { config } from '../utils/config'
import { walkFiles } from '../utils/fileScanner'
import { REGISTRY_TYPE_CONFIGS } from '../utils/types'
import { BaseCollector, resolveTarget, toTitle, validateRegistryItem } from './baseCollector'

/**
 * Collects page files (type `registry:page`).
 *
 * Scans `packages/elements/src/pages/` (if it exists).
 * Each `.vue` file becomes a registry item.
 *
 * **target is REQUIRED** for `registry:page` per the shadcn-vue schema.
 * The default target maps to `pages/<relative-path>`.
 */
export class PageCollector extends BaseCollector {
  readonly typeConfig: RegistryTypeConfig = REGISTRY_TYPE_CONFIGS.page

  protected getSourceDir(ctx: CollectorContext): string {
    return `${ctx.elementsDir}/src/pages`
  }

  async collect(ctx: CollectorContext): Promise<AssetFile[]> {
    const sourceDir = this.getSourceDir(ctx)
    const files: AssetFile[] = []

    let paths: string[] = []
    try {
      paths = await walkFiles(sourceDir, { extensions: ['.vue', '.ts'] })
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
        type: 'registry:page',
        path: `pages/${rel}`,
        content: parsed,
        // target is REQUIRED for registry:page — resolved from meta.json or defaults to path
        target: resolveTarget(`pages/${rel}`, 'registry:page', ctx, `pages/${rel}`),
      })
    }

    return files
  }

  buildItems(files: AssetFile[], ctx: CollectorContext): CollectorResult {
    const items: RegistryItem[] = []
    const outputs = new Map<string, Record<string, unknown>>()

    for (const f of files) {
      const fileName = basename(f.path)
      const name = fileName.replace(/\.(vue|ts)$/, '')
      const deps = this.analyzeFileDependencies([f], ctx)

      const item: RegistryItem = {
        name,
        type: 'registry:page',
        title: `${toTitle(name)} Page`,
        description: `${toTitle(name)} page component.`,
        files: [{
          path: f.path,
          type: f.type,
          target: f.target!, // required for registry:page
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

      if (validateRegistryItem(itemJson, `page:${name}`)) {
        outputs.set(name, itemJson)
      }
      else {
        console.error(`Skipping invalid page: ${name}`)
      }
    }

    return { files, items, outputs, typeConfig: this.typeConfig }
  }
}
