export function parseUrlTableText(text) {
  const lines = text.split('\n');
  const items = [];
  const groupsFound = new Set();
  let validCount = 0;
  let skippedCount = 0;

  lines.forEach((rawLine, i) => {
    const line = rawLine.trim();
    if (!line) {
      skippedCount++;
      return;
    }

    const parts = line.split(';');
    const url = parts[0].trim();
    const extraData = parts[1] ? parts[1].trim() : 'No Data Found';

    let groups = [];
    const groupMatch = line.match(/\{(.*)\}/);
    if (groupMatch) {
      groups = groupMatch[1].split(';').map((g) => g.trim()).filter((g) => g.length > 0);
      groups.forEach((g) => groupsFound.add(g));
    }

    let validUrl = false;
    try {
      new URL(url);
      validUrl = true;
    } catch {
      /* invalid */
    }

    items.push({ url, extraData, groups, validUrl, lineNumber: i + 1, id: Date.now() + Math.random() });
    validCount++;
  });

  return { items, groupsFound, validCount, skippedCount, totalLines: lines.length };
}

export function buildFileContent(allData) {
  return (
    allData
      .map((item) => {
        let line = `${item.url};${item.extraData}`;
        if (item.groups && item.groups.length > 0) line += `;{${item.groups.join(';')}}`;
        return line;
      })
      .join('\n') + '\n'
  );
}

export function applyFilterToData(data, currentFilter, currentSearch) {
  let filtered = data;
  if (currentFilter !== 'all') {
    if (currentFilter === 'ungrouped') {
      filtered = filtered.filter((d) => d.groups.length === 0);
    } else {
      filtered = filtered.filter((d) => d.groups.includes(currentFilter));
    }
  }
  if (currentSearch) {
    filtered = filtered.filter(
      (d) => d.url.toLowerCase().includes(currentSearch) || d.extraData.toLowerCase().includes(currentSearch)
    );
  }
  return filtered;
}

/**
 * Splits `text` into [{text, hl}] segments around case-insensitive matches
 * of `term`, for rendering as JSX (<mark> around hl:true segments) instead
 * of the original's regex-based innerHTML + <mark> string building.
 */
export function highlightParts(text, term) {
  if (!term) return [{ text, hl: false }];

  const lower = text.toLowerCase();
  const lowerTerm = term.toLowerCase();
  const parts = [];
  let i = 0;

  while (i < text.length) {
    const idx = lower.indexOf(lowerTerm, i);
    if (idx === -1) {
      parts.push({ text: text.slice(i), hl: false });
      break;
    }
    if (idx > i) parts.push({ text: text.slice(i, idx), hl: false });
    parts.push({ text: text.slice(idx, idx + term.length), hl: true });
    i = idx + term.length;
  }

  return parts;
}

export const GROUP_NAME_PATTERN = /^[\p{L}0-9\s_-]+$/u;
