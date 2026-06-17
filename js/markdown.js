// File upload functionality
document.getElementById('uploadBtn').addEventListener('click', function() {
  document.getElementById('fileInput').click();
});

document.getElementById('fileInput').addEventListener('change', function(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(event) {
    const textarea = document.getElementById('inp');
    textarea.value = event.target.result;
    if (typeof update === 'function') {
      update();
    }
    e.target.value = '';
  };
  reader.onerror = function() {
    alert('Error reading file');
  };
  reader.readAsText(file);
});

function esc(s) {
  return s.replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;');
}

const ESCAPES = { 'n': '\n', 't': '\t', 'r': '\r', '\\': '\\', '"': '"', "'": '\'', '0': '\0' };

function expandEscapes(s) {
  const QUOTES = ['"', "'", '`'];
  let out = '', inStr = null, i = 0;
  while (i < s.length) {
    const c = s[i];
    if (inStr) {
      if (c === '\\' && i + 1 < s.length) {
        const nx = s[i + 1];
        out += c + nx;
        i += 2;
        continue;
      }
      if (c === inStr) inStr = null;
      out += c;
      i++;
      continue;
    }
    if (QUOTES.includes(c)) {
      inStr = c;
      out += c;
      i++;
      continue;
    }
    if (c === '\\' && i + 1 < s.length) {
      const nx = s[i + 1];
      out += (ESCAPES[nx] !== undefined ? ESCAPES[nx] : c + nx);
      i += 2;
      continue;
    }
    out += c;
    i++;
  }
  return out;
}

// Inline formatting - don't escape if already HTML
function formatInline(text) {
  // Don't process if it looks like HTML (contains code block placeholders or tags)
  if (/%%CODE_\d+%%|<[^>]+>/.test(text)) {
    return text;
  }
  
  let html = esc(text);
  
  // Images (must be before links)
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" style="max-width:100%;border-radius:4px;">');
  
  // Links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" style="color:#7ab8f5;text-decoration:none;">$1</a>');
  
  // Bold + Italic
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/___(.+?)___/g, '<strong><em>$1</em></strong>');
  
  // Bold
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/__(.+?)__/g, '<strong>$1</strong>');
  
  // Italic
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  html = html.replace(/_(.+?)_/g, '<em>$1</em>');
  
  // Strikethrough
  html = html.replace(/~~(.+?)~~/g, '<del>$1</del>');
  
  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code style="background:#2a2a2a;padding:1px 4px;border-radius:3px;font-family:monospace;font-size:12px;color:#f48771;">$1</code>');
  
  return html;
}

function processParagraph(text) {
  // If text is just a code block placeholder, return it as-is
  if (/^%%CODE_\d+%%$/.test(text.trim())) {
    return text;
  }
  
  const lines = text.split('\n');
  
  // Check if this is a list block
  if (lines.every(line => /^(\s*[-*+]\s|\s*\d+\.\s)/.test(line))) {
    return processList(lines);
  }
  
  // Check if this is a table
  if (lines.length >= 2 && lines[0].includes('|') && lines[1].includes('|') && 
      /^[\s|:\-]+$/.test(lines[1].replace(/\|/g, '').trim())) {
    return processTable(lines);
  }
  
  // Regular paragraph - join lines with <br> if multiple lines
  if (lines.length > 1) {
    return `<p>${lines.map(l => formatInline(l)).join('<br>')}</p>`;
  }
  
  return `<p>${formatInline(text)}</p>`;
}

function processList(lines) {
  let html = '';
  let inSubList = false;
  let subListItems = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isSubItem = line.startsWith('    ') || line.startsWith('\t');
    const isOrdered = /^\s*\d+\.\s/.test(line);
    const isUnordered = /^\s*[-*+]\s/.test(line);
    
    if (isSubItem) {
      // Handle sub-item
      const content = line.replace(/^\s+[-*+]\s|\s+\d+\.\s/, '');
      subListItems.push(content);
    } else {
      // Flush any pending sublist
      if (subListItems.length > 0) {
        html += '<ul style="margin:0;padding-left:20px;">';
        subListItems.forEach(item => {
          html += `<li style="color:#aaa;">${formatInline(item)}</li>`;
        });
        html += '</ul>';
        subListItems = [];
        html += '</li>';
      }
      
      // Check if next line is sub-item
      const nextLine = i + 1 < lines.length ? lines[i + 1] : '';
      const hasSubItems = nextLine && (nextLine.startsWith('    ') || nextLine.startsWith('\t'));
      
      const content = line.replace(/^\s*[-*+]\s|\s*\d+\.\s/, '');
      
      if (isOrdered) {
        const num = line.match(/(\d+)\./)[1];
        html += `<li value="${num}" style="margin:3px 0;color:#e0e0e0;">${formatInline(content)}`;
      } else {
        html += `<li style="margin:3px 0;color:#e0e0e0;">${formatInline(content)}`;
      }
      
      if (!hasSubItems) {
        html += '</li>';
      }
    }
  }
  
  // Flush remaining sublist
  if (subListItems.length > 0) {
    html += '<ul style="margin:0;padding-left:20px;">';
    subListItems.forEach(item => {
      html += `<li style="color:#aaa;">${formatInline(item)}</li>`;
    });
    html += '</ul>';
    html += '</li>';
  }
  
  const listTag = /^\d+\.\s/.test(lines[0]) ? 'ol' : 'ul';
  return `<${listTag} style="margin:5px 0;padding-left:24px;list-style-position:outside;">${html}</${listTag}>`;
}

function processTable(lines) {
  const headers = lines[0].split('|').filter(cell => cell.trim()).map(cell => cell.trim());
  const alignments = lines[1].split('|').filter(cell => cell.trim()).map(cell => {
    const trimmed = cell.trim();
    if (trimmed.startsWith(':') && trimmed.endsWith(':')) return 'center';
    if (trimmed.endsWith(':')) return 'right';
    return 'left';
  });
  
  let html = '<div style="overflow-x:auto;margin:8px 0;"><table style="width:100%;border-collapse:collapse;font-size:13px;">';
  
  // Header
  html += '<thead><tr>';
  headers.forEach((header, i) => {
    html += `<th style="border:1px solid #3a3a3a;padding:6px 10px;text-align:${alignments[i] || 'left'};background:#222;color:#e0e0e0;font-weight:500;">${formatInline(header)}</th>`;
  });
  html += '</tr></thead><tbody>';
  
  // Body
  for (let i = 2; i < lines.length; i++) {
    const cells = lines[i].split('|').filter(cell => cell.trim()).map(cell => cell.trim());
    html += '<tr>';
    headers.forEach((_, j) => {
      html += `<td style="border:1px solid #3a3a3a;padding:6px 10px;color:#ccc;">${formatInline(cells[j] || '')}</td>`;
    });
    html += '</tr>';
  }
  
  html += '</tbody></table></div>';
  return html;
}

function render(text) {
  // First, protect code blocks and replace them with HTML immediately
  text = text.replace(/```(\w*)\n([\s\S]*?)```/g, (match, lang, code) => {
    const langHeader = lang ? 
      `<div style="background:#222;padding:3px 8px;font-size:11px;font-family:monospace;color:#888;">${esc(lang)}</div>` : '';
    return `\n%%HTML_START%%<div style="border:0.5px solid #3a3a3a;border-radius:8px;overflow:hidden;margin:8px 0;text-align:left;">${langHeader}<pre style="margin:0;padding:10px;font-family:monospace;font-size:12px;color:#7ab8f5;white-space:pre-wrap;overflow-x:auto;text-align:left;">${esc(expandEscapes(code.trim()))}</pre></div>%%HTML_END%%\n`;
  });
  
  // Protect indented code blocks (lines starting with 4+ spaces or tab)
  const lines = text.split('\n');
  let processed = [];
  let inCodeBlock = false;
  let codeLines = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.match(/^( {4,}|\t)/) && !line.match(/^\s*[-*+]\s|\s*\d+\.\s/)) {
      if (!inCodeBlock) {
        inCodeBlock = true;
        codeLines = [];
      }
      codeLines.push(line.replace(/^( {4}|\t)/, ''));
    } else {
      if (inCodeBlock) {
        processed.push(`%%HTML_START%%<div style="border:0.5px solid #3a3a3a;border-radius:8px;overflow:hidden;margin:8px 0;text-align:left;"><pre style="margin:0;padding:10px;font-family:monospace;font-size:12px;color:#7ab8f5;white-space:pre-wrap;overflow-x:auto;text-align:left;">${esc(codeLines.join('\n'))}</pre></div>%%HTML_END%%`);
        inCodeBlock = false;
      }
      processed.push(line);
    }
  }
  
  if (inCodeBlock) {
    processed.push(`%%HTML_START%%<div style="border:0.5px solid #3a3a3a;border-radius:8px;overflow:hidden;margin:8px 0;text-align:left;"><pre style="margin:0;padding:10px;font-family:monospace;font-size:12px;color:#7ab8f5;white-space:pre-wrap;overflow-x:auto;text-align:left;">${esc(codeLines.join('\n'))}</pre></div>%%HTML_END%%`);
  }
  
  text = processed.join('\n');
  
  // Split into blocks (paragraphs separated by blank lines)
  const blocks = text.split(/\n\n+/);
  let html = '';
  
  for (let block of blocks) {
    const trimmedBlock = block.trim();
    if (!trimmedBlock) {
      html += '<div style="height:12px;"></div>';
      continue;
    }
    
    // Check if this block is raw HTML (code blocks)
    if (trimmedBlock.startsWith('%%HTML_START%%') && trimmedBlock.endsWith('%%HTML_END%%')) {
      html += trimmedBlock.replace('%%HTML_START%%', '').replace('%%HTML_END%%', '');
      continue;
    }
    
    const lines = trimmedBlock.split('\n');
    const firstLine = lines[0].trim();
    
    // Horizontal rule
    if (/^(-{3,}|\*{3,}|_{3,})\s*$/.test(firstLine) && lines.length === 1) {
      html += '<hr style="border:none;border-top:1px solid #3a3a3a;margin:12px 0;">';
      continue;
    }
    
    // Headers
    if (firstLine.startsWith('#')) {
      const match = firstLine.match(/^(#{1,6})\s(.+)$/);
      if (match) {
        const level = match[1].length;
        const content = match[2];
        const sizes = {1: '22px', 2: '18px', 3: '15px', 4: '13px', 5: '12px', 6: '11px'};
        const colors = {1: '#e0e0e0', 2: '#e0e0e0', 3: '#aaa', 4: '#888', 5: '#888', 6: '#888'};
        const transforms = level <= 3 ? 'text-transform:uppercase;letter-spacing:1px;' : '';
        html += `<h${level} style="font-size:${sizes[level]};font-weight:500;color:${colors[level]};margin:8px 0 4px;${transforms}">${formatInline(content)}</h${level}>`;
        continue;
      }
    }
    
    // Blockquote
    if (lines.every(line => line.trim().startsWith('>'))) {
      const content = lines.map(line => line.replace(/^>\s?/, '')).join('<br>');
      html += `<blockquote style="border-left:3px solid #555;margin:8px 0;padding:4px 12px;color:#aaa;background:#1a1a1a;border-radius:0 4px 4px 0;">
        ${formatInline(content)}
      </blockquote>`;
      continue;
    }
    
    // Process as paragraph/list/table
    html += processParagraph(trimmedBlock);
  }
  
  return html;
}

function update() {
  const v = document.getElementById('inp').value;
  document.getElementById('preview').innerHTML = render(v);
  document.getElementById('sb').textContent = (v.match(/\n/g) || []).length;
  document.getElementById('sn').textContent = (v.match(/\\n/g) || []).length;
}

document.getElementById('inp').addEventListener('input', update);
update();