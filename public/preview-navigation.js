export function previewExercises(spec,block){
 return block.type==='Diagnostic'?spec.diagnostic.tasks:block.activityIds.map(id=>spec.activities.find(a=>a.id===id)).filter(Boolean);
}
export function previewEditorStep(spec){
 const hasEditor=block=>previewExercises(spec,block).some(a=>['CodeEditor','TestRunner','Preview','Terminal'].includes(a.type));
 const index=spec.blocks.findIndex(block=>block.type!=='Diagnostic'&&hasEditor(block));
 return index>=0?index:spec.blocks.findIndex(hasEditor);
}
export function focusPreviewEditor(root){
 requestAnimationFrame(()=>{
  const editor=root?.querySelector('.lesson-workbench, [data-dom-lab], [data-real-lab], textarea.code');if(!editor)return;
  const body=editor.closest('.modal-body');
  if(body)body.scrollTop+=editor.getBoundingClientRect().top-body.getBoundingClientRect().top-body.querySelector('.preview-toolbar').offsetHeight-12;
  else editor.scrollIntoView({block:'start'});
  (editor.matches('textarea')?editor:editor.querySelector('textarea'))?.focus({preventScroll:true});
 });
}
