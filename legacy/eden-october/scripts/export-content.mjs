import {writeFile} from 'node:fs/promises';
import {LESSON} from '../docs/app/content.js';
await writeFile(new URL('../docs/app/lesson.json',import.meta.url),JSON.stringify(LESSON,null,2)+'\n');
console.log('lesson.json actualisé depuis content.js.');
