import type { Registry } from 'shadcn-vue/schema'
import type { AssetFile, CollectorContext, CollectorResult, PackageJson, TargetMeta } from './types'
import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import { createDefaultCollectors } from '../collectors'
import { validateRegistryItem } from '../collectors/baseCollector'
import { config } from './config'
import { analyzeDependencies, buildTypesDevDepsMap, parseImportsFromCode } from './dependencyAnalyzer'
import { extractSourceCode } from './fileScanner'
import { isTargetRequired } from './types'

// ─── Main entry point ───────────────────────────────────────────────

export async function generateRegistryAssets(ctx: { rootDir: string }) {
  const rootDir = ctx.rootDir
  const elementsDir = join(rootDir, '..', '..', 'packages', 'elements')
  const srcDir = join(elementsDir, 'src', 'components')
  const composablesDir = join(elementsDir, 'src', 'composables')
  const examplesDir = join(rootDir, '..', '..', 'packages', 'examples', 'src')

  // ── Read package.json files for dependency sets ──────────────────
  let pkg: PackageJson = {}
  try {
    const raw = await fs.readFile(join(elementsDir, 'package.json'), 'utf-8')
    pkg = JSON.parse(raw) as PackageJson
  }
  catch {}

  let examplesPkg: PackageJson = {}
  try {
    const raw = await fs.readFile(join(rootDir, '..', '..', 'packages', 'examples', 'package.json'), 'utf-8')
    examplesPkg = JSON.parse(raw) as PackageJson
  }
  catch {}

  // ── Load target metadata from meta.json ─────────────────────────
  let targetMeta: TargetMeta = { targets: {} }
  try {
    const raw = await fs.readFile(join(elementsDir, 'meta.json'), 'utf-8')
    targetMeta = JSON.parse(raw) as TargetMeta
  }
  catch {}

  const internalDeps = new Set(
    Object.keys(pkg.dependencies || {}).filter((d: string) => d.startsWith('@repo') && d !== '@repo/shadcn-vue'),
  )

  const allDeps = { ...pkg.dependencies, ...examplesPkg.dependencies }
  const allDevDeps = { ...pkg.devDependencies, ...examplesPkg.devDependencies }

  const excludedDeps = ['vue', '@repo/shadcn-vue', ...Array.from(internalDeps)]
  const excludedDevDeps = ['typescript']

  const allowedDeps = new Set(Object.keys(allDeps || {}).filter((d: string) => !excludedDeps.includes(d)))
  const allowedDevDeps = new Set(Object.keys(allDevDeps || {}).filter((d: string) => !excludedDevDeps.includes(d)))
  const typesDevDepsMap = buildTypesDevDepsMap(Array.from(allowedDevDeps))

  // ── Build the collector context ─────────────────────────────────
  const collectorCtx: CollectorContext = {
    rootDir,
    elementsDir,
    srcDir,
    composablesDir,
    examplesDir,
    allowedDeps,
    allowedDevDeps,
    typesDevDepsMap,
    targetMeta,
  }

  // ── Prepare output directories ──────────────────────────────────
  const outBase = join(rootDir, 'server', 'assets', 'registry')

  // Clean existing output to remove stale files from previous builds
  try {
    await fs.rm(outBase, { recursive: true, force: true })
  }
  catch {}
  await fs.mkdir(outBase, { recursive: true })

  // ── Run all collectors ──────────────────────────────────────────
  const collectors = createDefaultCollectors()
  const results: CollectorResult[] = []

  for (const collector of collectors) {
    // Some collectors (style, theme) use a combined collect+build flow
    const combined = await collector.collectAndBuild(collectorCtx)
    if (combined) {
      results.push(combined)
      continue
    }

    const files = await collector.collect(collectorCtx)
    if (files.length === 0)
      continue

    // Validate target requirements — filter out files missing required targets
    const validFiles = files.filter((f) => {
      if (isTargetRequired(f.type) && !f.target) {
        console.error(
          `[registry] File "${f.path}" of type "${f.type}" requires a target but none was provided. Skipping.`,
        )
        return false
      }
      return true
    })

    if (validFiles.length === 0)
      continue

    const result = collector.buildItems(validFiles, collectorCtx)
    results.push(result)
  }

  // ── Write per-item JSON files ───────────────────────────────────
  for (const result of results) {
    const outputDir = join(outBase, result.typeConfig.outputDir)
    await fs.mkdir(outputDir, { recursive: true })

    for (const [name, json] of result.outputs) {
      await fs.writeFile(join(outputDir, `${name}.json`), JSON.stringify(json, null, 2), 'utf-8')
    }
  }

  // ── Generate registry.json ──────────────────────────────────────
  const allItems = results.flatMap(r => r.items)
  const registryJson: Registry = {
    name: config.baseName,
    homepage: config.homepage,
    items: allItems,
  }
  await fs.writeFile(join(outBase, 'registry.json'), JSON.stringify(registryJson, null, 2), 'utf-8')

  // ── Generate all.json (bundled) ─────────────────────────────────
  // Collects ALL component-type files into a single registry item.
  // For all.json: skip internal cross-deps, only keep shadcn-vue deps.
  const bundleFiles: AssetFile[] = []
  const bundleDeps = new Set<string>()
  const bundleDevDeps = new Set<string>()
  const bundleRegDeps = new Set<string>()

  // Types that are bundled into all.json (skip examples, style, theme)
  const bundleTypes = new Set([
    'registry:component',
    'registry:lib',
    'registry:hook',
    'registry:ui',
    'registry:page',
    'registry:file',
  ])

  for (const result of results) {
    const eligible = result.files.filter(f => bundleTypes.has(f.type))
    bundleFiles.push(...eligible)

    for (const f of eligible) {
      const code = extractSourceCode(f)
      if (!code)
        continue

      const imports = parseImportsFromCode(code)
      const analysis = analyzeDependencies(imports, allowedDeps, allowedDevDeps, {
        filePath: f.path,
        skipInternalDeps: true,
        typesDevDepsMap,
      })
      analysis.dependencies.forEach(d => bundleDeps.add(d))
      analysis.devDependencies.forEach(d => bundleDevDeps.add(d))
      analysis.registryDependencies.forEach(d => bundleRegDeps.add(d))
    }
  }

  if (bundleFiles.length > 0) {
    const allJson = {
      $schema: 'https://shadcn-vue.com/schema/registry-item.json',
      name: 'all',
      type: 'registry:component',
      title: config.registryTitle,
      description: config.registryDescription,
      files: bundleFiles,
      dependencies: Array.from(bundleDeps),
      devDependencies: Array.from(bundleDevDeps),
      registryDependencies: Array.from(bundleRegDeps),
    }

    if (validateRegistryItem(allJson, 'all')) {
      await fs.writeFile(join(outBase, 'all.json'), JSON.stringify(allJson, null, 2), 'utf-8')
    }
    else {
      console.error('Skipping invalid all.json')
    }
  }

  // eslint-disable-next-line no-console
  console.info('[nitro] registry server assets generated at', outBase)
}
