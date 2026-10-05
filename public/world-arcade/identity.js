// Pixel lettering from the supplied reference; no prototype state or fixtures.
 const glyphs = {
  A:['01110','11011','11011','11111','11011','11011','11011'],
  D:['11110','11011','11011','11011','11011','11011','11110'],
  E:['11111','11000','11000','11110','11000','11000','11111'],
  N:['11011','11111','11111','11011','11011','11011','11011'],
  W:['11011','11011','11011','11011','11111','11111','01010'],
  O:['01110','11011','11011','11011','11011','11011','01110'],
  R:['11110','11011','11011','11110','11100','11010','11011'],
  L:['11000','11000','11000','11000','11000','11000','11111'],
  C:['01111','11000','11000','11000','11000','11000','01111']
 };
 export function pixelText(text){
  const chars=[...text.toUpperCase()];let paths='';
  chars.forEach((char,i)=>{(glyphs[char]||glyphs.E).forEach((row,y)=>{[...row].forEach((cell,x)=>{if(cell==='1') paths+=`M${i*6+x} ${y}h1v1h-1Z`;});});});
  return `<svg viewBox="0 0 ${chars.length*6-1} 7" aria-hidden="true" shape-rendering="crispEdges"><path fill="currentColor" d="${paths}"/></svg>`;
 }
