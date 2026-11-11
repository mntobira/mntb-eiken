import type { EikenGrade } from './config';

export type WrittenSection = 'short' | 'conversation' | 'reorder' | 'cloze' | 'reading' | 'email' | 'summary' | 'essay';
export interface WrittenBlueprint { minutes: number; sections: readonly { id: WrittenSection; count: number; kind: 'choice' | 'writing' }[]; source: string }
const section = (id: WrittenSection, count: number, kind: 'choice' | 'writing' = 'choice') => ({ id, count, kind });
/** Format facts checked against each official /solutions.html on 2026-11-10. No question text is copied. */
export const WRITTEN_BLUEPRINTS: Partial<Record<EikenGrade, WrittenBlueprint>> = {
  eiken_5: { minutes:25, sections:[section('short',15),section('conversation',5),section('reorder',5)],source:'https://www.eiken.or.jp/eiken/exam/grade_5/solutions.html' },
  eiken_4: { minutes:35, sections:[section('short',15),section('conversation',5),section('reorder',5),section('reading',10)],source:'https://www.eiken.or.jp/eiken/exam/grade_4/solutions.html' },
  eiken_3: { minutes:65, sections:[section('short',15),section('conversation',5),section('reading',10),section('email',1,'writing'),section('essay',1,'writing')],source:'https://www.eiken.or.jp/eiken/exam/grade_3/solutions.html' },
  eiken_pre2: { minutes:80, sections:[section('short',15),section('conversation',5),section('cloze',2),section('reading',7),section('email',1,'writing'),section('essay',1,'writing')],source:'https://www.eiken.or.jp/eiken/exam/grade_p2/solutions.html' },
  eiken_pre2plus: { minutes:85, sections:[section('short',17),section('cloze',6),section('reading',8),section('summary',1,'writing'),section('essay',1,'writing')],source:'https://www.eiken.or.jp/eiken/exam/grade_p2plus/solutions.html' },
  eiken_2: { minutes:85, sections:[section('short',17),section('cloze',6),section('reading',8),section('summary',1,'writing'),section('essay',1,'writing')],source:'https://www.eiken.or.jp/eiken/exam/grade_2/solutions.html' },
  eiken_pre1: { minutes:90, sections:[section('short',18),section('cloze',6),section('reading',7),section('summary',1,'writing'),section('essay',1,'writing')],source:'https://www.eiken.or.jp/eiken/exam/grade_p1/solutions.html' },
};
export interface WrittenItem {
  id:string; section:WrittenSection; kind:'choice'|'writing'; prompt:string;
  passage?:{id:string;title:string;text:string;translation?:string;format?:'notice'|'email'|'article'};
  choices?:[string,string,string,string]; answer?:number; explanation?:string; distractorReasons?:[string,string,string,string];
  model?:string; rubric?:string[]; wordRange?:[number,number]; orderTokens?:string[]; orderAnswer?:number[]; orderPrefix?:string; completedSentence?:string; translation?:string;
}
export interface WrittenExam { id:string;grade:EikenGrade;round:number;scope?:'reading';revision:string;origin:'manatobi-original';review:'draft'|'approved';items:readonly WrittenItem[] }
export function validateWrittenExam(exam:WrittenExam, requireApproved=true):void {
  const blueprint=WRITTEN_BLUEPRINTS[exam.grade];
  if(!blueprint || exam.id!==`${exam.grade}_written_${String(exam.round).padStart(2,'0')}` || !Number.isInteger(exam.round) || exam.round<1 || exam.round>15 || !exam.revision || exam.origin!=='manatobi-original' || (requireApproved && exam.review!=='approved'))throw new Error('EXAM_NOT_RELEASE_READY');
  const sections=exam.scope==='reading'?blueprint.sections.filter(spec=>spec.kind==='choice'):blueprint.sections;
  if(exam.items.length!==sections.reduce((count,item)=>count+item.count,0) || new Set(exam.items.map(item=>item.id)).size!==exam.items.length)throw new Error('EXAM_COUNT_OR_DUPLICATE_ID');
  let at=0;
  const passages=new Map<string,string>();
  for(const spec of sections)for(let offset=0;offset<spec.count;offset++,at++){
    const item=exam.items[at];
    if(item.section!==spec.id || item.kind!==spec.kind || !item.id.startsWith(exam.id+'_') || !item.prompt?.trim() || JSON.stringify(item).includes('\uFFFD'))throw new Error('EXAM_SECTION_MISMATCH');
    if(item.kind==='choice'){
      if(item.choices?.length!==4 || item.choices.some(text=>!text.trim()) || new Set(item.choices).size!==4 || !Number.isInteger(item.answer) || item.answer!<0 || item.answer!>3 || !item.explanation?.trim() || item.distractorReasons?.length!==4 || item.distractorReasons.some(text=>!text.trim()))throw new Error('CHOICE_NOT_REVIEWABLE');
      if(item.section==='reorder') {
        const tokens=item.orderTokens, order=item.orderAnswer;
        if(!tokens || tokens.length!==4 || tokens.some(token=>!token.trim()) || new Set(tokens).size!==4)throw new Error('ORDER_TOKENS_REQUIRED');
        if(!order || order.length!==tokens.length || new Set(order).size!==tokens.length || order.some(no=>!Number.isInteger(no)||no<1||no>tokens.length) || !item.orderPrefix?.trim() || !item.completedSentence?.trim())throw new Error('ORDER_ANSWER_REQUIRED');
        const sentence=`${item.orderPrefix} ${order.map(no=>tokens[no-1]).join(' ')}`;
        if(item.completedSentence.replace(/[.?]$/,'')!==sentence || item.choices[item.answer!].replace(/\s/g,'')!==`${order[0]}－${order[2]}`)throw new Error('ORDER_ANSWER_MISMATCH');
      }
    }else if(!item.model?.trim() || !item.rubric?.length || !item.wordRange || !Number.isInteger(item.wordRange[0]) || !Number.isInteger(item.wordRange[1]) || item.rubric.some(text=>!text.trim()) || item.wordRange[0]<1 || item.wordRange[1]<item.wordRange[0])throw new Error('WRITING_RUBRIC_REQUIRED');
    if(['reading','cloze','email','summary'].includes(item.section) && (!item.passage?.text.trim() || !item.passage.id || !item.passage.title.trim()))throw new Error('PASSAGE_REQUIRED');
    if(item.passage){
      if(exam.scope==='reading' && (!item.passage.translation?.trim() || !['notice','email','article'].includes(item.passage.format || '')))throw new Error('PASSAGE_TRANSLATION_FORMAT_REQUIRED');
      const signature=JSON.stringify(item.passage), old=passages.get(item.passage.id);
      if(old && old!==signature)throw new Error('PASSAGE_ID_COLLISION');
      passages.set(item.passage.id,signature);
      if(exam.scope==='reading' && item.section==='cloze' && !new RegExp(`\\(\\s*${at+1}\\s*\\)`).test(item.passage.text))throw new Error('CLOZE_NUMBER_MISMATCH');
    }
  }
}
/** Readiness means 15 DISTINCT, complete, approved exams, not fifteen labels pointing to one bank. */
export function validateGradeSeries(exams:readonly WrittenExam[],grade:EikenGrade):void {
  if(exams.length!==15 || new Set(exams.map(exam=>exam.round)).size!==15 || exams.some(exam=>exam.grade!==grade))throw new Error('FIFTEEN_EXAMS_REQUIRED');
  exams.forEach(exam=>validateWrittenExam(exam));
  const signatures=exams.map(exam=>JSON.stringify(exam.items.map(item=>[item.section,item.prompt,item.passage?.text,item.choices])));
  if(new Set(signatures).size!==15)throw new Error('DUPLICATE_EXAM_CONTENT');
}
