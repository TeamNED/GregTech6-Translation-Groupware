import { describe, expect, it } from 'vitest';
import { tokenize } from '../src/engine/tokenizer';

describe('tokenize', () => {
  it('keeps words and splits punctuation', () => {
    expect(tokenize('Crate of Rainforest Jasper Dust')).toEqual(['Crate', 'of', 'Rainforest', 'Jasper', 'Dust']);
    expect(tokenize('Anti-Actinium')).toEqual(['Anti', '-', 'Actinium']);
    expect(tokenize('Wire (EV)')).toEqual(['Wire', '(', 'EV', ')']);
  });

  it('keeps internal apostrophes', () => {
    expect(tokenize("Don't break")).toEqual(["Don't", 'break']);
  });

  it('handles non-ascii text', () => {
    expect(tokenize('熔融 HSLA 钢')).toEqual(['熔融', 'HSLA', '钢']);
  });
});
