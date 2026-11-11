import type { Chapter, Problem } from '../types/curriculum';
import type { EikenGrade } from './config';
import { WRITTEN_BOOKLETS } from './materials/written-booklets';
import type { WrittenExam, WrittenItem } from './writtenExamCore';

const SECTION_LABELS = {short:'短文の語句空所補充',conversation:'会話文の空所補充',reorder:'語句整序',reading:'読解',cloze:'長文の語句空所補充',email:'Eメール',summary:'要約',essay:'英作文'};
/** No independent question/answer copy: PDF export and practice use the same IDs and original. */
export function bookletItemToProblem(exam: WrittenExam, item: WrittenItem): Problem {
  if (item.kind !== 'choice') throw new Error('WRITING_USES_WRITING_PRACTICE');
  const number=exam.items.indexOf(item)+1;
  if (number<1) throw new Error('ITEM_NOT_IN_BOOKLET');
  const tokens=item.orderTokens?.map((text,index)=>`${index+1}. ${text}`).join(' ／ ');
  return {
    id:item.id,title:`筆記 第${exam.round}回 問${number}`,category:SECTION_LABELS[item.section],
    text:[item.passage && `${item.passage.title}\n${item.passage.text}`,item.prompt,tokens].filter(Boolean).join('\n\n'),
    subQuestions:[{id:`${item.id}_answer`,label:`問${number}（冊子と共通）`,type:'multiple_choice',options:['1','2','3','4'],optionTexts:[...item.choices!],correctAnswer:String(item.answer!+1),skill:SECTION_LABELS[item.section],
      explainJa:item.explanation,detailedExplanation:{theme:SECTION_LABELS[item.section],steps:[item.completedSentence || '',item.explanation!].filter(Boolean)},distractors:item.distractorReasons!.map((why,index)=>({no:index+1,why}))}],
    explanation:[item.completedSentence,`【訳】${item.translation || ''}`,item.explanation,...item.choices!.map((text,index)=>`${index+1}. ${text} — ${item.distractorReasons![index]}`)].filter(Boolean).join('\n'),
    surroundingKnowledge:[],deepDiveTopics:[],
  };
}
export function bookletPracticeChapters(grade:EikenGrade):Chapter[] {
  return WRITTEN_BOOKLETS.filter(exam=>exam.grade===grade && exam.review==='approved').flatMap(exam=>
    (['short','conversation','reorder'] as const).flatMap(section=>{
      const items=exam.items.filter(item=>item.section===section);
      if(!items.length)return [];
      const title=`筆記 第${exam.round}回｜${SECTION_LABELS[section]}`;
      return [{id:`${exam.id}_${section}`,title,abstractTitle:title,realTitle:'語彙・文法練習',questionGroup:SECTION_LABELS[section],topics:['印刷用冊子と同じ問題・番号・解説'],marks:items.length,miniTest:[],practiceProblems:items.map(item=>bookletItemToProblem(exam,item))}];
    })
  );
}
