import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'PrefersDark';

function readStoredPreference() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw !== null ? JSON.parse(raw) : undefined;
  } catch (e) {
    console.error('Error reading localStorage:', e);
    return undefined;
  }
}

function writeStoredPreference(value) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch (e) {
    console.error('Error saving to localStorage:', e);
  }
}

/**
 * Relies on the global `DarkReader` object loaded from the CDN script in index.html.
 */
export function useDarkMode() {
  const [prefersDark, setPrefersDark] = useState(() => {
    const stored = readStoredPreference();
    if (stored !== undefined) return stored;
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? true;
  });

  const applyDarkReader = useCallback((enabled) => {
    if (typeof window === 'undefined' || !window.DarkReader) return;
    if (enabled) {
      window.DarkReader.enable();
    } else {
      window.DarkReader.disable();
    }
  }, []);

  useEffect(() => {
    // On mount, persist whatever default we resolved to, then apply it.
    writeStoredPreference(prefersDark);
    applyDarkReader(prefersDark);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleDarkMode = useCallback(() => {
    setPrefersDark((prev) => {
      const next = !prev;
      writeStoredPreference(next);
      applyDarkReader(next);
      return next;
    });
  }, [applyDarkReader]);

  return { prefersDark, toggleDarkMode };
}
