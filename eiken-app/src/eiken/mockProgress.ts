import { perUserKey } from '../utils/userStorageKeys';
import { countEnglishWords, type WrittenExam, type WrittenSection } from './writtenExamCore';

export const MOCK_STORAGE_KEY_PREFIX = 'eiken_mock_v1_';
export const mockStorageKey = (uid: string) => perUserKey(MOCK_STORAGE_KEY_PREFIX, uid);

export const SECTION_LABELS: Record<WrittenSection, string> = {
  short: '短文空所補充',
  conversation: '会話文空所補充',
  reorder: '語句整序',
  cloze: '長文空所補充',
  reading: '長文読解',
  email: 'Eメール返信',
  summary: '英文要約',
  essay: '英作文（意見論述）',
};

export interface MockWritingEntry {
  text: string;
  checked: number[];
}

export interface MockInProgressSession {
  examId: string;
  answers: Record<string, number>;
  writing: Record<string, MockWritingEntry>;
  flags: string[];
  elapsedSec: number;
  timed: boolean;
  limitSec: number;
  currentIndex: number;
  updatedAt: number;
}

export interface MockSubmittedRecord {
  examId: string;
  correct: number;
  total: number;
  writingDone: number;
  writingTotal: number;
  elapsedSec: number;
  timed: boolean;
  answers: Record<string, number>;
  writing: Record<string, MockWritingEntry>;
  flags: string[];
  submittedAt: number;
}

export interface MockProgressState {
  version: 1;
  sessions: Record<string, MockInProgressSession>;
  history: Record<string, MockSubmittedRecord[]>;
}

export function emptyMockState(): MockProgressState {
  return { version: 1, sessions: {}, history: {} };
}

export function parseMockState(raw: string | null): MockProgressState {
  if (!raw) return emptyMockState();
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.version !== 1 || typeof parsed !== 'object') return emptyMockState();
    const sessions: Record<string, MockInProgressSession> = {};
    if (parsed.sessions && typeof parsed.sessions === 'object' && !Array.isArray(parsed.sessions)) {
      for (const [id, val] of Object.entries(parsed.sessions)) {
        const s = val as MockInProgressSession;
        if (s && typeof s.examId === 'string' && s.answers && typeof s.answers === 'object') {
          sessions[id] = {
            examId: s.examId,
            answers: s.answers,
            writing: s.writing && typeof s.writing === 'object' ? s.writing : {},
            flags: Array.isArray(s.flags) ? s.flags.map(String) : [],
            elapsedSec: Number.isFinite(s.elapsedSec) ? Math.max(0, Math.floor(s.elapsedSec)) : 0,
            timed: Boolean(s.timed),
            limitSec: Number.isFinite(s.limitSec) ? Math.max(60, Math.floor(s.limitSec)) : 1500,
            currentIndex: Number.isFinite(s.currentIndex) ? Math.max(0, Math.floor(s.currentIndex)) : 0,
            updatedAt: Number.isFinite(s.updatedAt) ? s.updatedAt : Date.now(),
          };
        }
      }
    }
    const history: Record<string, MockSubmittedRecord[]> = {};
    if (parsed.history && typeof parsed.history === 'object' && !Array.isArray(parsed.history)) {
      for (const [id, list] of Object.entries(parsed.history)) {
        if (Array.isArray(list)) {
          history[id] = list
            .filter((r): r is MockSubmittedRecord => Boolean(r && typeof r === 'object' && typeof r.examId === 'string'))
            .slice(0, 5);
        }
      }
    }
    return { version: 1, sessions, history };
  } catch {
    return emptyMockState();
  }
}

export interface SectionScoreBreakdown {
  section: WrittenSection;
  label: string;
  kind: 'choice' | 'writing';
  correct: number;
  total: number;
  answered: number;
}

export interface MockScoreSummary {
  correct: number;
  total: number;
  answered: number;
  unanswered: number;
  accuracyPct: number;
  writingDone: number;
  writingTotal: number;
  sections: SectionScoreBreakdown[];
}

export function scoreMockExam(
  exam: WrittenExam,
  answers: Record<string, number>,
  writing: Record<string, MockWritingEntry>,
  sectionFilter?: WrittenSection | 'all',
): MockScoreSummary {
  let correct = 0;
  let total = 0;
  let answered = 0;
  let writingDone = 0;
  let writingTotal = 0;
  const bySection = new Map<WrittenSection, SectionScoreBreakdown>();

  const targetItems =
    sectionFilter && sectionFilter !== 'all'
      ? exam.items.filter(item => item.section === sectionFilter)
      : exam.items;

  for (const item of targetItems) {
    let entry = bySection.get(item.section);
    if (!entry) {
      entry = {
        section: item.section,
        label: SECTION_LABELS[item.section],
        kind: item.kind,
        correct: 0,
        total: 0,
        answered: 0,
      };
      bySection.set(item.section, entry);
    }
    entry.total += 1;

    if (item.kind === 'choice') {
      total += 1;
      const picked = answers[item.id];
      if (Number.isInteger(picked) && picked >= 0 && picked <= 3) {
        answered += 1;
        entry.answered += 1;
        if (picked === item.answer) {
          correct += 1;
          entry.correct += 1;
        }
      }
    } else {
      writingTotal += 1;
      const w = writing[item.id];
      const words = countEnglishWords(w?.text ?? '');
      if (words > 0) {
        entry.answered += 1;
        writingDone += 1;
        if (item.wordRange && words >= Math.floor(item.wordRange[0] * 0.6)) {
          entry.correct += 1;
        }
      }
    }
  }

  return {
    correct,
    total,
    answered,
    unanswered: total - answered,
    accuracyPct: total > 0 ? Math.round((correct / total) * 100) : 0,
    writingDone,
    writingTotal,
    sections: [...bySection.values()],
  };
}

export function formatDuration(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
