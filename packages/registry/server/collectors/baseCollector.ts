import type { RegistryItem } from 'shadcn-vue/schema'
import type { AssetFile, CollectorContext, CollectorResult, RegistryTypeConfig } from '../utils/types'
import { registryItemSchema } from 'shadcn-vue/schema'
import { analyzeDependencies, parseImportsFromCode } from '../utils/dependencyAnalyzer'
import { extractSourceCode } from '../utils/fileScanner'
import { isTargetRequired } from '../utils/types'

// ─── Validation ─────────────────────────────────────────────────────

export function validateRegistryItem(item: unknown, label: string): item is RegistryItem {
  const parsed = registryItemSchema.safeParse(item)
  if (!parsed.success) {
    console.warn(`Invalid registry item schema (${label}):`, parsed.error.issues)
    return false
  }

  // JSON-only types (style, theme) don't require files
  const type = (item as any)?.type as string
  const jsonOnlyTypes = new Set(['registry:style', 'registry:theme'])
  if (!jsonOnlyTypes.has(type) && (!parsed.data.files || parsed.data.files.length === 0)) {
    console.warn(`Invalid registry item: files must be non-empty array (${label})`)
    return false
  }

  return true
}

// ─── Helpers ────────────────────────────────────────────────────────

export function toTitle(slug: string): string {
  return slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

/**
 * Resolve the install target for a file.
 *
 * Priority:
 *  1. Explicit entry in `meta.json` (keyed by the file's `path`)
 *  2. The provided `fallback` (usually `path` itself for required-target types)
 *  3. `undefined` (for optional-target types)
 */
export function resolveTarget(
  filePath: string,
  fileType: string,
  ctx: CollectorContext,
  fallback?: string,
): string | undefined {
  // Check meta.json first
  const metaTarget = ctx.targetMeta.targets[filePath]
  if (metaTarget)
    return metaTarget

  // For types that require target, use fallback (which is usually the path itself)
  if (isTargetRequired(fileType as any))
    return fallback ?? filePath

  // For optional types, no target unless explicitly set
  return undefined
}

/**
 * Group collected asset files by their top-level path segment.
 *
 * Given files with paths like:
 *   `prefix/foo.ts`          → group "foo" (name = "foo")
 *   `prefix/bar/a.ts`        → group "bar" (name = "bar")
 *   `prefix/bar/b.ts`        → group "bar" (name = "bar")
 *
 * Returns a map from group-name → files in that group.
 *
 * @param files  All collected AssetFile[]
 * @param prefix The path prefix to strip before determining the group
 *               (e.g. `"files/"`, `"composables/"`, `"lib/"`)
 */
export function groupFilesByDirectory(
  files: AssetFile[],
  prefix: string,
): Map<string, AssetFile[]> {
  const groupMap = new Map<string, AssetFile[]>()

  for (const f of files) {
    const rel = f.path.startsWith(prefix) ? f.path.slice(prefix.length) : f.path
    const segments = rel.split('/')
    // If there's more than one segment → first segment is the directory (group name)
    // If only one segment → it's a standalone file, group by filename without ext
    const group = segments.length > 1
      ? segments[0]
      : segments[0].replace(/\.[^.]+$/, '')

    if (!groupMap.has(group))
      groupMap.set(group, [])
    groupMap.get(group)!.push(f)
  }

  return groupMap
}

// ─── Abstract collector ─────────────────────────────────────────────

/**
 * Base class for all registry collectors.
 *
 * Subclasses must implement:
 *  - `collect(ctx)` → scan files and return AssetFile[]
 *  - `buildItems(files, ctx)` → transform files into RegistryItem[] + per-item JSON outputs
 *
 * The base provides common dependency-analysis helpers.
 */
export abstract class BaseCollector {
  abstract readonly typeConfig: RegistryTypeConfig

  /**
   * Scan the file system and produce an array of asset files.
   */
  abstract collect(ctx: CollectorContext): Promise<AssetFile[]>

  /**
   * Build registry items from the collected files.
   * Returns the full CollectorResult.
   */
  abstract buildItems(files: AssetFile[], ctx: CollectorContext): CollectorResult

  /**
   * Optional: Combined collect + build for collectors that don't follow
   * the standard file-scan → build-items pattern (e.g. JSON-only types
   * like registry:style and registry:theme).
   *
   * Returns `null` if no items were found.
   * When this returns a result, the builder skips the regular collect/build flow.
   */
  async collectAndBuild(_ctx: CollectorContext): Promise<CollectorResult | null> {
    return null
  }

  // ── Shared helpers ──────────────────────────────────────────────

  /**
   * Analyze dependencies for a set of asset files belonging to a single group/item.
   */
  protected analyzeFileDependencies(
    files: AssetFile[],
    ctx: CollectorContext,
    options?: {
      currentGroup?: string
      skipInternalDeps?: boolean
    },
  ): { dependencies: string[], devDependencies: string[], registryDependencies: string[] } {
    const deps = new Set<string>()
    const devDeps = new Set<string>()
    const regDeps = new Set<string>()

    for (const f of files) {
      const code = extractSourceCode(f)
      if (!code)
        continue

      const imports = parseImportsFromCode(code)
      const analysis = analyzeDependencies(imports, ctx.allowedDeps, ctx.allowedDevDeps, {
        filePath: f.path,
        currentGroup: options?.currentGroup,
        skipInternalDeps: options?.skipInternalDeps ?? false,
        typesDevDepsMap: ctx.typesDevDepsMap,
      })
      analysis.dependencies.forEach(d => deps.add(d))
      analysis.devDependencies.forEach(d => devDeps.add(d))
      analysis.registryDependencies.forEach(d => regDeps.add(d))
    }

    return {
      dependencies: Array.from(deps),
      devDependencies: Array.from(devDeps),
      registryDependencies: Array.from(regDeps),
    }
  }
}
