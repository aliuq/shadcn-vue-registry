import type { AssetFile, CollectorContext, CollectorResult, RegistryTypeConfig } from '../utils/types'
import { promises as fs } from 'node:fs'
import { basename, join } from 'node:path'
import { REGISTRY_TYPE_CONFIGS } from '../utils/types'
import { BaseCollector, validateRegistryItem } from './baseCollector'

/**
 * Collects pre-authored style definitions (type `registry:style`).
 *
 * Reads JSON files from `packages/elements/src/styles/`.
 * Each JSON file should be a complete registry item with `cssVars`, `css`,
 * `dependencies`, `registryDependencies`, etc.
 *
 * Style items are **not** included in `all.json` / `registry.json` items
 * by default — they are init-time configuration.
 */
export class StyleCollector extends BaseCollector {
  readonly typeConfig: RegistryTypeConfig = REGISTRY_TYPE_CONFIGS.style

  protected getSourceDir(ctx: CollectorContext): string {
    return join(ctx.elementsDir, 'src', 'styles')
  }

  async collect(_ctx: CollectorContext): Promise<AssetFile[]> {
    // Style items are JSON-only, no source files to collect
    return []
  }

  /**
   * Override: Instead of collecting source files, we read pre-authored JSON
   * definitions and pass them straight through to outputs.
   */
  async collectAndBuild(ctx: CollectorContext): Promise<CollectorResult | null> {
    const sourceDir = this.getSourceDir(ctx)
    const items: CollectorResult['items'] = []
    const outputs = new Map<string, Record<string, unknown>>()

    let entries: string[] = []
    try {
      const dirEntries = await fs.readdir(sourceDir, { withFileTypes: true })
      entries = dirEntries
        .filter(e => e.isFile() && e.name.endsWith('.json'))
        .map(e => join(sourceDir, e.name))
    }
    catch {
      return null
    }

    if (entries.length === 0)
      return null

    for (const abs of entries) {
      try {
        const raw = await fs.readFile(abs, 'utf-8')
        const json = JSON.parse(raw) as Record<string, unknown>

        // Ensure required fields
        const name = (json.name as string) || basename(abs, '.json')
        json.name = name
        json.type = json.type || 'registry:style'
        json.$schema = json.$schema || 'https://shadcn-vue.com/schema/registry-item.json'

        if (validateRegistryItem(json, `style:${name}`)) {
          outputs.set(name, json)
          items.push(json as any)
        }
        else {
          console.error(`Skipping invalid style: ${name}`)
        }
      }
      catch (error) {
        console.error(`Failed to read style file ${abs}:`, error)
      }
    }

    if (outputs.size === 0)
      return null

    return { files: [], items, outputs, typeConfig: this.typeConfig }
  }

  buildItems(_files: AssetFile[], _ctx: CollectorContext): CollectorResult {
    // Not used — collectAndBuild handles everything
    return { files: [], items: [], outputs: new Map(), typeConfig: this.typeConfig }
  }
}
