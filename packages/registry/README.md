# Registry Package

This package contains the Nitro-based registry server that generates and serves shadcn-vue–compatible registry JSON endpoints.

## Quick Commands

```bash
# Development (starts server on port 3001)
pnpm dev

# Production build (default)
pnpm build

# Production build (Vercel preset)
pnpm build:vercel
```

> **Note**: From the repository root, use `pnpm dev:registry` or `pnpm build:registry` instead.

## What Gets Generated

When you run `pnpm dev` or `pnpm build`, the registry builder scans [packages/elements/src/](../elements/src/) and generates JSON assets in:

```
packages/registry/server/assets/registry/
├── components/
│   ├── hello-world.json
│   └── ...
├── hooks/
├── pages/
├── files/
├── styles/
├── themes/
├── all.json
└── registry.json
```

### Build Hook

The [server/hooks/index.ts](server/hooks/index.ts) registers a Nitro `build:before` hook that calls `generateRegistryAssets()` from [server/utils/registryBuilder.ts](server/utils/registryBuilder.ts).

## Configuration

Environment variables (see [server/utils/config.ts](server/utils/config.ts)):

| Variable | Default | Description |
|----------|---------|-------------|
| `BASE_URL` | `http://localhost:3001` | Public registry URL (used in `registryDependencies`). |
| `BASE_NAME` | `self` | Internal registry identifier. |
| `HOMEPAGE` | `https://example.com` | Homepage URL for `registry.json`. |
| `REGISTRY_TITLE` | `All Elements` | Title for `all.json`. |
| `REGISTRY_DESCRIPTION` | `A collection of all elements.` | Description for `all.json`. |

## Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /all.json` | All items merged into one registry item. |
| `GET /registry.json` | Registry index with metadata. |
| `GET /<name>.json` | Single registry item (e.g., `/hello-world.json`). |

## Architecture

| Component | Location | Purpose |
|-----------|----------|---------|
| **Registry Builder** | [server/utils/registryBuilder.ts](server/utils/registryBuilder.ts) | Orchestrates collectors and writes JSON assets. |
| **Collectors** | [server/collectors/](server/collectors/) | Scan source directories for components, hooks, pages, etc. |
| **File Scanner** | [server/utils/fileScanner.ts](server/utils/fileScanner.ts) | Walks directories and extracts source code. |
| **Dependency Analyzer** | [server/utils/dependencyAnalyzer.ts](server/utils/dependencyAnalyzer.ts) | Parses imports to infer dependencies. |
| **Routes** | [server/routes/\[component\].json.ts](server/routes/[component].json.ts) | Serves JSON endpoints. |
| **Types** | [server/utils/types.ts](server/utils/types.ts) | Type definitions and `REGISTRY_TYPE_CONFIGS`. |

## Adding a New Item

1. Add your component/hook/file/page to [packages/elements/src/](../elements/src/).
2. For `registry:file` or `registry:page` types, add a target mapping to [packages/elements/meta.json](../elements/meta.json).
3. Run `pnpm dev` to regenerate assets.
4. Verify at `http://localhost:3001/<name>.json`.

## Testing

```bash
# Start dev server
pnpm dev

# In another terminal, test the endpoint
curl http://localhost:3001/hello-world.json

# Install via shadcn-vue CLI
npx shadcn-vue@latest add http://localhost:3001/hello-world.json
```

## Deployment

### Option 1: Deploy Nitro App

Deploy the built Nitro app to Vercel, Netlify, or a Node.js server:

```bash
# Build for Vercel
pnpm build:vercel

# Or generic build
pnpm build
```

### Option 2: Static Hosting

Extract `server/assets/registry/` and publish to a CDN. Configure your shadcn-vue CLI to point to the CDN URLs.

## More Information

See the main [README.md](../../README.md) for detailed usage, examples, and troubleshooting.
