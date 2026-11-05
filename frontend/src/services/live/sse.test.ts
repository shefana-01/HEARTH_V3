import { describe, expect, it } from 'vitest';
import { SseParser } from './sse';

describe('server-sent events parser', () => {
  it('reads named events split across chunks, skipping heartbeats', () => {
    const parser = new SseParser();
    expect(parser.push('event:ready\ndata:{"scopes":[]}\n\n:keep-alive\n\nevent:cha')).toEqual([{ event: 'ready', data: '{"scopes":[]}' }]);
    expect(parser.push('nge\ndata: {"scopes":["tasks"]}\r\n\r\n')).toEqual([{ event: 'change', data: '{"scopes":["tasks"]}' }]);
  });

  it('joins multi-line data and defaults the event name', () => {
    expect(new SseParser().push('data:a\ndata:b\n\n')).toEqual([{ event: 'message', data: 'a\nb' }]);
  });
});
