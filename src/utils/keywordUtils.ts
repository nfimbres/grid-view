export const keywords = [
    'def', 'class', 'if', 'for', 'while', 'with',
    'try', 'except', 'else', 'elif'
  ];
  
  export function findKeyword(line: string): string | undefined {
    const trimmed = line.trim();
    return keywords.find(kw => trimmed.startsWith(kw + ' ') || trimmed.startsWith(kw + '('));
  }
  
  export function classifyKeywords(line: string): string {
    if (/^\s*for\b/.test(line)) return 'within for';
    if (/^\s*if\b/.test(line)) return 'within if';
    if (/^\s*def\b/.test(line)) return 'function def';
    return 'none';
  }