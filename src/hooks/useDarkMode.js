import { useCallback, useEffect, useState } from 'react';
import { getFromLocalStorage, saveToLocalStorage } from '../hooks/usePersistedState.js';

const STORAGE_KEY = 'PrefersDark';

const writeStoredPreference = (value) => saveToLocalStorage(STORAGE_KEY, value);

/**
 * Relies on the global `DarkReader` object loaded from the CDN script in index.html.
 */
export function useDarkMode() {
  const [prefersDark, setPrefersDark] = useState(() => {
    const stored = getFromLocalStorage(STORAGE_KEY);
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
