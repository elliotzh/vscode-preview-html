import * as vscode from 'vscode';
import * as path from 'path';
import { HtmlPreviewEditorProvider } from './htmlPreviewEditorProvider';
import { ServerManager } from './staticServer';

export function activate(context: vscode.ExtensionContext) {
	const serverManager = new ServerManager();
	context.subscriptions.push({ dispose: () => serverManager.dispose() });

	const provider = new HtmlPreviewEditorProvider(context, serverManager);

	context.subscriptions.push(
		vscode.window.registerCustomEditorProvider(
			HtmlPreviewEditorProvider.viewType,
			provider,
			{
				webviewOptions: { retainContextWhenHidden: true },
				supportsMultipleEditorsPerDocument: false,
			}
		)
	);

	// Toggle: preview → source
	context.subscriptions.push(
		vscode.commands.registerCommand('previewHtml.openSource', () => {
			const tab = vscode.window.tabGroups.activeTabGroup.activeTab;
			const input = tab?.input;
			if (input && typeof input === 'object' && 'uri' in input) {
				const uri = (input as { uri: vscode.Uri }).uri;
				vscode.commands.executeCommand('vscode.openWith', uri, 'default');
			}
		})
	);

	// Toggle: source → preview
	context.subscriptions.push(
		vscode.commands.registerCommand('previewHtml.openPreview', () => {
			const uri = vscode.window.activeTextEditor?.document.uri;
			if (uri) {
				vscode.commands.executeCommand('vscode.openWith', uri, HtmlPreviewEditorProvider.viewType);
			}
		})
	);

	// Open in browser (Simple Browser or external)
	context.subscriptions.push(
		vscode.commands.registerCommand('previewHtml.openInBrowser', async () => {
			const uri = getActiveHtmlUri();
			if (!uri) { return; }
			const fileDir = path.dirname(uri.fsPath);
			const fileName = path.basename(uri.fsPath);
			const server = await serverManager.getServer(fileDir);
			const url = `${server.baseUrl}${fileName}`;
			vscode.commands.executeCommand('simpleBrowser.api.open', url);
		})
	);

	// Open in external browser
	context.subscriptions.push(
		vscode.commands.registerCommand('previewHtml.openExternal', async () => {
			const uri = getActiveHtmlUri();
			if (!uri) { return; }
			const fileDir = path.dirname(uri.fsPath);
			const fileName = path.basename(uri.fsPath);
			const server = await serverManager.getServer(fileDir);
			const url = `${server.baseUrl}${fileName}`;
			vscode.env.openExternal(vscode.Uri.parse(url));
		})
	);
}

function getActiveHtmlUri(): vscode.Uri | undefined {
	// Try active text editor first
	const textUri = vscode.window.activeTextEditor?.document.uri;
	if (textUri) { return textUri; }
	// Try custom editor tab
	const tab = vscode.window.tabGroups.activeTabGroup.activeTab;
	const input = tab?.input;
	if (input && typeof input === 'object' && 'uri' in input) {
		return (input as { uri: vscode.Uri }).uri;
	}
	return undefined;
}

export function deactivate() {}
