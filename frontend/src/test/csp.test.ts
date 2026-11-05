// @vitest-environment node
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8');

describe('Content-Security-Policy', () => {
  it('allows the inline theme script in index.html, in nginx and in Caddy', () => {
    const inline = [...read('../../index.html').matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => `'sha256-${createHash('sha256').update(m[1]).digest('base64')}'`);
    expect(inline).toHaveLength(1);
    expect(read('../../security-headers.conf')).toContain(inline[0]);
    expect(read('../../../infrastructure/caddy/Caddyfile')).toContain(inline[0]);
  });

  it('lets voice typing use the microphone', () => {
    expect(read('../../security-headers.conf')).toContain('microphone=(self)');
    expect(read('../../../infrastructure/caddy/Caddyfile')).toContain('microphone=(self)');
  });
});
