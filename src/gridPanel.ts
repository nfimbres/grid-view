import * as vscode from 'vscode';
import { getWebviewContent } from './renderer';

let currentDoc: vscode.TextDocument;

export async function openGridPanel(context: vscode.ExtensionContext) {
  const uris = await vscode.window.showOpenDialog({ canSelectMany: false });
  if (!uris || uris.length === 0) return;

  currentDoc = await vscode.workspace.openTextDocument(uris[0]);
  const editor = await vscode.window.showTextDocument(currentDoc, vscode.ViewColumn.One);

  editor.options = {
    ...editor.options,
    lineNumbers: 'on' as unknown as vscode.TextEditorLineNumbersStyle
  };

  const lines = currentDoc.getText().split(/\r?\n/);

  const panel = vscode.window.createWebviewPanel(
    'gridSecondPanel',
    'Code Grid',
    vscode.ViewColumn.Two,
    {
      enableScripts: true,
      retainContextWhenHidden: true,
    }
  );

  await vscode.commands.executeCommand('workbench.action.focusSecondEditorGroup');
  await vscode.commands.executeCommand('workbench.action.moveEditorToBelowGroup');
  await vscode.commands.executeCommand('workbench.action.focusFirstEditorGroup');

  panel.webview.html = getWebviewContent(lines);

  panel.webview.onDidReceiveMessage(async (msg) => {
    if (msg.command === 'save') {
      const newContent = msg.lines.join('\n');
      const edit = new vscode.WorkspaceEdit();
      const fullRange = new vscode.Range(
        currentDoc.positionAt(0),
        currentDoc.positionAt(currentDoc.getText().length)
      );
      edit.replace(currentDoc.uri, fullRange, newContent);
      await vscode.workspace.applyEdit(edit);
      await currentDoc.save();
    }
  });
}
