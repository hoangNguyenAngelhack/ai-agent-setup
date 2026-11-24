/** Words that carry no routing signal. */
const STOPWORDS = new Set(
  'a an and are as at be by can do does for from has have how i in into is it its me my new of on or our out the their them then this to up us we what when which why will with without you your all any each every get make makes use using via should would could also so than that these those there here over under about after before between both but not no only own same some such too very just more most other few its it\'s let'.split(' '),
);

/** Lowercases and keeps letters, digits and the symbols in names like c#, .net, node.js, ci/cd. */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9#+./-]+/g, ' ')
    .replace(/(^|\s)[./-]+|[./-]+(\s|$)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Light suffix stripping so "tests", "testing" and "tested" share a stem. */
export function stem(word: string): string {
  if (word.length > 5 && word.endsWith('ing')) return word.slice(0, -3);
  if (word.length > 5 && word.endsWith('ied')) return `${word.slice(0, -3)}y`;
  if (word.length > 4 && word.endsWith('ies')) return `${word.slice(0, -3)}y`;
  if (word.length > 5 && word.endsWith('ed') && !word.endsWith('eed')) return word.slice(0, -2);
  if (word.length > 3 && word.endsWith('s') && !word.endsWith('ss') && !word.endsWith('us')) return word.slice(0, -1);
  return word;
}

/** Stemmed content words, in order. */
export function terms(text: string): string[] {
  return normalize(text)
    .split(' ')
    .flatMap((word) => word.split('/'))
    .filter((word) => word.length > 1 && !STOPWORDS.has(word))
    .map(stem);
}

/** All 1- to 3-word sequences of stemmed terms, joined by spaces. */
export function ngrams(stems: readonly string[], maxLength = 3): Set<string> {
  const result = new Set<string>();
  for (let start = 0; start < stems.length; start += 1) {
    for (let length = 1; length <= maxLength && start + length <= stems.length; length += 1) {
      result.add(stems.slice(start, start + length).join(' '));
    }
  }
  return result;
}
