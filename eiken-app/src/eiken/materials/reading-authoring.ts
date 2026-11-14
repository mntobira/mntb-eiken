import type { EikenGrade } from '../config';
import type { WrittenExam, WrittenItem } from '../writtenExamCore';
export type ChoiceSpec = [prompt:string, choices:[string,string,string,string], answer:number, explanation:string, reasons:[string,string,string,string], translation:string];
export const question=(spec:ChoiceSpec,section:WrittenItem['section']='short'):WrittenItem=>({id:'pending',section,kind:'choice',prompt:spec[0],choices:spec[1],answer:spec[2],explanation:spec[3],distractorReasons:spec[4],translation:spec[5]});
export function passage(key:string,title:string,text:string,translation:string,format:'notice'|'email'|'article',specs:ChoiceSpec[],section:'reading'|'cloze'='reading'):WrittenItem[]{
 return specs.map(spec=>({...question(spec,section),passage:{id:key,title,text,translation,format}}));
}
export function reorder(japanese:string,prefix:string,tokens:[string,string,string,string],order:[number,number,number,number],pairs:[string,string,string,string],answer:number,explanation:string):WrittenItem{
 const questionStart=/^(How|What|When|Where|Who|Which|Why|Do|Does|Did|Is|Are|Was|Were|Can|Could|Will|Would|May|Shall|Have|Has)\b/;
 const sentence=`${prefix} ${order.map(n=>tokens[n-1]).join(' ')}${questionStart.test(prefix)?'?':'.'}`;
 return {...question([`${japanese}\n${prefix} ( ____ / ____ / ____ / ____ )${sentence.at(-1)}\n1番目・3番目の語句番号の組を選んでください。`,pairs,answer,explanation,pairs.map((pair,i)=>i===answer?`正しい語順の1番目・3番目は${pair}。`:`${pair}は完成文の1番目・3番目と一致しない。`) as [string,string,string,string],japanese],'reorder'),orderTokens:tokens,orderAnswer:order,orderPrefix:prefix,completedSentence:sentence};
}
export function emailWriting(key:string,title:string,emailText:string,emailTranslation:string,prompt:string,wordRange:[number,number],model:string,modelTranslation:string,explanation:string,rubric:[string,string,string,string]):WrittenItem{
 return {id:'pending',section:'email',kind:'writing',prompt,passage:{id:key,title,text:emailText,translation:emailTranslation,format:'email'},wordRange,model,translation:modelTranslation,explanation,rubric:[...rubric]};
}
export function summaryWriting(key:string,title:string,articleText:string,articleTranslation:string,prompt:string,wordRange:[number,number],model:string,modelTranslation:string,explanation:string,rubric:[string,string,string,string]):WrittenItem{
 return {id:'pending',section:'summary',kind:'writing',prompt,passage:{id:key,title,text:articleText,translation:articleTranslation,format:'article'},wordRange,model,translation:modelTranslation,explanation,rubric:[...rubric]};
}
export function essayWriting(prompt:string,wordRange:[number,number],model:string,modelTranslation:string,explanation:string,rubric:[string,string,string,string]):WrittenItem{
 return {id:'pending',section:'essay',kind:'writing',prompt,wordRange,model,translation:modelTranslation,explanation,rubric:[...rubric]};
}
export function writtenRound(grade:EikenGrade,round:number,items:WrittenItem[],revision='original-written-20261111-r2'):WrittenExam{
 const id=`${grade}_written_${String(round).padStart(2,'0')}`;
 return {id,grade,round,revision,origin:'manatobi-original',review:'approved',items:items.map((item,index)=>({...item,id:`${id}_q${String(index+1).padStart(2,'0')}`}))};
}
export function readingRound(grade:EikenGrade,items:WrittenItem[],round=1,scope:'reading'|null='reading'):WrittenExam{
 const id=`${grade}_written_${String(round).padStart(2,'0')}`;
 const revision=round===1?'original-reading-20261111-r1':scope?`original-reading-20261112-r${round}`:`original-20261112-r${round}`;
 return {id,grade,round,...(scope?{scope}:{}),revision,origin:'manatobi-original',review:'approved',items:items.map((item,index)=>({...item,id:`${id}_q${String(index+1).padStart(2,'0')}`}))};
}
