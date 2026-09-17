import { describe, it, expect } from 'vitest';
import { toCsv } from './csv';

describe('toCsv', () => {
  it('joins plain rows without quoting', () => {
    expect(toCsv([['a', 'b'], [1, 2]])).toBe('a,b\n1,2');
  });

  it('quotes fields containing commas', () => {
    expect(toCsv([['a,b', 'c']])).toBe('"a,b",c');
  });

  it('quotes fields containing double quotes and doubles internal quotes', () => {
    expect(toCsv([[`say "hi"`]])).toBe('"say ""hi"""');
  });

  it('quotes fields containing newlines', () => {
    expect(toCsv([['line1\nline2', 'x']])).toBe('"line1\nline2",x');
  });

  it('quotes fields containing carriage returns', () => {
    expect(toCsv([['a\rb']])).toBe('"a\rb"');
  });

  it('prefixes a single quote on formula-injection cells', () => {
    expect(toCsv([['=SUM(A1)', '+1', '-2', '@cmd', 'plain']])).toBe(
      "'=SUM(A1),'+1,'-2,'@cmd,plain"
    );
  });

  it('quotes formula cells that also need RFC 4180 quoting', () => {
    expect(toCsv([['=1,2']])).toBe('"\'=1,2"');
  });

  it('treats null/undefined cells as empty strings', () => {
    expect(toCsv([[null, undefined, 'x']])).toBe(',,x');
  });
});