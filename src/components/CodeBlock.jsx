import { useEffect, useRef, useState } from 'react';
import { languageLabel } from '../lib/code.js';
import { useModal } from '../context/ModalContext.jsx';

export default function CodeBlock({ id, lang, desc, code, variant = 'card', onOpen, onClose }) {
  const codeRef = useRef(null);
  const [editable, setEditable] = useState(false);
  const { openModal } = useModal();

  const lines = code.split('\n').length;
  const height = lines * 20;

  // Highlight on mount (and whenever the underlying snippet changes).
  useEffect(() => {
    if (codeRef.current && window.Prism) {
      window.Prism.highlightElement(codeRef.current);
    }
  }, [code]);

  function copyCode() {
    const text = codeRef.current?.textContent ?? '';
    navigator.clipboard
      .writeText(text)
      .then(() => openModal('Copy Success', 'Code copied to clipboard!'))
      .catch((error) => openModal('Copy Error', `Failed to copy: ${error.message}`));
  }

  function resetCode() {
    if (!codeRef.current) return;
    codeRef.current.textContent = code;
    if (window.Prism) window.Prism.highlightElement(codeRef.current);
  }

  const isPage = variant === 'page';

  return (
    <div className={isPage ? 'code_page' : 'code'} id={isPage ? `code_${id}_page` : `code_${id}`}>
      <div className="code_lang">Language: {languageLabel(lang)}</div>
      <div className="code_desc">Description: {desc}</div>

      {isPage ? (
        <input type="button" className="code_resize" value="Close this page" onClick={onClose} />
      ) : (
        <input type="button" className="code_resize" value="More about the code!" onClick={onOpen} />
      )}

      <p className={isPage ? 'code_buttons_page' : 'code_buttons'}>
        <input
          type="button"
          className="code_readonly"
          value={editable ? 'Make Read-Only' : 'Toggle Editable'}
          onClick={() => setEditable((v) => !v)}
        />
        <input type="button" className="code_reset" value="Reset the code" onClick={resetCode} />
      </p>

      <div className={isPage ? 'code_help_page' : 'code_help'}>
        <pre className="line-numbers code_out" style={{ height: `${height}px` }}>
          <code
            ref={codeRef}
            className={`language-${lang} code_code`}
            contentEditable={editable}
            suppressContentEditableWarning
          >
            {code}
          </code>
        </pre>
      </div>

      <button onClick={copyCode} className="code_copy">
        Copy Code
      </button>
    </div>
  );
}
