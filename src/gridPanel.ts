import * as vscode from 'vscode';
import { getWebviewContent } from './renderer';
import { buildTableFromText } from './utils/lineParser';

export let currentDoc: vscode.TextDocument; // Export currentDoc
let panel: vscode.WebviewPanel; // Stores the webview panel instance

// Function to open the grid panel and display the grid view
export async function openGridPanel(context: vscode.ExtensionContext) {
  // Show a file open dialog to select a file
  const uris = await vscode.window.showOpenDialog({ canSelectMany: false });
  if (!uris || uris.length === 0) return; // Exit if no file is selected
  // Open the selected file as a text document
  currentDoc = await vscode.workspace.openTextDocument(uris[0]);
  console.log('Current document set to:', currentDoc.uri.toString());
  const editor = await vscode.window.showTextDocument(currentDoc, vscode.ViewColumn.One);

  // Enable line numbers in the editor
  editor.options = {
    ...editor.options,
    lineNumbers: 'on' as unknown as vscode.TextEditorLineNumbersStyle
  };

  // Split the document content into lines
  const lines = currentDoc.getText().split(/\r?\n/);

  // Create a new webview panel to display the grid
  panel = vscode.window.createWebviewPanel(
    'gridSecondPanel', // Unique identifier for the webview
    'Code Grid', // Title of the webview
    vscode.ViewColumn.Two, // Display the webview in the second editor column
    {
      enableScripts: true, // Allow scripts to run in the webview
      retainContextWhenHidden: true, // Retain the webview's state when hidden
    }
  );

  // Rearrange the editor layout to show the webview below the editor
  await vscode.commands.executeCommand('workbench.action.focusSecondEditorGroup');
  await vscode.commands.executeCommand('workbench.action.moveEditorToBelowGroup');
  await vscode.commands.executeCommand('workbench.action.focusFirstEditorGroup');

  // Set the HTML content of the webview
  panel.webview.html = getWebviewContent(lines);

  // Listen for messages from the webview
  panel.webview.onDidReceiveMessage(async (msg) => {
    if (msg.command === 'save') {
      // Handle the save command from the webview
      const newContent = msg.lines.join('\n'); // Join the lines into a single string
      const lastFocusedCell = msg.lastFocusedCell; // Capture the last focused cell
      const edit = new vscode.WorkspaceEdit();
      const fullRange = new vscode.Range(
        currentDoc.positionAt(0), // Start of the document
        currentDoc.positionAt(currentDoc.getText().length) // End of the document
      );
      // Replace the document content with the new content
      edit.replace(currentDoc.uri, fullRange, newContent);
      await vscode.workspace.applyEdit(edit); // Apply the edit
      await currentDoc.save(); // Save the document

      // Notify the webview that the save is complete and restore focus to the last cell
      panel.webview.postMessage({ 
        command: 'saveComplete', 
        lastFocusedCell 
      });
    }
  });
}

// Function to update the grid view when the file content changes
export function updateGridFromFile(newText: string, doc: vscode.TextDocument) {
  if (doc === currentDoc) {
    const newTableHTML = buildTableFromText(newText);
    if (panel) {
      console.log('Sending refreshGrid message to webview');
      panel.webview.postMessage({
        command: 'refreshGrid',
        html: newTableHTML
      });

      panel.webview.postMessage({
        command: 'validateGrid'
      });
    }
  }
}