import { Image, Text, View } from 'react-native';
import { topicImages } from '../assets/topics';

// Placeholder look for topics that have no picture yet: [emoji, background].
const ART = {
  cooking: ['🍳', '#FFE3C7'],
  dancing: ['💃', '#E9DDFB'],
  esports: ['🎮', '#D9E7FB'],
  hiking: ['🥾', '#DDEFC9'],
  traveling: ['✈️', '#D6EEF7'],
  photography: ['📷', '#F9E1E6'],
  comics: ['🦸', '#FFE9A8'],
  sports: ['⚽', '#D9EFD2'],
  music: ['🎵', '#EBDDF5'],
  shopping: ['🛍️', '#FBE2D5'],
  tourism: ['🗺️', '#D9ECF7'],
};

// A topic picture. Uses the image from assets/topics when registered, otherwise an emoji tile.
// `emoji` overrides the topic art (used for lesson records).
export default function TopicArt({ topicId, emoji, width = 56, height = width, rounded = 8, style }) {
  const source = topicId ? topicImages[topicId] : null;
  if (source) {
    return <Image source={source} resizeMode="cover" style={[{ width, height, borderRadius: rounded }, style]} />;
  }
  const [defaultEmoji, bg] = ART[topicId] ?? ['📘', '#EEEEEE'];
  const size = typeof height === 'number' ? height : 56;
  return (
    <View
      style={[
        { width, height, borderRadius: rounded, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' },
        style,
      ]}
    >
      <Text style={{ fontSize: size * 0.5 }}>{emoji ?? defaultEmoji}</Text>
    </View>
  );
}
