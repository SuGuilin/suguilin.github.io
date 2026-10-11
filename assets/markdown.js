import {escapeHTML as esc, safeURL} from './state.js';

// Small local renderer: headings, lists, quotes, emphasis and fenced code.
// Raw HTML is always displayed as text. Links allow HTTP(S) only.
export function renderMarkdown(text) {
  const inline = value => esc(value).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  const out = [];
  let paragraph = [], list = [], listType = '', code = null;
  const flush = () => {
    if (paragraph.length) {out.push(`<p>${paragraph.map(inline).join('<br>')}</p>`); paragraph = [];}
    if (list.length) {out.push(`<${listType}>${list.map(item=>`<li>${inline(item)}</li>`).join('')}</${listType}>`); list = []; listType = '';}
  };
  for (const line of String(text).split('\n')) {
    if (/^\s*```/.test(line)) {
      if (code === null) {flush(); code = [];} else {out.push(`<pre><code>${esc(code.join('\n'))}</code></pre>`);code = null;}
      continue;
    }
    if (code !== null) {code.push(line);continue;}
    if (!line.trim()) {flush();continue;}
    const heading = /^(#{1,3})\s+(.+)$/.exec(line);
    if (heading) {flush();const level = heading[1].length+1;out.push(`<h${level}>${inline(heading[2])}</h${level}>`);continue;}
    const bullet = /^\s*([-*]|\d+\.)\s+(.+)$/.exec(line);
    if (bullet) {
      const type = /\d/.test(bullet[1])?'ol':'ul';
      if (paragraph.length || listType && listType !== type) flush();
      listType=type;list.push(bullet[2]);continue;
    }
    if (/^>\s?/.test(line)) {flush();out.push(`<blockquote>${inline(line.replace(/^>\s?/,''))}</blockquote>`);continue;}
    if (list.length) flush();
    if (/^https?:\/\/\S+$/.test(line)) {flush();out.push(`<p><a href="${esc(safeURL(line))}" target="_blank" rel="noopener noreferrer">${esc(line)}</a></p>`);continue;}
    paragraph.push(line);
  }
  flush();
  if (code !== null) out.push(`<pre><code>${esc(code.join('\n'))}</code></pre>`);
  return out.join('\n');
}
