# Preview HTML

Open HTML files as rendered pages. Instantly.

No side panels. No browser tabs. No build step. Just open the file and see the result.

## Why?

VS Code treats HTML like any other text file. That makes sense for coding, but when you're reviewing a build artifact, checking documentation, or iterating on a static page, you don't want to stare at angle brackets.

Preview HTML makes the rendered view the default. Source is one click away when you need it.

## How it works

A lightweight static file server starts on `127.0.0.1` when the extension activates. Each HTML file is served from its own directory — relative paths, absolute paths, SVG refs, ES module imports, fonts — everything resolves naturally, exactly like a browser would.

No path rewriting. No injected scripts. No mangled content.

## Features

- **Instant preview** — HTML files render on open, no extra steps
- **Live reload** — edits reflect in ~300ms (works great with AI-assisted coding)
- **Full asset support** — CSS, JS, images, fonts, SVGs with `<use>`, dynamic imports — all work
- **Toggle** — `<>` button in the title bar flips to source; preview icon flips back
- **Configurable scope** — preview everything, or only files in specific paths (glob patterns)
- **Zero dependencies** — built on Node's `http` module, 9KB bundled

## Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `previewHtml.defaultEditor` | `true` | Preview HTML files on open. Set `false` to default to source. |
| `previewHtml.previewPaths` | `[]` | Glob patterns restricting which files auto-preview (e.g. `**/docs/**`). Empty = all files. |
| `previewHtml.ignorePaths` | `[]` | Glob patterns that should never auto-preview. Takes priority over `previewPaths`. |

## Quick start

1. Install from the [Marketplace](https://marketplace.visualstudio.com/items?itemName=Arcmantle.vscode-preview-html)
2. Open any `.html` file
3. Done

To restrict previewing to specific folders:

```json
{
  "previewHtml.previewPaths": ["**/docs/**", "**/dist/**"]
}
```

To block preview on certain paths:

```json
{
  "previewHtml.ignorePaths": ["**/node_modules/**", "**/coverage/**"]
}
```

## Requirements

VS Code 1.96+
