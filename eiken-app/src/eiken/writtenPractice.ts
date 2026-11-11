import type { Chapter, Problem, SubQuestion } from '../types/curriculum';
import type { EikenGrade } from './config';
import { WRITTEN_BOOKLETS } from './materials/written-booklets';
import type { WrittenExam, WrittenItem } from './writtenExamCore';
const LABELS={short:'短文の語句空所補充',conversation:'会話文の空所補充',reorder:'語句整序',reading:'読解',cloze:'長文の語句空所補充',email:'Eメール',summary:'要約',essay:'英作文'};
function subQuestion(exam:WrittenExam,item:WrittenItem):SubQuestion {
 return {id:`${item.id}_answer`,label:`問${exam.items.indexOf(item)+1}（冊子と共通）${item.passage?' '+item.prompt:''}`,type:'multiple_choice',options:['1','2','3','4'],optionTexts:[...item.choices!],correctAnswer:String(item.answer!+1),skill:LABELS[item.section],explainJa:item.explanation,detailedExplanation:{theme:LABELS[item.section],steps:[item.completedSentence || '',item.explanation!].filter(Boolean)},distractors:item.distractorReasons!.map((why,index)=>({no:index+1,why}))};
}
/** Original IDs, choice positions, explanations and translations are never re-authored here. */
export function bookletItemToProblem(exam:WrittenExam,item:WrittenItem):Problem {
 if(item.kind!=='choice')throw new Error('WRITING_USES_WRITING_PRACTICE');
 const number=exam.items.indexOf(item)+1;if(number<1)throw new Error('ITEM_NOT_IN_BOOKLET');
 const tokens=item.orderTokens?.map((text,index)=>`${index+1}. ${text}`).join(' ／ ');
 return {id:item.id,title:`筆記 第${exam.round}回 問${number}`,category:LABELS[item.section],text:[item.passage && `${item.passage.title}\n${item.passage.text}`,item.prompt,tokens].filter(Boolean).join('\n\n'),subQuestions:[subQuestion(exam,item)],explanation:[item.completedSentence,`【訳】${item.translation || ''}`,item.explanation,...item.choices!.map((text,index)=>`${index+1}. ${text} — ${item.distractorReasons![index]}`)].filter(Boolean).join('\n'),surroundingKnowledge:[],deepDiveTopics:[]};
}
function passageProblems(exam:WrittenExam,items:WrittenItem[]):Problem[] {
 const groups=new Map<string,WrittenItem[]>();for(const item of items){const key=item.passage!.id;groups.set(key,[...(groups.get(key)||[]),item]);}
 return [...groups.values()].map(group=>({id:`${exam.id}_${group[0].passage!.id}`,title:group[0].passage!.title,category:LABELS[group[0].section],text:`${group[0].passage!.title}\n\n${group[0].passage!.text}`,subQuestions:group.map(item=>subQuestion(exam,item)),explanation:`【本文の和訳】\n${group[0].passage!.translation}\n\n${group.map(item=>`問${exam.items.indexOf(item)+1}：${item.explanation}\n${item.choices!.map((text,i)=>`${i+1}. ${text} — ${item.distractorReasons![i]}`).join('\n')}`).join('\n\n')}`,surroundingKnowledge:[],deepDiveTopics:[]}));
}
export function bookletPracticeChapters(grade:EikenGrade,part:'vocabulary'|'reading'='vocabulary'):Chapter[] {
 const sections=part==='reading'?['cloze','reading']as const:['short','conversation','reorder']as const;
 return WRITTEN_BOOKLETS.filter(exam=>exam.grade===grade && exam.review==='approved').flatMap(exam=>sections.flatMap(section=>{
  const items=exam.items.filter(item=>item.section===section);if(!items.length)return [];
  const title=`${exam.scope==='reading'?'リーディング':'筆記'} 第${exam.round}回｜${LABELS[section]}`;
  return [{id:`${exam.id}_${section}`,title,abstractTitle:title,realTitle:part==='reading'?'リーディング練習':'語彙・文法練習',questionGroup:`冊子${LABELS[section]}`,topics:['印刷用冊子と同じ原本・番号・解説'],marks:items.length,miniTest:[],practiceProblems:part==='reading'?passageProblems(exam,items):items.map(item=>bookletItemToProblem(exam,item))}];
 }));
}
