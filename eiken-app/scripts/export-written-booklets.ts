import { writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { WRITTEN_BOOKLETS } from '../src/eiken/materials/written-booklets';
import { buildPrimaryBundleRef, GRADE_AUTHORING_SPECS } from '../src/eiken/writtenAuthoringSpec';
import { WRITTEN_BLUEPRINTS, validateReleasedBooklets } from '../src/eiken/writtenExamCore';
import { EIKEN_UNITS } from '../src/eiken/questions';
validateReleasedBooklets(WRITTEN_BOOKLETS);
const gradeIds=['eiken_5','eiken_4','eiken_3','eiken_pre2','eiken_pre2plus','eiken_2','eiken_pre1'] as const;
writeFileSync('deliverables/eiken-writing-tasks.json',JSON.stringify(EIKEN_UNITS.slice(0,7).map((u,i)=>({grade:gradeIds[i],theme:u.theme,focus:u.focus,writing:u.writing})),null,2)+'\n');
const source=JSON.stringify(WRITTEN_BOOKLETS);
const choiceQuestions=WRITTEN_BOOKLETS.reduce((count,exam)=>count+exam.items.filter(item=>item.kind==='choice').length,0);
const writingTasks=WRITTEN_BOOKLETS.reduce((count,exam)=>count+exam.items.filter(item=>item.kind==='writing').length,0);
writeFileSync('deliverables/written-booklets.json',JSON.stringify({
 sourceHash:createHash('sha256').update(source).digest('hex'),
 scope:'Full primary written exam booklets (reading + writing where applicable) and reading practice booklets across all 15 rounds of 7 grades; listening excluded from written booklets. Paired bundle IDs match Hub Listening room.',
 authoringGuide:'docs/WRITTEN_AUTHORING_GUIDE.md',
 progress:{
  target:105,completed:WRITTEN_BOOKLETS.length,remaining:105-WRITTEN_BOOKLETS.length,
  questions:choiceQuestions,
  writingTasks,
  totalItems:choiceQuestions+writingTasks,
  grades:Object.keys(WRITTEN_BLUEPRINTS).map(grade=>({
   grade,target:15,
   completed:WRITTEN_BOOKLETS.filter(exam=>exam.grade===grade).length,
   rounds:WRITTEN_BOOKLETS.filter(exam=>exam.grade===grade).map(exam=>exam.round),
  })),
  writingIncluded:writingTasks>0,listeningIncluded:false,
 },
 gradeSpecs:GRADE_AUTHORING_SPECS,
 blueprints:WRITTEN_BLUEPRINTS,
 primaryBundles:WRITTEN_BOOKLETS.map(exam=>buildPrimaryBundleRef(exam.grade,exam.round)),
 booklets:WRITTEN_BOOKLETS,
},null,2)+'\n');
console.log(`Exported ${WRITTEN_BOOKLETS.length} original booklet(s): ${choiceQuestions} choice items + ${writingTasks} writing tasks.`);
