import { describe, expect, it } from 'vitest';
import { detectDelimiter, parseCsv, toCsv } from './csv';

describe('csv', () => {
  it('parses quotes, escaped quotes and CRLF', () => {
    expect(parseCsv('a,"b, c","d ""e"""\r\n1,2,3\r\n')).toEqual([
      ['a', 'b, c', 'd "e"'],
      ['1', '2', '3'],
    ]);
  });
  it('handles a BOM and blank lines', () => {
    expect(parseCsv('﻿x,y\n\n1,2\n')).toEqual([
      ['x', 'y'],
      ['1', '2'],
    ]);
  });
  it('detects semicolons', () => {
    expect(detectDelimiter('a;b;c\n')).toBe(';');
  });
  it('round-trips', () => {
    const text = toCsv(['n', 'v'], [['Bench, flat', 'he said "hi"']]);
    expect(parseCsv(text)).toEqual([
      ['n', 'v'],
      ['Bench, flat', 'he said "hi"'],
    ]);
  });
});
