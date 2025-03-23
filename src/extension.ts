import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
  const disposable = vscode.commands.registerCommand('grid-view.openSplitView', async () => {
    const uris = await vscode.window.showOpenDialog({ canSelectMany: false });
    if (!uris || uris.length === 0) return;

    const doc = await vscode.workspace.openTextDocument(uris[0]);
    const editor = await vscode.window.showTextDocument(doc, vscode.ViewColumn.One);

    // ✅ Ensure line numbers are enabled in the editor
    editor.options = {
      ...editor.options,
      lineNumbers: 'on' as unknown as vscode.TextEditorLineNumbersStyle
    };

    const lines = doc.getText().split(/\r?\n/);

    const panel = vscode.window.createWebviewPanel(
      'gridSecondPanel',
      'Code Grid',
      vscode.ViewColumn.Beside,
      { enableScripts: true, retainContextWhenHidden: true }
    );

    await vscode.commands.executeCommand('workbench.action.moveEditorToBelowGroup');
    panel.webview.html = getWebviewContent(lines);
  });

  context.subscriptions.push(disposable);
}

function getWebviewContent(lines: string[]): string {
  const maxCols = 5;

  const escapeHtml = (str: string) =>
    str.replace(/&/g, '&amp;')
       .replace(/</g, '&lt;')
       .replace(/>/g, '&gt;');

  const tableRows = lines.map((line, rowIndex) => {
    const indent = line.match(/^\s*/)?.[0] ?? '';
    const spaces = indent.replace(/\t/g, '    ');
    const indentLevel = Math.floor(spaces.length / 4);
    const codeColIndex = indentLevel;

    const cells = [];
    cells.push(`<td class="line-number">${rowIndex + 1}</td>`);

    for (let col = 0; col < maxCols; col++) {
      const dataAttrs = `data-row="${rowIndex}" data-col="${col}"`;
      const content = col === codeColIndex ? escapeHtml(line) : '';
      cells.push(`<td tabindex="0" ${dataAttrs} contenteditable="false">${content}</td>`);
    }

    return `<tr>${cells.join('')}</tr>`;
  }).join('\n');

  return /* html */`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <style>
        html, body {
          margin: 0;
          padding: 0;
          height: 100%;
          font-family: var(--vscode-editor-font-family);
          font-size: var(--vscode-editor-font-size);
          color: var(--vscode-editor-foreground);
          background-color: transparent;
        }
        table {
          border-collapse: collapse;
          width: 100%;
        }
        td {
          border: 1px solid #333;
          padding: 4px;
          min-width: 80px;
          white-space: pre;
        }
        td:focus {
          outline: 1px solid var(--vscode-editorCursor-foreground);
        }
        .line-number {
          background: transparent;
          text-align: right;
          color: var(--vscode-editorLineNumber-foreground);
          padding-right: 10px;
          user-select: none;
          min-width: 40px;
        }
      </style>
    </head>
    <body>
      <table id="grid">${tableRows}</table>

      <script>
        const grid = document.getElementById('grid');

        function getCell(row, col) {
          return grid.querySelector(\`td[data-row="\${row}"][data-col="\${col}"]\`);
        }

        let isEditing = false;

        grid.addEventListener('click', (e) => {
          const cell = e.target;
          if (!cell.dataset || cell.classList.contains('line-number')) return;
          enterEditMode(cell);
        });

        grid.addEventListener('keydown', (e) => {
          const cell = document.activeElement;
          if (!cell.dataset) return;

          const row = parseInt(cell.dataset.row);
          const col = parseInt(cell.dataset.col);
          let next;

          if (e.key === 'Enter') {
            e.preventDefault();
            if (isEditing) {
              exitEditMode(cell); // stay in cell
            } else {
              enterEditMode(cell); // enter and put caret at end
            }
            return;
          }

          if (isEditing) return;

          switch (e.key) {
            case 'ArrowDown':
              next = getCell(row + 1, col);
              break;
            case 'ArrowUp':
              next = getCell(row - 1, col);
              break;
            case 'ArrowRight':
              next = getCell(row, col + 1);
              break;
            case 'ArrowLeft':
              next = getCell(row, col - 1);
              break;
          }

          if (next) {
            e.preventDefault();
            next.focus();
          }
        });

        function enterEditMode(cell) {
          isEditing = true;
          cell.contentEditable = 'true';
          cell.focus();
          placeCaretAtEnd(cell);
        }

        function exitEditMode(cell) {
          isEditing = false;
          cell.contentEditable = 'false';
          cell.focus(); // stay in place
        }

        function placeCaretAtEnd(el) {
          const range = document.createRange();
          range.selectNodeContents(el);
          range.collapse(false);
          const sel = window.getSelection();
          sel.removeAllRanges();
          sel.addRange(range);
        }
      </script>
    </body>
    </html>
  `;
}

export function deactivate() {}
