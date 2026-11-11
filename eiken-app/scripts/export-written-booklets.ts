import { writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { WRITTEN_BOOKLETS } from '../src/eiken/materials/written-booklets';
import { WRITTEN_BLUEPRINTS, validateWrittenExam } from '../src/eiken/writtenExamCore';
WRITTEN_BOOKLETS.forEach(exam=>validateWrittenExam(exam));
const source=JSON.stringify(WRITTEN_BOOKLETS);
writeFileSync('deliverables/written-booklets.json',JSON.stringify({
 sourceHash:createHash('sha256').update(source).digest('hex'),
 scope:'Reading booklets only; writing and listening excluded. Internal review, not external difficulty calibration.',
 progress:{
  target:105,completed:WRITTEN_BOOKLETS.length,remaining:105-WRITTEN_BOOKLETS.length,
  questions:WRITTEN_BOOKLETS.reduce((count,exam)=>count+exam.items.length,0),
  grades:Object.keys(WRITTEN_BLUEPRINTS).map(grade=>({grade,target:15,completed:WRITTEN_BOOKLETS.filter(exam=>exam.grade===grade).length,rounds:WRITTEN_BOOKLETS.filter(exam=>exam.grade===grade).map(exam=>exam.round)})),
  writingIncluded:false,listeningIncluded:false,
 },
 blueprints:WRITTEN_BLUEPRINTS,booklets:WRITTEN_BOOKLETS,
},null,2)+'\n');
console.log(`Exported ${WRITTEN_BOOKLETS.length} original booklet(s).`);
