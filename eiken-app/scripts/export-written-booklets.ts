import { writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { WRITTEN_BOOKLETS } from '../src/eiken/materials/written-booklets';
import { WRITTEN_BLUEPRINTS, validateWrittenExam } from '../src/eiken/writtenExamCore';
WRITTEN_BOOKLETS.forEach(exam=>validateWrittenExam(exam));
const source=JSON.stringify(WRITTEN_BOOKLETS);
writeFileSync('deliverables/written-booklets.json',JSON.stringify({
 sourceHash:createHash('sha256').update(source).digest('hex'),
 scope:'Completed original booklets only. Not a 105-exam collection. Internal review, not external difficulty calibration.',
 blueprints:WRITTEN_BLUEPRINTS,booklets:WRITTEN_BOOKLETS,
},null,2)+'\n');
console.log(`Exported ${WRITTEN_BOOKLETS.length} original booklet(s).`);
