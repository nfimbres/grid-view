// Import the VS Code API and custom functions from the gridPanel module
import * as vscode from 'vscode';
import { openGridPanel, updateGridFromFile } from './gridPanel';

// This function is called when the extension is activated
export function activate(context: vscode.ExtensionContext) {
  // Register a command that opens the grid view in a split panel
  const disposable = vscode.commands.registerCommand('grid-view.openSplitView', async () => {
    // Call the function to open the grid panel
    await openGridPanel(context);
  });

  // Add the command to the extension's subscriptions for cleanup on deactivation
  context.subscriptions.push(disposable);

  // Listen for text document save events in the workspace
  vscode.workspace.onDidSaveTextDocument((doc) => {
    // Update the grid view with the content of the saved document
    updateGridFromFile(doc.getText());
  });
}

// This function is called when the extension is deactivated
export function deactivate() {}

