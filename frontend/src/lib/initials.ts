/** Up to two initials for an avatar, ignoring honorifics like “Dr.”. */
export function initials(name: string): string {
  const parts = name
    .replace(/^(dr|mr|mrs|ms)\.?\s+/i, '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return '?';
  return ((parts[0][0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}
