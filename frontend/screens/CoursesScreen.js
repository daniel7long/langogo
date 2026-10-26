import { useState } from 'react';
import { ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { getCurrentCourse } from '../api/app';
import AsyncState from '../components/AsyncState';
import Chip from '../components/Chip';
import FadeIn from '../components/FadeIn';
import IconButton from '../components/IconButton';
import LessonRow from '../components/LessonRow';
import NavMenu from '../components/NavMenu';
import ProgressBar from '../components/ProgressBar';
import Screen from '../components/Screen';
import { CoursesSkeleton } from '../components/Skeleton';
import useAsync from '../hooks/useAsync';
import { notify } from '../utils/dialog';
import { colors, radius, shadows, spacing, typography } from '../theme';

// The home screen: course progress and the lesson list.
export default function CoursesScreen() {
  const state = useAsync(getCurrentCourse, []);
  return (
    <Screen>
      <AsyncState state={state} skeleton={<CoursesSkeleton />}>
        {(course) => <CourseView course={course} />}
      </AsyncState>
    </Screen>
  );
}

const dot = (title) => (title ? title.replace(' - ', ' · ') : title);

function subtitleOf(lesson) {
  if (lesson.words == null) return 'Coming soon';
  const w = `${lesson.words} word${lesson.words === 1 ? '' : 's'}`;
  const l = lesson.lines ? ` · ${lesson.lines} lines` : '';
  return w + l;
}

function CourseView({ course }) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const { height: screenHeight } = useWindowDimensions();

  // Exactly 5 lessons fit on screen (the current lesson on the 4th row, like a ladder), with a level
  // divider and generous white space. Everything else is reached by scrolling.
  const ROWS = 5;
  const FIXED = 330; // top bar + level card + paddings
  const DIVIDER = 62; // level divider with its hint
  const GAP = 12;
  const cardHeight = Math.round(Math.min(96, Math.max(72, (screenHeight - FIXED - DIVIDER - GAP * (ROWS - 1)) / ROWS)));

  const open = (lesson) => {
    if (lesson.status === 'locked') {
      notify('Locked', 'Finish the earlier lessons to unlock this one.');
      return;
    }
    router.push({ pathname: '/lesson-prep', params: { id: lesson.id } });
  };

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.levelText}>L{course.level}</Text>
        <ProgressBar progress={course.progress} style={styles.track} />
        <Text style={[styles.levelText, styles.levelNext]}>L{course.next_level}</Text>
        <View style={styles.flowers} accessibilityLabel={`${course.flowers} flowers`}>
          <Ionicons name="flower-outline" size={18} color={colors.primary} />
          <Text style={styles.flowerCount}>{course.flowers}</Text>
        </View>
        <IconButton name="menu" label="Menu" onPress={() => setMenuOpen(true)} />
      </View>

      <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
        <FadeIn style={styles.levelCard}>
          <Text style={styles.eyebrow}>Your current level</Text>
          <Text style={styles.levelTitle}>{dot(course.title)}</Text>
          <View style={styles.levelFoot}>
            <Text style={styles.levelSub}>
              {course.completed} of {course.total} lessons completed
            </Text>
            {course.streak > 0 && <Chip icon="flame" label={`${course.streak}-day streak`} />}
          </View>
        </FadeIn>

        {course.lessons.map((lesson, i) => {
          const newLevel = i > 0 && lesson.level !== course.lessons[i - 1].level;
          const hint = newLevel && lesson.level > course.level && course.hint ? course.hint.replace(/Lv(\d+)/, 'Level $1') : null;
          return (
            <FadeIn key={lesson.id} delay={Math.min(i, 6) * 60}>
              {newLevel && (
                <View style={styles.divider}>
                  <View style={styles.dividerRow}>
                    <View style={styles.dividerLine} />
                    <Text style={styles.dividerText}>{dot(course.level_titles?.[String(lesson.level)] || `Level ${lesson.level}`)}</Text>
                    <View style={styles.dividerLine} />
                  </View>
                  {!!hint && <Text style={styles.dividerHint}>{hint}</Text>}
                </View>
              )}
              <LessonRow
                no={lesson.no}
                title={lesson.title}
                subtitle={subtitleOf(lesson)}
                status={lesson.status}
                grade={lesson.grade}
                height={cardHeight}
                onPress={() => open(lesson)}
              />
            </FadeIn>
          );
        })}
      </ScrollView>
      <NavMenu visible={menuOpen} onClose={() => setMenuOpen(false)} language={course.language} active="Courses" />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, height: 68 },
  levelText: { ...typography.labelSm, color: colors.primary },
  levelNext: { color: colors.textFaint },
  track: { flex: 1 },
  flowers: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 40,
    paddingHorizontal: spacing.s12,
    borderRadius: radius.full,
    backgroundColor: colors.selectedBg,
  },
  flowerCount: { ...typography.label, color: colors.primary },
  list: { padding: spacing.md, paddingBottom: spacing.xl, gap: spacing.s12 },
  levelCard: {
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    gap: 4,
    marginBottom: spacing.xs,
    ...shadows.card(),
  },
  eyebrow: { ...typography.eyebrow, color: colors.primary },
  levelTitle: { ...typography.title, color: colors.text },
  levelFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.xs },
  levelSub: { ...typography.body, color: colors.textMuted },
  divider: { alignItems: 'center', paddingVertical: spacing.s12, gap: 4 },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.s12, alignSelf: 'stretch' },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: { ...typography.labelSm, color: colors.text },
  dividerHint: { ...typography.caption, color: colors.textMuted },
});
