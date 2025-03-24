import * as vscode from 'vscode';
import { openGridPanel } from './gridPanel';

export function activate(context: vscode.ExtensionContext) {
  const disposable = vscode.commands.registerCommand('grid-view.openSplitView', async () => {
    await openGridPanel(context);
  });

  context.subscriptions.push(disposable);
}

export function deactivate() {}
