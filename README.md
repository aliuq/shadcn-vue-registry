# shadcn-vue Registry Template

A **registry template for shadcn-vue** that packages your components, hooks, pages, files, styles, and themes into a shadcn-vue–compatible registry (serving `/all.json`, `/registry.json`, and `/<name>.json` endpoints). Use the `shadcn-vue` CLI to install items into your target projects with a single command.

---

## 🚀 Quick Start

### Start the local registry (dev mode, default port 3001)

```bash
# From the repository root
pnpm dev:registry

# Or directly in packages/registry
pnpm --filter registry dev
```

The registry is now running at `http://localhost:3001`.

### Install items via shadcn-vue CLI

```bash
# Install all items (from all.json)
npx shadcn-vue@latest add http://localhost:3001/all.json

# Install a single item by name (if configured in your components.json)
npx shadcn-vue@latest add hello-world

# Or by direct URL
npx shadcn-vue@latest add http://localhost:3001/hello-world.json
```

> **Tip**: The root [package.json](package.json) provides convenience scripts: `dev:registry`, `build:registry`, and `build:registry:vercel`.

---

## 🔍 Registry API (shadcn-vue compatible)

| Endpoint | Description |
|----------|-------------|
| `GET /all.json` | Merges all packaged items into a single `RegistryItem` (suitable for one-shot install of all components). |
| `GET /registry.json` | Registry index metadata (`name`, `homepage`, `items[]` list). |
| `GET /<component>.json` | Returns a single registry item (e.g., `/hello-world.json`). |

The JSON format follows shadcn-vue's official schemas:

- **Registry Item schema**: <https://shadcn-vue.com/schema/registry-item.json>
- **Registry index schema**: <https://shadcn-vue.com/schema/registry.json>

These schemas define the structure and constraints for fields like `name`, `type`, `files`, `dependencies`, `registryDependencies`, `cssVars`, `tailwind`, etc.

---

## 🛠 How It Works

### Core Architecture

The registry is powered by **Nitro** (a framework for server and static deployments) and a set of **collectors** that scan your source files and generate JSON assets.

| Component | Location | Purpose |
|-----------|----------|---------|
| **Registry Builder** | [packages/registry/server/utils/registryBuilder.ts](packages/registry/server/utils/registryBuilder.ts) | Orchestrates all collectors and writes JSON assets to `server/assets/registry/`. |
| **Collectors** | [packages/registry/server/collectors/](packages/registry/server/collectors/) | Scan `packages/elements/src/` for components, hooks, pages, files, styles, and themes. Each collector implements logic for a specific registry type. |
| **File Scanner** | [packages/registry/server/utils/fileScanner.ts](packages/registry/server/utils/fileScanner.ts) | Walks directories, extracts source code, and filters by file extension. |
| **Dependency Analyzer** | [packages/registry/server/utils/dependencyAnalyzer.ts](packages/registry/server/utils/dependencyAnalyzer.ts) | Parses imports from source code to infer `dependencies`, `devDependencies`, and `registryDependencies`. |
| **Routes** | [packages/registry/server/routes/\[component\].json.ts](packages/registry/server/routes/[component].json.ts) | Serves the JSON endpoints and transforms `registryDependencies` into URLs or names for CLI consumption. |
| **Build Hook** | [packages/registry/server/hooks/index.ts](packages/registry/server/hooks/index.ts) | Registers a Nitro `build:before` hook that calls `generateRegistryAssets()`, so `pnpm build:registry` produces packaged JSON assets. |

### Asset Generation

- **Development**: Assets are generated on demand when the Nitro dev server starts.
- **Production**: Running `pnpm build:registry` (or `nitro build`) triggers the `build:before` hook, which writes all registry JSON files to [packages/registry/server/assets/registry/](packages/registry/server/assets/registry/).

---

## 📦 Create Your Own Registry Items

Follow these steps to add or customize registry items in this template.

### 1. Add Your Resource

Place your files in the appropriate source directory:

| Type | Source Directory | Example |
|------|------------------|---------|
| **Components** | `packages/elements/src/components/<item-name>/` | `packages/elements/src/components/hello-world/` |
| **Hooks (Composables)** | `packages/elements/src/composables/` | `packages/elements/src/composables/useHelloWorld.ts` |
| **Files** | `packages/elements/src/files/` | `packages/elements/src/files/eslint-config-mjs.mjs` |
| **Pages** | `packages/elements/src/pages/` | `packages/elements/src/pages/ChatPage.vue` |
| **Styles** | `packages/elements/src/styles/` | `packages/elements/src/styles/hello-style.json` (JSON only) |
| **Themes** | `packages/elements/src/themes/` | `packages/elements/src/themes/hello-theme.json` (JSON only) |

### 2. Configure Target Mappings (if needed)

For `registry:file` and `registry:page` types, a `target` field is **required** on each file entry to specify the install destination path in the target project.

You can define target mappings in [packages/elements/meta.json](packages/elements/meta.json):

```json
{
  "targets": {
    "pages/ChatPage.vue": "pages/chat/index.vue",
    "files/eslint-config-mjs.mjs": "eslint.config.mjs"
  }
}
```

- **Key**: Source path relative to `packages/elements/src/`.
- **Value**: Install target path (where the file will be written in the target project).

If no mapping is provided, collectors will attempt to infer a sensible target based on the file path.

### 3. Test Locally

1. Start the dev server:
   ```bash
   pnpm dev:registry
   ```

2. Verify the endpoint:
   ```bash
   curl http://localhost:3001/hello-world.json
   ```

3. Install via CLI to test in a real project:
   ```bash
   npx shadcn-vue@latest add http://localhost:3001/hello-world.json
   ```

### 4. Build for Production

1. Set environment variables (optional but recommended):
   ```bash
   export BASE_URL="https://registry.example.com"
   export BASE_NAME="my-registry"
   export HOMEPAGE="https://example.com"
   ```

2. Run the build:
   ```bash
   pnpm build:registry
   # or for Vercel deployment
   pnpm build:registry:vercel
   ```

3. The generated assets are in [packages/registry/server/assets/registry/](packages/registry/server/assets/registry/).

---

## 🚢 Build & Deploy

### Environment Variables

Configure these in your CI or hosting environment:

| Variable | Default | Description |
|----------|---------|-------------|
| `BASE_URL` | `http://localhost:3001` | Public URL of your registry (used to generate `registryDependencies` URLs). |
| `BASE_NAME` | `self` | Internal registry identifier. |
| `HOMEPAGE` | `https://example.com` | Homepage URL shown in `registry.json`. |
| `REGISTRY_TITLE` | `All Elements` | Title for the combined `all.json` item. |
| `REGISTRY_DESCRIPTION` | `A collection of all elements.` | Description for `all.json`. |

> See [packages/registry/server/utils/config.ts](packages/registry/server/utils/config.ts) for implementation details.

### Simple CI Steps

**Minimal CI workflow** (e.g., GitHub Actions):

```yaml
- name: Install dependencies
  run: pnpm install

- name: Set registry environment variables
  run: |
    echo "BASE_URL=https://registry.example.com" >> $GITHUB_ENV
    echo "BASE_NAME=my-registry" >> $GITHUB_ENV

- name: Build registry
  run: pnpm build:registry

- name: Deploy (example: upload artifacts or deploy Nitro)
  # Option 1: Deploy the full Nitro app (server + assets)
  # Option 2: Publish only the `server/assets/registry` folder to a CDN
```

### Deployment Options

1. **Deploy the full Nitro app** (includes server routes):
   - Deploy the built Nitro app (e.g., to Vercel, Netlify, or a Node.js server).
   - The app will serve the registry endpoints dynamically.

2. **Static hosting** (CDN):
   - Extract `packages/registry/server/assets/registry/` and publish to a CDN.
   - Configure your shadcn-vue CLI to point to the CDN URLs.

---

## 🔗 Dependencies & registryDependencies

### Automatic Dependency Inference

The **Dependency Analyzer** parses import statements in your source files to automatically populate:

- `dependencies`: NPM packages imported from `node_modules`.
- `devDependencies`: Dev-only packages (e.g., `@types/*`).
- `registryDependencies`: References to other registry items.

### Registry Dependency Resolution

The analyzer recognizes these import patterns:

| Import Pattern | Resolved To |
|----------------|-------------|
| `@/components/ui/<slug>` | Simple name `<slug>` (e.g., `button`) |
| `@/components/<base>/<slug>` | Full URL `${BASE_URL}/<slug>.json` |
| `@/composables/<slug>` | Full URL `${BASE_URL}/<slug>.json` (for hooks) |

When serving via routes, `registryDependencies` are transformed into:

- **Simple names** (e.g., `button`) if the item exists in the same registry.
- **Full URLs** (e.g., `https://registry.example.com/button.json`) if `BASE_URL` is set.

You can also manually specify `registryDependencies` in JSON-based items (styles/themes).

---

## 🧪 Example Walkthrough: `hello-world` Component

### Source Files

```
packages/elements/src/components/hello-world/
├── HelloWorld.vue
└── index.ts
```

**HelloWorld.vue**:

```vue
<script setup lang="ts">
import { Button } from '@/components/ui/button'
</script>

<template>
  <div>
    <h1>Hello World</h1>
    <Button>Click me</Button>
  </div>
</template>
```

### Generated Registry JSON

**packages/registry/server/assets/registry/components/hello-world.json**:

```json
{
  "name": "hello-world",
  "type": "registry:component",
  "files": [
    {
      "path": "components/hello-world/HelloWorld.vue",
      "content": "...",
      "type": "registry:component"
    },
    {
      "path": "components/hello-world/index.ts",
      "content": "...",
      "type": "registry:component"
    }
  ],
  "dependencies": [],
  "devDependencies": [],
  "registryDependencies": ["button"]
}
```

### Install in Target Project

```bash
npx shadcn-vue@latest add http://localhost:3001/hello-world.json
```

The CLI will:

1. Download `hello-world.json`.
2. Resolve `registryDependencies` (e.g., install `button` first).
3. Write files to `components/hello-world/` in your project.

---

## 🐛 Troubleshooting

### Item not found

- **Check generated assets**: Look in [packages/registry/server/assets/registry/](packages/registry/server/assets/registry/) for the expected JSON file.
- **Rebuild**: Run `pnpm build:registry` to regenerate assets.

### Schema validation errors

- Collectors validate items using `validateRegistryItem()` from [packages/registry/server/collectors/baseCollector.ts](packages/registry/server/collectors/baseCollector.ts).
- Check build logs for validation warnings or errors.

### Missing `target` field

- For `registry:file` and `registry:page` types, ensure you've added a mapping in [packages/elements/meta.json](packages/elements/meta.json).

### Dependency resolution issues

- Verify import paths match the expected patterns (see [Dependencies & registryDependencies](#-dependencies--registrydependencies)).
- Check [packages/registry/server/utils/dependencyAnalyzer.ts](packages/registry/server/utils/dependencyAnalyzer.ts) for resolution logic.

### Testing installation

1. Start dev server: `pnpm dev:registry`
2. Test endpoint: `curl http://localhost:3001/<item>.json`
3. Install in a test project: `npx shadcn-vue@latest add http://localhost:3001/<item>.json`
4. Verify installed files in your test project's components/composables directories.

---

## 📚 Reference

### Key Files & Directories

| Path | Description |
|------|-------------|
| [packages/registry/server/utils/registryBuilder.ts](packages/registry/server/utils/registryBuilder.ts) | Main orchestrator for generating registry assets. |
| [packages/registry/server/collectors/](packages/registry/server/collectors/) | Type-specific collectors (component, hook, file, page, style, theme). |
| [packages/registry/server/utils/fileScanner.ts](packages/registry/server/utils/fileScanner.ts) | File traversal and source extraction. |
| [packages/registry/server/utils/dependencyAnalyzer.ts](packages/registry/server/utils/dependencyAnalyzer.ts) | Import parsing and dependency inference. |
| [packages/registry/server/utils/types.ts](packages/registry/server/utils/types.ts) | Type definitions and `REGISTRY_TYPE_CONFIGS`. |
| [packages/registry/server/utils/config.ts](packages/registry/server/utils/config.ts) | Environment variable configuration. |
| [packages/registry/server/routes/\[component\].json.ts](packages/registry/server/routes/[component].json.ts) | Route handlers for JSON endpoints. |
| [packages/registry/server/hooks/index.ts](packages/registry/server/hooks/index.ts) | Nitro build hooks. |
| [packages/elements/meta.json](packages/elements/meta.json) | Target path mappings. |
| [packages/registry/server/assets/registry/](packages/registry/server/assets/registry/) | Generated JSON assets (output directory). |

### External Resources

- **shadcn-vue Official Site**: <https://www.shadcn-vue.com>
- **Registry Item Schema**: <https://shadcn-vue.com/schema/registry-item.json>
- **Registry Index Schema**: <https://shadcn-vue.com/schema/registry.json>
- **Project Architecture**: [packages/registry/ARCHITECTURE.md](packages/registry/ARCHITECTURE.md)

### Extending the Registry

To add support for a new registry type:

1. **Define the type** in [packages/registry/server/utils/types.ts](packages/registry/server/utils/types.ts) by adding to `REGISTRY_TYPE_CONFIGS`.
2. **Create a collector** by extending `BaseCollector` from [packages/registry/server/collectors/baseCollector.ts](packages/registry/server/collectors/baseCollector.ts).
3. **Register the collector** in [packages/registry/server/collectors/index.ts](packages/registry/server/collectors/index.ts) within `createDefaultCollectors()`.

See existing collectors for implementation examples.

---

## 🤝 Contributing

Contributions are welcome! Please:

- Follow the repository's coding style and linting rules.
- Run `pnpm lint` before submitting.
- Add tests for new features (if applicable).
- Submit issues or pull requests on GitHub.

---

**Maintained by**: The repository maintainers
