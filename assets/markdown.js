import {escapeHTML as esc, safeURL} from './state.js';

// Small local renderer: headings, lists, tables, quotes, emphasis and fenced code.
// Raw HTML is always displayed as text. Links allow HTTP(S) only.
export function renderMarkdown(text, options={}) {
  const inline = value => {
    const pattern=/`([^`]+)`|\*\*([^*]+)\*\*|\[([^\]\n]+)\]\(([^\s)]+)\)|(https?:\/\/[^\s<>"'()\[\]]+)/g;
    let html='',offset=0;
    for(const match of value.matchAll(pattern)){
      html+=esc(value.slice(offset,match.index));
      if(match[1])html+='<code>'+esc(match[1])+'</code>';
      else if(match[2])html+='<strong>'+esc(match[2])+'</strong>';
      else if(match[5]){const url=match[5].replace(/[.,。，；]+$/g,'');html+=`<a href="${esc(safeURL(url))}" target="_blank" rel="noopener noreferrer">${esc(url)}</a>`+esc(match[5].slice(url.length));}
      else {const url=safeURL(match[4]),internal=/^\/(study|journal)\/(?:[?#]|$)/.test(url);html+=url==='#'?esc(match[3]):`<a href="${esc(url)}" ${internal?'data-nav':'target="_blank" rel="noopener noreferrer"'}>${esc(match[3])}</a>`;}
      offset=match.index+match[0].length;
    }
    return html+esc(value.slice(offset));
  };
  const out = [];
  let paragraph = [], list = [], listType = '', code = null,language='',headingIndex=0;
  const codeBlock=()=>`<div class="code-block"><div class="code-caption"><span>${esc(language||'CODE')}</span><button type="button" data-action="copy-code">复制代码</button></div><pre><code>${esc(code.join('\n'))}</code></pre></div>`;
  const flush = () => {
    if (paragraph.length) {out.push(`<p>${paragraph.map(inline).join('<br>')}</p>`); paragraph = [];}
    if (list.length) {out.push(`<${listType}>${list.map(item=>`<li>${inline(item)}</li>`).join('')}</${listType}>`); list = []; listType = '';}
  };
  const lines=String(text).split('\n');
  const cells=line=>line.trim().replace(/^\|/,'').replace(/(?<!\\)\|$/,'').split(/(?<!\\)\|/).map(cell=>cell.trim().replace(/\\\|/g,'|'));
  for (let row=0;row<lines.length;row++) {
    const line=lines[row];
    if (/^\s*(```|~~~)/.test(line)) {
      if (code === null) {flush(); code = [];language=line.replace(/^\s*(```|~~~)/,'').trim();} else {out.push(codeBlock());code = null;}
      continue;
    }
    if (code !== null) {code.push(line);continue;}
    if (!line.trim()) {flush();continue;}
    if(line.includes('|')&&row+1<lines.length){
      const headers=cells(line),delimiters=cells(lines[row+1]);
      if(headers.length>=2&&headers.length<=20&&headers.length===delimiters.length&&delimiters.every(cell=>/^:?-{3,}:?$/.test(cell))){
        flush();row++;
        const body=[];
        while(row+1<lines.length&&lines[row+1].trim()&&lines[row+1].includes('|')){
          const values=cells(lines[row+1]);if(values.length!==headers.length)break;
          row++;body.push(values);
        }
        out.push('<div class="table-scroll" role="region" aria-label="表格，可横向滚动" tabindex="0"><table><thead><tr>'+headers.map(cell=>'<th scope="col">'+inline(cell)+'</th>').join('')+'</tr></thead><tbody>'+body.map(values=>'<tr>'+values.map(cell=>'<td>'+inline(cell)+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>');
        continue;
      }
    }
    const heading = /^(#{1,6})\s+(.+)$/.exec(line);
    if (heading) {flush();const level = Math.min(6,heading[1].length+(options.headingOffset===0?0:1));const id=options.headingPrefix?` id="${esc(options.headingPrefix)}-${headingIndex}"`:'';headingIndex++;out.push(`<h${level}${id}>${inline(heading[2])}</h${level}>`);continue;}
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
  if (code !== null) out.push(codeBlock());
  return out.join('\n');
}
