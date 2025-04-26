// Define a list of keywords that are commonly used in Python
export const keywords = [
    'def', 'class', 'if', 'for', 'while', 'with',
    'try', 'except', 'else', 'elif'
];

// Function to find a keyword at the start of a given line
// This checks if the line starts with any of the defined keywords followed by a space or parenthesis
export function findKeyword(line: string): string | undefined {
    const trimmed = line.trim(); // Remove leading and trailing whitespace
    return keywords.find(kw => trimmed.startsWith(kw + ' ') || trimmed.startsWith(kw + '('));
}

// Function to classify a line based on the keyword it starts with
// This returns a descriptive string indicating the type of keyword found
export function classifyKeywords(line: string): string {
    if (/^\s*for\b/.test(line)) return 'within for'; // Line starts with 'for'
    if (/^\s*if\b/.test(line)) return 'within if';   // Line starts with 'if'
    if (/^\s*def\b/.test(line)) return 'function def'; // Line starts with 'def'
    return 'none'; // No recognized keyword found
}