export function getGridScript(): string {
  return `
    // Acquire the VS Code API for communication between the webview and the extension
    const vscode = acquireVsCodeApi();

    // Get the grid element from the DOM
    const grid = document.getElementById('grid');
    let isEditing = false; // Tracks whether a cell is in edit mode
    let lastFocusedCell = null; // Tracks the last focused cell for saving state

    // History stacks for undo/redo functionality
    let history = [];
    let redoStack = [];

    // Push the current grid state to the history stack
    function pushToHistory() {
      const snapshot = Array.from(grid.querySelectorAll('tr')).map(tr =>
        Array.from(tr.querySelectorAll('td')).map(td => td.innerHTML)
      );
      history.push(snapshot);
      redoStack = []; // Clear redo stack on new action
    }

    // Restore the grid state from a snapshot
    function restoreFromSnapshot(snapshot) {
      const rows = grid.querySelectorAll('tr');
      snapshot.forEach((rowData, rowIndex) => {
        const cells = rows[rowIndex]?.querySelectorAll('td');
        if (cells) {
          rowData.forEach((html, colIndex) => {
            if (cells[colIndex]) cells[colIndex].innerHTML = html;
          });
        }
      });
      validateGridContent(); // Validate the grid after restoring
    }

    // Get a specific cell by row and column
    function getCell(row, col) {
      return grid.querySelector(\`td[data-row="\${row}"][data-col="\${col}"]\`);
    }

    // Place the caret at the end of a cell's content
    function placeCaretAtEnd(el) {
      const range = document.createRange();
      range.selectNodeContents(el);
      range.collapse(false);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    }

    // Enter edit mode for a cell
    function enterEditMode(cell) {
      isEditing = true;
      cell.contentEditable = 'true';
      cell.focus();
      placeCaretAtEnd(cell);
    }

    // Exit edit mode for a cell
    function exitEditMode(cell) {
      isEditing = false;
      cell.contentEditable = 'false';
      cell.focus();
      pushToHistory(); // Save the current state to history
      validateGridContent(); // Validate the grid content
    }

    // Find the parent keyword (e.g., 'def', 'if') for a given row
    function findParentKeyword(row) {
      for (let i = row - 1; i >= 0; i--) {
        const cells = grid.querySelectorAll(\`td[data-row="\${i}"]\`);
        for (let td of cells) {
          const text = td.textContent;
          if (text.includes('def')) return 'def';
          if (text.includes('if')) return 'if';
          if (text.includes('for')) return 'for';
          if (text.includes('while')) return 'while';
        }
      }
      return null;
    }

    // Get the maximum column used in a specific row
    function getMaxColUsedInRow(row) {
      const cells = grid.querySelectorAll(\`td[data-row="\${row}"]\`);
      let max = 0;
      for (let td of cells) {
        const content = td.textContent.trim();
        if (td.dataset.col && content !== '') {
          const col = parseInt(td.dataset.col);
          if (!isNaN(col)) max = Math.max(max, col);
        }
      }
      return max;
    }

    // Validate the grid content for logical issues
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

    // Shift a cell's content to the right
    function shiftCellRight(cell) {
      if (cell.dataset.edit !== 'true') return;
      pushToHistory();

      const row = parseInt(cell.dataset.row);
      const col = parseInt(cell.dataset.col);
      const nextCol = col + 1;

      const maxAllowedCol = getMaxColUsedInRow(row - 1);
      if (nextCol > maxAllowedCol + 1) return;

      const nextCell = getCell(row, nextCol);
      if (!nextCell) return;

      nextCell.textContent = cell.textContent;
      nextCell.dataset.edit = 'true';
      nextCell.contentEditable = 'false';
      nextCell.className = '';
      nextCell.focus();

      const context = findParentKeyword(row);
      cell.innerHTML = context ? \`↳within <em>\${context}</em>\` : '';
      cell.className = context === 'def' ? 'blue' : context === 'if' ? 'yellow' : context === 'for' ? 'green' : context === 'while' ? 'red' : '';
      cell.dataset.edit = 'false';
      cell.contentEditable = 'false';

      validateGridContent();
    }

    // Shift a cell's content to the left
    function shiftCellLeft(cell) {
      if (cell.dataset.edit !== 'true') return;
      pushToHistory();

      const row = parseInt(cell.dataset.row);
      const col = parseInt(cell.dataset.col);
      if (col === 0) return;

      const prevCell = getCell(row, col - 1);
      if (!prevCell) return;

      const content = cell.textContent;

      prevCell.textContent = content;
      prevCell.dataset.edit = 'true';
      prevCell.contentEditable = 'false';
      prevCell.className = '';
      prevCell.focus();

      cell.innerHTML = '';
      cell.className = '';
      cell.dataset.edit = 'false';
      cell.contentEditable = 'false';

      validateGridContent();
    }

    // Save the grid content to VS Code
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

      vscode.postMessage({
        command: 'save',
        lines,
        lastFocusedCell
      });
    }

    // Event listener for keydown events on the grid
    grid.addEventListener('keydown', (e) => {
      const cell = document.activeElement;
      if (!cell.dataset) return;

      const row = parseInt(cell.dataset.row);
      const col = parseInt(cell.dataset.col);
      let next;

      // Handle delete/backspace with meta/ctrl/shift keys
      if ((e.metaKey || e.ctrlKey || e.shiftKey) && (e.key === 'Delete' || e.key === 'Backspace')) {
        e.preventDefault();
        const rowElement = grid.querySelector(\`tr:nth-child(\${row + 1})\`);
        if (rowElement) {
          pushToHistory();
          rowElement.remove();

          const rows = Array.from(grid.querySelectorAll('tr'));
          rows.forEach((tr, rIdx) => {
            Array.from(tr.querySelectorAll('td')).forEach(td => {
              td.setAttribute('data-row', rIdx.toString());
            });
          });

          saveGridToVSCode();
        }
        return;
      }

      // Handle undo/redo with ctrl/meta + z
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey && redoStack.length > 0) {
          const redo = redoStack.pop();
          if (redo) {
            pushToHistory();
            restoreFromSnapshot(redo);
          }
        } else if (history.length > 0) {
          const undo = history.pop();
          if (undo) {
            const currentSnapshot = Array.from(grid.querySelectorAll('tr')).map(tr =>
              Array.from(tr.querySelectorAll('td')).map(td => td.innerHTML)
            );
            redoStack.push(currentSnapshot);
            restoreFromSnapshot(undo);
          }
        }
        return;
      }

      // Handle Enter key for editing or adding rows
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

          pushToHistory();
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

      // Handle Tab key for shifting cells
      if (!isEditing && e.key === 'Tab' && !e.shiftKey) {
        e.preventDefault();
        shiftCellRight(cell);
        saveGridToVSCode();
        return;
      }

      if (!isEditing && e.key === 'Tab' && e.shiftKey) {
        e.preventDefault();
        shiftCellLeft(cell);
        saveGridToVSCode();
        return;
      }

      if (isEditing) return;

      // Handle arrow keys for navigation
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
    });

    // Event listener for click events on the grid
    grid.addEventListener('click', (e) => {
      const cell = e.target;
      if (!cell.dataset || cell.classList.contains('line-number')) return;
      if (cell.dataset.edit === 'true') enterEditMode(cell);
    });

    // Event listener for focus events on the grid
    grid.addEventListener('focusin', (e) => {
      const cell = e.target;
      if (cell && cell.dataset) {
        lastFocusedCell = {
          row: cell.dataset.row,
          col: cell.dataset.col
        };
      }
    });

    // Handle messages from the VS Code extension
    window.addEventListener('message', event => {
      const message = event.data;
      if (message.command === 'refreshGrid') {
        const gridBody = document.getElementById('grid-body');
        if (gridBody) gridBody.innerHTML = message.html;
      }

      if (message.command === 'saveComplete' && message.lastFocusedCell) {
        validateGridContent();
        const { row, col } = message.lastFocusedCell;
        const cell = grid.querySelector(\`td[data-row="\${row}"][data-col="\${col}"]\`);
        if (cell) cell.focus();
      }

      if (message.command === 'validateGridContent') {
        validateGridContent();
      }
    });
  `;
}
