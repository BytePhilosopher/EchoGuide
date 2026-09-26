/** Normalises for scoring: case, punctuation (including Ethiopic ። ፣ ፤ ፥ ፦ ፧ ፨) and spacing. */
export function normalizeForWer(text: string): string[] {
  return text
    .normalize('NFC')
    .toLowerCase()
    .replace(/[\p{P}፡-፨]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

/** Word-level edit distance: substitutions + deletions + insertions. */
export function wordEdits(reference: string[], hypothesis: string[]): number {
  const row = Array.from({ length: hypothesis.length + 1 }, (_, j) => j);
  for (let i = 1; i <= reference.length; i += 1) {
    let diagonal = row[0];
    row[0] = i;
    for (let j = 1; j <= hypothesis.length; j += 1) {
      const above = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, diagonal + (reference[i - 1] === hypothesis[j - 1] ? 0 : 1));
      diagonal = above;
    }
  }
  return row[hypothesis.length];
}

/** Corpus WER: total edits over total reference words, the standard aggregate. */
export function corpusWer(pairs: Array<{ reference: string; hypothesis: string }>): number {
  let edits = 0;
  let words = 0;
  for (const { reference, hypothesis } of pairs) {
    const ref = normalizeForWer(reference);
    edits += wordEdits(ref, normalizeForWer(hypothesis));
    words += ref.length;
  }
  return words === 0 ? 0 : edits / words;
}
