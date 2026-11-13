import { Platform } from 'react-native';

import { BASE_URL, post, postForm, request } from './client';
import { applySettings } from '../utils/settingsStore';
import { setSpeechLocale } from '../utils/speech';

// Profile and settings
export const getMe = async () => {
  const me = await request('/me');
  setSpeechLocale(me.locale);
  applySettings(me.settings);
  return me;
};

// Languages (first screen), settings and starting a language over
export const getLanguages = () => request('/languages');
export const chooseLanguage = async (language) => {
  const me = await request('/me/language', { method: 'PUT', body: JSON.stringify({ language }) });
  setSpeechLocale(me.locale);
  return me;
};
export const saveSettings = (patch) => request('/me/settings', { method: 'PUT', body: JSON.stringify(patch) });
export const resetLanguage = () => post('/me/reset-language');
export const saveFavorites = (topic_ids) =>
  request('/me/topics', { method: 'PUT', body: JSON.stringify({ topic_ids }) });
export const saveName = (name) => request('/me/name', { method: 'PUT', body: JSON.stringify({ name }) });
export const deleteRecordings = () => request('/me/recordings', { method: 'DELETE' });
export const getLeaderboard = () => request('/leaderboard');
export const resetDemo = () => post('/dev/reset');
export const saveConsent = (research) => request('/me/consent', { method: 'PUT', body: JSON.stringify({ research }) });
// Profile picture: `asset` is what expo-image-picker returns ({ uri, mimeType }). The server returns the new address.
export async function uploadPhoto(asset) {
  const form = new FormData();
  if (Platform.OS === 'web') {
    const blob = await (await fetch(asset.uri)).blob();
    form.append('photo', blob, 'photo.jpg');
  } else {
    const ext = (asset.uri.split('.').pop() || 'jpg').toLowerCase();
    form.append('photo', { uri: asset.uri, name: `photo.${ext}`, type: asset.mimeType || `image/${ext === 'jpg' ? 'jpeg' : ext}` });
  }
  return postForm('/me/photo', form);
}
export const removePhoto = () => request('/me/photo', { method: 'DELETE' });
// Full web address of a picture the server returned (null when there is none).
export const photoUri = (path) => (path ? `${BASE_URL}${path}` : null);
// Tells the server the app is open (adds up the time spent). Never throws.
export const pingUsage = (seconds, newSession = false, area = null) =>
  post('/me/ping', { seconds, new_session: newSession, area }).catch(() => {});
export const deleteAccount = () => request('/me/account', { method: 'DELETE' });

// Topics
export const getTopics = () => request('/topics');
export const getFavoriteChoices = () => request('/topics/favorites');
export const getTopicLessons = (id) => request(`/topics/${encodeURIComponent(id)}/lessons`);
export const unlockTopic = (id) => post(`/topics/${encodeURIComponent(id)}/unlock`);

// Gift Menu: how flowers are earned, what they can buy, redeeming, wearing, inviting friends
export const getGifts = () => request('/gifts');
export const redeemGift = (itemId) => post('/gifts/redeem', { item_id: itemId });
export const equipGift = (slot, itemId) => post('/gifts/equip', { slot, item_id: itemId });
export const enterFriendCode = (code) => post('/gifts/referral', { code });

// Subscription (demo: no real payment)
export const getPlans = () => request('/subscription/plans');
export const subscribe = (plan) => post('/subscription', { plan });
export const cancelSubscription = () => request('/subscription', { method: 'DELETE' });

// Courses and lessons
export const getCurrentCourse = async () => {
  const course = await request('/courses/current');
  setSpeechLocale(course.language?.locale);
  return course;
};
export const getLesson = async (id) => {
  const lesson = await request(`/lessons/${encodeURIComponent(id)}`);
  setSpeechLocale(lesson.locale);
  return lesson;
};
// Puts a recording into FormData. On the web the recorder gives a blob: URL; on a phone, a file URI.
async function audioForm(fields, recording) {
  const form = new FormData();
  Object.entries(fields).forEach(([k, v]) => form.append(k, v));
  if (Platform.OS === 'web') {
    const blob = await (await fetch(recording.uri)).blob();
    form.append('audio', blob, 'recording.webm');
  } else {
    const ext = (recording.uri.split('.').pop() || 'm4a').toLowerCase();
    form.append('audio', { uri: recording.uri, name: `recording.${ext}`, type: `audio/${ext}` });
  }
  return form;
}

// Uploads one recording (`{ uri, durationMs }` from the recorder) and returns its scores.
// durationMs is how long the learner spent recording the line; the server keeps it for research only
// (speech rate is never sent back to the app).
export async function scoreTurn(lessonId, turnId, recording, swap = false) {
  const form = await audioForm(
    { turn_id: turnId, duration_ms: String(Math.round(recording.durationMs || 0)), swap: swap ? 'true' : 'false' },
    recording
  );
  return postForm(`/lessons/${encodeURIComponent(lessonId)}/speak`, form);
}
// The server keeps the scores of your takes, so completing needs no body.
// `swap` = the learner played the other speaker's part ("Switch parts").
export const completeLesson = (lessonId, swap = false) =>
  post(`/lessons/${encodeURIComponent(lessonId)}/complete${swap ? '?swap=true' : ''}`);

// Free Talk: an open conversation with the AI partner about the learner's favorite topics.
export const startFreeTalk = async (topicId) => {
  const start = await post('/freetalk/start', topicId ? { topic_id: topicId } : {});
  setSpeechLocale(start.locale);
  return start;
};
// Sends the learner's recording and the conversation so far; returns { you, turn, hints, level }.
export async function sendFreeTalkTurn({ topicId, sessionId, history, turnNo, hintUsed, recording }) {
  const form = await audioForm(
    {
      topic_id: topicId,
      session_id: sessionId || '',
      history: JSON.stringify(history),
      turn_no: String(turnNo),
      hint_used: hintUsed ? 'true' : 'false',
    },
    recording
  );
  return postForm('/freetalk/turn', form);
}
// Ends a dialogue. finished=false means the learner left early. `turns` = the scored turns (backup for a server restart).
export const finishFreeTalk = ({ sessionId, topicId, seconds, hintsUsed, finished, turns }) =>
  post('/freetalk/finish', { session_id: sessionId, topic_id: topicId, seconds, hints_used: hintsUsed, finished, turns });

// Vocab Notes (words saved from the flashcards) and their review
const enc = encodeURIComponent;
export const getNotes = async () => {
  const notes = await request('/notes');
  setSpeechLocale(notes.locale);
  return notes;
};
export const getLessonNotes = (lessonId) => request(`/notes/lesson/${enc(lessonId)}`);
export const addNote = (lessonId, vocabId) =>
  request(`/notes/${enc(lessonId)}/${enc(vocabId)}`, { method: 'PUT' });
export const removeNote = (lessonId, vocabId) =>
  request(`/notes/${enc(lessonId)}/${enc(vocabId)}`, { method: 'DELETE' });
export const reviewNote = (lessonId, vocabId, correct) =>
  post(`/notes/${enc(lessonId)}/${enc(vocabId)}/review`, { correct });
export const getReviewSession = async ({ mode = 'cards', scope = 'due', group, limit = 10 }) => {
  const items = await request(`/notes/review?mode=${mode}&scope=${scope}&limit=${limit}${group ? `&group=${enc(group)}` : ''}`);
  setSpeechLocale(items[0]?.locale);
  return items;
};

// Sharing a lesson result
export const getGiftShare = (giftId) => request(`/gifts/share/${enc(giftId)}`);
export const getSharePayload = (recordId) => request(`/share/${enc(recordId)}/payload`);

// Records
export const getRecords = (limit) => request(limit ? `/records?limit=${limit}` : '/records');
export const getRecord = (id) => request(`/records/${encodeURIComponent(id)}`);
// Retry one word of a finished lesson with a new recording; earns the retry flowers.
export async function retryWord(recordId, wordId, recording) {
  const form = await audioForm({ word_id: wordId }, recording);
  return postForm(`/records/${encodeURIComponent(recordId)}/retry`, form);
}
