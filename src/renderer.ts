// Import utility functions for building table rows and grid logic
import { buildTableRows } from './utils/lineParser';
import { getGridScript } from './gridLogic';

// Function to generate the HTML content for the webview
export function getWebviewContent(lines: string[]): string {
  // Convert the lines of text into table rows
  const tableRows = buildTableRows(lines);

  // Get the JavaScript logic for the grid
  const script = getGridScript();

  // Return the complete HTML content for the webview
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        /* General styles for the webview */
        html, body {
          margin: 0;
          padding: 0;
          height: 100%;
          background: black;
          color: white;
          font-family: monospace;
        }

        /* Table styling */
        table {
          border-collapse: collapse;
          width: 100%;
        }

        /* Cell styling */
        td {
          border-right: 1px solid white;
          border-left: 1px solid #444;
          border-bottom: 1px solid #444;
          border-top: 1px solid #444;
          padding: 4px;
          min-width: 80px;
          white-space: pre; /* Preserve whitespace formatting */
          background: black;
          color: white;
        }

        /* Line number column styling */
        .line-number {
          min-width: 20px;
          width: 20px;
          text-align: right;
          color: white;
          background: black !important; /* Exclude line number column from highlighting */
        }

        /* Highlighting for specific cell types */
        .yellow { background-color: rgb(240, 228, 66); color: rgb(60, 57, 17); }
        .blue { background-color: rgb(0, 114, 178); color: rgb(191, 220, 228); }
        .green { background-color: rgb(0, 158, 115); color: rgb(191, 231, 220); }
        .red { background-color: rgb(213, 94, 0); color: rgb(245, 215, 191); }

        /* Highlight problematic rows */
        .problem-row td {
          background-color: red !important;
        }
        .problem-row .line-number {
          background: rgb(255, 0, 0) !important;
        }

        /* Focused cell outline */
        td:focus {
          outline: 1px solid #00ffff;
        }

        /* Italicized text styling */
        em {
          font-style: italic;
        }
      </style>
    </head>
    <body>
      <!-- Table for displaying the grid -->
      <table id="grid"><tbody id="grid-body">${tableRows}</tbody></table>

      <!-- Controls section for keyboard shortcuts and indications -->
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

      <!-- JavaScript logic for the grid -->
      <script>${script}</script>

      <!-- Script to handle messages from the VS Code extension -->
      <script>
        window.addEventListener('message', event => {
          const message = event.data;

          // Handle grid updates
          if (message.command === 'updateGrid') {
            const gridBody = document.getElementById('grid-body');
            if (gridBody) {
              gridBody.innerHTML = message.html;
              validateGridContent(); // Reapply validation after grid update
            }
          } 
          // Trigger validation explicitly
          else if (message.command === 'validateGridContent') {
            validateGridContent();
          }
        });
      </script>
    </body>
    </html>
  `;
}
