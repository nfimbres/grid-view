import * as vscode from 'vscode';
import { getWebviewContent } from './renderer';
import { buildTableFromText } from './utils/lineParser';

let currentDoc: vscode.TextDocument;
let panel: vscode.WebviewPanel;

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

  panel = vscode.window.createWebviewPanel(
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
      const newContent = msg.lines.join('\n'); // Join lines with newline characters
      const lastFocusedCell = msg.lastFocusedCell; // Capture the last focused cell
      const edit = new vscode.WorkspaceEdit();
      const fullRange = new vscode.Range(
        currentDoc.positionAt(0),
        currentDoc.positionAt(currentDoc.getText().length)
      );
      edit.replace(currentDoc.uri, fullRange, newContent);
      await vscode.workspace.applyEdit(edit);
      await currentDoc.save();
    
      // Notify the webview that save is done and restore focus to the last cell
      panel.webview.postMessage({ 
        command: 'saveComplete', 
        lastFocusedCell 
      });
    }
  });
}

export function updateGridFromFile(newText: string) {
  const newTableHTML = buildTableFromText(newText);
  if (panel) {
    panel.webview.postMessage({
      command: 'refreshGrid',
      html: newTableHTML
    });
  }
}