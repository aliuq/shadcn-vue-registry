# AI Elements Vue

## Overview

[AI Elements Vue](https://ai-elements-vue.com) provides pre-built, customizable Vue components specifically designed for AI applications, including conversations, messages, code blocks, reasoning displays, and more. The CLI makes it easy to add these components to your Vue.js and Nuxt.js project.

## Installation

You can use the AI Elements Vue CLI directly with npx, or install it globally:

```bash
# Use directly (recommended)
npx ai-elements-vue@latest

# Or using shadcn-vue cli
npx shadcn-vue@latest add https://registry.ai-elements-vue.com/all.json
```

## Prerequisites

Before using AI Elements Vue, ensure your project meets these requirements:

- **Node.js** 18 or later
- **Vue.js, Nuxt.js**
- **shadcn-vue** initialized in your project (`npx shadcn-vue@latest init`)
- **Tailwind CSS** configured (AI Elements Vue supports CSS Variables mode only)

## Usage

### Install All Components

Install all available AI Elements Vue components at once:

```bash
npx ai-elements-vue@latest
```

This command will:

- Set up shadcn-vue if not already configured
- Install all AI Elements Vue components to your configured components directory
- Add necessary dependencies to your project

### Install Specific Components

Install individual or multiple components using the `add` command:

```bash
npx ai-elements-vue@latest add <component-name>

# Or install multiple at once:
npx ai-elements-vue@latest add <name1> <name2> ...
```

Examples:

```bash
# Install the message component
npx ai-elements-vue@latest add message

# Install the conversation component
npx ai-elements-vue@latest add conversation

# Install multiple components in one command
npx ai-elements-vue@latest add message conversation
```

### Alternative: Use with shadcn-vue CLI

You can also install components using the standard shadcn-vue CLI:

```bash
# Install all components
npx shadcn-vue@latest add https://registry.ai-elements-vue.com/all.json

# Install a specific component
npx shadcn-vue@latest add https://registry.ai-elements-vue.com/message.json
```

## Acknowledgments

This project draws inspiration from several excellent projects:

- **[shadcn-vue](https://www.shadcn-vue.com)** - UI component foundation
