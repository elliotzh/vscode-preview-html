# Implementation Plan: Preview HTML Extension

## Overview

Build a VS Code extension that registers a Custom Editor as the default viewer for `.html` files. Users see rendered HTML on open (preview-first), with a toolbar button to toggle to the standard text editor. The preview live-updates on every document change with debouncing.

## Architecture Decisions

- **Custom Text Editor API** over Webview Panel — gives us default-editor registration, proper tab lifecycle, and native toggle support via `vscode.openWith`
- **TypeScript + esbuild** — standard VS Code extension toolchain, fast bundling
- **No local server** — render HTML directly in the webview, rewrite asset paths with `webview.asWebviewUri()` instead of serving files over HTTP
- **Retain webview context** — use `retainContextWhenHidden: true` to avoid re-renders when the tab loses focus

## Task List

### Phase 1: Project Scaffold

#### Task 1: Initialize extension project

**Description:** Set up the VS Code extension project with TypeScript, esbuild bundler, and the standard extension structure. Include a working "hello world" activation to verify the scaffold works.

**Acceptance criteria:**
- [ ] `package.json` has extension manifest with `engines.vscode` targeting latest stable
- [ ] TypeScript compiles without errors
- [ ] Extension activates and can run a test command from the command palette
- [ ] `.vscodeignore` and esbuild config produce a bundled `.vsix`

**Verification:**
- [ ] `npm run compile` succeeds
- [ ] Extension loads in Extension Development Host without errors
- [ ] `F5` → command palette → test command executes

**Dependencies:** None

**Files likely touched:**
- `package.json`
- `tsconfig.json`
- `esbuild.config.mjs`
- `src/extension.ts`
- `.vscodeignore`
- `.gitignore`

**Estimated scope:** Small

---

#### Task 2: Register Custom Editor provider

**Description:** Implement a `CustomTextEditorProvider` that registers for `*.html` files with default priority. On resolve, it should render a minimal "Hello from Preview HTML" message in the webview to prove the registration works.

**Acceptance criteria:**
- [ ] Opening a `.html` file shows the custom editor (not the text editor) by default
- [ ] The webview displays a placeholder message
- [ ] `package.json` contributes `customEditors` with `viewType` and file selector for `*.html`
- [ ] The provider is registered in `extension.ts` activation

**Verification:**
- [ ] Open any `.html` file in Extension Development Host → see the placeholder webview
- [ ] Right-click the tab → "Reopen Editor With..." shows both the custom editor and the default text editor as options

**Dependencies:** Task 1

**Files likely touched:**
- `package.json` (contributes.customEditors)
- `src/extension.ts`
- `src/htmlPreviewEditorProvider.ts`

**Estimated scope:** Small

---

### Phase 2: Core Preview

#### Task 3: Render HTML content in webview

**Description:** Read the `TextDocument` content and render it inside the webview. The HTML file's content becomes the webview's HTML body. Handle the basic case of a self-contained HTML file with no external assets.

**Acceptance criteria:**
- [ ] Opening an HTML file shows its rendered content (headings, paragraphs, inline styles)
- [ ] The webview displays the full document (not just `<body>` — respects `<head>`, `<style>`, etc.)
- [ ] Inline `<script>` tags execute (webview scripts enabled)

**Verification:**
- [ ] Create a test HTML file with headings, styled text, and an inline script that modifies the DOM
- [ ] Open it → content renders correctly, script runs

**Dependencies:** Task 2

**Files likely touched:**
- `src/htmlPreviewEditorProvider.ts`

**Estimated scope:** Small

---

#### Task 4: Resolve relative assets

**Description:** Rewrite relative paths in the HTML (images, CSS `<link>`, JS `<script src>`) to use `webview.asWebviewUri()` so they load correctly from disk. Set `localResourceRoots` to the file's directory and workspace folders.

**Acceptance criteria:**
- [ ] Relative `<img src="./image.png">` displays the image
- [ ] Relative `<link href="./style.css">` applies styles
- [ ] Relative `<script src="./app.js">` executes
- [ ] Nested paths (`../assets/img.png`) resolve correctly
- [ ] `localResourceRoots` is set to the file's parent directory and all workspace folders

**Verification:**
- [ ] Create an HTML file referencing a sibling CSS file and image → both load in the preview
- [ ] Create an HTML file referencing a parent-directory asset → loads correctly

**Dependencies:** Task 3

**Files likely touched:**
- `src/htmlPreviewEditorProvider.ts`
- `src/assetResolver.ts` (new utility)

**Estimated scope:** Medium

---

#### Task 5: Live update on document change

**Description:** Listen to `workspace.onDidChangeTextDocument` for the associated document and re-render the webview content with a 300ms debounce. This covers both user edits (when toggled to source) and external process writes (AI agents).

**Acceptance criteria:**
- [ ] Editing the file in a separate text editor tab updates the preview within ~300ms
- [ ] Rapid changes don't cause excessive re-renders (debounce works)
- [ ] External file writes (e.g., from a terminal `echo "..." > file.html`) trigger an update
- [ ] Scroll position is preserved across updates (or reset to top — decide and implement consistently)

**Verification:**
- [ ] Open HTML in preview → open same file with "Reopen Editor With → Text Editor" in a split → edit text → preview updates
- [ ] Run `echo "<h1>Updated</h1>" > test.html` in terminal → preview reflects change

**Dependencies:** Task 3

**Files likely touched:**
- `src/htmlPreviewEditorProvider.ts`
- `src/debounce.ts` (small utility)

**Estimated scope:** Small

---

### Checkpoint: Core Preview
- [ ] Opening any `.html` file shows rendered preview by default
- [ ] Relative assets (CSS, JS, images) load correctly
- [ ] Editing the file externally updates the preview live
- [ ] Extension builds and loads without errors

---

### Phase 3: Toggle & UX

#### Task 6: Toggle button — preview to source

**Description:** Add an editor title bar button (icon) that switches from the custom editor (preview) to the default text editor for the same file. Use `vscode.openWith(uri, 'default')`.

**Acceptance criteria:**
- [ ] A "Open Source" icon button appears in the editor title bar when the custom editor is active
- [ ] Clicking it opens the file in the standard text editor (same editor group)
- [ ] The button uses an appropriate codicon (e.g., `code` or `go-to-file`)

**Verification:**
- [ ] Open HTML file → see preview → click button → see source code in text editor

**Dependencies:** Task 2

**Files likely touched:**
- `package.json` (contributes.commands, contributes.menus → editor/title)
- `src/extension.ts`

**Estimated scope:** Small

---

#### Task 7: Toggle button — source to preview

**Description:** Add an editor title bar button that appears when viewing an HTML file in the standard text editor, allowing the user to switch back to the preview custom editor.

**Acceptance criteria:**
- [ ] A "Open Preview" icon button appears in the editor title bar when an `.html` file is open in the text editor
- [ ] Clicking it opens the file in the custom preview editor
- [ ] The button uses an appropriate codicon (e.g., `preview` or `open-preview`)
- [ ] The button only appears for `.html` files (uses `when` clause: `resourceLangId == html`)

**Verification:**
- [ ] Open HTML in text editor → click preview button → see rendered preview

**Dependencies:** Task 6

**Files likely touched:**
- `package.json` (contributes.commands, contributes.menus)
- `src/extension.ts`

**Estimated scope:** Small

---

#### Task 8: Theme-aware webview background

**Description:** Set the webview's background color to match the current VS Code theme so there's no white flash in dark mode. Inject a minimal style block that sets `background-color` and `color` based on VS Code's CSS variables.

**Acceptance criteria:**
- [ ] In dark theme, the preview has a dark background (not white) before HTML content loads
- [ ] If the HTML file doesn't set its own background, it inherits the theme-appropriate color
- [ ] Theme changes (user switches theme) are reflected on next render

**Verification:**
- [ ] Switch to dark theme → open an HTML file without explicit background → no white flash
- [ ] Open a minimal `<p>Hello</p>` HTML → text is readable in both dark and light themes

**Dependencies:** Task 3

**Files likely touched:**
- `src/htmlPreviewEditorProvider.ts`

**Estimated scope:** Small

---

### Checkpoint: Toggle & UX
- [ ] Toggle between preview and source works bidirectionally
- [ ] Buttons appear in the correct context with correct icons
- [ ] Dark/light theme handled gracefully
- [ ] Full user flow works: open HTML → see preview → toggle to source → edit → toggle back → see updated preview

---

### Phase 4: Polish & Publish

#### Task 9: Extension icon, metadata, and README

**Description:** Add a marketplace icon, write a concise README with screenshots/GIF, fill in `package.json` metadata (description, categories, keywords, repository), and configure the extension's display name.

**Acceptance criteria:**
- [ ] `package.json` has: `displayName`, `description`, `categories`, `keywords`, `icon`, `repository`
- [ ] README explains the extension with a usage GIF or screenshots
- [ ] Extension icon is present (128x128 PNG)

**Verification:**
- [ ] `vsce package` produces a `.vsix` without warnings about missing metadata
- [ ] README renders correctly on GitHub

**Dependencies:** Task 7

**Files likely touched:**
- `package.json`
- `README.md`
- `images/icon.png`

**Estimated scope:** Small

---

#### Task 10: Configuration setting for default editor priority

**Description:** Add a setting `previewHtml.defaultEditor` (boolean, default `true`) that controls whether the extension registers as the default editor for `.html` files. When `false`, the extension is available via "Reopen With" but doesn't override the text editor.

**Acceptance criteria:**
- [ ] Setting exists in extension settings UI
- [ ] When set to `false`, opening `.html` files uses the standard text editor by default
- [ ] The "Open Preview" button still works regardless of this setting
- [ ] Setting change takes effect on next file open (no reload required)

**Verification:**
- [ ] Set `previewHtml.defaultEditor: false` → open HTML file → see source → click preview button → see preview
- [ ] Set back to `true` → open HTML file → see preview by default

**Dependencies:** Task 7

**Files likely touched:**
- `package.json` (contributes.configuration)
- `src/htmlPreviewEditorProvider.ts`
- `src/extension.ts`

**Estimated scope:** Small

---

#### Task 11: End-to-end testing

**Description:** Write integration tests using VS Code's test framework (`@vscode/test-electron`) that verify the core flows: custom editor opens, content renders, toggle works, live update fires.

**Acceptance criteria:**
- [ ] Test: opening an HTML file activates the custom editor
- [ ] Test: toggle command switches to text editor
- [ ] Test: modifying document content triggers webview update
- [ ] Tests run in CI-compatible headless mode

**Verification:**
- [ ] `npm test` passes all integration tests
- [ ] Tests can run in a GitHub Actions workflow

**Dependencies:** Tasks 5, 7

**Files likely touched:**
- `src/test/suite/extension.test.ts`
- `src/test/suite/index.ts`
- `src/test/runTest.ts`
- `src/test/fixtures/test.html`
- `package.json` (test script)

**Estimated scope:** Medium

---

### Checkpoint: Complete
- [ ] All acceptance criteria met across all tasks
- [ ] `vsce package` produces a clean `.vsix`
- [ ] Tests pass
- [ ] README is clear and complete
- [ ] Ready for marketplace publish

---

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Custom Editor API quirks with undo/redo (we don't own edits) | Low | We're read-only in the webview — edits happen in the text editor. No undo/redo needed in preview. |
| Relative asset rewriting misses edge cases (data URIs, absolute URLs, protocol-relative) | Medium | Only rewrite paths that are clearly relative (start with `./` or `../` or are bare filenames). Leave absolute URLs untouched. |
| Large HTML files cause slow re-renders | Medium | Debounce at 300ms. If still slow, consider incremental DOM patching in a future version. |
| Users are confused by HTML files not opening in text editor | Medium | Clear README, first-run notification, and a setting to disable default-editor behavior. |
| Scripts in HTML files pose security risk | Low | Webview is sandboxed by VS Code. `localResourceRoots` restricts file access. Acceptable for v1 since target users are viewing their own/AI-generated content. |

## Open Questions

- Should the extension show a first-run welcome notification explaining the preview-first behavior?
- Should `retainContextWhenHidden` be configurable? It uses more memory but gives instant tab switching.
- Should the preview support `<base href>` for more complex asset resolution scenarios?
