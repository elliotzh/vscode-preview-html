import * as vscode from 'vscode';
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
}

export function deactivate() {}
