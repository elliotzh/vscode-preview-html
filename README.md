# Preview HTML

**Preview-first HTML viewer for VS Code.** Opens `.html` files as rendered pages by default — no extra clicks, no side panels. One-click toggle to source when you need it.

## Features

- **Preview by default** — Opening any `.html` file shows the rendered page, not raw markup
- **Live update** — Edits (from you or an AI agent) reflect in the preview within 300ms
- **Relative assets** — Images, CSS, and JS with relative paths load correctly
- **Toggle to source** — Click the `<>` icon in the editor title bar to switch to the text editor
- **Toggle back** — Click the preview icon to return to the rendered view
- **Theme-aware** — Matches your VS Code dark/light theme to avoid white flashes

## Usage

1. Install the extension
2. Open any `.html` file — you'll see the rendered preview
3. Click `<>` in the editor title bar to view/edit source
4. Click the preview icon to switch back

## Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `previewHtml.defaultEditor` | `true` | When `true`, the preview opens by default for `.html` files. Set to `false` to use the text editor by default (preview still available via "Reopen With"). |

## Requirements

- VS Code 1.96.0 or later

## Extension Settings

This extension contributes the following settings:

* `previewHtml.defaultEditor`: Enable/disable preview as the default editor for HTML files.
