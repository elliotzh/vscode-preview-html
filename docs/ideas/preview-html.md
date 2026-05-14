# Preview HTML — VS Code Extension

## Problem Statement

How might we make viewing AI-generated HTML documents in VS Code as frictionless as reading a rendered page — preview-first, always current, no extra clicks?

## Recommended Direction

**Custom Editor (preview-first) with toggle to source.**

Register a `CustomTextEditorProvider` as the default editor for `.html` files. When a user opens any HTML file, they see the fully rendered preview — not raw markup. A toolbar button in the editor title bar lets them toggle to the standard text editor when they need to inspect or edit source, and toggle back to preview with another click.

This inverts the default paradigm: every other HTML preview extension treats source as primary and requires an explicit action to see the render. For AI-generated documentation and agentic output, the rendered view *is* what you care about. Source is the escape hatch, not the default.

Live updating is debounced on every text change (whether from the user editing in source mode, or an agent writing to the file on disk), so the preview always reflects the current state without manual refresh.

## Key Assumptions to Validate

- [ ] **Custom Editor coexistence** — Users can seamlessly toggle between the custom editor (preview) and the built-in text editor for the same file via `vscode.openWith`. (High confidence — this is a supported API pattern.)
- [ ] **File watcher responsiveness** — When an external process (AI agent, script) writes to the HTML file, the `workspace.onDidChangeTextDocument` or `workspace.fs` watcher fires quickly enough for the preview to feel "live". (Test with rapid multi-save scenarios.)
- [ ] **Relative asset resolution** — Images, CSS, and JS referenced with relative paths resolve correctly via `webview.asWebviewUri()` mapping the file's directory as a local resource root. (Needs testing with nested folder structures.)
- [ ] **Users rarely edit these files** — The toggle overhead (one click to switch to source) is acceptable because the primary use case is *reading* rendered output, not authoring HTML. (Validate with real usage.)

## MVP Scope

### In scope

- **Custom Editor registration** as default for `.html` files (can be changed in user settings)
- **Rendered preview** using a VS Code Webview with full HTML/CSS/JS execution
- **Relative asset support** — resolve `./styles.css`, `./img/logo.png`, etc. relative to the file's location
- **Live update** — debounced re-render on every document change (~300ms debounce)
- **Toggle button** in editor title bar: "Show Source" / "Show Preview" to flip between custom editor and built-in text editor
- **Editor icon** — small preview icon in the editor title area (consistent with how Markdown preview works)
- **Respects VS Code theming** — webview background matches the current theme to avoid jarring white flashes in dark mode
- **Security sandboxing** — webview runs with `localResourceRoots` restricted to the file's workspace folder

### Technical approach

- `CustomTextEditorProvider` with `webviewOptions: { retainContextWhenHidden: true }` for instant re-display
- `vscode.commands.executeCommand('vscode.openWith', uri, 'default')` for toggling to text editor
- Reverse toggle via a contributed command that opens with the custom editor ID
- Register the editor with `priority: "default"` so it wins for `.html` files out of the box
- File change detection via the `TextDocument` provided by the Custom Editor API (handles both local edits and external writes)

## Not Doing (and Why)

- **Embedded Monaco source editor inside the webview** — Adds massive complexity (losing native extensions, keybindings, language services) for marginal gain. The native text editor is one click away and is infinitely better.
- **Local dev server / proxy mode** — Out of scope for v1. This is for static HTML documents, not running apps. Users with dev servers already have HMR.
- **Multi-file dashboard / gallery view** — Cool for later, but the single-file preview is the core value. Ship that first.
- **Visual diff between versions** — Interesting for agentic workflows but adds significant complexity. Can layer on later via a separate command.
- **Markdown or other format support** — VS Code already has a great Markdown preview. Stay focused on the HTML gap.
- **Script execution sandboxing (CSP)** — For v1, allow scripts to run (AI output often includes interactive elements). Revisit if security concerns arise from real usage.
- **Custom CSS injection / user stylesheets** — Not needed for v1. The HTML files are self-contained.

## Open Questions

- Should the extension register as default for *all* `.html` files, or only within specific folders (e.g. `docs/`, `output/`)? A setting like `previewHtml.autoPreviewGlob` could let users scope it.
- Should there be a "pin" behavior where the preview stays even when you switch to another file (like Markdown preview's lock icon)?
- How should we handle HTML files that are clearly application code (e.g. Angular templates, React JSX-in-HTML)? Possibly detect by heuristic or let the user override per-file.
- Should the extension contribute a "Preview HTML" command to the command palette for users who change the default back to the text editor but occasionally want the preview?
