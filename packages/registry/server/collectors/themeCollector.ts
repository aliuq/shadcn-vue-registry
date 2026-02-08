import type { AssetFile, CollectorContext, CollectorResult, RegistryTypeConfig } from '../utils/types'
import { promises as fs } from 'node:fs'
import { basename, join } from 'node:path'
import { REGISTRY_TYPE_CONFIGS } from '../utils/types'
import { BaseCollector, validateRegistryItem } from './baseCollector'

/**
 * Collects pre-authored theme definitions (type `registry:theme`).
 *
 * Reads JSON files from `packages/elements/src/themes/`.
 * Each JSON file should be a complete registry item with `cssVars`
 * (light/dark theme variables).
 *
 * Theme items are **not** included in `all.json` — they are
 * standalone theming configurations.
 */
export class ThemeCollector extends BaseCollector {
  readonly typeConfig: RegistryTypeConfig = REGISTRY_TYPE_CONFIGS.theme

  protected getSourceDir(ctx: CollectorContext): string {
    return join(ctx.elementsDir, 'src', 'themes')
  }

  async collect(_ctx: CollectorContext): Promise<AssetFile[]> {
    // Theme items are JSON-only, no source files to collect
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

        const name = (json.name as string) || basename(abs, '.json')
        json.name = name
        json.type = json.type || 'registry:theme'
        json.$schema = json.$schema || 'https://shadcn-vue.com/schema/registry-item.json'

        if (validateRegistryItem(json, `theme:${name}`)) {
          outputs.set(name, json)
          items.push(json as any)
        }
        else {
          console.error(`Skipping invalid theme: ${name}`)
        }
      }
      catch (error) {
        console.error(`Failed to read theme file ${abs}:`, error)
      }
    }

    if (outputs.size === 0)
      return null

    return { files: [], items, outputs, typeConfig: this.typeConfig }
  }

  buildItems(_files: AssetFile[], _ctx: CollectorContext): CollectorResult {
    return { files: [], items: [], outputs: new Map(), typeConfig: this.typeConfig }
  }
}
