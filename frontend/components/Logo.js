import { Image } from 'react-native';
import { logo } from '../assets/branding';

const FALLBACK_RATIO = 1094 / 410;

// The Langogo logo. The image itself lives in assets/branding/ (see the README there).
// The aspect ratio is read from the file, so a new logo with different proportions just works.
export default function Logo({ width = 160, style }) {
  const meta = Image.resolveAssetSource ? Image.resolveAssetSource(logo) : null;
  const ratio = meta && meta.width && meta.height ? meta.width / meta.height : FALLBACK_RATIO;

  return (
    <Image
      source={logo}
      accessibilityLabel="Langogo"
      resizeMode="contain"
      style={[{ width, height: width / ratio }, style]}
    />
  );
}
