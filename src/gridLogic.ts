export function getGridScript(): string {
  return `
    const vscode = acquireVsCodeApi();
    const grid = document.getElementById('grid');
    let isEditing = false;
    let lastFocusedCell = null;

    function pushToHistory() {
      // This function is no longer needed since undo functionality is removed.
    }

    function restoreFromSnapshot(snapshot) {
      const rows = grid.querySelectorAll('tr');
      snapshot.forEach((line, rowIndex) => {
        const cells = rows[rowIndex]?.querySelectorAll('td');
        if (cells) {
          const indentationLevel = (line.match(/^\\s*/) || [''])[0].length / 4;
          const code = line.trim();
          cells.forEach((cell, colIndex) => {
            if (colIndex === indentationLevel) {
              cell.textContent = code;
              cell.dataset.edit = 'true';
            } else {
              cell.textContent = '';
              cell.dataset.edit = 'false';
            }
          });
        }
      });

      validateGridContent(); // Ensure the grid content is validated after restoring

      // Send the updated code back to VS Code
      vscode.postMessage({
        command: 'save',
        lines: snapshot,
        lastFocusedCell
      });
    }

    function getCell(row, col) {
      return grid.querySelector(\`td[data-row="\${row}"][data-col="\${col}"]\`);
    }

    function placeCaretAtEnd(el) {
      const range = document.createRange();
      range.selectNodeContents(el);
      range.collapse(false);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    }

    function enterEditMode(cell) {
      isEditing = true;
      cell.contentEditable = 'true';
      cell.focus();
      placeCaretAtEnd(cell);
    }

    function exitEditMode(cell) {
      isEditing = false;
      cell.contentEditable = 'false';
      cell.focus();
      validateGridContent();
    }

    function validateGridContent() {
      const rows = Array.from(grid.querySelectorAll('tr'));
      const warnings = [];

      rows.forEach((tr, rowIndex) => {
        const cells = Array.from(tr.querySelectorAll('td')).filter(c => c.dataset && c.dataset.col);
        const codeCell = cells.find(c => c.dataset.edit === 'true');
        if (!codeCell) {
          tr.classList.remove('problem-row');
          return;
        }

        const code = codeCell.textContent.trim();
        if (code.startsWith('for') || code.startsWith('while') || code.startsWith('if') || code.startsWith('def')) {
          const nextRow = rows[rowIndex + 1];
          if (!nextRow) {
            warnings.push(\`Line \${rowIndex + 1}: "\${code.split(' ')[0]}" statement has no body.\`);
            tr.classList.add('problem-row');
            return;
          }

          const nextCells = Array.from(nextRow.querySelectorAll('td')).filter(c => c.dataset && c.dataset.col);
          const nextCodeCell = nextCells.find(c => c.dataset.edit === 'true');
          if (!nextCodeCell || parseInt(nextCodeCell.dataset.col) <= parseInt(codeCell.dataset.col)) {
            warnings.push(\`Line \${rowIndex + 1}: "\${code.split(' ')[0]}" statement has no body.\`);
            tr.classList.add('problem-row');
          } else {
            tr.classList.remove('problem-row');
          }
        } else {
          tr.classList.remove('problem-row');
        }
      });

      if (warnings.length > 0) {
        vscode.postMessage({ command: 'showWarnings', warnings });
      }
    }

    function shiftCellRight(cell) {
      if (cell.dataset.edit !== 'true') return;

      const row = parseInt(cell.dataset.row);
      const col = parseInt(cell.dataset.col);

      // Check for a valid parent line above
      let validParentFound = false;
      let parentConstruct = ''; // Store the parent construct (e.g., "for", "if")
      for (let i = row - 1; i >= 0; i--) {
        const parentCell = getCell(i, col);
        if (!parentCell || parentCell.dataset.edit !== 'true') continue;

        const parentCode = parentCell.textContent.trim();
        if (parentCode.startsWith('for') || parentCode.startsWith('while') || parentCode.startsWith('if') || parentCode.startsWith('def')) {
          validParentFound = true;
          parentConstruct = parentCode.split(' ')[0]; // Extract the construct (e.g., "for")
          break;
        }
      }

      // If no valid parent is found, prevent indentation
      if (!validParentFound) {
        console.warn('Cannot indent: No valid parent line found above.');
        return;
      }

      const nextCol = col + 1;
      const nextCell = getCell(row, nextCol);
      if (!nextCell) return;

      nextCell.textContent = cell.textContent;
      nextCell.dataset.edit = 'true';
      nextCell.contentEditable = 'false';
      nextCell.focus();

      cell.innerHTML = \`↳within \${parentConstruct}\`; // Display the parent construct
      cell.dataset.edit = 'false';
      cell.contentEditable = 'false';

      validateGridContent();
    }

    function shiftCellLeft(cell) {
      if (cell.dataset.edit !== 'true') return;

      const row = parseInt(cell.dataset.row);
      const col = parseInt(cell.dataset.col);
      if (col === 0) return;

      const prevCell = getCell(row, col - 1);
      if (!prevCell) return;

      prevCell.textContent = cell.textContent;
      prevCell.dataset.edit = 'true';
      prevCell.contentEditable = 'false';
      prevCell.focus();

      cell.innerHTML = '';
      cell.dataset.edit = 'false';
      cell.contentEditable = 'false';

      validateGridContent();
    }

    function saveGridToVSCode() {
      const lines = Array.from(grid.querySelectorAll('tr')).map(row => {
        const cells = Array.from(row.querySelectorAll('td'));
        const codeCell = cells.find(cell => cell.dataset.edit === 'true');
        if (codeCell) {
          const colIndex = parseInt(codeCell.dataset.col || '0', 10);
          const indentation = '    '.repeat(colIndex);
          return indentation + (codeCell.textContent || '').trim();
        }
        return '';
      });

      console.log('Sending save message to VS Code with lines:', lines);
      vscode.postMessage({
        command: 'save',
        lines,
        lastFocusedCell
      });
    }

    function processKeyboardShortcut(e) {
      const cell = document.activeElement;
      if (!cell || !cell.dataset) return;

      const row = parseInt(cell.dataset.row);
      const col = parseInt(cell.dataset.col);

      if (e.key === 'Enter') {
        e.preventDefault();
        if (e.shiftKey) {
          const newRow = document.createElement('tr');
          const totalCols = grid.querySelectorAll('td[data-row="0"]').length;

          for (let i = 0; i < totalCols; i++) {
            const newCell = document.createElement('td');
            newCell.setAttribute('data-row', row + 1);
            newCell.setAttribute('data-col', i);
            newCell.setAttribute('tabindex', '0');
            newCell.setAttribute('data-edit', 'false');
            newCell.setAttribute('contenteditable', 'false');
            newCell.textContent = '';
            newRow.appendChild(newCell);
          }

          const rows = Array.from(grid.querySelectorAll('tr'));
          const currentRow = rows[row];
          currentRow.insertAdjacentElement('afterend', newRow);
          rows.slice(row + 1).forEach((tr, index) => {
            const newRowIndex = row + 1 + index;
            Array.from(tr.querySelectorAll('td')).forEach(td => {
              td.setAttribute('data-row', newRowIndex);
            });
          });

          validateGridContent();
          saveGridToVSCode();
        } else if (isEditing) {
          exitEditMode(cell);
          saveGridToVSCode();
        } else if (cell.dataset.edit === 'true') {
          enterEditMode(cell);
        }
        return;
      }

      if (!isEditing && e.key === 'Tab') {
        e.preventDefault();
        if (e.shiftKey) {
          shiftCellLeft(cell);
        } else {
          shiftCellRight(cell);
        }
        saveGridToVSCode();
        return;
      }

      if (isEditing) return;

      let next;
      switch (e.key) {
        case 'ArrowDown': next = getCell(row + 1, col); break;
        case 'ArrowUp': next = getCell(row - 1, col); break;
        case 'ArrowRight': next = getCell(row, col + 1); break;
        case 'ArrowLeft': next = getCell(row, col - 1); break;
      }

      if (next) {
        e.preventDefault();
        next.focus();
      }
    }

    grid.addEventListener('keydown', processKeyboardShortcut);

    grid.addEventListener('click', (e) => {
      const cell = e.target;
      if (!cell.dataset || cell.classList.contains('line-number')) return;
      if (cell.dataset.edit === 'true') enterEditMode(cell);
    });

    grid.addEventListener('focusin', (e) => {
      const cell = e.target;
      if (cell && cell.dataset) {
        lastFocusedCell = {
          row: cell.dataset.row,
          col: cell.dataset.col
        };
      }
    });

    window.addEventListener('message', event => {
      const message = event.data;
      console.log('Message received in webview:', message);

      if (message.command === 'refreshGrid') {
        const gridBody = document.getElementById('grid-body');
        if (gridBody) {
          // Save the currently focused cell's position
          const focusedCell = document.activeElement;
          const focusedRow = focusedCell?.dataset?.row;
          const focusedCol = focusedCell?.dataset?.col;

          // Update the grid with the new HTML
          gridBody.innerHTML = message.html;

          // Restore focus to the previously focused cell
          if (focusedRow !== undefined && focusedCol !== undefined) {
            const cellToFocus = grid.querySelector(\`td[data-row="\${focusedRow}"][data-col="\${focusedCol}"]\`);
            if (cellToFocus) {
              cellToFocus.focus();
            }
          }
        }

        validateGridContent(); // Revalidate the grid content
      }

      if (message.command === 'validateGrid') {
        validateGridContent(); // Revalidate the grid content
      }
    });
  `;
}
