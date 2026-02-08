import type { RegistryItem } from 'shadcn-vue/schema'

// ─── Registry item types ────────────────────────────────────────────
// Matches shadcn-vue's registryItemTypeSchema enum exactly.

export type RegistryItemType
  = | 'registry:lib'
    | 'registry:block'
    | 'registry:component'
    | 'registry:ui'
    | 'registry:hook'
    | 'registry:page'
    | 'registry:file'
    | 'registry:theme'
    | 'registry:style'
    | 'registry:example'

// ─── Target requirement per type ────────────────────────────────────
// Per the shadcn-vue file schema (discriminated union on `type`):
//   • registry:file  → target is **required**
//   • registry:page  → target is **required**
//   • all other types → target is optional
//
// This map is the single source of truth for target requirements so
// collectors and the validator both agree.

export const TARGET_REQUIRED_TYPES = new Set<RegistryItemType>([
  'registry:file',
  'registry:page',
])

export function isTargetRequired(type: RegistryItemType): boolean {
  return TARGET_REQUIRED_TYPES.has(type)
}

// ─── Registry type metadata ─────────────────────────────────────────
// Each type has:
//   • outputDir   – sub-folder under the assets output root
//   • itemType    – the type string written into registry-item JSON
//   • targetRequired – whether `target` is mandatory on files

export interface RegistryTypeConfig {
  /** Sub-folder under the asset output root (e.g. "components", "hooks") */
  outputDir: string
  /** The registry item type value */
  itemType: RegistryItemType
  /** Whether `target` must be set on every file entry */
  targetRequired: boolean
  /** Human-readable label (used in registry.json description, etc.) */
  label: string
}

/**
 * Central mapping of registry item types to their metadata.
 * Collectors reference this to stay consistent; new types can be added
 * here without touching every file.
 */
export const REGISTRY_TYPE_CONFIGS: Record<string, RegistryTypeConfig> = {
  component: {
    outputDir: 'components',
    itemType: 'registry:component',
    targetRequired: false,
    label: 'component',
  },
  hook: {
    outputDir: 'hooks',
    itemType: 'registry:hook',
    targetRequired: false,
    label: 'hook',
  },
  lib: {
    outputDir: 'lib',
    itemType: 'registry:lib',
    targetRequired: false,
    label: 'lib',
  },
  ui: {
    outputDir: 'ui',
    itemType: 'registry:ui',
    targetRequired: false,
    label: 'ui',
  },
  block: {
    outputDir: 'examples',
    itemType: 'registry:block',
    targetRequired: false,
    label: 'example',
  },
  page: {
    outputDir: 'pages',
    itemType: 'registry:page',
    targetRequired: true,
    label: 'page',
  },
  file: {
    outputDir: 'files',
    itemType: 'registry:file',
    targetRequired: true,
    label: 'file',
  },
  theme: {
    outputDir: 'themes',
    itemType: 'registry:theme',
    targetRequired: false,
    label: 'theme',
  },
  style: {
    outputDir: 'styles',
    itemType: 'registry:style',
    targetRequired: false,
    label: 'style',
  },
}

// ─── Asset file ─────────────────────────────────────────────────────
// Unified representation of a file that goes into a registry item.

export interface AssetFile {
  /** Registry type of this file */
  type: RegistryItemType
  /** Relative path as it appears in the output JSON (e.g. "components/my-registry/hello-world/HelloWorld.vue") */
  path: string
  /** File content (with import aliases already rewritten) */
  content: string
  /** Installation target path — **required** for registry:file and registry:page */
  target?: string
}

// ─── Collector context ──────────────────────────────────────────────
// Passed to every collector so they share the same evaluation context.

export interface CollectorContext {
  /** Absolute path to the registry app root (packages/registry) */
  rootDir: string
  /** Absolute path to the elements package (packages/elements) */
  elementsDir: string
  /** Absolute path to elements/src/components */
  srcDir: string
  /** Absolute path to elements/src/composables */
  composablesDir: string
  /** Absolute path to packages/examples/src */
  examplesDir: string
  /** Set of allowed production dependencies */
  allowedDeps: Set<string>
  /** Set of allowed dev dependencies */
  allowedDevDeps: Set<string>
  /** Mapping from runtime package → @types/ packages */
  typesDevDepsMap: Map<string, string[]>
  /** Target metadata loaded from meta.json (path → target mapping) */
  targetMeta: TargetMeta
}

// ─── Collector result ───────────────────────────────────────────────

export interface CollectorResult {
  /** Collected asset files */
  files: AssetFile[]
  /** Generated registry items (for registry.json) */
  items: RegistryItem[]
  /**
   * Per-item output: name → full JSON object ready to be written to disk.
   * Keys should NOT include file extensions.
   */
  outputs: Map<string, Record<string, unknown>>
  /** The type config this collector operates under */
  typeConfig: RegistryTypeConfig
}

// ─── Target metadata ────────────────────────────────────────────────

/**
 * Shape of `packages/elements/meta.json`.
 * Maps relative file paths (e.g. `pages/ChatPage.vue`) to their
 * install-target path on the consumer side.
 *
 * Only `registry:page` and `registry:file` **require** a target.
 * Other types default to an empty / unset target unless overridden here.
 */
export interface TargetMeta {
  targets: Record<string, string>
}

// ─── Package JSON ───────────────────────────────────────────────────

export interface PackageJson {
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
}
