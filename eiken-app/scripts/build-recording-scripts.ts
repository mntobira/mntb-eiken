import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { EIKEN_QUESTIONS, toProblem } from '../src/eiken/questions';
import { EIKEN_GRADES } from '../src/eiken/config';
import type { VocabularyData } from '../src/data/listeningSupport';

// Offline export only: no paid synthesis, cloud access, voice cloning or audio publication.
const vocabulary: VocabularyData = JSON.parse(readFileSync('public/data/listeningVocabulary.json', 'utf8'));
const speakers = [
  { id: 'M1', label: '男1', role: '会話A。落ち着いた明瞭な英語。全問題で同じ声を使用。' },
  { id: 'F1', label: '女1', role: '会話B。男1と聞き分けられる自然な英語。全問題で同じ声を使用。' },
  { id: 'F2', label: '女2', role: '設問・独話・単語・例文ナレーター。全収録で同じ声を使用。' },
];
const listening = EIKEN_QUESTIONS.filter(q => q.published).map(question => {
  const track = toProblem(question).audioTracks![0];
  const turns = track.turns!.map((turn, index) => {
    if (turn.who && !['A', 'B'].includes(turn.who)) throw new Error(`Unassigned speaker: ${turn.who}`);
    const speaker = turn.who === 'A' ? 'M1' : turn.who === 'B' ? 'F1' : 'F2';
    return { id: `${question.id}_s${String(index + 1).padStart(2, '0')}`, speaker,
      label: speakers.find(item => item.id === speaker)!.label, text: turn.text,
      role: index === track.turns!.length - 1 ? 'question' : 'body', pauseAfterMs: index === track.turns!.length - 2 ? 900 : 350 };
  });
  return { id: question.id, grade: question.grade, title: question.title,
    filename: `${question.id}.mp3`, targetPath: `/eiken_audio/${question.id}.mp3`,
    sourceText: track.script, turns, speakerCount: new Set(turns.map(turn => turn.speaker)).size,
    usedBy: ['級別リスニング演習', '解説の聞き直し', 'AI・オンライン対戦（同じ問題）'],
    productionNote: '1回読みの完成音源。A/B・男女ラベル・ID・日本語指示は読まない。本文後にQuestionと設問を読む。選択肢は印刷表示のみ。2回読みはアプリ側で繰り返すため収録へ焼き込まない。' };
});
const words = vocabulary.words.map(word => ({ id: word.id, grade: word.level, word: word.word, meaning: word.meaning,
  clips: [
    { id: word.id, speaker: 'F2', label: '女2', text: word.word, filename: `${word.id}.mp3`, targetPath: `/audio/vocab/eiken/${word.id}.mp3`, kind: 'word' },
    { id: `${word.id}:example`, speaker: 'F2', label: '女2', text: word.exampleSentence!, filename: `${word.id}__example.mp3`, targetPath: `/audio/vocab/eiken/${word.id}__example.mp3`, kind: 'example' },
  ] }));
const allClips = [...listening.map(item => ({ id: item.id, text: item.sourceText })), ...words.flatMap(word => word.clips)];
if (allClips.some(clip => !clip.text?.trim()) || new Set(allClips.map(clip => clip.id)).size !== allClips.length) throw new Error('Blank or duplicate audio script');
const sourceHash = createHash('sha256').update(JSON.stringify(allClips)).digest('hex');
const manifest = {
  version: 1, scope: '現在公開されている独自教材。各級15回分の新模試・再編後の追加語彙は含まない。',
  requestedRecordingModel: 'ElevenLabs V4（ユーザー側で収録。モデル名・利用条件は収録時に確認）',
  sourceHash, speakers, grades: EIKEN_GRADES.filter(grade => grade.available),
  counts: { listening: listening.length, headwords: words.length, wordClips: words.length, exampleClips: words.length, finalSpeechFiles: allClips.length },
  listening, words,
  nonSpeech: [
    { category: 'BGM', path: '/tanjou.mp3', note: 'ホームBGM。文章読み上げの台本はありません。既存音源を維持。' },
    ...['waiting','battle','battle2'].map(name => ({ category: 'BGM', path: `/bgm/battle/${name}.mp3`, note: '既存曲・クレジットを維持。TTS収録対象ではありません。' })),
    { category: 'SFX', path: '/sfx/launch/*.mp3', note: '起動3音。非言語の効果音。' },
    { category: 'SFX', path: '/sfx/battle/*.mp3', note: 'タップ・正誤・報酬など26音。非言語の効果音。' },
    { category: 'Video', path: '/cinematics/*.mp4', note: '既存演出。映像と非言語効果音は台本で置換しません。' },
  ],
  importStatus: '未収録・未接続。targetPathは納品予定先であり、ファイルが存在するという宣言ではない。録音後に音声の検査とアプリへの接続が必要。',
};
mkdirSync('deliverables', { recursive: true });
writeFileSync('deliverables/eiken-recording-manifest.json', JSON.stringify(manifest, null, 2) + '\n');
const rows = [['id','speaker','text','filename','kind'],
  ...listening.flatMap(item => item.turns.map(turn => [turn.id,turn.label,turn.text,`${turn.id}.mp3`,`${item.id}/${turn.role}`])),
  ...words.flatMap(word => word.clips.map(clip => [clip.id,clip.label,clip.text,clip.filename,clip.kind])),
];
writeFileSync('deliverables/eiken-recording-segments.tsv', rows.map(row => row.map(cell => String(cell).replace(/[\t\r\n]/g, ' ')).join('\t')).join('\n') + '\n');
console.log(JSON.stringify(manifest.counts), 'SHA256', sourceHash);
