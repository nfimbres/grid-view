// Import utility functions for escaping HTML and working with keywords
import { escapeHtml } from './htmlEscape';
import { keywords, findKeyword } from './keywordUtils';

// Interface to represent an entry in the keyword stack
// Each entry tracks the indentation level and the associated keyword
interface KeywordStackEntry {
  indent: number;
  keyword: string;
}

// Function to build table rows from an array of lines
// Each line is converted into a row of cells, with indentation and keywords visualized
export function buildTableRows(lines: string[], maxCols = 5): string {
  const indentStack: KeywordStackEntry[] = []; // Stack to track indentation and keywords

  // Map each line to a table row
  return lines.map((line, rowIndex) => {
    // Determine the indentation level of the line
    const indentText = line.match(/^\s*/)?.[0] ?? ''; // Match leading whitespace
    const spaces = indentText.replace(/\t/g, '    '); // Convert tabs to spaces
    const indentLevel = Math.floor(spaces.length / 4); // Calculate indentation level (4 spaces per level)

    // Check if the line starts with a recognized keyword
    const foundKeyword = findKeyword(line);

    // Pop entries from the stack if the current indentation level is less than the stack's top entry
    while (indentStack.length > 0 && indentStack[indentStack.length - 1].indent >= indentLevel) {
      indentStack.pop();
    }

    // Push the current keyword onto the stack if one is found
    if (foundKeyword) {
      indentStack.push({ indent: indentLevel, keyword: foundKeyword });
    }

    // Get the list of keywords currently in the stack
    const currentKeywords = indentStack.map(k => k.keyword);

    // Initialize the cells for the current row
    const cells = [`<td class="line-number">${rowIndex + 1}</td>`]; // Add a line number cell

    // Build cells for each column in the row
    for (let col = 0; col < maxCols; col++) {
      const dataAttrs = `data-row="${rowIndex}" data-col="${col}"`; // Data attributes for row and column
      let content = ''; // Cell content
      let className = ''; // CSS class for styling
      let editable = col === indentLevel ? 'true' : 'false'; // Make the cell editable if it matches the indent level

      if (col === indentLevel) {
        // If the column matches the indent level, display the line's content
        content = escapeHtml(line.trimStart());
      } else if (col < indentLevel && currentKeywords[col]) {
        // If the column is within the indentation level, display the keyword context
        const kw = currentKeywords[col];
        content = `↳within <em>${escapeHtml(kw)}</em>`; // Show the keyword context
        // Assign a color class based on the keyword type
        if (kw === 'def') className = 'blue';
        else if (kw === 'if') className = 'yellow';
        else if (kw === 'for') className = 'green';
        else if (kw === 'while') className = 'red';
      } else {
        // Ensure empty cells are clean
        content = '';
        className = '';
      }

      // Add the cell to the row
      cells.push(`<td tabindex="0" ${dataAttrs} data-edit="${editable}" contenteditable="false" class="${className}">${content}</td>`);
    }

    // Return the complete row as a string
    return `<tr>${cells.join('')}</tr>`;
  }).join('\n'); // Join all rows into a single string
}

// Function to build an HTML table from a block of text
// Splits the text into lines and converts each line into a table row
export function buildTableFromText(text: string): string {
  const lines = text.split(/\r?\n/); // Split the text into lines
  return buildTableRows(lines); // Build table rows from the lines
}