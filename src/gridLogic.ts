export function getGridScript(): string {
    return `
      const vscode = acquireVsCodeApi();
      const grid = document.getElementById('grid');
      let isEditing = false;
      let lastFocusedCell = null;
  
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
  
      function validateGridContent() {
        const rows = Array.from(grid.querySelectorAll('tr'));
        const warnings = [];
      
        rows.forEach((tr, rowIndex) => {
          const cells = Array.from(tr.querySelectorAll('td')).filter(c => c.dataset && c.dataset.col);
          const codeCell = cells.find(c => c.dataset.edit === 'true');
          if (!codeCell) {
            tr.classList.remove('problem-row'); // Remove the class if no code cell exists
            return;
          }
      
          const code = codeCell.textContent.trim();
          if (code.startsWith('for') || code.startsWith('while') || code.startsWith('if') || code.startsWith('def')) {
            const nextRow = rows[rowIndex + 1];
            if (!nextRow) {
              warnings.push(\`Line \${rowIndex + 1}: "\${code.split(' ')[0]}" statement has no body.\`);
              tr.classList.add('problem-row'); // Highlight the problematic row
              return;
            }
      
            const nextCells = Array.from(nextRow.querySelectorAll('td')).filter(c => c.dataset && c.dataset.col);
            const nextCodeCell = nextCells.find(c => c.dataset.edit === 'true');
            if (!nextCodeCell || parseInt(nextCodeCell.dataset.col) <= parseInt(codeCell.dataset.col)) {
              warnings.push(\`Line \${rowIndex + 1}: "\${code.split(' ')[0]}" statement has no body.\`);
              tr.classList.add('problem-row'); // Highlight the problematic row
            } else {
              tr.classList.remove('problem-row'); // Remove the class if the issue is resolved
            }
          } else {
            tr.classList.remove('problem-row'); // Remove the class if the row is not a loop, conditional, or function definition
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
  
      function shiftCellLeft(cell) {
        if (cell.dataset.edit !== 'true') return;
  
        const row = parseInt(cell.dataset.row);
        const col = parseInt(cell.dataset.col);
        if (col === 0) return;
  
        const prevCell = getCell(row, col - 1);
        if (!prevCell) return;
  
        const content = cell.textContent;
  
        // Move content to left cell
        prevCell.textContent = content;
        prevCell.dataset.edit = 'true';
        prevCell.contentEditable = 'false';
        prevCell.className = '';
        prevCell.focus();
  
        // Clear this (right) cell completely
        cell.innerHTML = '';
        cell.className = '';
        cell.dataset.edit = 'false';
        cell.contentEditable = 'false';
        
        validateGridContent();
      }
  
      function saveGridToVSCode() {
        const lines = Array.from(grid.querySelectorAll('tr')).map(row => {
          const cells = Array.from(row.querySelectorAll('td'));
          const codeCell = cells.find(cell => cell.dataset.edit === 'true');
          if (codeCell) {
            // Preserve indentation by calculating the column index and adding spaces
            const colIndex = parseInt(codeCell.dataset.col || '0', 10);
            const indentation = '    '.repeat(colIndex); // 4 spaces per indentation level
            return indentation + (codeCell.textContent || '').trim(); // Preserve indentation and trim only trailing spaces
          }
          return ''; // Empty line if no code cell is found
        });
      
        vscode.postMessage({
          command: 'save',
          lines,
          lastFocusedCell // Include the last focused cell in the save message
        });
      }
  
      grid.addEventListener('keydown', (e) => {
        const cell = document.activeElement;
        if (!cell.dataset) return;
  
        const row = parseInt(cell.dataset.row);
        const col = parseInt(cell.dataset.col);
        let next;
  
        if (e.key === 'Enter') {
          e.preventDefault();
          if (e.shiftKey) {
            // Add a new line below the current row
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
      
            // Update row indices for all rows below the new row
            rows.slice(row + 1).forEach((tr, index) => {
              const newRowIndex = row + 1 + index;
              Array.from(tr.querySelectorAll('td')).forEach(td => {
                td.setAttribute('data-row', newRowIndex);
              });
            });
      
            validateGridContent();
            saveGridToVSCode(); // Always save after handling Shift+Enter
          } else if (isEditing) {
            exitEditMode(cell);
            saveGridToVSCode(); // Save only when exiting edit mode
          } else if (cell.dataset.edit === 'true') {
            enterEditMode(cell);
          }
          return;
        }
  
        if (!isEditing && e.key === 'Tab' && !e.shiftKey) {
          e.preventDefault();
          shiftCellRight(cell);
          saveGridToVSCode(); // Save after handling Tab
          return;
        }
  
        if (!isEditing && e.key === 'Tab' && e.shiftKey) {
          e.preventDefault();
          shiftCellLeft(cell);
          saveGridToVSCode(); // Save after handling Shift+Tab
          return;
        }
  
        if (isEditing) return;
  
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
        
        if (message.command === 'refreshGrid') {
          const gridBody = document.getElementById('grid-body');
          if (gridBody) gridBody.innerHTML = message.html;
        }

        if (message.command === 'saveComplete' && message.lastFocusedCell) {
          validateGridContent();

          // Restore focus to last focused cell if needed
          const { row, col } = message.lastFocusedCell;
          const cell = grid.querySelector(\`td[data-row="\${row}"][data-col="\${col}"]\`);
          if (cell) {
            cell.focus(); // Restore focus to the last visited cell
          }
        }

        if (message.command === 'validateGridContent') {
          validateGridContent();
        }
      });
    `;
  }
