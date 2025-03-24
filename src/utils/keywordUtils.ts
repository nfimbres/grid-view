export const keywords = [
    'def', 'class', 'if', 'for', 'while', 'with',
    'try', 'except', 'else', 'elif'
  ];
  
  export function findKeyword(line: string): string | undefined {
    const trimmed = line.trim();
    return keywords.find(kw => trimmed.startsWith(kw + ' ') || trimmed.startsWith(kw + '('));
  }
  