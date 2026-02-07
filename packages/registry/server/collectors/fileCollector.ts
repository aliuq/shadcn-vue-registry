import type { RegistryItem } from 'shadcn-vue/schema'
import type { AssetFile, CollectorContext, CollectorResult, RegistryTypeConfig } from '../utils/types'
import { promises as fs } from 'node:fs'
import { basename, relative } from 'node:path'
import { config } from '../utils/config'
import { walkFiles } from '../utils/fileScanner'
import { REGISTRY_TYPE_CONFIGS } from '../utils/types'
import { BaseCollector, resolveTarget, toTitle, validateRegistryItem } from './baseCollector'

/**
 * Collects arbitrary files (type `registry:file`).
 *
 * Scans `packages/elements/src/files/` (if it exists).
 *
 * **target is REQUIRED** for `registry:file` per the shadcn-vue schema.
 * Each file must explicitly declare where it should be installed.
 */
export class FileCollector extends BaseCollector {
  readonly typeConfig: RegistryTypeConfig = REGISTRY_TYPE_CONFIGS.file

  protected getSourceDir(ctx: CollectorContext): string {
    return `${ctx.elementsDir}/src/files`
  }

  async collect(ctx: CollectorContext): Promise<AssetFile[]> {
    const sourceDir = this.getSourceDir(ctx)
    const files: AssetFile[] = []

    let paths: string[] = []
    try {
      paths = await walkFiles(sourceDir)
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
        type: 'registry:file',
        path: `files/${rel}`,
        content: parsed,
        // target is REQUIRED for registry:file — resolved from meta.json or defaults to rel path
        target: resolveTarget(`files/${rel}`, 'registry:file', ctx, rel),
      })
    }

    return files
  }

  buildItems(files: AssetFile[], ctx: CollectorContext): CollectorResult {
    const items: RegistryItem[] = []
    const outputs = new Map<string, Record<string, unknown>>()

    for (const f of files) {
      const fileName = basename(f.path)
      const name = fileName.replace(/\.[^.]+$/, '')
      const deps = this.analyzeFileDependencies([f], ctx)

      const item: RegistryItem = {
        name,
        type: 'registry:file',
        title: toTitle(name),
        description: `${toTitle(name)} file.`,
        files: [{
          path: f.path,
          type: f.type,
          target: f.target!, // required for registry:file
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

      if (validateRegistryItem(itemJson, `file:${name}`)) {
        outputs.set(name, itemJson)
      }
      else {
        console.error(`Skipping invalid file: ${name}`)
      }
    }

    return { files, items, outputs, typeConfig: this.typeConfig }
  }
}
