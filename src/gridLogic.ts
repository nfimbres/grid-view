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

      let validParentFound = false;
      let parentConstruct = '';
      let parentRow = -1;

      for (let i = row - 1; i >= 0; i--) {
        const parentCell = getCell(i, col);
        if (!parentCell) continue;

        const parentCode = parentCell.textContent.trim();

        // Check if the parent is a valid construct (e.g., for, while, if, def)
        if (parentCell.dataset.edit === 'true' && (parentCode.startsWith('for') || parentCode.startsWith('while') || parentCode.startsWith('if') || parentCode.startsWith('def'))) {
          validParentFound = true;
          parentConstruct = parentCode.split(' ')[0];
          parentRow = i;
          break;
        }

        // Check if the parent cell is a "↳within" cell
        if (parentCell.dataset.edit === 'false' && parentCell.textContent.includes('↳within')) {
          validParentFound = true;
          const match = parentCell.textContent.match(/↳within (\\w+) \\(line (\\d+)\\)/);
          if (match) {
            parentConstruct = match[1];
            parentRow = parseInt(match[2]) - 1;
          }
          break;
        }

        // Skip blank lines but continue searching for a valid parent
        if (parentCell.dataset.edit !== 'true' && parentCode.trim() === '') {
          continue;
        }

        // Stop if a new construct is encountered, indicating the end of the current nested structure
        if (parentCell.dataset.edit === 'true' && (parentCode.startsWith('for') || parentCode.startsWith('while') || parentCode.startsWith('if') || parentCode.startsWith('def'))) {
          break;
        }
      }

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

      cell.innerHTML = \`↳within \${parentConstruct} (line \${parentRow + 1})\`;
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

      if (e.key === 'Tab') {
        e.preventDefault();
        if (e.shiftKey) {
          shiftCellLeft(cell);
        } else {
          shiftCellRight(cell);
        }
        saveGridToVSCode();
        return;
      }

      if ((e.key === 'Delete' || e.key === 'Backspace') && e.shiftKey) {
        e.preventDefault();
        console.log('Shift+Delete or Shift+Backspace detected, attempting to delete row.');
        const rows = Array.from(grid.querySelectorAll('tr'));
        const currentRow = rows[row];
        if (currentRow) {
          console.log(\`Deleting row: \${row}\`);
          const previousRow = rows[row - 1];
          currentRow.remove();

          // Update the data-row attributes for all rows below the deleted one
          rows.slice(row + 1).forEach((tr, index) => {
            const newRowIndex = row + index;
            Array.from(tr.querySelectorAll('td')).forEach(td => {
              td.setAttribute('data-row', newRowIndex);
            });
          });

          validateGridContent();
          saveGridToVSCode();

          // Focus on the cell above if it exists
          if (previousRow) {
            const cellAbove = previousRow.querySelector(\`td[data-col="\${col}"]\`);
            if (cellAbove) {
              cellAbove.focus();
            }
          }
        } else {
          console.warn('No row found to delete.');
        }
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
          row: cell.dataset.row, // Save the row index of the last focused cell
          col: cell.dataset.col  // Save the column index of the last focused cell
        };
      }
    });

    // Listen for messages sent to the webview
    window.addEventListener('message', event => {
      const message = event.data; // Extract the message data from the event
      console.log('Message received in webview:', message);

      // Handle the 'refreshGrid' command to update the grid content
      if (message.command === 'refreshGrid') {
        const gridBody = document.getElementById('grid-body'); // Get the grid body element
        if (gridBody) {
          // Save the currently focused cell's position
          const focusedCell = document.activeElement; // Get the currently focused element
          const focusedRow = focusedCell?.dataset?.row; // Row index of the focused cell
          const focusedCol = focusedCell?.dataset?.col; // Column index of the focused cell

          // Update the grid with the new HTML content
          gridBody.innerHTML = message.html; // Replace the grid's content with the new HTML

          // Restore focus to the previously focused cell after the grid is updated
          if (focusedRow !== undefined && focusedCol !== undefined) {
            const cellToFocus = grid.querySelector(\`td[data-row="\${focusedRow}"][data-col="\${focusedCol}"]\`);
            if (cellToFocus) {
              cellToFocus.focus(); // Set focus back to the previously focused cell
            }
          }
        }

        // Revalidate the grid content to ensure consistency
        validateGridContent(); // Call the function to validate the grid's content
      }

      // Handle the 'validateGrid' command to manually trigger grid validation
      if (message.command === 'validateGrid') {
        validateGridContent(); // Revalidate the grid content
      }
    });
  `;
}
