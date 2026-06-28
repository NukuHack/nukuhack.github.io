document.addEventListener('DOMContentLoaded', () => {
    // ── DOM refs ──────────────────────────────────────────────────────────────
    const fileInput = document.getElementById('fileInput');
    const loadFileBtn = document.getElementById('loadFileBtn');
    const fileName = document.getElementById('fileName');
    const tableBody = document.getElementById('tableBody');
    const statusMessage = document.getElementById('statusMessage');
    const statsContainer = document.getElementById('statsContainer');
    const statTotal = document.getElementById('statTotal');
    const statValid = document.getElementById('statValid');
    const statSkipped = document.getElementById('statSkipped');
    const groupSection = document.getElementById('groupSection');
    const filterSection = document.getElementById('filterSection');
    const newGroupInput = document.getElementById('newGroupInput');
    const addGroupBtn = document.getElementById('addGroupBtn');
    const groupFilter = document.getElementById('groupFilter');
    const clearFilterBtn = document.getElementById('clearFilterBtn');
    const groupTagsContainer = document.getElementById('groupTagsContainer');
    const groupModal = document.getElementById('groupModal');
    const groupModalBody = document.getElementById('groupModalBody');
    const groupModalCancel = document.getElementById('groupModalCancel');
    const groupModalConfirm = document.getElementById('groupModalConfirm');
    const searchInput = document.getElementById('searchInput');
    const saveFileBtn = document.getElementById('saveFileBtn');
    const addEntryBtn = document.getElementById('addEntryBtn');
    const techToggle = document.getElementById('techToggle');
    const techBody = document.getElementById('techBody');

    // ── State ─────────────────────────────────────────────────────────────────
    let allData = [];
    let allGroups = new Set();
    let isModified = false;
    let currentFilter = 'all';
    let currentSearch = '';
    let currentFileName = null;
    let pendingGroupItemId = null;

    function markModified() {
        isModified = true;
        const saveBtn = document.getElementById('saveFileBtn');
        if (saveBtn) saveBtn.classList.add('has-changes');
    }
    function markSaved() {
        isModified = false;
        const saveBtn = document.getElementById('saveFileBtn');
        if (saveBtn) saveBtn.classList.remove('has-changes');
    }

    // ── Unsaved changes guard ─────────────────────────────────────────────────
    window.addEventListener('beforeunload', (e) => {
        if (isModified) {
            e.preventDefault();
            e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
        }
    });

    // ── Load button wiring ────────────────────────────────────────────────────
    const loadSection = document.getElementById('loadSection');
    const techLoadRow = document.getElementById('techLoadRow');
    const loadFileBtnTech = document.getElementById('loadFileBtnTech');

    function triggerFileLoad() { fileInput.click(); }
    loadFileBtn.addEventListener('click', triggerFileLoad);
    if (loadFileBtnTech) loadFileBtnTech.addEventListener('click', triggerFileLoad);

    function markFileLoaded() {
        // Hide the prominent load section, show compact one inside tech
        if (loadSection) loadSection.style.display = 'none';
        if (techLoadRow) techLoadRow.style.display = 'block';
    }

    // ── File loading ──────────────────────────────────────────────────────────

    fileInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (!file) return;

        markFileLoaded();
        currentFileName = file.name;
        fileName.textContent = file.name;
        tableBody.innerHTML = '';
        clearStatus();
        statsContainer.style.display = 'none';
        groupSection.style.display = 'none';
        showStatus('Loading and parsing file…', 'loading');
        isModified = false;
        allGroups.clear();
        updateGroupFilter();

        const reader = new FileReader();
        reader.onload = (e) => {
            let data;
            try {
                data = e.target.result;
                try {
                    data = decompress(data);
                } catch (err) {
                    console.error('decomp error (hopefully not compressed):', err);
                }
            } catch (err) {
                console.error('Read error:', err);
                showStatus(`Error reading file: ${err.message}`, 'error');
            }
            try {
                const lines = data.split('\n');
                allData = [];
                let validCount = 0, skippedCount = 0;

                lines.forEach((line, i) => {
                    line = line.trim();
                    if (!line) { skippedCount++; return; }

                    const parts = line.split(';');
                    const url = parts[0].trim();
                    const extraData = parts[1] ? parts[1].trim() : 'No Data Found';

                    let groups = [];
                    const groupMatch = line.match(/\{(.*)\}/);
                    if (groupMatch) {
                        groups = groupMatch[1].split(';').map(g => g.trim()).filter(g => g.length > 0);
                        groups.forEach(g => allGroups.add(g));
                    }

                    let validUrl = false;
                    try { new URL(url); validUrl = true; } catch { /* invalid */ }

                    allData.push({ url, extraData, groups, validUrl, lineNumber: i + 1, id: Date.now() + Math.random() });
                    validCount++;
                });

                updateStats(lines.length, validCount, skippedCount);

                if (allData.length > 0) {
                    displayData(allData);
                    autoSave();
                    groupSection.style.display = 'block';
                    filterSection.style.display = 'block';
                    updateGroupTags();
                    updateGroupFilter();
                    showStatus(`Loaded ${allData.length} item(s) successfully.`, 'success');
                } else {
                    showStatus('File is empty or contains only blank lines.', 'empty');
                }
            } catch (err) {
                console.error('Parse error:', err);
                showStatus(`Error parsing file: ${err.message}`, 'error');
            }
        };

        reader.onerror = () => showStatus('Error reading the file.', 'error');
        reader.readAsText(file);
    });

    // ── Stats ─────────────────────────────────────────────────────────────────
    function updateStats(total, valid, skipped) {
        statTotal.textContent = total;
        statValid.textContent = valid;
        statSkipped.textContent = skipped;
        statsContainer.style.display = 'flex';
    }

    // ── Group tags ────────────────────────────────────────────────────────────
    function updateGroupTags() {
        groupTagsContainer.innerHTML = '';
        allGroups.forEach(group => {
            const count = allData.filter(d => d.groups.includes(group)).length;
            const tag = document.createElement('span');
            tag.className = 'group-tag';
            tag.dataset.group = group;
            tag.innerHTML = `<span class="group-tag-name">${group}</span><span class="group-tag-count">${count}</span><button class="remove-group" title="Remove group from all">&times;</button>`;

            tag.addEventListener('click', (e) => {
                if (!e.target.classList.contains('remove-group')) {
                    const already = currentFilter === group;
                    groupFilter.value = already ? 'all' : group;
                    currentFilter = already ? 'all' : group;
                    applyFilter();
                }
            });
            tag.querySelector('.remove-group').addEventListener('click', (e) => {
                e.stopPropagation();
                removeGroupFromAll(group);
            });

            groupTagsContainer.appendChild(tag);
        });
    }

    function updateGroupFilter() {
        const prev = groupFilter.value;
        groupFilter.innerHTML = `
            <option value="all">All Links (${allData.length})</option>
            <option value="ungrouped">No Groups (${allData.filter(d => d.groups.length === 0).length})</option>
        `;
        allGroups.forEach(group => {
            const count = allData.filter(d => d.groups.includes(group)).length;
            groupFilter.innerHTML += `<option value="${group}">${group} (${count})</option>`;
        });

        if (prev && Array.from(groupFilter.options).some(o => o.value === prev)) {
            groupFilter.value = prev;
        } else {
            groupFilter.value = 'all';
        }
        currentFilter = groupFilter.value;
        applyFilter();
    }

    // ── Display ───────────────────────────────────────────────────────────────
    function displayData(data) {
        tableBody.innerHTML = '';
        const filtered = applyFilterToData(data);
        updateRowCountHeader(filtered.length);

        filtered.forEach(item => {
            const row = document.createElement('tr');
            row.dataset.id = item.id;

            // Extra Data cell
            const extraCell = document.createElement('td');
            extraCell.className = 'extra-data-cell';
            extraCell.innerHTML = highlight(item.extraData || '(no extra data)', currentSearch);

            // URL cell
            const urlCell = document.createElement('td');
            urlCell.className = 'url-cell';

            if (item.validUrl) {
                const link = document.createElement('a');
                link.href = item.url;
                link.className = 'full-cell-link';
                link.innerHTML = highlight(item.url, currentSearch);
                link.target = '_blank';
                link.rel = 'noopener noreferrer';
                urlCell.appendChild(link);
                urlCell.style.padding = '0';
                urlCell.style.position = 'relative';
            } else {
                const span = document.createElement('span');
                span.className = 'url-invalid';
                span.textContent = item.url;
                span.title = 'This may not be a valid URL';
                urlCell.appendChild(span);
            }

            // Group cell
            const groupCell = document.createElement('td');
            groupCell.className = 'group-cell';
            updateGroupCell(groupCell, item);

            // Action cell
            const actionCell = document.createElement('td');
            actionCell.style.textAlign = 'center';
            actionCell.style.whiteSpace = 'nowrap';

            const editBtn = makeActionBtn(editIcon(), 'Edit entry', () => toggleEditMode(row, item));
            editBtn.classList.add('edit-btn');

            const deleteBtn = makeActionBtn(trashIcon(), 'Delete entry', () => deleteLine(row, item.id));
            deleteBtn.classList.add('delete-btn');

            actionCell.appendChild(editBtn);
            actionCell.appendChild(deleteBtn);

            row.appendChild(extraCell);
            row.appendChild(urlCell);
            row.appendChild(groupCell);
            row.appendChild(actionCell);
            tableBody.appendChild(row);
        });

        addAddLineRow();
    }

    function updateRowCountHeader(count) {
        const th = document.querySelector('#dataTable thead th:first-child');
        if (!th) return;
        let badge = th.querySelector('.th-count');
        if (!badge) {
            badge = document.createElement('span');
            badge.className = 'th-count';
            th.appendChild(badge);
        }
        badge.textContent = `(${count})`;
    }

    function makeActionBtn(svgHtml, title, onClick) {
        const btn = document.createElement('button');
        btn.className = 'table-action-btn';
        btn.innerHTML = svgHtml;
        btn.title = title;
        btn.addEventListener('click', onClick);
        return btn;
    }

    // ── Group cell ────────────────────────────────────────────────────────────
    function updateGroupCell(cell, item) {
        cell.innerHTML = '';

        if (item.groups && item.groups.length > 0) {
            item.groups.forEach(group => {
                const badge = document.createElement('span');
                badge.className = 'badge';
                badge.innerHTML = `${group}<button class="remove-badge" data-group="${group}" title="Remove from group">&times;</button>`;
                badge.querySelector('.remove-badge').addEventListener('click', (e) => {
                    e.stopPropagation();
                    removeGroupFromItem(item.id, group);
                });
                cell.appendChild(badge);
            });
        } else {
            const empty = document.createElement('span');
            empty.className = 'no-groups';
            empty.textContent = 'No groups';
            cell.appendChild(empty);
        }

        const addBtn = document.createElement('button');
        addBtn.className = 'add-group-to-line';
        addBtn.textContent = '+ Add';
        addBtn.title = 'Add to group';
        addBtn.addEventListener('click', () => openGroupModal(item.id));
        cell.appendChild(addBtn);
    }

    // ── Modal (add to group) ──────────────────────────────────────────────────
    function openGroupModal(itemId) {
        const item = allData.find(d => d.id === itemId);
        if (!item) return;

        const available = Array.from(allGroups).filter(g => !item.groups.includes(g));
        pendingGroupItemId = itemId;

        groupModalBody.innerHTML = '';

        if (available.length === 0) {
            // Offer to create new group directly
            const newInput = document.createElement('input');
            newInput.type = 'text';
            newInput.className = 'group-input';
            newInput.placeholder = 'No groups yet — type a new name…';
            newInput.maxLength = 50;
            newInput.style.width = '100%';
            newInput.id = 'modalNewGroupInput';
            groupModalBody.appendChild(newInput);
        } else {
            const sel = document.createElement('select');
            sel.className = 'filter-select';
            sel.style.width = '100%';
            sel.id = 'modalGroupSelect';
            sel.innerHTML = '<option value="">Select a group…</option>';
            available.forEach(g => { sel.innerHTML += `<option value="${g}">${g}</option>`; });
            sel.innerHTML += '<option value="__new__">+ Create new group…</option>';

            const newInput = document.createElement('input');
            newInput.type = 'text';
            newInput.className = 'group-input';
            newInput.placeholder = 'New group name…';
            newInput.maxLength = 50;
            newInput.style.width = '100%';
            newInput.style.display = 'none';
            newInput.style.marginTop = '10px';
            newInput.id = 'modalNewGroupInput';

            sel.addEventListener('change', () => {
                newInput.style.display = sel.value === '__new__' ? 'block' : 'none';
            });

            groupModalBody.appendChild(sel);
            groupModalBody.appendChild(newInput);
        }

        groupModal.style.display = 'flex';
    }

    groupModalCancel.addEventListener('click', closeGroupModal);

    groupModal.addEventListener('click', (e) => {
        if (e.target === groupModal) closeGroupModal();
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && groupModal.style.display === 'flex') closeGroupModal();
    });

    function closeGroupModal() {
        groupModal.style.display = 'none';
        pendingGroupItemId = null;
    }

    groupModalConfirm.addEventListener('click', () => {
        const item = allData.find(d => d.id === pendingGroupItemId);
        if (!item) { closeGroupModal(); return; }

        const sel = document.getElementById('modalGroupSelect');
        const newInput = document.getElementById('modalNewGroupInput');
        let groupName = '';

        if (sel && sel.value === '__new__') {
            groupName = newInput ? newInput.value.trim() : '';
        } else if (sel) {
            groupName = sel.value;
        } else {
            groupName = newInput ? newInput.value.trim() : '';
        }

        if (!groupName) { showStatus('Please select or enter a group name.', 'error'); return; }
        if (groupName.includes('{') || groupName.includes('}') || groupName.includes(';')) {
            showStatus('Group name cannot contain {, }, or ;', 'error'); return;
        }
        if (!/^[\p{L}0-9\s_-]+$/u.test(groupName)) {
            showStatus('Group name can only contain letters, numbers, spaces, hyphens and underscores.', 'error'); return;
        }

        if (!item.groups.includes(groupName)) {
            allGroups.add(groupName);
            item.groups.push(groupName);
            isModified = true; markModified();
            autoSave();
            updateGroupTags();
            updateGroupFilter();
            displayData(allData);
            showStatus(`Added to group: ${groupName}`, 'success');
        }
        closeGroupModal();
    });

    // ── Group management ──────────────────────────────────────────────────────
    function removeGroupFromItem(itemId, groupName) {
        const item = allData.find(d => d.id === itemId);
        if (!item) return;

        item.groups = item.groups.filter(g => g !== groupName);
        isModified = true; markModified();
        autoSave();

        if (!allData.some(d => d.groups.includes(groupName))) {
            allGroups.delete(groupName);
            updateGroupTags();
        }
        updateGroupFilter();
        displayData(allData);
        showStatus(`Removed from group: ${groupName}`, 'success');
    }

    function removeGroupFromAll(groupName) {
        if (!confirm(`Remove group "${groupName}" from all items?`)) return;
        allData.forEach(item => { item.groups = item.groups.filter(g => g !== groupName); });
        allGroups.delete(groupName);
        isModified = true; markModified();
        autoSave();
        updateGroupTags();
        updateGroupFilter();
        displayData(allData);
        showStatus(`Removed group "${groupName}" from all items.`, 'success');
    }

    // ── Filtering ─────────────────────────────────────────────────────────────
    function filterByGroup(groupName) {
        groupFilter.value = groupName;
        currentFilter = groupName;
        applyFilter();
    }

    function applyFilter() {
        currentFilter = groupFilter.value;
        displayData(allData);
        document.querySelectorAll('.group-tag').forEach(tag => {
            tag.classList.toggle('active', tag.dataset.group === currentFilter);
        });
    }

    function applyFilterToData(data) {
        let filtered = data;
        if (currentFilter !== 'all') {
            if (currentFilter === 'ungrouped') {
                filtered = filtered.filter(d => d.groups.length === 0);
            } else {
                filtered = filtered.filter(d => d.groups.includes(currentFilter));
            }
        }
        if (currentSearch) {
            filtered = filtered.filter(d =>
                d.url.toLowerCase().includes(currentSearch) ||
                d.extraData.toLowerCase().includes(currentSearch)
            );
        }
        return filtered;
    }

    function highlight(text, term) {
        if (!term) return escapeHtml(text);
        const escaped = escapeHtml(text);
        const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return escaped.replace(new RegExp(`(${escapedTerm})`, 'gi'), '<mark class="search-hl">$1</mark>');
    }

    function escapeHtml(str) {
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    groupFilter.addEventListener('change', applyFilter);
    clearFilterBtn.addEventListener('click', () => {
        groupFilter.value = 'all';
        searchInput.value = "";
        currentFilter = 'all';
        currentSearch = "";
        applyFilter();
        showStatus('Filter cleared.', 'success');
    });

    // ── Add group tag ─────────────────────────────────────────────────────────
    addGroupBtn.addEventListener('click', () => {
        const name = newGroupInput.value.trim();
        if (!name) { showStatus('Please enter a group name.', 'error'); return; }
        if (!/^[\p{L}0-9\s_-]+$/u.test(name)) {
            showStatus('Group name can only contain letters, numbers, spaces, hyphens and underscores.', 'error'); return;
        }
        if (allGroups.has(name)) { showStatus('Group already exists.', 'error'); return; }

        allGroups.add(name);
        newGroupInput.value = '';
        updateGroupTags();
        updateGroupFilter();
        showStatus(`Group "${name}" created.`, 'success');
    });

    newGroupInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') addGroupBtn.click(); });

    // ── Edit / Delete / Add line ──────────────────────────────────────────────
    function toggleEditMode(row, item, isNew = false) {
        const isEditing = row.classList.contains('editing');

        if (isEditing) {
            saveEditRow(row, item);
        } else {
            startEditRow(row, item, isNew);
        }
    }

    function saveEditRow(row, item) {
        const extraIn = row.querySelector('.extra-data-input');
        const urlIn = row.querySelector('.url-input');

        const newExtra = extraIn.value.trim() || 'No Data Found';
        const newUrl = urlIn.value.trim();

        let validUrl = false;
        try { new URL(newUrl); validUrl = true; } catch { /* invalid */ }

        if (newExtra !== item.extraData || newUrl !== item.url) {
            item.extraData = newExtra;
            item.url = newUrl;
            item.validUrl = validUrl;
            isModified = true;
            markModified();
            autoSave();
        }

        const extraCell = row.querySelector('.extra-data-cell');
        const urlCell = row.querySelector('.url-cell');
        const groupCell = row.querySelector('.group-cell');

        extraCell.textContent = newExtra;
        urlCell.innerHTML = '';
        urlCell.style.padding = '';

        if (validUrl) {
            const link = document.createElement('a');
            link.href = newUrl;
            link.className = 'full-cell-link';
            link.textContent = newUrl;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            urlCell.appendChild(link);
            urlCell.style.padding = '0';
            urlCell.style.position = 'relative';
        } else {
            const span = document.createElement('span');
            span.className = 'url-invalid';
            span.textContent = newUrl;
            span.title = 'This may not be a valid URL';
            urlCell.appendChild(span);
        }

        updateGroupCell(groupCell, item);
        row.querySelector('.edit-btn').innerHTML = editIcon();
        row.classList.remove('editing');
        // remove hint cell if present
        const hintCell = row.querySelector('.edit-hint-td');
        if (hintCell) hintCell.remove();
        showStatus('Changes saved.', 'success');
    }

    function revertEditRow(row, item, isNew) {
        if (isNew) {
            // delete the row entirely
            allData = allData.filter(d => d.id !== item.id);
            row.remove();
            updateStats(allData.length, allData.length, 0);
            updateGroupFilter();
            autoSave();
            showStatus('New entry discarded.', 'empty');
            addAddLineRow();
        } else {
            // restore original values
            const extraCell = row.querySelector('.extra-data-cell');
            const urlCell = row.querySelector('.url-cell');
            const groupCell = row.querySelector('.group-cell');

            extraCell.textContent = item.extraData;
            urlCell.innerHTML = '';
            urlCell.style.padding = '';

            if (item.validUrl) {
                const link = document.createElement('a');
                link.href = item.url;
                link.className = 'full-cell-link';
                link.textContent = item.url;
                link.target = '_blank';
                link.rel = 'noopener noreferrer';
                urlCell.appendChild(link);
                urlCell.style.padding = '0';
                urlCell.style.position = 'relative';
            } else {
                const span = document.createElement('span');
                span.className = 'url-invalid';
                span.textContent = item.url;
                urlCell.appendChild(span);
            }

            updateGroupCell(groupCell, item);
            row.querySelector('.edit-btn').innerHTML = editIcon();
            row.classList.remove('editing');
            const hintCell = row.querySelector('.edit-hint-td');
            if (hintCell) hintCell.remove();
            showStatus('Edit cancelled.', 'empty');
        }
    }

    function startEditRow(row, item, isNew = false) {
        const extraCell = row.querySelector('.extra-data-cell');
        const urlCell = row.querySelector('.url-cell');

        const extraIn = document.createElement('input');
        extraIn.type = 'text';
        extraIn.className = 'extra-data-input';
        extraIn.value = item.extraData;

        const currentUrl = urlCell.querySelector('a') ? urlCell.querySelector('a').href : urlCell.querySelector('span')?.textContent || '';
        const urlIn = document.createElement('input');
        urlIn.type = 'text';
        urlIn.className = 'url-input';
        urlIn.value = currentUrl;

        // Enter to save, Esc to revert
        function handleEditKey(e) {
            if (e.key === 'Enter') { e.preventDefault(); saveEditRow(row, item); }
            if (e.key === 'Escape') { e.preventDefault(); revertEditRow(row, item, isNew); }
        }
        extraIn.addEventListener('keydown', handleEditKey);
        urlIn.addEventListener('keydown', handleEditKey);

        extraCell.innerHTML = '';
        extraCell.appendChild(extraIn);

        urlCell.innerHTML = '';
        urlCell.style.padding = '';
        urlCell.style.position = '';
        urlCell.appendChild(urlIn);

        row.querySelector('.edit-btn').innerHTML = saveIcon();
        row.classList.add('editing');
        // store isNew on row for ESC handler
        row.dataset.isNew = isNew ? '1' : '0';

        showStatus('Editing — Enter to save, Esc to cancel.', 'loading');
        extraIn.focus();
        extraIn.select();
    }

    // double-click on description cell to enter edit
    tableBody.addEventListener('dblclick', (e) => {
        const td = e.target.closest('td.extra-data-cell');
        if (!td) return;
        const row = td.closest('tr');
        if (!row || row.classList.contains('editing') || row.id === 'addLineBottomRow') return;
        const itemId = parseFloat(row.dataset.id);
        const item = allData.find(d => d.id === itemId);
        if (item) startEditRow(row, item, false);
    });

    function deleteLine(row, id) {
        if (!confirm('Delete this entry?')) return;
        allData = allData.filter(item => item.id !== id);
        row.remove();
        updateStats(allData.length, allData.length, 0);
        updateGroupFilter();
        isModified = true; markModified();
        markModified();
        autoSave();
        showStatus('Entry deleted.', 'success');
        addAddLineRow();
    }

    function addNewLine() {
        const newId = Date.now() + Math.random();
        const newItem = { id: newId, url: 'https://example.com', extraData: 'New entry', groups: [], validUrl: true, lineNumber: allData.length + 1 };
        allData.push(newItem);
        displayData(allData);
        updateStats(allData.length, allData.length, 0);

        setTimeout(() => {
            const newRow = document.querySelector(`tr[data-id="${newId}"]`);
            if (newRow) {
                newRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
                startEditRow(newRow, newItem, true);
            }
        }, 80);
    }

    function addAddLineRow() {
        const existing = document.getElementById('addLineBottomRow');
        if (existing) existing.remove();

        const tr = document.createElement('tr');
        tr.id = 'addLineBottomRow';
        tr.className = 'add-line-row';

        const td = document.createElement('td');
        td.colSpan = 4;

        const btn = document.createElement('button');
        btn.className = 'add-line-btn';
        btn.innerHTML = `<svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M8 4a.5.5 0 0 1 .5.5v3h3a.5.5 0 0 1 0 1h-3v3a.5.5 0 0 1-1 0v-3h-3a.5.5 0 0 1 0-1h3v-3A.5.5 0 0 1 8 4z"/></svg> Add New Entry`;
        btn.addEventListener('click', addNewLine);

        td.appendChild(btn);
        tr.appendChild(td);
        tableBody.appendChild(tr);
    }

    // ── Save / Auto-save ──────────────────────────────────────────────────────
    function buildFileContent() {
        return allData.map(item => {
            let line = `${item.url};${item.extraData}`;
            if (item.groups && item.groups.length > 0) line += `;{${item.groups.join(';')}}`;
            return line;
        }).join('\n') + '\n';
    }

    function autoSave() {
        try {
            const raw = buildFileContent();
            let stored = raw;
            let isCompressed = false;
            try {
                stored = compress(raw);
                isCompressed = true;
            } catch (compressErr) {
                console.warn('Compression failed, storing plain text:', compressErr);
            }
            localStorage.setItem('urlDataAutoSave', stored);
            localStorage.setItem('urlDataAutoSaveCompressed', isCompressed ? '1' : '0');
            localStorage.setItem('urlDataFileName', currentFileName || 'url-data.txt');
            localStorage.setItem('urlDataLastModified', new Date().toISOString());
        } catch (e) { console.warn('Auto-save failed:', e); return; }

        const toast = document.createElement('div');
        toast.className = 'autosave-toast';
        toast.textContent = 'Auto-saved';
        document.body.appendChild(toast);
        setTimeout(() => toast.parentNode?.removeChild(toast), 1400);
    }

    function saveToFile() {
        if (allData.length === 0) { showStatus('No data to save.', 'error'); return; }

        let data = buildFileContent();
        if (true) { // if compress mode is on
            try {
                data = compress(data);
            } catch (error) {
                console.log(" compress error: "+error)
            }
        }
        const blob = new Blob([data], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = currentFileName || 'url-data-modified.txt';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        isModified = false;
        markSaved();
        try {
            localStorage.removeItem('urlDataAutoSave');
            localStorage.removeItem('urlDataFileName');
            localStorage.removeItem('urlDataLastModified');
        } catch { /* ignore */ }

        showStatus('File saved successfully!', 'success');
    }

    // ── Status ────────────────────────────────────────────────────────────────
    function showStatus(message, type) {
        statusMessage.innerHTML = '';
        const text = document.createElement('span');
        text.textContent = message;
        statusMessage.appendChild(text);
        const dismiss = document.createElement('button');
        dismiss.className = 'status-dismiss';
        dismiss.innerHTML = '&times;';
        dismiss.title = 'Dismiss';
        dismiss.addEventListener('click', clearStatus);
        statusMessage.appendChild(dismiss);
        statusMessage.className = `status-msg ${type}`;
        statusMessage.style.display = 'flex';
    }

    function clearStatus() {
        statusMessage.textContent = '';
        statusMessage.className = 'status-msg';
        statusMessage.style.display = 'none';
    }

    // ── Keyboard shortcuts ────────────────────────────────────────────────────
    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); saveToFile(); }
        if ((e.ctrlKey || e.metaKey) && e.key === 'e') { e.preventDefault(); addNewLine(); }
        if ((e.ctrlKey || e.metaKey) && e.key === 'g') { e.preventDefault(); newGroupInput.focus(); }
        if ((e.ctrlKey || e.metaKey) && e.key === 'f') { e.preventDefault(); searchInput.focus(); }
        if (e.key === 'Escape' && currentFilter !== 'all') {
            e.preventDefault();
            groupFilter.value = 'all';
            currentFilter = 'all';
            applyFilter();
            showStatus('Filter cleared.', 'success');
        }
    });

    // ── Tech collapsible panel ────────────────────────────────────────────────
    techToggle.addEventListener('click', () => {
        const open = techBody.classList.toggle('open');
        techToggle.setAttribute('aria-expanded', open);
    });

    // ── Sidebar Save / Add buttons ────────────────────────────────────────────
    saveFileBtn.addEventListener('click', saveToFile);
    addEntryBtn.addEventListener('click', addNewLine);

    // ── Search ────────────────────────────────────────────────────────────────
    searchInput.addEventListener('input', () => {
        currentSearch = searchInput.value.trim().toLowerCase();
        displayData(allData);
    });

    // ── SVG helpers ───────────────────────────────────────────────────────────
    function editIcon() {
        return `<svg width="14" height="14" fill="currentColor" viewBox="0 0 16 16"><path d="M12.146.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1 0 .708l-10 10a.5.5 0 0 1-.168.11l-5 2a.5.5 0 0 1-.65-.65l2-5a.5.5 0 0 1 .11-.168l10-10zM11.207 2.5 13.5 4.793 14.793 3.5 12.5 1.207 11.207 2.5zm1.586 3L10.5 3.207 4 9.707V10h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.293l6.5-6.5zm-9.761 5.175-.106.106-1.528 3.821 3.821-1.528.106-.106A.5.5 0 0 1 5 12.5V12h-.5a.5.5 0 0 1-.5-.5V11h-.5a.5.5 0 0 1-.468-.325z"/></svg>`;
    }
    function saveIcon() {
        return `<svg width="14" height="14" fill="currentColor" viewBox="0 0 16 16"><path d="M2 1a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1H9.5a1 1 0 0 0-1 1v7.293l2.646-2.647a.5.5 0 0 1 .708.708l-3.5 3.5a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L7.5 9.293V2a2 2 0 0 1 2-2H14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V2a2 2 0 0 1 2-2h2.5a.5.5 0 0 1 0 1H2z"/></svg>`;
    }
    function trashIcon() {
        return `<svg width="14" height="14" fill="currentColor" viewBox="0 0 16 16"><path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/><path fill-rule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/></svg>`;
    }

    // ── Cache clear & auto-load toggle ───────────────────────────────────────
    const AUTO_LOAD_KEY = 'urlDataAutoLoad';

    const autoLoadToggle = document.getElementById('autoLoadToggle');
    autoLoadToggle.checked = localStorage.getItem(AUTO_LOAD_KEY) !== '0';
    autoLoadToggle.addEventListener('change', () => {
        localStorage.setItem(AUTO_LOAD_KEY, autoLoadToggle.checked ? '1' : '0');
        showStatus(autoLoadToggle.checked
            ? 'Auto-load enabled — saved data will be restored on next page load.'
            : 'Auto-load disabled — page will start fresh on next load.', 'success');
    });

    document.getElementById('clearCacheBtn').addEventListener('click', () => {
        const hasCache = localStorage.getItem('urlDataAutoSave');
        if (!hasCache) { showStatus('No cached data to clear.', 'empty'); return; }
        if (!confirm('Clear the locally cached data? This cannot be undone.')) return;
        localStorage.removeItem('urlDataAutoSave');
        localStorage.removeItem('urlDataAutoSaveCompressed');
        localStorage.removeItem('urlDataFileName');
        localStorage.removeItem('urlDataLastModified');
        showStatus('Cache cleared.', 'success');
    });

    // ── Auto-save restore ─────────────────────────────────────────────────────
    async function restoreAutoSave() {
        try {
            const packed = localStorage.getItem('urlDataAutoSave');
            if (!packed) return false;

            const wasCompressed = localStorage.getItem('urlDataAutoSaveCompressed') !== '0';
            let restored = packed;
            if (wasCompressed) {
                try {
                    await window.decompReady;          // ← wait for WASM
                    restored = decompress(packed);
                } catch (decompressErr) {
                    console.warn('Decompression failed, trying as plain text:', decompressErr);
                    restored = packed;   // fallback: treat stored value as raw text
                }
            }
            const savedFileName = localStorage.getItem('urlDataFileName') || 'url-data.txt';
            const savedDate = localStorage.getItem('urlDataLastModified');

            currentFileName = savedFileName;
            fileName.textContent = savedFileName;
            tableBody.innerHTML = '';
            allGroups.clear();

            const lines = restored.split('\n');
            allData = [];
            let validCount = 0, skippedCount = 0;

            lines.forEach((line, i) => {
                line = line.trim();
                if (!line) { skippedCount++; return; }

                const parts = line.split(';');
                const url = parts[0].trim();
                const extraData = parts[1] ? parts[1].trim() : 'No Data Found';

                let groups = [];
                const groupMatch = line.match(/\{(.*)\}/);
                if (groupMatch) {
                    groups = groupMatch[1].split(';').map(g => g.trim()).filter(g => g.length > 0);
                    groups.forEach(g => allGroups.add(g));
                }

                let validUrl = false;
                try { new URL(url); validUrl = true; } catch { /* invalid */ }

                allData.push({ url, extraData, groups, validUrl, lineNumber: i + 1, id: Date.now() + Math.random() });
                validCount++;
            });

            if (allData.length === 0) return false;

            updateStats(lines.length, validCount, skippedCount);
            displayData(allData);
            groupSection.style.display = 'block';
            filterSection.style.display = 'block';
            updateGroupTags();
            updateGroupFilter();

            const dateStr = savedDate ? ` (saved ${new Date(savedDate).toLocaleTimeString()})` : '';
            showStatus(`Auto-save restored: ${allData.length} item(s)${dateStr}`, 'success');
            markFileLoaded();
            return true;
        } catch (e) {
            console.warn('Auto-save restore failed:', e);
            return false;
        }
    }

    // ── Sample data on first load ─────────────────────────────────────────────
    (function loadSampleData() {
        const autoLoadEnabled = localStorage.getItem(AUTO_LOAD_KEY) !== '0';
        if (autoLoadEnabled && restoreAutoSave()) return;   // prefer auto-save if toggle is on

        const sample = [
            { url: 'https://www.wikipedia.org/', extraData: 'Online encyclopedia', groups: ['Reference', 'Education'], validUrl: true, id: 1 },
            { url: 'https://github.com/', extraData: 'Version control', groups: ['Development', 'Tools'], validUrl: true, id: 2 },
            { url: 'https://stackoverflow.com/', extraData: 'Q&A for programmers', groups: ['Development', 'Reference'], validUrl: true, id: 3 },
            { url: 'invalid-without-protocol', extraData: 'Missing http://', groups: [], validUrl: false, id: 4 }
        ];

        allData = sample;
        sample.forEach(item => item.groups.forEach(g => allGroups.add(g)));
        displayData(sample);
        updateStats(4, 4, 0);
        groupSection.style.display = 'block';
        filterSection.style.display = 'block';
        updateGroupTags();
        updateGroupFilter();
        showStatus('Sample data loaded — load your own TXT file to begin.', 'empty');
        fileName.textContent = 'sample-data.txt (example)';
        currentFileName = 'sample-data.txt';
    })();
});