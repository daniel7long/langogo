import { Alert, Platform } from 'react-native';

import { t } from '../i18n';

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
    host({ title: t(title), message: t(message), confirmLabel: t('OK'), cancelLabel: null, resolve: () => {} });
    return;
  }
  if (Platform.OS === 'web') {
    window.alert(message ? `${t(title)}\n\n${t(message)}` : t(title));
    return;
  }
  Alert.alert(t(title), t(message));
}

// Resolves true when the learner picks the action, false when they stay. The safe choice is the big orange button.
export function confirm(title, message, confirmLabel = 'OK', cancelLabel = 'Cancel') {
  if (host) {
    return new Promise((resolve) => host({ title: t(title), message: t(message), confirmLabel: t(confirmLabel), cancelLabel: t(cancelLabel), resolve }));
  }
  if (Platform.OS === 'web') {
    return Promise.resolve(window.confirm(`${t(title)}\n\n${t(message)}`));
  }
  return new Promise((resolve) => {
    Alert.alert(
      t(title),
      t(message),
      [
        { text: t(cancelLabel), style: 'cancel', onPress: () => resolve(false) },
        { text: t(confirmLabel), onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) }
    );
  });
}
