import type { H3Event } from 'nitro/h3'
import type { Registry, RegistryItem } from 'shadcn-vue/schema'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { defineHandler, readBody, redirect } from 'nitro/h3'
import { useStorage } from 'nitro/storage'
import { z } from 'zod'
import { config, REGISTRY_SEARCH_DIRS } from '../utils/config'

const SERVER_INFO = {
  name: config.baseName,
  version: '1.0.0',
}

const getComponentInputSchema = z.object({
  component: z
    .string()
    .min(1, 'component is required')
    .describe('Component name (e.g. "context")'),
})

type GetComponentInput = z.infer<typeof getComponentInputSchema>

// Data Access Layer
function getRegistryStorage() {
  return useStorage('assets:registry')
}

async function loadRegistryIndex(): Promise<Registry | null> {
  try {
    const storage = getRegistryStorage()
    return await storage.getItem('registry.json') as Registry
  }
  catch (error) {
    console.error('Failed to read registry index', error)
    return null
  }
}

async function listComponentNames(): Promise<string[]> {
  const index = await loadRegistryIndex()
  if (!index?.items) {
    return []
  }

  return index.items
    .filter(item => item.type === 'registry:component')
    .map(item => item.name)
    .sort((a, b) => a.localeCompare(b))
}

async function loadRegistryItem(name: string): Promise<RegistryItem | null> {
  const storage = getRegistryStorage()
  // Normalize and sanitize input
  const normalized = name.replace(/\.json$/i, '')

  // Search across all registry output subdirectories
  for (const dir of REGISTRY_SEARCH_DIRS) {
    try {
      const item = await storage.getItem(`${dir}/${normalized}.json`) as RegistryItem
      if (item) {
        return item
      }
    }
    catch (error) {
      console.error(`Failed to read ${dir}/${normalized}.json`, error)
    }
  }

  return null
}

// Tool Handlers
async function handleListComponents() {
  const componentNames = await listComponentNames()
  const body = componentNames.length
    ? JSON.stringify(componentNames, null, 2)
    : '[]'

  return {
    content: [{ type: 'text' as const, text: body }],
  }
}

async function handleGetComponent(component: string) {
  const registryItem = await loadRegistryItem(component)

  if (!registryItem) {
    return {
      content: [{ type: 'text' as const, text: `Component "${component}" not found.` }],
      isError: true,
    }
  }

  return {
    content: [{ type: 'text' as const, text: JSON.stringify(registryItem, null, 2) }],
  }
}

function createMcpServer() {
  const server = new McpServer(SERVER_INFO)

  server.registerTool(
    `get_${config.baseName}_components`,
    {
      title: `List ${config.baseName} components`,
      description: `Provides a list of all ${config.baseName} components.`,
    },
    async () => handleListComponents(),
  )

  server.registerTool(
    `get_${config.baseName}_component`,
    {
      title: `Get ${config.baseName} component`,
      description: `Provides information about a ${config.baseName} component.`,
      inputSchema: getComponentInputSchema,
    },
    async ({ component }: GetComponentInput) => handleGetComponent(component),
  )

  return server
}

async function readOptionalBody(event: H3Event) {
  const node = event.runtime?.node
  const method = node?.req.method
  if (!method || method === 'GET' || method === 'HEAD') {
    return undefined
  }

  try {
    return await readBody(event)
  }
  catch (error) {
    console.warn('Failed to parse MCP request body, falling back to undefined', error)
    return undefined
  }
}

export default defineHandler(async (event) => {
  const node = event.runtime?.node

  if (node?.req.method === 'GET') {
    const accept = node.req.headers.accept ?? ''
    if (accept.includes('text/html')) {
      return redirect('/all.json')
    }
  }

  const server = createMcpServer()
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  })

  node?.res?.once('close', () => {
    server.close().catch(error => console.error('Failed to close MCP server', error))
    if (typeof transport.close === 'function') {
      transport.close().catch(error => console.error('Failed to close MCP transport', error))
    }
  })

  const body = await readOptionalBody(event)
  await server.connect(transport)
  // @ts-expect-error ignore
  return await transport.handleRequest(node?.req, node?.res, body)
})
