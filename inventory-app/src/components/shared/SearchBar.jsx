import React, { useEffect, useState } from 'react';
import { FaSearch, FaTimes } from 'react-icons/fa';

let placeholderStyleInjected = false;
function ensurePlaceholderStyle() {
  if (placeholderStyleInjected || typeof document === 'undefined') return;
  placeholderStyleInjected = true;
  const style = document.createElement('style');
  style.textContent = '[data-scnt-search]::-webkit-input-placeholder{color:var(--text-muted);opacity:1}[data-scnt-search]::placeholder{color:var(--text-muted);opacity:1}';
  document.head.appendChild(style);
}

export default function SearchBar({ value, onChange, placeholder = 'Search...', inputRef }) {
  const [focused, setFocused] = useState(false);

  useEffect(() => { ensurePlaceholderStyle(); }, []);

  return (
    <div style={{ background:'var(--bg-card)', borderRadius:12, padding:'10px 16px',
      display:'flex', alignItems:'center', gap:10, marginBottom:20,
      border:`1.5px solid ${focused ? 'var(--accent)' : 'var(--border)'}`,
      boxShadow:'0 2px 12px rgba(0,0,0,0.2)', transition:'border-color 0.15s' }}>
      <FaSearch style={{ color:'var(--text-muted)', fontSize:14 }} />
      <input ref={inputRef} value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        data-scnt-search="true"
        style={{ flex:1, border:'none', outline:'none', fontSize:13, color:'var(--text-primary)',
          caretColor:'var(--accent)', background:'transparent' }} />
      {value && (
        <button onClick={() => onChange('')} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)' }}>
          <FaTimes />
        </button>
      )}
    </div>
  );
}