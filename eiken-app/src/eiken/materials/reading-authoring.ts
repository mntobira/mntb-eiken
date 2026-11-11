import type { EikenGrade } from '../config';
import type { WrittenExam, WrittenItem } from '../writtenExamCore';
export type ChoiceSpec = [prompt:string, choices:[string,string,string,string], answer:number, explanation:string, reasons:[string,string,string,string], translation:string];
export const question=(spec:ChoiceSpec,section:WrittenItem['section']='short'):WrittenItem=>({id:'pending',section,kind:'choice',prompt:spec[0],choices:spec[1],answer:spec[2],explanation:spec[3],distractorReasons:spec[4],translation:spec[5]});
export function passage(key:string,title:string,text:string,translation:string,format:'notice'|'email'|'article',specs:ChoiceSpec[],section:'reading'|'cloze'='reading'):WrittenItem[]{
 return specs.map(spec=>({...question(spec,section),passage:{id:key,title,text,translation,format}}));
}
export function reorder(japanese:string,prefix:string,tokens:[string,string,string,string],order:[number,number,number,number],pairs:[string,string,string,string],answer:number,explanation:string):WrittenItem{
 const sentence=`${prefix} ${order.map(n=>tokens[n-1]).join(' ')}${prefix.match(/^(How|What|When|Where)/)?'?':'.'}`;
 return {...question([`${japanese}\n${prefix} ( ____ / ____ / ____ / ____ )${sentence.at(-1)}\n1番目・3番目の語句番号の組を選んでください。`,pairs,answer,explanation,pairs.map((pair,i)=>i===answer?`正しい語順の1番目・3番目は${pair}。`:`${pair}は完成文の1番目・3番目と一致しない。`) as [string,string,string,string],japanese],'reorder'),orderTokens:tokens,orderAnswer:order,orderPrefix:prefix,completedSentence:sentence};
}
export function readingRound(grade:EikenGrade,items:WrittenItem[]):WrittenExam{
 const id=`${grade}_written_01`;
 return {id,grade,round:1,scope:'reading',revision:'original-reading-20261111-r1',origin:'manatobi-original',review:'approved',items:items.map((item,index)=>({...item,id:`${id}_q${String(index+1).padStart(2,'0')}`}))};
}
