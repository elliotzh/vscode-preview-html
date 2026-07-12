import * as vscode from 'vscode';
import * as path from 'path';
import { ServerManager } from './staticServer';
import { minimatch } from './minimatch';

export class HtmlPreviewEditorProvider implements vscode.CustomTextEditorProvider {
	public static readonly viewType = 'previewHtml.preview';

	constructor(
		private readonly context: vscode.ExtensionContext,
		private readonly serverManager: ServerManager,
	) {}

	private isInDiffContext(document: vscode.TextDocument): boolean {
		// Non-file schemes (git:, gitlens:, vscode-scm:, etc.) indicate SCM original versions
		if (document.uri.scheme !== 'file' && document.uri.scheme !== 'untitled') {
			return true;
		}

		// Check if the document is part of any diff tab
		for (const group of vscode.window.tabGroups.all) {
			for (const tab of group.tabs) {
				if (tab.input instanceof vscode.TabInputTextDiff) {
					const { original, modified } = tab.input;
					if (original.toString() === document.uri.toString() ||
						modified.toString() === document.uri.toString()) {
						return true;
					}
				}
			}
		}

		return false;
	}

	public async resolveCustomTextEditor(
		document: vscode.TextDocument,
		webviewPanel: vscode.WebviewPanel,
		_token: vscode.CancellationToken
	): Promise<void> {
		// Disable preview in diff views — it breaks the diff experience
		if (this.isInDiffContext(document)) {
			setTimeout(() => {
				vscode.commands.executeCommand('vscode.openWith', document.uri, 'default');
			}, 0);
			return;
		}

		const config = vscode.workspace.getConfiguration('previewHtml');
		if (!config.get<boolean>('defaultEditor', true)) {
			setTimeout(() => {
				vscode.commands.executeCommand('vscode.openWith', document.uri, 'default');
			}, 0);
			return;
		}

		const relativePath = vscode.workspace.asRelativePath(document.uri, false);

		// ignorePaths takes priority — never auto-preview these
		const ignorePaths = config.get<string[]>('ignorePaths', []);
		if (ignorePaths.length > 0 && ignorePaths.some(p => minimatch(relativePath, p))) {
			setTimeout(() => {
				vscode.commands.executeCommand('vscode.openWith', document.uri, 'default');
			}, 0);
			return;
		}

		// If previewPaths is set, only auto-preview files matching those globs
		const previewPaths = config.get<string[]>('previewPaths', []);
		if (previewPaths.length > 0) {
			if (!previewPaths.some(p => minimatch(relativePath, p))) {
				setTimeout(() => {
					vscode.commands.executeCommand('vscode.openWith', document.uri, 'default');
				}, 0);
				return;
			}
		}

		const fileDir = path.dirname(document.uri.fsPath);

		// Two rendering strategies:
		//  - 'inline': render the document straight into the webview and rewrite local
		//    asset URLs via asWebviewUri. Same-origin, so text selection / copy works.
		//    Best for static/text-heavy pages. No live JS server semantics.
		//  - 'server': serve the directory over http and embed it in an <iframe>. Full
		//    fidelity (fetch, ES modules, dynamic imports) but the nested cross-origin
		//    iframe means VS Code blocks Ctrl+C copy (a platform limitation).
		const mode = config.get<'inline' | 'server'>('renderMode', 'inline');

		if (mode === 'inline') {
			await this.resolveInline(document, webviewPanel, fileDir);
		} else {
			await this.resolveServer(document, webviewPanel, fileDir);
		}
	}

	/** Direct render into the webview — copyable, best for static pages. */
	private async resolveInline(
		document: vscode.TextDocument,
		webviewPanel: vscode.WebviewPanel,
		fileDir: string,
	): Promise<void> {
		const roots = [vscode.Uri.file(fileDir)];
		const wsFolder = vscode.workspace.getWorkspaceFolder(document.uri);
		if (wsFolder) { roots.push(wsFolder.uri); }
		webviewPanel.webview.options = { enableScripts: true, localResourceRoots: roots };

		const render = () => {
			webviewPanel.webview.html = this.buildInlineHtml(document, webviewPanel.webview, fileDir);
		};
		render();

		let debounceTimer: ReturnType<typeof setTimeout> | undefined;
		const changeSubscription = vscode.workspace.onDidChangeTextDocument((e) => {
			if (e.document.uri.toString() === document.uri.toString()) {
				if (debounceTimer) { clearTimeout(debounceTimer); }
				debounceTimer = setTimeout(render, 300);
			}
		});
		webviewPanel.onDidDispose(() => {
			changeSubscription.dispose();
			if (debounceTimer) { clearTimeout(debounceTimer); }
		});
	}

	/** Rewrite local asset references to webview URIs and inject a CSP. */
	private buildInlineHtml(document: vscode.TextDocument, webview: vscode.Webview, fileDir: string): string {
		let html = document.getText();

		const toWebviewUri = (raw: string): string | undefined => {
			const value = raw.trim();
			// Leave remote / inline / anchor references untouched.
			if (
				value === '' ||
				value.startsWith('#') ||
				value.startsWith('//') ||
				/^[a-z][a-z0-9+.-]*:/i.test(value) // http:, https:, data:, blob:, mailto:, etc.
			) {
				return undefined;
			}
			// Strip query/hash — irrelevant for a local file on disk.
			const clean = value.replace(/[?#].*$/, '');
			const resolved = clean.startsWith('/')
				? path.join(fileDir, clean.slice(1)) // root-relative → relative to the file's dir
				: path.resolve(fileDir, clean);
			return webview.asWebviewUri(vscode.Uri.file(resolved)).toString();
		};

		// src="...", href="...", poster="..." on any element.
		html = html.replace(
			/\b(src|href|poster)\s*=\s*("([^"]*)"|'([^']*)')/gi,
			(match, attr, _q, dq, sq) => {
				const rewritten = toWebviewUri(dq !== undefined ? dq : sq);
				return rewritten ? `${attr}="${rewritten}"` : match;
			},
		);

		// url(...) inside <style> blocks and inline style="" attributes.
		html = html.replace(
			/url\(\s*(['"]?)([^'")]+)\1\s*\)/gi,
			(match, _quote, url) => {
				const rewritten = toWebviewUri(url);
				return rewritten ? `url("${rewritten}")` : match;
			},
		);

		const csp = [
			`default-src 'none'`,
			`img-src ${webview.cspSource} https: http: data: blob:`,
			`media-src ${webview.cspSource} https: http: data: blob:`,
			`font-src ${webview.cspSource} https: http: data:`,
			`style-src ${webview.cspSource} 'unsafe-inline' https:`,
			`script-src ${webview.cspSource} 'unsafe-inline' 'unsafe-eval' https:`,
			`connect-src ${webview.cspSource} https: http:`,
			`frame-src https: http:`,
		].join('; ');
		const cspTag = `<meta http-equiv="Content-Security-Policy" content="${csp};">`;

		// Inject the CSP as the first thing in <head> (or synthesize a head).
		if (/<head[^>]*>/i.test(html)) {
			return html.replace(/<head[^>]*>/i, (m) => `${m}\n${cspTag}`);
		}
		if (/<html[^>]*>/i.test(html)) {
			return html.replace(/<html[^>]*>/i, (m) => `${m}<head>${cspTag}</head>`);
		}
		return `${cspTag}\n${html}`;
	}

	/** Serve the directory over http and embed it in an iframe — full fidelity, no copy. */
	private async resolveServer(
		document: vscode.TextDocument,
		webviewPanel: vscode.WebviewPanel,
		fileDir: string,
	): Promise<void> {
		webviewPanel.webview.options = { enableScripts: true };

		const fileName = path.basename(document.uri.fsPath);
		const server = await this.serverManager.getServer(fileDir);
		// Translate the loopback URL into one the webview can actually reach.
		// On remote hosts (Remote-SSH, Tunnels, Codespaces, code-server) the webview
		// renders on the client, so a bare http://127.0.0.1:<port> points at the wrong
		// machine and the iframe comes up blank. asExternalUri forwards the port.
		const baseUrl = (await vscode.env.asExternalUri(vscode.Uri.parse(server.baseUrl))).toString();

		const updateWebview = () => {
			// Point iframe at the local server — all paths resolve naturally
			const bust = Date.now();
			webviewPanel.webview.html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src * 'unsafe-inline' 'unsafe-eval' data: blob:;">
<style>html,body{margin:0;padding:0;width:100%;height:100%;overflow:hidden}iframe{border:none;width:100%;height:100%;display:block}</style>
</head><body>
<iframe src="${baseUrl}${fileName}?_t=${bust}" allow="*"></iframe>
</body></html>`;
		};

		updateWebview();

		let debounceTimer: ReturnType<typeof setTimeout> | undefined;
		const changeSubscription = vscode.workspace.onDidChangeTextDocument((e) => {
			if (e.document.uri.toString() === document.uri.toString()) {
				if (debounceTimer) { clearTimeout(debounceTimer); }
				debounceTimer = setTimeout(updateWebview, 300);
			}
		});

		webviewPanel.onDidDispose(() => {
			changeSubscription.dispose();
			if (debounceTimer) { clearTimeout(debounceTimer); }
			this.serverManager.release(fileDir);
		});
	}
}
