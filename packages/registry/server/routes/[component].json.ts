import type { Registry, RegistryItem } from 'shadcn-vue/schema'
import { defineHandler, getRequestURL } from 'nitro/h3'
import { useStorage } from 'nitro/storage'
import { config, REGISTRY_SEARCH_DIRS } from '../utils/config'

interface RegistryErrorResponse {
  error: string
  suggestions?: string
}

// All data is served from Nitro Server Assets generated at build time.

function transformRegistryDependencies(item: RegistryItem, registryUrl: string): RegistryItem {
  const deps = item.registryDependencies
  if (deps && Array.isArray(deps)) {
    return {
      ...item,
      registryDependencies: deps.map((dep) => {
      // Handle different types of dependencies
        if (dep.startsWith('/')) {
          // Relative path to JSON endpoint (e.g., "/component.json")
          return new URL(dep, registryUrl).toString()
        }
        if (dep.includes('.json')) {
          // Already formatted JSON dependency
          return dep.startsWith('http') ? dep : new URL(`/${dep}`, registryUrl).toString()
        }
        if (dep.match(/^[a-z-]+$/)) {
          // Simple component name (shadcn-vue style)
          return dep
        }
        // Fallback: assume it's a relative path
        return new URL(`/${dep}.json`, registryUrl).toString()
      }),
    }
  }
  return item
}

export default defineHandler(async (event) => {
  const url = getRequestURL(event)
  const registryUrl = url.origin
  const storage = useStorage(`assets:registry`)

  const componentParam = event.context.params?.component as string | undefined
  const fallbackFromPath = url.pathname.split('/').pop() || ''
  const component = componentParam ?? fallbackFromPath
  const parsedComponent = component.replace('.json', '')

  // Handle "all.json" - bundle all components into a single RegistryItem
  if (parsedComponent === 'all') {
    try {
      const allJson = await storage.getItem('all.json') as RegistryItem | null
      if (allJson) {
        return transformRegistryDependencies(allJson, registryUrl)
      }
    }
    catch (error) {
      console.error('Failed to load registry/all.json:', error)
    }

    // Fallback: return an error
    const errorResponse: RegistryErrorResponse = {
      error: 'all.json not found.',
      suggestions: 'Please rebuild the registry assets.',
    }
    return errorResponse
  }

  // Handle "registry.json" - return the registry index
  if (parsedComponent === 'registry') {
    try {
      const index = await storage.getItem('registry.json') as Registry | null
      if (index) {
        return index
      }
    }
    catch (error) {
      console.error('Failed to load registry/registry.json:', error)
    }

    // Fallback: return a basic registry structure
    const fallback: Registry = {
      name: config.baseName,
      homepage: config.homepage,
      items: [],
    }
    return fallback
  }

  // Search across all registry output subdirectories.
  // The order determines lookup priority — first match wins.
  for (const dir of REGISTRY_SEARCH_DIRS) {
    try {
      const item = await storage.getItem(`${dir}/${parsedComponent}.json`) as RegistryItem | null
      if (item) {
        return transformRegistryDependencies(item, registryUrl)
      }
    }
    catch (error) {
      console.warn(`Failed to load ${dir}/${parsedComponent}.json:`, error)
    }
  }

  // Enhanced error message with suggestions
  console.error(`Component "${parsedComponent}" not found in registry`)
  const errorResponse: RegistryErrorResponse = {
    error: `Component "${parsedComponent}" not found.`,
    suggestions: 'Available endpoints: /all.json, or individual component names (e.g. /message.json)',
  }
  return errorResponse
})
