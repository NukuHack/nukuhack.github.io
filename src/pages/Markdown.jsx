import { useMemo, useRef, useState } from 'react';
import '../styles/markdown.css';
import { render } from '../lib/markdown.js';
import { useModal } from '../context/ModalContext.jsx';

const DEFAULT_TEXT = `# Hello world

This is a **bold** and *italic* example.

- Item one
- Item two
  - Nested

\`inline code\` and a literal \\n newline escape.

\`\`\`js
const x = "hello\\nworld";
  \`\`\``;

export default function Markdown() {
  const [text, setText] = useState(DEFAULT_TEXT);
  const fileInputRef = useRef(null);
  const { openModal } = useModal();

  const previewHtml = useMemo(() => render(text), [text]);
  const actualBreaks = (text.match(/\n/g) || []).length;
  const literalBreaks = (text.match(/\\n/g) || []).length;

  function handleFileChange(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      setText(event.target.result);
      e.target.value = '';
    };
    reader.onerror = () => {
      openModal('Upload Error', 'Error reading file');
    };
    reader.readAsText(file);
  }

  return (
    <div className="md-app">
      <div className="wrap">
        <div className="panel">
          <div className="panel-head">
            INPUT
            <input
              type="file"
              ref={fileInputRef}
              accept=".txt,.md,.markdown"
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />
            <button
              style={{ marginLeft: '10px', padding: '2px 8px', fontSize: '12px', cursor: 'pointer' }}
              onClick={() => fileInputRef.current?.click()}
            >
              📁 Upload File
            </button>
          </div>
          <textarea id="inp" value={text} onChange={(e) => setText(e.target.value)} />
        </div>
        <div className="panel">
          <div className="panel-head">PREVIEW</div>
          <div id="preview" dangerouslySetInnerHTML={{ __html: previewHtml }} />
        </div>
      </div>
      <div className="stats">
        <span>
          Actual breaks: <span className="stat-val">{actualBreaks}</span>
        </span>
        <span>
          Literal \n: <span className="stat-val">{literalBreaks}</span>
        </span>
      </div>
    </div>
  );
}
