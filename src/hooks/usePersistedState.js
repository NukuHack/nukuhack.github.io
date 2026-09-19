import { useEffect, useState } from 'react';

export function saveToLocalStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error('Error saving to localStorage:', e);
  }
}

export function getFromLocalStorage(key) {
  try {
    const value = localStorage.getItem(key);
    return value !== null ? JSON.parse(value) : undefined;
  } catch (e) {
    console.error('Error reading localStorage:', e);
    return undefined;
  }
}

export function removeFromLocalStorage(key) {
  try {
    localStorage.removeItem(key);
  } catch (e) {
    console.error('Error removing from localStorage:', e);
  }
}

/** useState that is initialised from, and kept in sync with, localStorage. */
export function usePersistedState(key, defaultValue) {
  const [state, setState] = useState(() => {
    const stored = getFromLocalStorage(key);
    return stored !== undefined ? stored : defaultValue;
  });

  useEffect(() => {
    saveToLocalStorage(key, state);
  }, [key, state]);

  return [state, setState];
}
