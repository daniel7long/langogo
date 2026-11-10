import { Text } from 'react-native';

import { translateChildren } from '../i18n';

// A <Text> that shows the app's own words in the learner's chosen app language.
// Lesson content and names from the server pass through unchanged (they are not in the dictionaries).
export default function AppText({ children, ...props }) {
  return <Text {...props}>{translateChildren(children)}</Text>;
}
