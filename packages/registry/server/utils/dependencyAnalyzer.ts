import { dirname, join } from 'node:path'
import { Project } from 'ts-morph'
import { config } from './config'

// ─── Helpers ────────────────────────────────────────────────────────

export function unique<T>(arr: T[]): T[] {
  return Array.from(new Set(arr))
}

// Normalize to package root (supports scoped and deep subpath imports)
export function getBasePackageName(specifier: string): string {
  if (specifier.startsWith('@')) {
    const parts = specifier.split('/')
    return parts.slice(0, 2).join('/')
  }
  return specifier.split('/')[0]
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
    const imports: string[] = []
    sourceFile.getImportDeclarations().forEach((declaration) => {
      const moduleSpecifier = declaration.getModuleSpecifierValue()
      if (moduleSpecifier) {
        imports.push(moduleSpecifier)
      }
    })

    return unique(imports)
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
  /** If true, skip adding AI component dependencies (for all.json bundling) */
  skipAiComponentDeps?: boolean
  /** Mapping from import package to @types/ packages */
  typesDevDepsMap?: Map<string, string[]>
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
  const basePath = `components/${config.baseName}/`

  for (const mod of imports) {
    if (mod.startsWith('./')) {
      continue
    }

    if (mod.startsWith('../') && options?.filePath && options?.currentGroup) {
      const currentDir = dirname(options.filePath)
      const resolved = join(currentDir, mod).split('\\').join('/')
      if (resolved.startsWith(basePath)) {
        const targetGroup = resolved.slice(basePath.length).split('/').filter(Boolean)[0]
        if (targetGroup && targetGroup !== options.currentGroup) {
          if (!options.skipAiComponentDeps) {
            registryDependencies.add(`${config.baseUrl}/${targetGroup}.json`)
          }
        }
      }
      continue
    }

    // Normalize to base package name for dependency lookup
    const pkg = getBasePackageName(mod)

    if (allowedDeps.has(pkg)) {
      dependencies.add(pkg)
      // Check if it has a corresponding @types/ package
      if (options?.typesDevDepsMap) {
        const typePkgs = options.typesDevDepsMap.get(pkg)
        if (typePkgs) {
          for (const t of typePkgs) {
            devDependencies.add(t)
          }
        }
      }
    }

    if (allowedDevDeps.has(mod)) {
      devDependencies.add(mod)
    }

    if (mod.startsWith('@/components/ui/')) {
      const slug = extractRegistrySlug(mod, '@/components/ui/')
      if (slug)
        registryDependencies.add(slug)
    }

    if (mod.startsWith(`@/components/${config.baseName}/`)) {
      const slug = extractRegistrySlug(mod, `@/components/${config.baseName}/`)
      if (slug) {
        if (options?.currentGroup && slug === options.currentGroup)
          continue
        if (!options?.skipAiComponentDeps) {
          registryDependencies.add(`${config.baseUrl}/${slug}.json`)
        }
      }
    }
  }

  return { dependencies, devDependencies, registryDependencies }
}
