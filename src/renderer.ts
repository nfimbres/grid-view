import { buildTableRows } from './utils/lineParser';
import { getGridScript } from './gridLogic';

export function getWebviewContent(lines: string[]): string {
  const tableRows = buildTableRows(lines);
  const script = getGridScript();

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        html, body {
          margin: 0;
          padding: 0;
          height: 100%;
          background: black;
          color: white;
          font-family: monospace;
        }
        table {
          border-collapse: collapse;
          width: 100%;
        }
        td {
          border-right: 1px solid white;
          border-left: 1px solid #444;
          border-bottom: 1px solid #444;
          border-top: 1px solid #444;
          padding: 4px;
          min-width: 80px;
          white-space: pre;
          background: black;
          color: white;
        }
        .line-number {
          min-width: 20px;
          width: 20px;
          text-align: right;
          color: white;
          background: black !important; /* Exclude line number column from highlighting */
        }
        .yellow { background-color: rgb(240, 228, 66); color: rgb(60, 57, 17); }
        .blue { background-color: rgb(0, 114, 178); color: rgb(191, 220, 228); }
        .green { background-color: rgb(0, 158, 115); color: rgb(191, 231, 220); }
        .red { background-color: rgb(213, 94, 0); color: rgb(245, 215, 191); }
        .problem-row td {
          background-color: red !important; /* Highlight problematic rows */
        }
        .problem-row .line-number {
          background: rgb(255, 0, 0) !important;
        }
        td:focus {
          outline: 1px solid #00ffff;
        }
        em {
          font-style: italic;
        }
      </style>
    </head>
    <body>
      <table id="grid"><tbody id="grid-body">${tableRows}</tbody></table>

      <div id="controls" style="justify-content: center; padding: 10px;">
        <h3>Keyboard Controls</h3>
        <ul>
          <li>Toggle Mode (Edit/Navigate): <strong>Enter</strong></li>
          <li>New Line: <strong>Shift+Enter</strong></li>
          <li>Indent Line: <strong>Tab</strong></li>
          <li>Unindent Line: <strong>Shift+Tab</strong></li>
          <li>Navigate Cells: <strong>Arrow Keys</strong></li>
        </ul>
        <h3>Indications</h3>
        <ul>
          <li>Red: Missing nested code</li>
        </ul>
      </div>

      <script>${script}</script>
      <script>
        window.addEventListener('message', event => {
          const message = event.data;
          if (message.command === 'updateGrid') {
            const gridBody = document.getElementById('grid-body');
            if (gridBody) {
              gridBody.innerHTML = message.html;
              validateGridContent(); // Reapply validation after grid update
            }
          } else if (message.command === 'validateGridContent') {
            validateGridContent(); // Trigger validation explicitly
          }
        });
      </script>
    </body>
    </html>
  `;
}
