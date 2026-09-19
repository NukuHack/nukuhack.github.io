export const LANGUAGE_MAPPING = {
  csharp: 'C#',
  javascript: 'JavaScript',
  java: 'Java',
  python: 'Python',
  css: 'CSS',
  html: 'HTML',
  //jsx: 'JSX',
  //tsx: 'TSX',
  //typescript: 'TypeScript',
  c_lang: 'C',
  cplusplus: 'C++',
  haskell: 'Haskell',
};

export function capitalize(string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

export function languageLabel(lang) {
  return LANGUAGE_MAPPING[lang] || capitalize(lang);
}

/** Keyword -> [id, id, ...] */
export function buildInvertedIndex(data) {
  const index = {};
  data.forEach(({ id, keywords }) => {
    keywords.forEach((keyword) => {
      if (!index[keyword]) index[keyword] = [];
      index[keyword].push(id);
    });
  });
  return index;
}

/**
 * Returns the ids matching every term in `query` against the inverted
 * index (exact match, or substring match either direction as a fallback),
 * or `null` when the query is empty/too short (meaning "no search filter").
 */
export function searchDescriptions(query, invertedIndex) {
  const searchTerms = query.split(/\s+/).filter((term) => term.length > 1);
  if (searchTerms.length < 1) return null;

  let results = [];
  searchTerms.forEach((term) => {
    const termResults = invertedIndex[term]
      ? invertedIndex[term]
      : Object.keys(invertedIndex)
          .filter((key) => key.includes(term) || term.includes(key))
          .flatMap((key) => invertedIndex[key]);

    results = results.length === 0 ? [...termResults] : results.filter((id) => termResults.includes(id));
  });

  return results;
}
