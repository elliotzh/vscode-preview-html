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

	public async resolveCustomTextEditor(
		document: vscode.TextDocument,
		webviewPanel: vscode.WebviewPanel,
		_token: vscode.CancellationToken
	): Promise<void> {
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

		webviewPanel.webview.options = { enableScripts: true };

		const fileDir = path.dirname(document.uri.fsPath);
		const fileName = path.basename(document.uri.fsPath);
		const server = await this.serverManager.getServer(fileDir);
		const baseUrl = server.baseUrl;

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
