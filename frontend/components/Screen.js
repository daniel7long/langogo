import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../theme';

// Keeps every screen in a phone-width column (like the Figma frames), so the layout also looks right in a
// wide browser window. A soft peach glow sits in the top right corner of every screen.
export default function Screen({ children, glow = true }) {
  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.column}>
        {glow && (
          <LinearGradient
            pointerEvents="none"
            colors={['rgba(255,226,196,0.85)', 'rgba(255,232,208,0.45)', 'rgba(255,252,248,0)']}
            locations={[0, 0.5, 1]}
            start={{ x: 1, y: 0 }}
            end={{ x: 0, y: 0.9 }}
            style={styles.glow}
          />
        )}
        {glow && (
          // Fades the bottom of the glow into the page colour, so there is no visible edge anywhere.
          <LinearGradient
            pointerEvents="none"
            colors={['rgba(255,252,248,0)', 'rgba(255,252,248,0.6)', colors.bg]}
            locations={[0, 0.55, 1]}
            style={styles.glow}
          />
        )}
        {children}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.page, alignItems: 'center' },
  column: { flex: 1, width: '100%', maxWidth: 480, backgroundColor: colors.bg, overflow: 'hidden' },
  glow: { position: 'absolute', top: 0, left: 0, right: 0, height: 420 },
});
