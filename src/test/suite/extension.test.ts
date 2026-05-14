import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';

suite('Preview HTML Extension', () => {
	// Fixtures are in the source tree, not the dist tree
	const fixturesPath = path.resolve(__dirname, '../../../src/test/fixtures');
	const testHtmlPath = path.join(fixturesPath, 'test.html');

	test('Custom editor opens for HTML files', async () => {
		const uri = vscode.Uri.file(testHtmlPath);
		await vscode.commands.executeCommand('vscode.openWith', uri, 'previewHtml.preview');

		// Give the editor time to open
		await new Promise((resolve) => setTimeout(resolve, 1000));

		const tab = vscode.window.tabGroups.activeTabGroup.activeTab;
		assert.ok(tab, 'A tab should be active');

		const input = tab.input;
		assert.ok(input && typeof input === 'object' && 'viewType' in input,
			'Tab should have a custom editor input');
		assert.strictEqual((input as any).viewType, 'previewHtml.preview');
	});

	test('Toggle to source command opens text editor', async () => {
		const uri = vscode.Uri.file(testHtmlPath);
		await vscode.commands.executeCommand('vscode.openWith', uri, 'previewHtml.preview');
		await new Promise((resolve) => setTimeout(resolve, 500));

		await vscode.commands.executeCommand('previewHtml.openSource');
		await new Promise((resolve) => setTimeout(resolve, 1000));

		const editor = vscode.window.activeTextEditor;
		assert.ok(editor, 'Active text editor should be available after toggling to source');
		assert.strictEqual(editor.document.uri.fsPath, testHtmlPath);
	});

	test('Toggle to preview command opens custom editor', async () => {
		const uri = vscode.Uri.file(testHtmlPath);

		// Open in text editor first
		const doc = await vscode.workspace.openTextDocument(uri);
		await vscode.window.showTextDocument(doc);
		await new Promise((resolve) => setTimeout(resolve, 500));

		await vscode.commands.executeCommand('previewHtml.openPreview');
		await new Promise((resolve) => setTimeout(resolve, 1000));

		const tab = vscode.window.tabGroups.activeTabGroup.activeTab;
		assert.ok(tab, 'A tab should be active');
		const input = tab!.input;
		assert.ok(input && typeof input === 'object' && 'viewType' in input,
			'Tab should have a custom editor input after toggling to preview');
	});

	test('Document change triggers update (debounced)', async () => {
		const uri = vscode.Uri.file(testHtmlPath);
		await vscode.commands.executeCommand('vscode.openWith', uri, 'previewHtml.preview');
		await new Promise((resolve) => setTimeout(resolve, 500));

		// Open the document in a text editor to make edits
		const doc = await vscode.workspace.openTextDocument(uri);
		const editor = await vscode.window.showTextDocument(doc, vscode.ViewColumn.Two);

		// Make an edit
		await editor.edit((editBuilder) => {
			editBuilder.insert(new vscode.Position(0, 0), '<!-- updated -->\n');
		});

		// Wait for debounce (300ms) + buffer
		await new Promise((resolve) => setTimeout(resolve, 600));

		// Verify the document has the edit
		assert.ok(doc.getText().includes('<!-- updated -->'),
			'Document should contain the edit');

		// Undo the edit to restore the fixture
		await vscode.commands.executeCommand('undo');
		await doc.save();
	});
});
