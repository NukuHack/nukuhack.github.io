import { useEffect, useMemo, useRef, useState } from 'react';
import '../styles/urltable.css';
import { initWasmCompression } from '../lib/urltableWasm.js';
import { parseUrlTableText, buildFileContent, applyFilterToData, highlightParts, GROUP_NAME_PATTERN } from '../lib/urltableParse.js';
import { getFromLocalStorage, saveToLocalStorage, removeFromLocalStorage } from '../hooks/usePersistedState.js';

const AUTO_LOAD_KEY = 'urlDataAutoLoad';

const SAMPLE_DATA = [
  { id: 1, url: 'https://www.wikipedia.org/', extraData: 'Online encyclopedia', groups: ['Reference', 'Education'], validUrl: true },
  { id: 2, url: 'https://github.com/', extraData: 'Version control', groups: ['Development', 'Tools'], validUrl: true },
  { id: 3, url: 'https://stackoverflow.com/', extraData: 'Q&A for programmers', groups: ['Development', 'Reference'], validUrl: true },
  { id: 4, url: 'invalid-without-protocol', extraData: 'Missing http://', groups: [], validUrl: false },
];

function Highlighted({ text, term }) {
  const parts = highlightParts(text, term);
  return (
    <>
      {parts.map((p, i) =>
        p.hl ? (
          <mark className="search-hl" key={i}>
            {p.text}
          </mark>
        ) : (
          <span key={i}>{p.text}</span>
        )
      )}
    </>
  );
}

export default function UrlTable() {
  const [allData, setAllData] = useState([]);
  const [allGroups, setAllGroups] = useState([]); // ordered like a Set (insertion order)
  const [isModified, setIsModified] = useState(false);
  const [currentFilter, setCurrentFilter] = useState('all');
  const [currentSearch, setCurrentSearch] = useState('');
  const [currentFileName, setCurrentFileName] = useState(null);
  const [fileLoaded, setFileLoaded] = useState(false);
  const [status, setStatus] = useState(null); // { message, type }
  const [newGroupInputValue, setNewGroupInputValue] = useState('');
  const [techOpen, setTechOpen] = useState(false);
  const [autoLoadEnabled, setAutoLoadEnabled] = useState(() => getFromLocalStorage(AUTO_LOAD_KEY) !== '0');
  const [autosaveToastVisible, setAutosaveToastVisible] = useState(false);

  const [editing, setEditing] = useState(null); // { id, extraData, url, isNew }
  const [groupModal, setGroupModal] = useState(null); // { itemId, availableGroups, selectValue, newGroupValue }

  const fileInputRef = useRef(null);
  const searchInputRef = useRef(null);
  const newGroupInputRef = useRef(null);
  const autosaveTimerRef = useRef(null);

  const addGroupToSet = (name) => setAllGroups((prev) => (prev.includes(name) ? prev : [...prev, name]));

  function showStatus(message, type) {
    setStatus({ message, type });
  }
  function clearStatus() {
    setStatus(null);
  }

  function markModified() {
    setIsModified(true);
  }
  function markSaved() {
    setIsModified(false);
  }

  // ── Unsaved changes guard ─────────────────────────────────────────────────
  useEffect(() => {
    function onBeforeUnload(e) {
      if (isModified) {
        e.preventDefault();
        e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
      }
    }
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [isModified]);

  // ── WASM compression loader ───────────────────────────────────────────────
  useEffect(() => {
    initWasmCompression().catch((err) => console.error('WASM compression unavailable:', err));
  }, []);

  // ── Auto-save ──────────────────────────────────────────────────────────────
  function autoSave(data, fileName) {
    try {
      const raw = buildFileContent(data);
      let stored = raw;
      let isCompressed = false;
      try {
        stored = window.compress(raw);
        isCompressed = true;
      } catch (compressErr) {
        console.warn('Compression failed, storing plain text:', compressErr);
      }
      saveToLocalStorage('urlDataAutoSave', stored);
      saveToLocalStorage('urlDataAutoSaveCompressed', isCompressed ? '1' : '0');
      saveToLocalStorage('urlDataFileName', fileName || 'url-data.txt');
      saveToLocalStorage('urlDataLastModified', new Date().toISOString());
    } catch (e) {
      console.warn('Auto-save failed:', e);
      return;
    }

    setAutosaveToastVisible(true);
    clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = setTimeout(() => setAutosaveToastVisible(false), 1400);
  }

  // ── Initial load: restore auto-save, else sample data ─────────────────────
  useEffect(() => {
    let cancelled = false;

    async function restoreAutoSave() {
      try {
        const packed = getFromLocalStorage('urlDataAutoSave');
        if (!packed) return false;

        const wasCompressed = getFromLocalStorage('urlDataAutoSaveCompressed') !== '0';
        let restored = packed;
        if (wasCompressed) {
          try {
            await window.decompReady; // ← wait for WASM
            restored = window.decompress(packed);
          } catch (decompressErr) {
            console.warn('Decompression failed, trying as plain text:', decompressErr);
            restored = packed;
          }
        }
        const savedFileName = getFromLocalStorage('urlDataFileName') || 'url-data.txt';
        const savedDate = getFromLocalStorage('urlDataLastModified');

        const { items, groupsFound, validCount, skippedCount } = parseUrlTableText(restored);
        if (items.length === 0 || cancelled) return false;

        setCurrentFileName(savedFileName);
        setAllData(items);
        setAllGroups(Array.from(groupsFound));
        setFileLoaded(true);

        const dateStr = savedDate ? ` (saved ${new Date(savedDate).toLocaleTimeString()})` : '';
        showStatus(`Auto-save restored: ${items.length} item(s)${dateStr}`, 'success');
        void validCount;
        void skippedCount;
        return true;
      } catch (e) {
        console.warn('Auto-save restore failed:', e);
        return false;
      }
    }

    (async () => {
      const autoLoadOn = getFromLocalStorage(AUTO_LOAD_KEY) !== '0';
      if (autoLoadOn && (await restoreAutoSave())) return;
      if (cancelled) return;

      setAllData(SAMPLE_DATA);
      const groups = new Set();
      SAMPLE_DATA.forEach((item) => item.groups.forEach((g) => groups.add(g)));
      setAllGroups(Array.from(groups));
      showStatus('Sample data loaded — load your own TXT file to begin.', 'empty');
      setCurrentFileName('sample-data.txt');
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── File loading ───────────────────────────────────────────────────────────
  function handleFileChange(e) {
    const file = e.target.files[0];
    if (!file) return;

    setFileLoaded(true);
    setCurrentFileName(file.name);
    clearStatus();
    setIsModified(false);
    showStatus('Loading and parsing file…', 'loading');

    const reader = new FileReader();
    reader.onload = (ev) => {
      let data = ev.target.result;
      try {
        data = window.decompress(data);
      } catch (err) {
        console.error('decomp error (hopefully not compressed):', err);
      }

      try {
        const { items, groupsFound, validCount, skippedCount, totalLines } = parseUrlTableText(data);

        if (items.length > 0) {
          setAllData(items);
          setAllGroups(Array.from(groupsFound));
          autoSave(items, file.name);
          showStatus(`Loaded ${items.length} item(s) successfully.`, 'success');
        } else {
          setAllData([]);
          setAllGroups([]);
          showStatus('File is empty or contains only blank lines.', 'empty');
        }
        void validCount;
        void skippedCount;
        void totalLines;
      } catch (err) {
        console.error('Parse error:', err);
        showStatus(`Error parsing file: ${err.message}`, 'error');
      }
    };
    reader.onerror = () => showStatus('Error reading the file.', 'error');
    reader.readAsText(file);

    e.target.value = '';
  }

  // ── Filtering / search / groups (derived) ─────────────────────────────────
  const filteredData = useMemo(
    () => applyFilterToData(allData, currentFilter, currentSearch),
    [allData, currentFilter, currentSearch]
  );

  const groupCounts = useMemo(() => {
    const counts = {};
    allGroups.forEach((g) => {
      counts[g] = allData.filter((d) => d.groups.includes(g)).length;
    });
    return counts;
  }, [allGroups, allData]);

  const ungroupedCount = useMemo(() => allData.filter((d) => d.groups.length === 0).length, [allData]);

  function applyFilter(next) {
    setCurrentFilter(next);
  }

  function handleClearFilter() {
    setCurrentFilter('all');
    setCurrentSearch('');
    if (searchInputRef.current) searchInputRef.current.value = '';
    showStatus('Filter cleared.', 'success');
  }

  // ── Group management ───────────────────────────────────────────────────────
  function handleAddGroupTag() {
    const name = newGroupInputValue.trim();
    if (!name) {
      showStatus('Please enter a group name.', 'error');
      return;
    }
    if (!GROUP_NAME_PATTERN.test(name)) {
      showStatus('Group name can only contain letters, numbers, spaces, hyphens and underscores.', 'error');
      return;
    }
    if (allGroups.includes(name)) {
      showStatus('Group already exists.', 'error');
      return;
    }
    addGroupToSet(name);
    setNewGroupInputValue('');
    showStatus(`Group "${name}" created.`, 'success');
  }

  function removeGroupFromItem(itemId, groupName) {
    setAllData((prev) => {
      const next = prev.map((item) => (item.id === itemId ? { ...item, groups: item.groups.filter((g) => g !== groupName) } : item));
      if (!next.some((d) => d.groups.includes(groupName))) {
        setAllGroups((groups) => groups.filter((g) => g !== groupName));
      }
      markModified();
      autoSave(next, currentFileName);
      return next;
    });
    showStatus(`Removed from group: ${groupName}`, 'success');
  }

  function removeGroupFromAll(groupName) {
    if (!confirm(`Remove group "${groupName}" from all items?`)) return;
    setAllData((prev) => {
      const next = prev.map((item) => ({ ...item, groups: item.groups.filter((g) => g !== groupName) }));
      markModified();
      autoSave(next, currentFileName);
      return next;
    });
    setAllGroups((groups) => groups.filter((g) => g !== groupName));
    showStatus(`Removed group "${groupName}" from all items.`, 'success');
  }

  function openGroupModal(itemId) {
    const item = allData.find((d) => d.id === itemId);
    if (!item) return;
    const available = allGroups.filter((g) => !item.groups.includes(g));
    setGroupModal({ itemId, availableGroups: available, selectValue: available.length ? '' : '__new__', newGroupValue: '' });
  }
  function closeGroupModal() {
    setGroupModal(null);
  }

  function confirmGroupModal() {
    if (!groupModal) return;
    const item = allData.find((d) => d.id === groupModal.itemId);
    if (!item) {
      closeGroupModal();
      return;
    }

    let groupName = groupModal.selectValue === '__new__' ? groupModal.newGroupValue.trim() : groupModal.selectValue;

    if (!groupName) {
      showStatus('Please select or enter a group name.', 'error');
      return;
    }
    if (groupName.includes('{') || groupName.includes('}') || groupName.includes(';')) {
      showStatus('Group name cannot contain {, }, or ;', 'error');
      return;
    }
    if (!GROUP_NAME_PATTERN.test(groupName)) {
      showStatus('Group name can only contain letters, numbers, spaces, hyphens and underscores.', 'error');
      return;
    }

    if (!item.groups.includes(groupName)) {
      addGroupToSet(groupName);
      setAllData((prev) => {
        const next = prev.map((d) => (d.id === item.id ? { ...d, groups: [...d.groups, groupName] } : d));
        markModified();
        autoSave(next, currentFileName);
        return next;
      });
      showStatus(`Added to group: ${groupName}`, 'success');
    }
    closeGroupModal();
  }

  // Escape closes the modal — a separate, independent listener from the
  // shortcuts one below, exactly like the original's two distinct
  // document-level keydown handlers (both can fire for the same keypress).
  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === 'Escape' && groupModal) closeGroupModal();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  });

  // ── Edit / delete / add line ────────────────────────────────────────────────
  function startEditRow(item, isNew = false) {
    setEditing({ id: item.id, extraData: item.extraData, url: item.url, isNew });
  }

  function saveEditRow() {
    if (!editing) return;
    const item = allData.find((d) => d.id === editing.id);
    if (!item) {
      setEditing(null);
      return;
    }

    const newExtra = editing.extraData.trim() || 'No Data Found';
    const newUrl = editing.url.trim();
    let validUrl = false;
    try {
      new URL(newUrl);
      validUrl = true;
    } catch {
      /* invalid */
    }

    if (newExtra !== item.extraData || newUrl !== item.url) {
      setAllData((prev) => {
        const next = prev.map((d) => (d.id === item.id ? { ...d, extraData: newExtra, url: newUrl, validUrl } : d));
        markModified();
        autoSave(next, currentFileName);
        return next;
      });
    }
    setEditing(null);
    showStatus('Changes saved.', 'success');
  }

  function revertEditRow() {
    if (!editing) return;
    if (editing.isNew) {
      setAllData((prev) => prev.filter((d) => d.id !== editing.id));
      showStatus('New entry discarded.', 'empty');
    } else {
      showStatus('Edit cancelled.', 'empty');
    }
    setEditing(null);
  }

  function deleteLine(id) {
    if (!confirm('Delete this entry?')) return;
    setAllData((prev) => {
      const next = prev.filter((item) => item.id !== id);
      markModified();
      autoSave(next, currentFileName);
      return next;
    });
    showStatus('Entry deleted.', 'success');
  }

  function addNewLine() {
    const newId = Date.now() + Math.random();
    const newItem = { id: newId, url: 'https://example.com', extraData: 'New entry', groups: [], validUrl: true };
    setAllData((prev) => [...prev, newItem]);
    setTimeout(() => {
      const newRow = document.querySelector(`tr[data-id="${newId}"]`);
      if (newRow) newRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
      startEditRow(newItem, true);
    }, 80);
  }

  // ── Save to file ─────────────────────────────────────────────────────────
  function saveToFile() {
    if (allData.length === 0) {
      showStatus('No data to save.', 'error');
      return;
    }

    let data = buildFileContent(allData);
    try {
      data = window.compress(data);
    } catch (error) {
      console.log(' compress error: ' + error);
    }

    const blob = new Blob([data], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = currentFileName || 'url-data-modified.txt';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);

    markSaved();
    removeFromLocalStorage('urlDataAutoSave');
    removeFromLocalStorage('urlDataFileName');
    removeFromLocalStorage('urlDataLastModified');
    showStatus('File saved successfully!', 'success');
  }

  // ── Keyboard shortcuts ───────────────────────────────────────────────────
  useEffect(() => {
    function onKeyDown(e) {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        saveToFile();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'e') {
        e.preventDefault();
        addNewLine();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'g') {
        e.preventDefault();
        newGroupInputRef.current?.focus();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      if (e.key === 'Escape' && currentFilter !== 'all') {
        e.preventDefault();
        setCurrentFilter('all');
        showStatus('Filter cleared.', 'success');
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allData, currentFileName, currentFilter]);

  // ── Cache clear & auto-load toggle ────────────────────────────────────────
  function handleAutoLoadToggle(e) {
    const checked = e.target.checked;
    setAutoLoadEnabled(checked);
    saveToLocalStorage(AUTO_LOAD_KEY, checked ? '1' : '0');
    showStatus(
      checked
        ? 'Auto-load enabled — saved data will be restored on next page load.'
        : 'Auto-load disabled — page will start fresh on next load.',
      'success'
    );
  }

  function handleClearCache() {
    const hasCache = getFromLocalStorage('urlDataAutoSave');
    if (!hasCache) {
      showStatus('No cached data to clear.', 'empty');
      return;
    }
    if (!confirm('Clear the locally cached data? This cannot be undone.')) return;
    removeFromLocalStorage('urlDataAutoSave');
    removeFromLocalStorage('urlDataAutoSaveCompressed');
    removeFromLocalStorage('urlDataFileName');
    removeFromLocalStorage('urlDataLastModified');
    showStatus('Cache cleared.', 'success');
  }

  return (
    <div className="app-layout">
      <aside className="sidebar" id="sidebar">
        <div className="sidebar-inner">
          {!fileLoaded && (
            <section className="side-section load-section" id="loadSection">
              <div className="side-label">LOAD FILE</div>
              <button className="load-btn load-btn-prominent" id="loadFileBtn" onClick={() => fileInputRef.current?.click()}>
                <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                  <path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5z" />
                  <path d="M7.646 11.854a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0-.708-.708L8.5 10.293V1.5a.5.5 0 0 0-1 0v8.793L5.354 8.146a.5.5 0 1 0-.708.708l3 3z" />
                </svg>
                Load TXT File
              </button>
              <input type="file" id="fileInput" ref={fileInputRef} accept=".txt" style={{ display: 'none' }} onChange={handleFileChange} />
              <div className="file-info">
                <span className="file-info-label">File:</span>
                <span id="fileName" className="file-name-val">
                  {currentFileName || 'None'}
                </span>
              </div>
              <p className="load-hint">
                Load a <code>.txt</code> file with lines like:
                <br />
                <code>https://url.com;Description;{'{Group}'}</code>
              </p>
            </section>
          )}

          <section className="side-section">
            <div className="side-label">SEARCH</div>
            <div className="search-wrap">
              <svg className="search-icon" width="13" height="13" fill="currentColor" viewBox="0 0 16 16">
                <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.099zm-5.242 1.656a5.5 5.5 0 1 1 0-11 5.5 5.5 0 0 1 0 11z" />
              </svg>
              <input
                type="text"
                id="searchInput"
                className="search-input"
                placeholder="desc, url…"
                ref={searchInputRef}
                onChange={(e) => setCurrentSearch(e.target.value.trim().toLowerCase())}
              />
            </div>
          </section>

          {allGroups.length > 0 || allData.length > 0 ? (
            <section className="side-section" id="groupSection">
              <div className="side-label">GROUPS</div>
              <div className="new-group-row">
                <input
                  type="text"
                  id="newGroupInput"
                  className="group-input"
                  placeholder="New group…"
                  maxLength={50}
                  ref={newGroupInputRef}
                  value={newGroupInputValue}
                  onChange={(e) => setNewGroupInputValue(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleAddGroupTag()}
                />
                <button id="addGroupBtn" className="icon-btn" title="Add group" onClick={handleAddGroupTag}>
                  <svg width="13" height="13" fill="currentColor" viewBox="0 0 16 16">
                    <path d="M8 4a.5.5 0 0 1 .5.5v3h3a.5.5 0 0 1 0 1h-3v3a.5.5 0 0 1-1 0v-3h-3a.5.5 0 0 1 0-1h3v-3A.5.5 0 0 1 8 4z" />
                  </svg>
                </button>
              </div>
              <div className="group-tags" id="groupTagsContainer">
                {allGroups.map((group) => (
                  <span
                    className={`group-tag${currentFilter === group ? ' active' : ''}`}
                    data-group={group}
                    key={group}
                    onClick={() => applyFilter(currentFilter === group ? 'all' : group)}
                  >
                    <span className="group-tag-name">{group}</span>
                    <span className="group-tag-count">{groupCounts[group] ?? 0}</span>
                    <button
                      className="remove-group"
                      title="Remove group from all"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeGroupFromAll(group);
                      }}
                    >
                      &times;
                    </button>
                  </span>
                ))}
              </div>
            </section>
          ) : null}

          {allGroups.length > 0 || allData.length > 0 ? (
            <section className="side-section" id="filterSection">
              <div className="side-label">FILTER</div>
              <select id="groupFilter" className="filter-select" value={currentFilter} onChange={(e) => applyFilter(e.target.value)}>
                <option value="all">All Links ({allData.length})</option>
                <option value="ungrouped">No Groups ({ungroupedCount})</option>
                {allGroups.map((g) => (
                  <option value={g} key={g}>
                    {g} ({groupCounts[g] ?? 0})
                  </option>
                ))}
              </select>
              <button id="clearFilterBtn" className="text-btn clear-filter-btn" onClick={handleClearFilter}>
                ✕ Clear filter
              </button>
            </section>
          ) : null}

          {allData.length > 0 && (
            <section className="side-section" id="statsContainer">
              <div className="side-label">STATS</div>
              <div className="stats-grid">
                <div className="stat-item">
                  <div className="stat-value" id="statTotal">
                    {allData.length}
                  </div>
                  <div className="stat-label">Total</div>
                </div>
                <div className="stat-item">
                  <div className="stat-value" id="statValid">
                    {allData.length}
                  </div>
                  <div className="stat-label">Valid</div>
                </div>
                <div className="stat-item">
                  <div className="stat-value" id="statSkipped">
                    0
                  </div>
                  <div className="stat-label">Skipped</div>
                </div>
              </div>
            </section>
          )}

          <section className="side-section tech-section">
            <button className="collapsible-trigger" id="techToggle" aria-expanded={techOpen} onClick={() => setTechOpen((v) => !v)}>
              <span className="side-label" style={{ margin: 0 }}>
                TECHNICAL
              </span>
              <svg className="chevron" width="12" height="12" fill="currentColor" viewBox="0 0 16 16">
                <path
                  fillRule="evenodd"
                  d="M1.646 4.646a.5.5 0 0 1 .708 0L8 10.293l5.646-5.647a.5.5 0 0 1 .708.708l-6 6a.5.5 0 0 1-.708 0l-6-6a.5.5 0 0 1 0-.708z"
                />
              </svg>
            </button>
            <div className={`collapsible-body${techOpen ? ' open' : ''}`} id="techBody">
              {fileLoaded && (
                <div id="techLoadRow">
                  <button className="load-btn" id="loadFileBtnTech" onClick={() => fileInputRef.current?.click()}>
                    <svg width="14" height="14" fill="currentColor" viewBox="0 0 16 16">
                      <path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5z" />
                      <path d="M7.646 11.854a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0-.708-.708L8.5 10.293V1.5a.5.5 0 0 0-1 0v8.793L5.354 8.146a.5.5 0 1 0-.708.708l3 3z" />
                    </svg>
                    Load TXT File
                  </button>
                </div>
              )}
              <div className="tech-row">
                <button className={`action-btn save-btn${isModified ? ' has-changes' : ''}`} id="saveFileBtn" title="Ctrl+S" onClick={saveToFile}>
                  <svg width="13" height="13" fill="currentColor" viewBox="0 0 16 16">
                    <path d="M2 1a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1H9.5a1 1 0 0 0-1 1v7.293l2.646-2.647a.5.5 0 0 1 .708.708l-3.5 3.5a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L7.5 9.293V2a2 2 0 0 1 2-2H14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V2a2 2 0 0 1 2-2h2.5a.5.5 0 0 1 0 1H2z" />
                  </svg>
                  Save File
                </button>
                <button className="action-btn add-btn" id="addEntryBtn" title="Ctrl+E" onClick={addNewLine}>
                  <svg width="13" height="13" fill="currentColor" viewBox="0 0 16 16">
                    <path d="M8 4a.5.5 0 0 1 .5.5v3h3a.5.5 0 0 1 0 1h-3v3a.5.5 0 0 1-1 0v-3h-3a.5.5 0 0 1 0-1h3v-3A.5.5 0 0 1 8 4z" />
                  </svg>
                  Add Entry
                </button>
              </div>
              <div className="tech-divider" />
              <button className="action-btn danger-btn" id="clearCacheBtn" onClick={handleClearCache}>
                <svg width="12" height="12" fill="currentColor" viewBox="0 0 16 16">
                  <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z" />
                  <path
                    fillRule="evenodd"
                    d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"
                  />
                </svg>
                Clear Cache
              </button>
              <label className="autoload-toggle">
                <input type="checkbox" id="autoLoadToggle" checked={autoLoadEnabled} onChange={handleAutoLoadToggle} />
                <span className="toggle-track">
                  <span className="toggle-thumb" />
                </span>
                <span className="toggle-label">Auto-load on start</span>
              </label>
            </div>
          </section>
        </div>
      </aside>

      <main className="main-content">
        {status && (
          <div className={`status-msg ${status.type}`} style={{ display: 'flex' }}>
            <span>{status.message}</span>
            <button className="status-dismiss" title="Dismiss" onClick={clearStatus}>
              &times;
            </button>
          </div>
        )}

        <div className="table-wrap">
          <table id="dataTable">
            <thead>
              <tr>
                <th width="38%">
                  Description <span className="th-count">({filteredData.length})</span>
                </th>
                <th width="40%">URL</th>
                <th width="14%">Groups</th>
                <th width="8%">Actions</th>
              </tr>
            </thead>
            <tbody id="tableBody">
              {filteredData.map((item) =>
                editing && editing.id === item.id ? (
                  <tr key={item.id} data-id={item.id} className="editing">
                    <td className="extra-data-cell">
                      <input
                        type="text"
                        className="extra-data-input"
                        autoFocus
                        value={editing.extraData}
                        onChange={(e) => setEditing({ ...editing, extraData: e.target.value })}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            saveEditRow();
                          }
                          if (e.key === 'Escape') {
                            e.preventDefault();
                            revertEditRow();
                          }
                        }}
                      />
                    </td>
                    <td className="url-cell">
                      <input
                        type="text"
                        className="url-input"
                        value={editing.url}
                        onChange={(e) => setEditing({ ...editing, url: e.target.value })}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            saveEditRow();
                          }
                          if (e.key === 'Escape') {
                            e.preventDefault();
                            revertEditRow();
                          }
                        }}
                      />
                    </td>
                    <td className="group-cell">
                      <GroupCell item={item} onOpenModal={openGroupModal} onRemoveGroup={removeGroupFromItem} />
                    </td>
                    <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                      <button className="table-action-btn edit-btn" title="Save entry" onClick={saveEditRow}>
                        <SaveIcon />
                      </button>
                      <button className="table-action-btn delete-btn" title="Delete entry" onClick={() => deleteLine(item.id)}>
                        <TrashIcon />
                      </button>
                    </td>
                  </tr>
                ) : (
                  <tr
                    key={item.id}
                    data-id={item.id}
                    onDoubleClick={(e) => {
                      if (e.target.closest('td.extra-data-cell')) startEditRow(item, false);
                    }}
                  >
                    <td className="extra-data-cell">
                      <Highlighted text={item.extraData || '(no extra data)'} term={currentSearch} />
                    </td>
                    <td className="url-cell" style={item.validUrl ? { padding: 0, position: 'relative' } : undefined}>
                      {item.validUrl ? (
                        <a href={item.url} className="full-cell-link" target="_blank" rel="noopener noreferrer">
                          <Highlighted text={item.url} term={currentSearch} />
                        </a>
                      ) : (
                        <span className="url-invalid" title="This may not be a valid URL">
                          {item.url}
                        </span>
                      )}
                    </td>
                    <td className="group-cell">
                      <GroupCell item={item} onOpenModal={openGroupModal} onRemoveGroup={removeGroupFromItem} />
                    </td>
                    <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                      <button className="table-action-btn edit-btn" title="Edit entry" onClick={() => startEditRow(item, false)}>
                        <EditIcon />
                      </button>
                      <button className="table-action-btn delete-btn" title="Delete entry" onClick={() => deleteLine(item.id)}>
                        <TrashIcon />
                      </button>
                    </td>
                  </tr>
                )
              )}
              <tr id="addLineBottomRow" className="add-line-row">
                <td colSpan={4}>
                  <button className="add-line-btn" onClick={addNewLine}>
                    <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                      <path d="M8 4a.5.5 0 0 1 .5.5v3h3a.5.5 0 0 1 0 1h-3v3a.5.5 0 0 1-1 0v-3h-3a.5.5 0 0 1 0-1h3v-3A.5.5 0 0 1 8 4z" />
                    </svg>{' '}
                    Add New Entry
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </main>

      <div id="footerHelp" />
      <footer>
        <div className="footer_in">
          <div className="footer_in_in">
            <h6>URL Data Table Loader — load, edit and group your URL lists</h6>
            <h6>Ctrl+S save &bull; Ctrl+E add entry &bull; Ctrl+G group input &bull; Ctrl+F filter &bull; Enter save edit &bull; Esc revert/delete</h6>
          </div>
        </div>
      </footer>

      <div className="modal" id="groupModal" style={{ display: groupModal ? 'flex' : 'none' }} onClick={(e) => e.target.id === 'groupModal' && closeGroupModal()}>
        <div className="modal-content">
          <h3 id="groupModalTitle" style={{ marginBottom: 15 }}>
            Add to Group
          </h3>
          {groupModal && (
            <div id="groupModalBody">
              {groupModal.availableGroups.length > 0 && (
                <select
                  className="filter-select"
                  style={{ width: '100%' }}
                  id="modalGroupSelect"
                  value={groupModal.selectValue}
                  onChange={(e) => setGroupModal({ ...groupModal, selectValue: e.target.value })}
                >
                  <option value="">Select a group…</option>
                  {groupModal.availableGroups.map((g) => (
                    <option value={g} key={g}>
                      {g}
                    </option>
                  ))}
                  <option value="__new__">+ Create new group…</option>
                </select>
              )}
              <input
                type="text"
                className="group-input"
                placeholder={groupModal.availableGroups.length > 0 ? 'New group name…' : 'No groups yet — type a new name…'}
                maxLength={50}
                id="modalNewGroupInput"
                style={{
                  width: '100%',
                  marginTop: groupModal.availableGroups.length > 0 ? 10 : 0,
                  display: groupModal.availableGroups.length === 0 || groupModal.selectValue === '__new__' ? 'block' : 'none',
                }}
                value={groupModal.newGroupValue}
                onChange={(e) => setGroupModal({ ...groupModal, newGroupValue: e.target.value })}
              />
            </div>
          )}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 15 }}>
            <button className="modal-button" id="groupModalCancel" onClick={closeGroupModal}>
              Cancel
            </button>
            <button className="modal-button modal-button-confirm" id="groupModalConfirm" onClick={confirmGroupModal}>
              Add
            </button>
          </div>
        </div>
      </div>

      {autosaveToastVisible && <div className="autosave-toast">Auto-saved</div>}
    </div>
  );
}

function GroupCell({ item, onOpenModal, onRemoveGroup }) {
  return (
    <>
      {item.groups && item.groups.length > 0 ? (
        item.groups.map((group) => (
          <span className="badge" key={group}>
            {group}
            <button
              className="remove-badge"
              data-group={group}
              title="Remove from group"
              onClick={(e) => {
                e.stopPropagation();
                onRemoveGroup(item.id, group);
              }}
            >
              &times;
            </button>
          </span>
        ))
      ) : (
        <span className="no-groups">No groups</span>
      )}
      <button className="add-group-to-line" title="Add to group" onClick={() => onOpenModal(item.id)}>
        + Add
      </button>
    </>
  );
}

function EditIcon() {
  return (
    <svg width="14" height="14" fill="currentColor" viewBox="0 0 16 16">
      <path d="M12.146.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1 0 .708l-10 10a.5.5 0 0 1-.168.11l-5 2a.5.5 0 0 1-.65-.65l2-5a.5.5 0 0 1 .11-.168l10-10zM11.207 2.5 13.5 4.793 14.793 3.5 12.5 1.207 11.207 2.5zm1.586 3L10.5 3.207 4 9.707V10h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.293l6.5-6.5zm-9.761 5.175-.106.106-1.528 3.821 3.821-1.528.106-.106A.5.5 0 0 1 5 12.5V12h-.5a.5.5 0 0 1-.5-.5V11h-.5a.5.5 0 0 1-.468-.325z" />
    </svg>
  );
}
function SaveIcon() {
  return (
    <svg width="14" height="14" fill="currentColor" viewBox="0 0 16 16">
      <path d="M2 1a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1H9.5a1 1 0 0 0-1 1v7.293l2.646-2.647a.5.5 0 0 1 .708.708l-3.5 3.5a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L7.5 9.293V2a2 2 0 0 1 2-2H14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V2a2 2 0 0 1 2-2h2.5a.5.5 0 0 1 0 1H2z" />
    </svg>
  );
}
function TrashIcon() {
  return (
    <svg width="14" height="14" fill="currentColor" viewBox="0 0 16 16">
      <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z" />
      <path
        fillRule="evenodd"
        d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"
      />
    </svg>
  );
}
