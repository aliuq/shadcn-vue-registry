# shadcn-vue Registry Template 🔧

**基于 shadcn-vue 的组件/资源分发 Registry 模板**，用于将项目内的组件、hooks、页面、样式等打包成 shadcn-vue 兼容的 registry（/all.json、/registry.json、/<name>.json），方便通过 `shadcn-vue` CLI 一键安装到目标项目。

---

## 🚀 快速开始

- 启动本地 Registry（开发模式，默认端口 3001）：

```bash
# 在仓库根目录
pnpm dev:registry
# 或者直接进入 packages/registry
pnpm --filter registry dev
```

- 使用 shadcn-vue CLI 从本地 Registry 安装：

```bash
# 安装所有（从 all.json）
npx shadcn-vue@latest add http://localhost:3001/all.json

# 安装单个组件（按名称或完整 endpoint）
npx shadcn-vue@latest add hello-world
# 或
npx shadcn-vue@latest add http://localhost:3001/hello-world.json
```

> 提示：根 package.json 已提供便捷脚本 `dev:registry` 与 `build:registry`。

---

## 🔍 Registry API（兼容 shadcn-vue）

- GET /all.json — 将所有可打包的组件合并为一个 RegistryItem（适合一次性安装全部组件）。
- GET /registry.json — Registry 索引（name, homepage, items[]）。
- GET /<component>.json — 返回单个 registry item（例如 `/hello-world.json`）。

JSON 格式遵循 shadcn-vue 的 schema：

- Registry Item schema: <https://shadcn-vue.com/schema/registry-item.json>
- Registry index schema: <https://shadcn-vue.com/schema/registry.json>

这些 schema 说明了字段（name, type, files, dependencies, registryDependencies, cssVars, tailwind 等）的结构与约束。

---

## 🏗 构建与资产生成

- Registry 的 JSON 资产由 `packages/registry/server/utils/registryBuilder.ts` 在 Nitro 构建时生成（通过 `build:before` hook）。生成路径：`packages/registry/server/assets/registry`。
- 生产/发布时请运行：

```bash
pnpm build:registry
# Nitro build 会把 assets 打包到构件中，随后可用静态/服务方式发布。
```

---

## 🧠 架构 & 可扩展性

- 主要逻辑位于 `packages/registry/server/`：
  - `collectors/`：不同类型（component/hook/page/file/style/theme 等）对应的 Collector 实现，负责扫描、提取并构建输出 JSON。
  - `utils/`：`registryBuilder`, `fileScanner`, `dependencyAnalyzer`, `types`, `config`。
  - `routes/`：`/[component].json.ts` 提供对 `/all.json`, `/registry.json`, `/<name>.json` 的支持。
- 元数据映射位于 `packages/elements/meta.json`，用于覆盖或定义 `target` 映射（例如 pages 路径重写）。

扩展流程（添加新类型）：

1. 在 `types.ts` 的 `REGISTRY_TYPE_CONFIGS` 中加入配置。
2. 新建一个 `Collector`（继承 `BaseCollector`）。
3. 在 `collectors/index.ts` 的 `createDefaultCollectors()` 中注册。

更多架构细节参考：`packages/registry/ARCHITECTURE.md`。

---

## ✅ 使用示例与常见场景

- 本地开发：启动 Registry，修改 `packages/elements` 中组件，重新构建（或保存触发构建钩子），通过 CLI 测试安装。
- 发布 Registry：在 CI 中运行 `pnpm build:registry`，把生成的 assets 与 Nitro 服务部署到静态主机或服务器。
- 依赖引用：Registry 支持 `registryDependencies` 字段，既可以引用同一 registry 中的项（name），也支持外部 registry 的完整 URL（http(s)://.../xxx.json）。

---

## 📚 参考

- shadcn-vue 官方站点：<https://www.shadcn-vue.com>
- Registry schema：
  - <https://shadcn-vue.com/schema/registry-item.json>
  - <https://shadcn-vue.com/schema/registry.json>
- 本项目 registry 架构：`packages/registry/ARCHITECTURE.md`

---

## 🤝 贡献

欢迎提交 issue / PR（请遵循仓库的编码风格、测试与 lint 规则）。

---

**作者**：本仓库维护团队
