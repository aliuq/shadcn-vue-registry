# shadcn-vue Registry Template

A **registry template for shadcn-vue** that packages your components, hooks, pages, files, styles, and themes into a shadcn-vue–compatible registry (serving `/all.json`, `/registry.json`, and `/<name>.json` endpoints). Use the `shadcn-vue` CLI to install items into your target projects with a single command.

---

## Quick Start

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
npx shadcn-vue@latest add @self/hello-world

# "registries": {
#   "@self": "http://localhost:3001/{name}.json"
# }

# Or by direct URL
npx shadcn-vue@latest add http://localhost:3001/hello-world.json
```

> **Tip**
> The root [package.json](package.json) provides convenience scripts: `dev:registry`, `build:registry`, and `build:registry:vercel`.

---

## Registry API

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

## Create Your Own Registry Items

Follow these steps to add or customize registry items in this template.

```bash
npx degit aliuq/shadcn-vue-registry your-registry
cd your-registry
pnpm install
```

### 1. Add Your Resource

Place your files in the appropriate source directory `packages/elements/src/` based on the type of item you're creating:

| Type | Source Directory | Example |
|------|------------------|---------|
| **Components** | `components/<item-name>/` | `components/hello-world/` |
| **Hooks (Composables)** | `composables/` | `composables/useHelloWorld.ts` |
| **Files** | `files/` | `files/eslint-config-mjs.mjs` |
| **Pages** | `pages/` | `pages/ChatPage.vue` |
| **Styles** | `styles/` | `styles/hello-style.json` (JSON only) |
| **Themes** | `themes/` | `themes/hello-theme.json` (JSON only) |

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

## Build & Deploy

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
- name: Build registry (Nitro Cloudflare Worker)
  run: pnpm build:registry
  env:
    BASE_NAME: self
    HOMEPAGE: https://example.com/all.json
    BASE_URL: https://example.com
    REGISTRY_TITLE: ''
    REGISTRY_DESCRIPTION: ''
```

[deploy-registry-cf](.github/workflows/deploy-registry-cf.yml) is an example workflow that builds the registry and deploys it to Cloudflare Workers using Wrangler.

---

## Testing installation

1. Start dev server: `pnpm dev:registry`
2. Test endpoint: `curl http://localhost:3001/<item>.json`
3. Install in a test project: `npx shadcn-vue@latest add http://localhost:3001/<item>.json`
4. Verify installed files in your test project's components/composables directories.

---

## Reference

- **shadcn-vue Official Site**: <https://www.shadcn-vue.com>
- **Registry Item Schema**: <https://shadcn-vue.com/schema/registry-item.json>
- **Registry Index Schema**: <https://shadcn-vue.com/schema/registry.json>
- **Project Architecture**: [packages/registry/ARCHITECTURE.md](packages/registry/ARCHITECTURE.md)

---

The project architecture is forked from ❤️ [AI Elements Vue](https://github.com/vuepont/ai-elements-vue), with the core construction logic and documentation implemented by `Claude Opus 4.6`.
