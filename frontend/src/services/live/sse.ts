/** One server-sent event: its name ("message" when none was given) and its data lines joined. */
export interface SseEvent {
  event: string;
  data: string;
}

/**
 * Incremental parser for the text/event-stream format (HTML spec, "event stream interpretation").
 * Feed it chunks as they arrive; it returns the complete events found so far. Comments (lines starting
 * with ":") are heartbeats and are skipped.
 */
export class SseParser {
  private buffer = '';
  private event = '';
  private data: string[] = [];

  push(chunk: string): SseEvent[] {
    this.buffer += chunk;
    const events: SseEvent[] = [];
    let newline: number;
    while ((newline = this.buffer.search(/\r\n|\r|\n/)) >= 0) {
      const line = this.buffer.slice(0, newline);
      const width = this.buffer.startsWith('\r\n', newline) ? 2 : 1;
      this.buffer = this.buffer.slice(newline + width);
      if (line === '') {
        if (this.data.length) events.push({ event: this.event || 'message', data: this.data.join('\n') });
        this.event = '';
        this.data = [];
        continue;
      }
      if (line.startsWith(':')) continue;
      const colon = line.indexOf(':');
      const field = colon === -1 ? line : line.slice(0, colon);
      let value = colon === -1 ? '' : line.slice(colon + 1);
      if (value.startsWith(' ')) value = value.slice(1);
      if (field === 'event') this.event = value;
      else if (field === 'data') this.data.push(value);
    }
    return events;
  }
}
