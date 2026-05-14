import * as vscode from 'vscode';
import * as path from 'path';

export class HtmlPreviewEditorProvider implements vscode.CustomTextEditorProvider {
	public static readonly viewType = 'previewHtml.preview';

	constructor(private readonly context: vscode.ExtensionContext) {}

	public async resolveCustomTextEditor(
		document: vscode.TextDocument,
		webviewPanel: vscode.WebviewPanel,
		_token: vscode.CancellationToken
	): Promise<void> {
		// If the user has disabled preview-as-default, redirect to the text editor
		const config = vscode.workspace.getConfiguration('previewHtml');
		if (!config.get<boolean>('defaultEditor', true)) {
			setTimeout(() => {
				vscode.commands.executeCommand('vscode.openWith', document.uri, 'default');
			}, 0);
			return;
		}

		const fileDir = vscode.Uri.file(path.dirname(document.uri.fsPath));
		const localResourceRoots = [fileDir];
		if (vscode.workspace.workspaceFolders) {
			for (const folder of vscode.workspace.workspaceFolders) {
				localResourceRoots.push(folder.uri);
			}
		}

		webviewPanel.webview.options = {
			enableScripts: true,
			localResourceRoots,
		};

		// Set the stable shell once — never reload it
		const baseUri = webviewPanel.webview.asWebviewUri(fileDir);
		webviewPanel.webview.html = this.getShellHtml(baseUri.toString());

		// Send initial content via message (after shell loads)
		const sendContent = () => {
			const html = this.prepareContent(document, baseUri.toString());
			webviewPanel.webview.postMessage({ type: 'update', html });
		};

		// Send once the webview signals it's ready
		const readyListener = webviewPanel.webview.onDidReceiveMessage((msg) => {
			if (msg.type === 'ready') {
				sendContent();
			}
		});

		// Live update with 300ms debounce
		let debounceTimer: ReturnType<typeof setTimeout> | undefined;
		const changeSubscription = vscode.workspace.onDidChangeTextDocument((e) => {
			if (e.document.uri.toString() === document.uri.toString()) {
				if (debounceTimer) {
					clearTimeout(debounceTimer);
				}
				debounceTimer = setTimeout(sendContent, 300);
			}
		});

		webviewPanel.onDidDispose(() => {
			readyListener.dispose();
			changeSubscription.dispose();
			if (debounceTimer) {
				clearTimeout(debounceTimer);
			}
		});
	}

	private prepareContent(document: vscode.TextDocument, baseHref: string): string {
		let html = document.getText();
		html = this.injectBase(html, baseHref);
		html = this.injectThemeStyles(html);
		return html;
	}

	private getShellHtml(baseHref: string): string {
		return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<style>
		html, body { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; }
		iframe { border: none; width: 100%; height: 100%; display: block; }
	</style>
</head>
<body>
	<iframe id="preview" sandbox="allow-scripts allow-same-origin allow-popups allow-forms"></iframe>
	<script>
		const vscode = acquireVsCodeApi();
		const iframe = document.getElementById('preview');

		window.addEventListener('message', (event) => {
			const msg = event.data;
			if (msg.type === 'update') {
				iframe.srcdoc = msg.html;
			}
		});

		// Signal we're ready for content
		vscode.postMessage({ type: 'ready' });
	</script>
</body>
</html>`;
	}

	private readonly themeStyle = `<style>
:root {
	color-scheme: light dark;
}
body:not([style*="background"]) {
	background-color: var(--vscode-editor-background, #1e1e1e);
	color: var(--vscode-editor-foreground, #cccccc);
}
</style>`;

	private injectThemeStyles(html: string): string {
		const headCloseIdx = html.search(/<\/head>/i);
		if (headCloseIdx !== -1) {
			return html.slice(0, headCloseIdx) + this.themeStyle + '\n' + html.slice(headCloseIdx);
		}

		const headMatch = html.match(/<head[^>]*>.*?<base[^>]*>/is);
		if (headMatch) {
			const idx = html.indexOf(headMatch[0]) + headMatch[0].length;
			return html.slice(0, idx) + '\n' + this.themeStyle + html.slice(idx);
		}

		return this.themeStyle + '\n' + html;
	}

	private injectBase(html: string, baseHref: string): string {
		const href = baseHref.endsWith('/') ? baseHref : baseHref + '/';

		const headMatch = html.match(/<head[^>]*>/i);
		if (headMatch) {
			const idx = html.indexOf(headMatch[0]) + headMatch[0].length;
			return html.slice(0, idx) + `\n<base href="${href}">` + html.slice(idx);
		}

		const htmlMatch = html.match(/<html[^>]*>/i);
		if (htmlMatch) {
			const idx = html.indexOf(htmlMatch[0]) + htmlMatch[0].length;
			return html.slice(0, idx) + `\n<head><base href="${href}"></head>` + html.slice(idx);
		}

		return `<base href="${href}">\n` + html;
	}
}
