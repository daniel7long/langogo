import { Platform } from 'react-native';
import { AudioModule } from 'expo-audio';

// Is the microphone already allowed? (Used to skip the "Let's hear your voice" screen for returning learners.)
export async function microphoneAllowed() {
  try {
    if (Platform.OS === 'web') {
      const status = await navigator.permissions?.query({ name: 'microphone' });
      return status?.state === 'granted';
    }
    const result = await AudioModule.getRecordingPermissionsAsync();
    return !!result.granted;
  } catch (e) {
    return false;
  }
}

// Shows the system permission prompt. Resolves { granted }.
export async function askMicrophone() {
  try {
    const result = await AudioModule.requestRecordingPermissionsAsync();
    return { granted: !!result.granted };
  } catch (e) {
    return { granted: false };
  }
}
