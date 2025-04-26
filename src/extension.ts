import * as vscode from 'vscode';
import { openGridPanel, updateGridFromFile, currentDoc } from './gridPanel';

export function activate(context: vscode.ExtensionContext) {
  // Register a command that opens the grid view in a split panel
  const disposable = vscode.commands.registerCommand('grid-view.openSplitView', async () => {
    await openGridPanel(context);
  });

  context.subscriptions.push(disposable);

  // Listen for text document save events in the workspace
  vscode.workspace.onDidSaveTextDocument((doc) => {
    if (doc === currentDoc) {
      console.log('File saved:', doc.uri.toString());
      const newText = doc.getText();
      updateGridFromFile(newText, doc);
    }
  });

  // Listen for text document change events in the workspace
  vscode.workspace.onDidChangeTextDocument((event) => {
    if (event.document === currentDoc) {
      console.log('Document changed:', event.document.uri.toString());
      const newText = event.document.getText();
      updateGridFromFile(newText, event.document);
    }
  });
}

export function deactivate() {}

