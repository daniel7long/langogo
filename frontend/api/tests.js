import { post, request } from './client';

export function fetchFrenchTest() {
  return request('/tests/french');
}

// answers: [{ question_id: 'q1', option_id: 'b' }, ...]
// Returns { id, score, max_score, level, correct_count, total_questions, recommended_minutes_per_day }
export function submitFrenchTest(answers) {
  return post('/tests/french/submit', { answers });
}

export function fetchFrenchResult(id) {
  return request(`/tests/french/results/${encodeURIComponent(id)}`);
}
