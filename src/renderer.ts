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
        }
        .yellow { background-color: #ffff00; color: black; }
        .blue { background-color: #3399ff; color: black; }
        .green { background-color: #00ff00; color: black; }
        .red { background-color:rgb(255, 0, 0); color: black; }
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
          <li>Toggle Mode: <strong>Enter</strong></li>
          <li>Indent Line: <strong>Tab</strong></li>
          <li>Unindent Line: <strong>Shift+Tab</strong></li>
          <li>Navigate Cells: <strong>Arrow Keys</strong></li>
          <li>Save changes: <strong>Cmnd+S / Ctrl+S</strong></li>
        </ul>
      </div>

      <script>${script}</script>

    </body>
    </html>
  `;
  
}
