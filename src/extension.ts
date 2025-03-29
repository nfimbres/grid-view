import * as vscode from 'vscode';
import { openGridPanel, updateGridFromFile } from './gridPanel';

export function activate(context: vscode.ExtensionContext) {
  const disposable = vscode.commands.registerCommand('grid-view.openSplitView', async () => {
    await openGridPanel(context);
  });

  context.subscriptions.push(disposable);

  // 🔁 ADD: file save listener to trigger grid refresh
  vscode.workspace.onDidSaveTextDocument((doc) => {
    updateGridFromFile(doc.getText());
  });
}

export function deactivate() {}

