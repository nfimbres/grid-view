import { escapeHtml } from './htmlEscape';
import { keywords, findKeyword } from './keywordUtils';

interface KeywordStackEntry {
  indent: number;
  keyword: string;
}

export function buildTableRows(lines: string[], maxCols = 5): string {
  const indentStack: KeywordStackEntry[] = [];

  return lines.map((line, rowIndex) => {
    const indentText = line.match(/^\s*/)?.[0] ?? '';
    const spaces = indentText.replace(/\t/g, '    ');
    const indentLevel = Math.floor(spaces.length / 4);
    const foundKeyword = findKeyword(line);

    while (indentStack.length > 0 && indentStack[indentStack.length - 1].indent >= indentLevel) {
      indentStack.pop();
    }

    if (foundKeyword) {
      indentStack.push({ indent: indentLevel, keyword: foundKeyword });
    }

    const currentKeywords = indentStack.map(k => k.keyword);
    const cells = [`<td class="line-number">${rowIndex + 1}</td>`];

    for (let col = 0; col < maxCols; col++) {
      const dataAttrs = `data-row="${rowIndex}" data-col="${col}"`;
      let content = '';
      let className = '';
      let editable = col === indentLevel ? 'true' : 'false';

      if (col === indentLevel) {
        content = escapeHtml(line.trimStart());
      } else if (col < indentLevel && currentKeywords[col]) {
        const kw = currentKeywords[col];
        content = `↳within <em>${escapeHtml(kw)}</em>`;
        if (kw === 'def') className = 'blue';
        else if (kw === 'if') className = 'yellow';
        else if (kw === 'for') className = 'green';
        else if (kw === 'while') className = 'red';
      } else {
        content = ''; // Ensure empty cells are clean
        className = '';
      }

      // Clean, plain empty cells otherwise
      cells.push(`<td tabindex="0" ${dataAttrs} data-edit="${editable}" contenteditable="false" class="${className}">${content}</td>`);
    }

    return `<tr>${cells.join('')}</tr>`;
  }).join('\n');
}

export function buildTableFromText(text: string): string {
  const lines = text.split(/\r?\n/);
  return buildTableRows(lines);
}