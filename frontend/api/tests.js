import { Platform } from 'react-native';

import { post, postForm, request } from './client';

export function fetchFrenchTest() {
  return request('/tests/french');
}

// answers: [{ question_id: 'q1', option_id: 'b' }, ...]
// Returns { id, completion_score, correct_count, total_questions }: the speaking step comes next.
export function submitFrenchTest(answers) {
  return post('/tests/french/submit', { answers });
}

// The speaking step. `recording` is { uri, durationMs } from the recorder. There is one try: the server scores it
// like a dialogue line and returns the final result (the mean of both parts and the lesson to start at).
export async function submitFrenchSpeech(id, recording) {
  const form = new FormData();
  form.append('duration_ms', String(Math.round(recording.durationMs || 0)));
  if (Platform.OS === 'web') {
    const blob = await (await fetch(recording.uri)).blob();
    form.append('audio', blob, 'recording.webm');
  } else {
    const ext = (recording.uri.split('.').pop() || 'm4a').toLowerCase();
    form.append('audio', { uri: recording.uri, name: `recording.${ext}`, type: `audio/${ext}` });
  }
  return postForm(`/tests/french/${encodeURIComponent(id)}/speak`, form);
}

// Returns { id, score, max_score, level, completion_score, speech_score, start_level, start_lesson_no,
//           start_lesson_title, recommended_minutes_per_day, ... }
export function fetchFrenchResult(id) {
  return request(`/tests/french/results/${encodeURIComponent(id)}`);
}
