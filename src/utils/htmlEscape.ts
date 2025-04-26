// Function to escape special HTML characters in a string
// This prevents issues like HTML injection by replacing special characters with their HTML entities
export function escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;') // Replace '&' with '&amp;'
      .replace(/</g, '&lt;')  // Replace '<' with '&lt;'
      .replace(/>/g, '&gt;'); // Replace '>' with '&gt;'
}
