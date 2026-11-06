import { Fragment, type ReactNode } from 'react';

/**
 * Lightweight, safe React markdown formatter for AI chat messages.
 * Formats headings, bold, italics, inline code, numbered & bullet lists, and paragraphs.
 */
export function MarkdownView({ content, className = '' }: { content: string; className?: string }) {
  const blocks = content.trim().split(/\n\s*\n/);

  return (
    <div className={`space-y-2 text-sm leading-relaxed ${className}`}>
      {blocks.map((block, bIdx) => {
        const trimmed = block.trim();

        // Heading 3: ### Title
        if (trimmed.startsWith('### ')) {
          return (
            <h4 key={bIdx} className="pt-2 font-display text-base font-semibold text-ink">
              {formatInline(trimmed.slice(4))}
            </h4>
          );
        }

        // Heading 2: ## Title
        if (trimmed.startsWith('## ')) {
          return (
            <h3 key={bIdx} className="pt-2 font-display text-lg font-semibold text-ink">
              {formatInline(trimmed.slice(3))}
            </h3>
          );
        }

        // Bullet lists
        if (trimmed.split('\n').every((line) => line.trim().startsWith('- ') || line.trim().startsWith('* '))) {
          const items = trimmed.split('\n').map((line) => line.trim().replace(/^[-*]\s+/, ''));
          return (
            <ul key={bIdx} className="list-disc space-y-1 pl-5">
              {items.map((item, iIdx) => (
                <li key={iIdx}>{formatInline(item)}</li>
              ))}
            </ul>
          );
        }

        // Numbered lists
        if (trimmed.split('\n').every((line) => /^\d+\.\s+/.test(line.trim()))) {
          const items = trimmed.split('\n').map((line) => line.trim().replace(/^\d+\.\s+/, ''));
          return (
            <ol key={bIdx} className="list-decimal space-y-1 pl-5">
              {items.map((item, iIdx) => (
                <li key={iIdx}>{formatInline(item)}</li>
              ))}
            </ol>
          );
        }

        // Standard paragraph
        return (
          <p key={bIdx} className="whitespace-pre-line">
            {formatInline(trimmed)}
          </p>
        );
      })}
    </div>
  );
}

/** Parses bold, italic, and inline code formatting inside a single text block. */
function formatInline(text: string): ReactNode {
  // Regex to split on **bold**, *italic*, and `code`
  const tokens = text.split(/(\*\*.*?\*\*|\*.*?\*|`.*?`)/g);

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
        <em key={idx} className="italic text-ink">
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
