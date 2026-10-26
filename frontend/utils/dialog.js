import { Alert, Platform } from 'react-native';

// notify() and confirm() show Langogo's own dialog (components/DialogHost.js, mounted once in the root
// layout). If the host is not mounted for some reason, they fall back to the system dialogs.
let host = null;
export function registerDialogHost(fn) {
  host = fn;
  return () => {
    if (host === fn) host = null;
  };
}

export function notify(title, message) {
  if (host) {
    host({ title, message, confirmLabel: 'OK', cancelLabel: null, resolve: () => {} });
    return;
  }
  if (Platform.OS === 'web') {
    window.alert(message ? `${title}\n\n${message}` : title);
    return;
  }
  Alert.alert(title, message);
}

// Resolves true when the learner picks the action, false when they stay. The safe choice is the big orange button.
export function confirm(title, message, confirmLabel = 'OK', cancelLabel = 'Cancel') {
  if (host) {
    return new Promise((resolve) => host({ title, message, confirmLabel, cancelLabel, resolve }));
  }
  if (Platform.OS === 'web') {
    return Promise.resolve(window.confirm(`${title}\n\n${message}`));
  }
  return new Promise((resolve) => {
    Alert.alert(
      title,
      message,
      [
        { text: cancelLabel, style: 'cancel', onPress: () => resolve(false) },
        { text: confirmLabel, onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) }
    );
  });
}
