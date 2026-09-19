import { useEffect, useMemo, useRef, useState } from 'react';
import '../styles/code.css';
import codeData from '../json/data.json';
import CodeBlock from '../components/CodeBlock.jsx';
import { languageLabel, buildInvertedIndex, searchDescriptions } from '../lib/code.js';
import { useModal } from '../context/ModalContext.jsx';

const DATA = codeData.data;

export default function Code() {
  const [selectedLanguage, setSelectedLanguage] = useState('all');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [openCodeId, setOpenCodeId] = useState(null);
  const [helperVisible, setHelperVisible] = useState(true);

  const dropdownRef = useRef(null);
  const searchTimeoutRef = useRef(null);
  const { openModal } = useModal();

  const supportedLanguages = useMemo(() => {
    const seen = [];
    DATA.forEach(({ lang }) => {
      if (!seen.includes(lang)) seen.push(lang);
    });
    return seen;
  }, []);

  const invertedIndex = useMemo(() => buildInvertedIndex(DATA), []);

  // Debounce the search box exactly like the original (500ms after typing stops).
  useEffect(() => {
    clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      setDebouncedQuery(searchInput.toLowerCase().trim());
    }, 500);
    return () => clearTimeout(searchTimeoutRef.current);
  }, [searchInput]);

  // Close the language dropdown on an outside click.
  useEffect(() => {
    function handleClick(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  const matchingIds = useMemo(
    () => searchDescriptions(debouncedQuery, invertedIndex),
    [debouncedQuery, invertedIndex]
  );

  const filteredData = useMemo(() => {
    return DATA.filter(({ id, lang, code }) => {
      const matchesLanguage = selectedLanguage === 'all' || lang === selectedLanguage;
      const matchesDescription = matchingIds === null || matchingIds.includes(id);
      return matchesLanguage && matchesDescription && code !== 'none';
    });
  }, [selectedLanguage, matchingIds]);

  const openItem = openCodeId !== null ? DATA.find((item) => item.id === openCodeId) : null;

  // Lock page scroll while the fullscreen code page is open.
  useEffect(() => {
    document.body.style.overflow = openCodeId !== null ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [openCodeId]);

  function handleOpenCodePage(id) {
    setOpenCodeId(id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function handleCloseCodePage() {
    setOpenCodeId(null);
  }

  function dismissHelper() {
    openModal(
      'Css stuff',
      'The codes in phone version are not displayed,\nYou have to go and open the page about the code to view it.'
    );
    setHelperVisible(false);
  }

  return (
    <>
      <div className="search_stuff" id="search_stuff">
        <div ref={dropdownRef} style={{ display: 'inline-block' }}>
          <button
            className="dropdown-button"
            id="dropdown_language_button"
            onClick={() => setDropdownOpen((v) => !v)}
          >
            {selectedLanguage === 'all' ? 'Select a language' : `Selected language: ${languageLabel(selectedLanguage)}`}
          </button>
          <div className={`dropdown-content${dropdownOpen ? ' show' : ''}`} id="dropdown_language">
            <button className="dropdown-item" onClick={() => setSelectedLanguage('all')}>
              All
            </button>
            {supportedLanguages.map((lang) => (
              <button className="dropdown-item" key={lang} onClick={() => setSelectedLanguage(lang)}>
                {languageLabel(lang)}
              </button>
            ))}
          </div>
        </div>

        <input
          type="text"
          id="search_title"
          placeholder="Input the Description"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />

        <div id="search_no_result" style={{ display: filteredData.length === 0 ? 'block' : 'none' }}>
          <p>We are really sorry for your inconvenience.</p>
          <p>Currently, there are No matching codes in our database.</p>
          <p>This page is still in development, look out for it in the future!</p>
          <p>But for now, try with a different keyword</p>
        </div>
      </div>

      {helperVisible && (
        <div id="codes_helper" onClick={dismissHelper}>
          The codes in phone version are not displayed.
          <br />
          More about it here.
        </div>
      )}

      <div id="code_page" style={{ display: openItem ? 'block' : 'none' }}>
        {openItem && (
          <CodeBlock
            id={openItem.id}
            lang={openItem.lang}
            desc={openItem.desc}
            code={openItem.code}
            variant="page"
            onClose={handleCloseCodePage}
          />
        )}
      </div>

      <div className="codes" id="codes">
        {filteredData.map(({ id, lang, desc, code }) => (
          <CodeBlock
            key={id}
            id={id}
            lang={lang}
            desc={desc}
            code={code}
            variant="card"
            onOpen={() => handleOpenCodePage(id)}
          />
        ))}
      </div>
    </>
  );
}
