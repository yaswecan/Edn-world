// CodeMirror uses LF positions internally. Keep the original file's bytes at the
// authoring boundary, including CRLF and mixed line endings outside an edit.
export function applyCodeChanges(source,changes,pastedText=null){
 const offset=position=>{let raw=0,logical=0;while(raw<source.length&&logical<position){if(source[raw]==='\r'&&source[raw+1]==='\n')raw++;raw++;logical++;}return raw;};
 const separator=source.includes('\r\n')?'\r\n':'\n';
 const edits=changes.map(c=>({from:offset(c.from),to:offset(c.to),text:pastedText!==null&&changes.length===1?pastedText:c.text.replace(/\n/g,separator)}));
 for(const edit of edits.reverse())source=source.slice(0,edit.from)+edit.text+source.slice(edit.to);return source;
}
