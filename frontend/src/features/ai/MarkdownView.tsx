import { Fragment, type ReactNode } from 'react';

/**
 * Rich, safe React Markdown renderer styled after ChatGPT and Google Gemini responses.
 * Supports headings (#, ##, ###, ####), Markdown tables (| a | b |), bullet & numbered lists,
 * blockquotes (>), fenced code blocks (```), horizontal rules (---), and inline formatting.
 */
export function MarkdownView({ content, className = '' }: { content: string; className?: string }) {
  const lines = content.replace(/\r\n/g, '\n').split('\n');
  const elements: ReactNode[] = [];

  let i = 0;
  let keySeq = 0;

  while (i < lines.length) {
    const raw = lines[i];
    const trimmed = raw.trim();

    // Skip empty lines
    if (!trimmed) {
      i++;
      continue;
    }

    // Horizontal rule
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      elements.push(<hr key={keySeq++} className="my-3 border-line" />);
      i++;
      continue;
    }

    // Fenced code block
    if (trimmed.startsWith('```')) {
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      if (i < lines.length) i++; // skip closing ```
      elements.push(
        <pre key={keySeq++} className="my-2.5 overflow-x-auto rounded-xl border border-line bg-surface-muted p-3 font-mono text-xs leading-relaxed text-ink">
          <code>{codeLines.join('\n')}</code>
        </pre>,
      );
      continue;
    }

    // Headings
    const headingMatch = trimmed.match(/^(#{1,4})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const text = headingMatch[2];
      const headingClass =
        level === 1
          ? 'pt-2 font-display text-lg font-bold text-ink'
          : level === 2
            ? 'pt-2 font-display text-base font-bold text-ink'
            : level === 3
              ? 'pt-1.5 font-display text-sm font-semibold text-ink'
              : 'pt-1 text-xs font-semibold uppercase tracking-wider text-ink-muted';
      elements.push(
        <div key={keySeq++} className={headingClass}>
          {formatInline(text)}
        </div>,
      );
      i++;
      continue;
    }

    // Markdown Table: line starts and ends with | (or contains |) and next line is separator |---|---|
    if (trimmed.includes('|') && i + 1 < lines.length && /^\s*\|?[\s:-]+\|[\s|:-]*$/.test(lines[i + 1])) {
      const parseRow = (rowLine: string) =>
        rowLine
          .trim()
          .replace(/^\|/, '')
          .replace(/\|$/, '')
          .split('|')
          .map((cell) => cell.trim());

      const headers = parseRow(trimmed);
      i += 2; // skip header + separator
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().includes('|') && lines[i].trim() !== '') {
        if (/^\s*\|?[\s:-]+\|[\s|:-]*$/.test(lines[i].trim())) {
          i++;
          continue;
        }
        rows.push(parseRow(lines[i]));
        i++;
      }
      elements.push(
        <div key={keySeq++} className="my-2.5 overflow-x-auto rounded-xl border border-line bg-surface shadow-2xs">
          <table className="w-full border-collapse text-left text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-line bg-surface-muted/80 text-xs font-semibold text-ink">
                {headers.map((h, hIdx) => (
                  <th key={hIdx} className="px-3 py-2 font-semibold">
                    {formatInline(h)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((r, rIdx) => (
                <tr key={rIdx} className="transition hover:bg-surface-muted/40">
                  {r.map((cell, cIdx) => (
                    <td key={cIdx} className="px-3 py-2 align-top text-ink">
                      {formatInline(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }

    // Blockquote
    if (trimmed.startsWith('>')) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        quoteLines.push(lines[i].trim().replace(/^>\s?/, ''));
        i++;
      }
      elements.push(
        <blockquote key={keySeq++} className="my-2 rounded-r-xl border-l-3 border-primary-500 bg-primary-50/50 py-2 pr-3 pl-3.5 text-xs sm:text-sm text-ink">
          {quoteLines.map((ql, qIdx) => (
            <p key={qIdx}>{formatInline(ql)}</p>
          ))}
        </blockquote>,
      );
      continue;
    }

    // Unordered list
    if (/^[-*•]\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*•]\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^[-*•]\s+/, ''));
        i++;
      }
      elements.push(
        <ul key={keySeq++} className="my-1.5 list-disc space-y-1.5 pl-5 text-ink">
          {items.map((item, idx) => (
            <li key={idx} className="leading-relaxed">
              {formatInline(item)}
            </li>
          ))}
        </ul>,
      );
      continue;
    }

    // Ordered list
    if (/^\d+\.\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^\d+\.\s+/, ''));
        i++;
      }
      elements.push(
        <ol key={keySeq++} className="my-1.5 list-decimal space-y-1.5 pl-5 text-ink">
          {items.map((item, idx) => (
            <li key={idx} className="leading-relaxed">
              {formatInline(item)}
            </li>
          ))}
        </ol>,
      );
      continue;
    }

    // Paragraph (consume consecutive plain lines)
    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !lines[i].trim().startsWith('```') &&
      !/^(#{1,4})\s+/.test(lines[i].trim()) &&
      !/^[-*•]\s+/.test(lines[i].trim()) &&
      !/^\d+\.\s+/.test(lines[i].trim()) &&
      !lines[i].trim().startsWith('>') &&
      !(lines[i].trim().includes('|') && i + 1 < lines.length && /^\s*\|?[\s:-]+\|[\s|:-]*$/.test(lines[i + 1]))
    ) {
      paraLines.push(lines[i].trim());
      i++;
    }
    elements.push(
      <p key={keySeq++} className="whitespace-pre-line leading-relaxed text-ink">
        {formatInline(paraLines.join('\n'))}
      </p>,
    );
  }

  return <div className={`space-y-2.5 text-sm leading-relaxed ${className}`}>{elements}</div>;
}

/** Parses bold, italic, and inline code formatting inside a single text block. */
function formatInline(text: string): ReactNode {
  const tokens = text.split(/(\*\*.*?\*\*|\*[^*]+?\*|`[^`]+?`)/g);

  return tokens.map((token, idx) => {
    if (token.startsWith('**') && token.endsWith('**') && token.length >= 4) {
      return (
        <strong key={idx} className="font-semibold text-ink">
          {token.slice(2, -2)}
        </strong>
      );
    }
    if (token.startsWith('*') && token.endsWith('*') && token.length >= 2) {
      return (
        <em key={idx} className="italic text-ink-muted">
          {token.slice(1, -1)}
        </em>
      );
    }
    if (token.startsWith('`') && token.endsWith('`') && token.length >= 2) {
      return (
        <code key={idx} className="rounded-md bg-surface-muted px-1.5 py-0.5 font-mono text-xs text-primary-800">
          {token.slice(1, -1)}
        </code>
      );
    }
    return <Fragment key={idx}>{token}</Fragment>;
  });
}
