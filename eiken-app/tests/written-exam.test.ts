import { describe, expect, it } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { WRITTEN_BLUEPRINTS, validateGradeSeries, validateWrittenExam, type WrittenExam, type WrittenItem } from '../src/eiken/writtenExamCore';
import { WRITTEN_BOOKLETS } from '../src/eiken/materials/written-booklets';
import { createHash } from 'node:crypto';
import { partsForGrade } from '../src/eiken/questions';
import { WRITTEN_PRINTS } from '../src/data/writtenPrints.generated';
import { GACHA_PRINTS } from '../src/data/gachaPrints.generated';
import { gachaItems, gachaItemRate } from '../src/battle/core/arenaEconomy';
import type { EikenGrade } from '../src/eiken/config';

/** Synthetic TEST fixtures only; not learning materials. */
function fixture(grade:EikenGrade='eiken_3',round=1):WrittenExam {
 const id=`${grade}_written_${String(round).padStart(2,'0')}`;
 const items=WRITTEN_BLUEPRINTS[grade]!.sections.flatMap(section=>Array.from({length:section.count},(_,index):WrittenItem=>({
  id:`${id}_${section.id}_${index}`,section:section.id,kind:section.kind,prompt:`TEST ONLY ${section.id} ${index} round ${round}`,
  passage:{id:`p-${round}`,title:'TEST ONLY',text:'Synthetic test passage, not a released learning item.'},choices:['1－3','B','C','D'],answer:0,
  explanation:'Test explanation',distractorReasons:['correct','wrong','wrong','wrong'],model:'A test answer.',rubric:['Check content'],wordRange:[25,35],
  orderTokens:['one','two','three','four'],orderAnswer:[1,2,3,4],orderPrefix:'Test',completedSentence:'Test one two three four.',
 })));
 return {id,grade,round,revision:'test-1',origin:'manatobi-original',review:'approved',items};
}

describe('written booklets — same original for print and field practice, no exam runner',()=>{
 it('defines all seven verified written formats including required reading and writing',()=>{
  expect(Object.values(WRITTEN_BLUEPRINTS).map(b=>b!.minutes)).toEqual([25,35,65,80,85,85,90]);
  expect(Object.values(WRITTEN_BLUEPRINTS).map(b=>b!.sections.filter(s=>s.kind==='choice').reduce((n,s)=>n+s.count,0))).toEqual([25,35,30,29,31,31,31]);
  for(const grade of Object.keys(WRITTEN_BLUEPRINTS)as EikenGrade[])expect(()=>validateWrittenExam(fixture(grade))).not.toThrow();
 });
 it('rejects incomplete, draft, empty-passaged or unreviewable booklets',()=>{
  const exam=fixture();
  expect(()=>validateWrittenExam({...exam,review:'draft'})).toThrow('EXAM_NOT_RELEASE_READY');
  expect(()=>validateWrittenExam({...exam,items:exam.items.slice(1)})).toThrow('EXAM_COUNT');
  const empty=structuredClone(exam);empty.items.find(i=>i.section==='reading')!.passage!.text='';
  expect(()=>validateWrittenExam(empty)).toThrow('PASSAGE_REQUIRED');
  const noAnswer=structuredClone(exam);noAnswer.items[0].answer=undefined;
  expect(()=>validateWrittenExam(noAnswer)).toThrow('CHOICE_NOT_REVIEWABLE');
  const badRange=structuredClone(exam);badRange.items.at(-1)!.wordRange=[25,35.5];
  expect(()=>validateWrittenExam(badRange)).toThrow('WRITING_RUBRIC_REQUIRED');
 });
 it('checks every real ordering permutation, completed sentence and first/third pair',()=>{
  expect(WRITTEN_BOOKLETS.map(exam=>[exam.grade,exam.items.length])).toEqual([
   ['eiken_5',25],['eiken_4',35],['eiken_3',30],['eiken_pre2',29],['eiken_pre2plus',31],['eiken_2',31],['eiken_pre1',31]
  ]);
  expect(WRITTEN_BOOKLETS.reduce((n,exam)=>n+exam.items.length,0)).toBe(212);
  for(const booklet of WRITTEN_BOOKLETS){
   validateWrittenExam(booklet);expect(booklet.round).toBe(1);
   for(const item of booklet.items.filter(i=>i.section==='reorder')){
    expect(item.choices![item.answer!]).toBe(`${item.orderAnswer![0]}－${item.orderAnswer![2]}`);
    expect(item.completedSentence!.replace(/[.?]$/,'')).toBe(`${item.orderPrefix} ${item.orderAnswer!.map(n=>item.orderTokens![n-1]).join(' ')}`);
   }
  }
  const exam=WRITTEN_BOOKLETS[0];validateWrittenExam(exam);
  expect(exam.items).toHaveLength(25);
  expect(exam.items.map(item=>item.id)).toEqual(Array.from({length:25},(_,i)=>`${exam.id}_q${String(i+1).padStart(2,'0')}`));
  expect(exam.items.filter(i=>i.section==='reorder')).toHaveLength(5);
  for(const item of exam.items.filter(i=>i.section==='reorder')) {
   expect(item.choices![item.answer!]).toBe(`${item.orderAnswer![0]}－${item.orderAnswer![2]}`);
   expect(item.completedSentence).toBe(`${item.orderPrefix} ${item.orderAnswer!.map(n=>item.orderTokens![n-1]).join(' ')}${item.completedSentence!.endsWith('?')?'?':'.'}`);
  }
  for(const mutate of [(item:WrittenItem)=>{item.orderAnswer=[1,1,3,4];},(item:WrittenItem)=>{item.answer=(item.answer!+1)%4;},(item:WrittenItem)=>{item.completedSentence='Wrong.';}]) {
   const bad=structuredClone(exam);mutate(bad.items[20]);expect(()=>validateWrittenExam(bad)).toThrow(/ORDER_/);
  }
  expect(exam.items[4].choices).not.toContain('go');
  expect(JSON.stringify(exam)).not.toContain('\uFFFD');
 });
 it('matches every field-practice answer and generated PDF audit to the same original',()=>{
  const manifest=JSON.parse(readFileSync('deliverables/written-booklets.json','utf8'));
  expect(manifest.booklets).toEqual(WRITTEN_BOOKLETS);
  expect(manifest.progress).toMatchObject({target:105,completed:7,remaining:98,questions:212,writingIncluded:false,listeningIncluded:false});
  expect(manifest.progress.grades).toHaveLength(7);
  for(const row of manifest.progress.grades)expect(row).toMatchObject({target:15,completed:1,rounds:[1]});
  const sourceHash=createHash('sha256').update(JSON.stringify(WRITTEN_BOOKLETS)).digest('hex');
  expect(manifest.sourceHash).toBe(sourceHash);
  const reports=JSON.parse(readFileSync('deliverables/written-pdf-validation.json','utf8'));
  expect(reports).toHaveLength(WRITTEN_BOOKLETS.length);
  for(const exam of WRITTEN_BOOKLETS){
   const report=reports.find(r=>r.id===exam.id), print=WRITTEN_PRINTS.find(p=>p.id===`print_${exam.id}`)!;
   expect(report.sourceHash).toBe(sourceHash);expect(report.answers).toEqual(exam.items.map((item,index)=>({id:item.id,number:index+1,answer:item.answer!+1,explanation:item.explanation})));
   expect(report.checks).toEqual({allPromptsChoicesTranslationsAndExplanations:true,noSplitQuestions:true,noAnswerLeak:true,safeMargins:true,grayscalePreviews:true});
   expect(report.pdfSha256).toBe(createHash('sha256').update(readFileSync(`public${print.file}`)).digest('hex'));
   if(exam.grade==='eiken_5'){
    expect(report.questionPages).toEqual([...Array(7).fill(2),...Array(8).fill(3),...Array(5).fill(4),...Array(5).fill(5)]);
    expect(report.layout.choiceColumns).toEqual({short:4,conversation:2,reorder:4});
    expect(report.layout.orderingAnswerBoxes).toBe(4);expect(report.layout.orderingMarkedPositions).toEqual([1,3]);
   }else{
    const splits={eiken_4:[8,7],eiken_3:[7,8],eiken_pre2:[10,5],eiken_pre2plus:[5,5,5,2],eiken_2:[5,5,5,2],eiken_pre1:[8,8,2]};
    expect(report.layout.shortQuestionPages).toEqual(splits[exam.grade]);
    expect(report.layout.choiceColumns).toEqual({short:4,conversation:2,cloze:2,reading:1});
   }
   expect(report.questionPages).toHaveLength(exam.items.length);
   expect(report.layout.officialArtworkCopied).toBe(false);
   expect(print.pages).toBe(report.pages);expect(print.variants![0].pages).toBe(exam.grade==='eiken_5'?5:exam.grade==='eiken_4'?11:exam.grade==='eiken_pre1'?10:['eiken_pre2plus','eiken_2'].includes(exam.grade)?11:9);
   expect(print.variants).toHaveLength(3);expect(print.variants!.map(p=>p.label)).toEqual(['問題冊子','解答用紙','解答・解説']);
   for(const part of print.variants!) expect(readFileSync(`public${part.file}`).subarray(0,5).toString()).toBe('%PDF-');
   const problems=partsForGrade(exam.grade).flatMap(part=>part.chapters).flatMap(chapter=>chapter.practiceProblems);
   for(const item of exam.items){
    const matches=problems.flatMap(problem=>problem.subQuestions.filter(sub=>sub.id===`${item.id}_answer`).map(sub=>({problem,sub})));
    expect(matches).toHaveLength(1);const {problem,sub}=matches[0];
    expect(sub.optionTexts).toEqual(item.choices);expect(sub.correctAnswer).toBe(String(item.answer!+1));
    expect(sub.explainJa).toBe(item.explanation);expect(problem.audioTracks).toBeUndefined();
    if(item.passage){
     expect(problem.text).toContain(item.passage.text);expect(problem.explanation).toContain(item.passage.translation);
     expect(problem.subQuestions).toHaveLength(exam.items.filter(other=>other.passage?.id===item.passage!.id).length);
    }
    for(const token of item.orderTokens || []) expect(problem.text).toContain(token);
   }
   expect(GACHA_PRINTS.some(p=>p.id===print.id)).toBe(true);
   const pool=['eiken_pre2plus','eiken_2','eiken_pre1'].includes(exam.grade)?'niji':'kyotsu';
   const reward=gachaItems(pool).find(i=>i.id===print.id)!;expect(reward.rarity).toBe('UR');
   expect(gachaItemRate(reward,'N',pool)).toBeGreaterThan(0);expect(gachaItems(pool==='kyotsu'?'niji':'kyotsu').some(i=>i.id===print.id)).toBe(false);
  }
 });
 it('requires translated consistent reading passages and matching cloze numbers without claiming full written coverage',()=>{
  for(const exam of WRITTEN_BOOKLETS.filter(exam=>exam.scope==='reading')){
   if(!['eiken_4','eiken_5'].includes(exam.grade))expect(()=>validateWrittenExam({...exam,scope:undefined})).toThrow('EXAM_COUNT');
   const missing=structuredClone(exam);missing.items.find(item=>item.passage)!.passage!.translation='';
   expect(()=>validateWrittenExam(missing)).toThrow('PASSAGE_TRANSLATION_FORMAT_REQUIRED');
   const collision=structuredClone(exam), shared=collision.items.filter(item=>item.passage);
   shared[1].passage!.translation+=' inconsistent';expect(()=>validateWrittenExam(collision)).toThrow('PASSAGE_ID_COLLISION');
   const cloze=structuredClone(exam);const index=cloze.items.findIndex(item=>item.section==='cloze');
   if(index>=0){
    const id=cloze.items[index].passage!.id;
    cloze.items.filter(item=>item.passage?.id===id).forEach(item=>{item.passage!.text=item.passage!.text.replace(new RegExp(`\\(\\s*${index+1}\\s*\\)`),'(999)');});
    expect(()=>validateWrittenExam(cloze)).toThrow('CLOZE_NUMBER_MISMATCH');
   }
  }
 });
 it('keeps timers, submitted attempts and a whole-exam AppState out of the app',()=>{
  expect(existsSync('src/components/WrittenExamRunner.tsx')).toBe(false);
  expect(readFileSync('src/eiken/writtenExamCore.ts','utf8')).not.toMatch(/WrittenAttempt|startWrittenAttempt|deadlineAt/);
  expect(readFileSync('src/appState.ts','utf8')).not.toMatch(/writtenExam|written-exam/);
 });
 it('requires 15 distinct complete rounds rather than relabelled copies',()=>{
  const exams=Array.from({length:15},(_,i)=>fixture('eiken_5',i+1));
  expect(()=>validateGradeSeries(exams,'eiken_5')).not.toThrow();
  expect(()=>validateGradeSeries(exams.slice(1),'eiken_5')).toThrow('FIFTEEN_EXAMS_REQUIRED');
  const repeated=exams.map((exam,index)=>index===1?{...exam,items:exam.items.map((item,i)=>({...item,prompt:exams[0].items[i].prompt,passage:exams[0].items[i].passage}))}:exam);
  expect(()=>validateGradeSeries(repeated,'eiken_5')).toThrow('DUPLICATE_EXAM_CONTENT');
  expect(()=>validateGradeSeries(WRITTEN_BOOKLETS,'eiken_5')).toThrow('FIFTEEN_EXAMS_REQUIRED');
 });
});
