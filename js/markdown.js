

function esc(s){return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}

// Expand escape sequences only outside string literals.
// String openers: " ' ` (backtick-strings count too)
const ESCAPES = {'n':'\n','t':'\t','r':'\r','\\':'\\','"':'"',"'":'\'','0':'\0'};
function expandEscapes(s){
  const QUOTES=['"',"'",'`'];
  let out='', inStr=null, i=0;
  while(i<s.length){
    const c=s[i];
    if(inStr){
      if(c==='\\' && i+1<s.length){
        const nx=s[i+1];
        // inside a string: keep escape sequences literal (as written)
        out+=c+nx; i+=2; continue;
      }
      if(c===inStr) inStr=null;
      out+=c; i++; continue;
    }
    // outside a string
    if(QUOTES.includes(c)){ inStr=c; out+=c; i++; continue; }
    if(c==='\\' && i+1<s.length){
      const nx=s[i+1];
      out+=(ESCAPES[nx]!==undefined ? ESCAPES[nx] : c+nx);
      i+=2; continue;
    }
    out+=c; i++;
  }
  return out;
}

function inline(s){
  return esc(s)
    .replace(/`([^`]+)`/g,'<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g,'<em style="color:#aaa;">$1</em>')
    .replace(/\\n/g,'<code>\\n</code>');
}

// For code blocks: HTML-escape but also expand escapes outside strings so
// \n inside "..." stays as \n visually, but a bare \n outside strings becomes a real newline.
function renderCode(raw){
  const expanded=expandEscapes(raw.trim());
  return esc(expanded);
}

function render(text){
  const segs=[];const re=/```(\w*)?\n?([\s\S]*?)```/g;let li=0,m;
  while((m=re.exec(text))!==null){
    if(m.index>li)segs.push({t:'p',v:text.slice(li,m.index)});
    segs.push({t:'c',lang:m[1]||'',v:m[2]});li=m.index+m[0].length;
  }
  if(li<text.length)segs.push({t:'p',v:text.slice(li)});
  return segs.map(s=>{
    if(s.t==='c') return `<div style="border:0.5px solid #3a3a3a;border-radius:8px;overflow:hidden;margin:8px 0;"><div style="background:#222;padding:3px 8px;font-size:11px;font-family:'Fira Code',monospace;color:#888;">${s.lang||'code'}</div><pre style="margin:0;padding:10px;font-family:'Fira Code',monospace;font-size:12px;color:#7ab8f5;white-space:pre-wrap;">${renderCode(s.v)}</pre></div>`;
    return expandEscapes(s.v).split('\n').map(line=>{
      const t=line.trim();
      if(!t) return '<div style="height:6px;"></div>';
      if(t.startsWith('### ')) return `<div style="font-size:13px;font-weight:500;color:#aaa;margin:8px 0 4px;text-transform:uppercase;letter-spacing:1px;">${inline(t.slice(4))}</div>`;
      if(t.startsWith('## ')) return `<div style="font-size:15px;font-weight:500;color:#e0e0e0;margin:8px 0 4px;">${inline(t.slice(3))}</div>`;
      if(t.startsWith('# ')) return `<div style="font-size:18px;font-weight:500;color:#e0e0e0;margin:8px 0 4px;">${inline(t.slice(2))}</div>`;
      if(t.startsWith('  - ')||t.startsWith('  • ')) return `<div style="margin:3px 0 3px 32px;color:#aaa;font-size:14px;">◦ ${inline(t.slice(4))}</div>`;
      if(t.startsWith('- ')||t.startsWith('• ')) return `<div style="margin:3px 0 3px 16px;color:#e0e0e0;font-size:14px;">• ${inline(t.slice(2))}</div>`;
      return `<p style="margin:5px 0;color:#e0e0e0;font-size:14px;">${inline(line)}</p>`;
    }).join('');
  }).join('');
}
function update(){
  const v=document.getElementById('inp').value;
  document.getElementById('preview').innerHTML=render(v);
  document.getElementById('sb').textContent=(v.match(/\n/g)||[]).length;
  document.getElementById('sn').textContent=(v.match(/\\n/g)||[]).length;
}
document.getElementById('inp').addEventListener('input',update);
update();