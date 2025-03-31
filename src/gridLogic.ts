export function getGridScript(): string {
    return `
      const vscode = acquireVsCodeApi();
      const grid = document.getElementById('grid');
      let isEditing = false;
  
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
      }
  
      function saveGridToVSCode() {
        const rows = Array.from(grid.querySelectorAll('tr'));
        const result = [];
  
        rows.forEach(tr => {
          const cells = Array.from(tr.querySelectorAll('td')).filter(c => c.dataset && c.dataset.col);
          const codeCell = cells.find(c => c.dataset.edit === 'true');
          if (!codeCell) {
            result.push('');
            return;
          }
          const indentLevel = parseInt(codeCell.dataset.col);
          const indent = '    '.repeat(indentLevel);
          const code = codeCell.textContent.trimEnd();
          result.push(indent + code);
        });
  
        vscode.postMessage({ command: 'save', lines: result });
      }
  
      grid.addEventListener('keydown', (e) => {
        const cell = document.activeElement;
        if (!cell.dataset) return;
  
        const row = parseInt(cell.dataset.row);
        const col = parseInt(cell.dataset.col);
        let next;
  
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
          e.preventDefault();
          saveGridToVSCode();
          return;
        }
  
        if (e.key === 'Enter') {
          e.preventDefault();
          if (isEditing) {
            exitEditMode(cell);
          } else if (cell.dataset.edit === 'true') {
            enterEditMode(cell);
          }
          return;
        }
  
        if (!isEditing && e.key === 'Tab' && !e.shiftKey) {
          e.preventDefault();
          shiftCellRight(cell);
          return;
        }
  
        if (!isEditing && e.key === 'Tab' && e.shiftKey) {
          e.preventDefault();
          shiftCellLeft(cell);
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

      window.addEventListener('message', event => {
        const message = event.data;
        if (message.command === 'refreshGrid') {
        const gridBody = document.getElementById('grid-body');
        if (gridBody) gridBody.innerHTML = message.html;}
      });
    `;
  }
  