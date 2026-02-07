import type { Dirent } from 'node:fs'
import type { AssetFile } from './types'
import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import { parse as parseSFC } from '@vue/compiler-sfc'

// ─── Generic file walker ────────────────────────────────────────────

export interface WalkOptions {
  /** File extensions to include (e.g. ['.vue', '.ts']) */
  extensions: string[]
  /** Absolute paths to exclude */
  excludePaths?: Set<string>
}

/**
 * Recursively walks a directory and returns absolute paths of matching files.
 */
export async function walkFiles(dir: string, options: WalkOptions = {} as WalkOptions): Promise<string[]> {
  const out: string[] = []
  let entries: Dirent[] = []
  try {
    entries = await fs.readdir(dir, { withFileTypes: true })
  }
  catch {
    return out
  }
  for (const entry of entries) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      const nested = await walkFiles(full, options)
      out.push(...nested)
    }
    else if (entry.isFile()) {
      if (options?.excludePaths?.has(full))
        continue

      if (!options.extensions?.length) {
        out.push(full)
        continue
      }

      const matches = options.extensions.some(ext => entry.name.endsWith(ext))
      if (matches) {
        out.push(full)
      }
    }
  }
  return out
}

// ─── Specialised walkers (backward-compat wrappers) ─────────────────

/**
 * Walk component files: includes .vue and .ts files, excludes root index.ts
 */
export async function walkComponentFiles(dir: string, rootDir: string): Promise<string[]> {
  const rootIndex = join(rootDir, 'index.ts')
  return walkFiles(dir, {
    extensions: ['.vue', '.ts'],
    excludePaths: new Set([rootIndex]),
  })
}

/**
 * Walk hook / composable files: includes .ts files only
 */
export async function walkHookFiles(dir: string): Promise<string[]> {
  return walkFiles(dir, {
    extensions: ['.ts'],
  })
}

// ─── Source code extraction ─────────────────────────────────────────

/**
 * Extract the script source from an asset file for import analysis.
 * - `.vue` → extracts `<script>` and `<script setup>` content
 * - `.ts`  → returns content as-is
 */
export function extractSourceCode(file: AssetFile): string {
  if (file.path.endsWith('.vue')) {
    const { descriptor } = parseSFC(file.content)
    return [descriptor.script?.content || '', descriptor.scriptSetup?.content || ''].join('\n')
  }
  const exts = ['.ts', '.js', '.tsx', '.jsx', '.mjs', '.mts']
  if (exts.some(ext => file.path.endsWith(ext))) {
    return file.content
  }
  return ''
}
