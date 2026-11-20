export {
  SCBT_PART_LABELS,
  SCBT_PART_ORDER,
  validateSpeakingSet,
  type ScbtIllustrationFrame,
  type ScbtSpeakingQuestionSpec,
  type ScbtSpeakingSet,
} from './speakingTypes';
export {
  SCBT_SPEAKING_SETS,
  findSpeakingSetById,
  speakingSetsForGrade,
} from './mockSpeakingSets';
export {
  PREFERRED_AUDIO_CANDIDATES,
  classifyMediaError,
  detectPreferredAudioMimeType,
  startAudioRecording,
  type ActiveRecordingHandle,
  type FriendlyMicError,
  type MicErrorCode,
  type RecordedClip,
  type SelectedAudioFormat,
} from './audioRecorder';
export {
  DEMO_SPEAKING_SUBMISSIONS,
  fetchClassSpeakingSubmissions,
  fetchStudentSpeakingSubmissions,
  saveSpeakingReview,
  submitSpeakingSession,
  type PartClipUploadInput,
  type SubmitSpeakingInput,
} from './speakingStore';
export { ScbtSpeakingPractice, type ScbtSpeakingPracticeProps } from './ScbtSpeakingPractice';
export { TeacherSpeakingReviewTab } from './TeacherSpeakingReviewTab';
export { playScbtBeep } from './scbtBeep';
export {
  buildSpeakingAiCoachPrompt,
  buildSpeakingFeedbackSheetHtml,
  openSpeakingFeedbackPrintWindow,
} from './speakingFeedbackSheet';
