import { dirname, join } from 'node:path'
import { Project, SyntaxKind } from 'ts-morph'
import { config } from './config'

// ─── Helpers ────────────────────────────────────────────────────────

export function unique<T>(arr: T[]): T[] {
  return Array.from(new Set(arr))
}

// Normalize to package root (supports scoped and deep subpath imports)
export function getBasePackageName(specifier: string): string {
  if (specifier.startsWith('@')) {
    const [scope, name] = specifier.split('/')
    return `${scope}/${name}`
  }
  return specifier.split('/')[0]!
}

export function extractRegistrySlug(modulePath: string, basePath: string): string {
  if (!modulePath.startsWith(basePath))
    return ''

  const rest = modulePath.slice(basePath.length)
    .split('/')
    .filter(Boolean)

  return rest[0] || ''
}

// ─── Import parsing (via ts-morph) ──────────────────────────────────

export function parseImportsFromCode(code: string): string[] {
  try {
    const project = new Project({
      useInMemoryFileSystem: true,
      compilerOptions: {
        allowJs: true,
        allowSyntheticDefaultImports: true,
        esModuleInterop: true,
        moduleResolution: 2, // Node
        target: 5, // ESNext
        module: 5, // ESNext
        strict: false,
        skipLibCheck: true,
      },
    })

    const sourceFile = project.createSourceFile('temp.ts', code)

    /**
     * Static imports like:
     *
     * 1. `import something from 'some-package'`
     * 2. `import 'some-package/app.css'`
     */
    const imports = sourceFile.getImportDeclarations().map(i => i.getModuleSpecifierValue())

    /**
     * Dynamic imports like:
     *
     * 1. `await import('some-package')`
     * 2. `import 'some-package/app.css'`
     */
    const dynamicImports = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)
      .filter(c => c.getExpression().getText() === 'import')
      .map(c => c.getArguments()[0]?.getText())
      .filter(Boolean)
      .map(s => s!.slice(1, -1)) // Remove quotes

    return unique([...imports, ...dynamicImports])
  }
  catch (error) {
    console.error('Failed to parse imports with ts-morph:', error)
    return []
  }
}

// ─── @types/ mapping ────────────────────────────────────────────────

export function buildTypesDevDepsMap(devDependencies: string[]): Map<string, string[]> {
  const TYPES_PREFIX = '@types/'
  const typesDevDepsMap = new Map<string, string[]>()
  for (const devDep of devDependencies) {
    if (devDep.startsWith(TYPES_PREFIX)) {
      const name = devDep.slice(TYPES_PREFIX.length)
      // Scoped packages in DefinitelyTyped use __ separator, e.g. @types/babel__core for @babel/core
      const runtime = name.includes('__') ? `@${name.replace('__', '/')}` : name
      const list = typesDevDepsMap.get(runtime) ?? []
      list.push(devDep)
      typesDevDepsMap.set(runtime, list)
    }
  }
  return typesDevDepsMap
}

// ─── Dependency analysis ────────────────────────────────────────────

export interface DependencyAnalysisResult {
  dependencies: Set<string>
  devDependencies: Set<string>
  registryDependencies: Set<string>
}

export interface AnalyzeDependenciesOptions {
  filePath?: string
  currentGroup?: string
  /** If true, skip adding internal cross-component dependencies (for all.json bundling) */
  skipInternalDeps?: boolean
  /** Mapping from import package to @types/ packages */
  typesDevDepsMap?: Map<string, string[]>
}

/**
 * All path prefixes that map to registry-managed items.
 *
 * For `@/` alias imports:
 *   `@/components/ui/<slug>`          → shadcn-vue registry dep (slug only)
 *   `@/components/${baseName}/<slug>` → internal component dep
 *   `@/composables/<slug>`            → internal hook dep
 *   `@/lib/<slug>`                    → internal lib dep
 *
 * For `./` and `../` relative imports:
 *   Resolved against the file's own rewritten path, then matched
 *   against the same prefix set. Self-references (slug === currentGroup)
 *   are skipped for all types.
 */
function resolveRegistryDep(
  mod: string,
  registryDependencies: Set<string>,
  options?: AnalyzeDependenciesOptions,
): void {
  const baseName = config.baseName
  const baseUrl = config.baseUrl

  // ── @/ alias imports ──────────────────────────────────────────

  // shadcn-vue ui primitives: @/components/ui/<slug>
  if (mod.startsWith('@/components/ui/')) {
    const slug = extractRegistrySlug(mod, '@/components/ui/')
    if (slug)
      registryDependencies.add(slug)
    return
  }

  // Internal components: @/components/<baseName>/<slug>
  const internalComponentPrefix = `@/components/${baseName}/`
  if (mod.startsWith(internalComponentPrefix)) {
    const slug = extractRegistrySlug(mod, internalComponentPrefix)
    if (slug) {
      if (options?.currentGroup && slug === options.currentGroup)
        return
      if (!options?.skipInternalDeps)
        registryDependencies.add(`${baseUrl}/${slug}.json`)
    }
    return
  }

  // Internal composables / hooks: @/composables/<slug>
  if (mod.startsWith('@/composables/')) {
    const slug = extractRegistrySlug(mod, '@/composables/')
    if (slug) {
      if (options?.currentGroup && slug === options.currentGroup)
        return
      if (!options?.skipInternalDeps)
        registryDependencies.add(`${baseUrl}/${slug}.json`)
    }
    return
  }

  // Internal lib utilities: @/lib/<slug>
  if (mod.startsWith('@/lib/')) {
    const slug = extractRegistrySlug(mod, '@/lib/')
    if (slug) {
      if (options?.currentGroup && slug === options.currentGroup)
        return
      if (!options?.skipInternalDeps)
        registryDependencies.add(`${baseUrl}/${slug}.json`)
    }
  }
}

/**
 * Resolve a relative import (`./` or `../`) against the file's rewritten path
 * and check whether it refers to another registry-managed group.
 *
 * `./sibling` imports ARE resolved (not skipped), because standalone files
 * in the same directory may be separate registry items.
 */
function resolveRelativeImport(
  mod: string,
  registryDependencies: Set<string>,
  options?: AnalyzeDependenciesOptions,
): void {
  if (!options?.filePath)
    return

  const currentDir = dirname(options.filePath)
  const resolved = join(currentDir, mod).split('\\').join('/')

  // The resolved path is something like:
  //   "components/<baseName>/other-group/file.ts"
  //   "composables/otherHook.ts"
  //   "lib/otherUtil.ts"
  // Wrap it with "@/" and run through the same alias resolver
  resolveRegistryDep(`@/${resolved}`, registryDependencies, options)
}

export function analyzeDependencies(
  imports: string[],
  allowedDeps: Set<string>,
  allowedDevDeps: Set<string>,
  options?: AnalyzeDependenciesOptions,
): DependencyAnalysisResult {
  const dependencies = new Set<string>()
  const devDependencies = new Set<string>()
  const registryDependencies = new Set<string>()

  for (const mod of imports) {
    // Relative imports (./ and ../) — resolve against the file's path
    // to detect cross-item registry dependencies.
    // A ./sibling import may reference a different registry item
    // when items are standalone files in the same directory.
    if (mod.startsWith('./') || mod.startsWith('../')) {
      resolveRelativeImport(mod, registryDependencies, options)
      continue
    }

    // @/ alias imports — check for registry dependencies
    if (mod.startsWith('@/') || mod.startsWith('~/')) {
      resolveRegistryDep(mod, registryDependencies, options)
      continue
    }

    // ── npm package dependency resolution ───────────────────────
    const pkg = getBasePackageName(mod)

    if (allowedDeps.has(pkg)) {
      dependencies.add(pkg)
      // Check if it has a corresponding @types/ package
      if (options?.typesDevDepsMap) {
        const typePkgs = options.typesDevDepsMap.get(pkg)
        if (typePkgs) {
          for (const t of typePkgs)
            devDependencies.add(t)
        }
      }
    }

    if (allowedDevDeps.has(mod))
      devDependencies.add(mod)
  }

  return { dependencies, devDependencies, registryDependencies }
}
