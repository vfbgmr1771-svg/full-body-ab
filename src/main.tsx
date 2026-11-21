import { render } from 'preact';
import { Capacitor } from '@capacitor/core';
import { registerSW } from 'virtual:pwa-register';
import { App } from './App';
import { initNativeAlerts } from './native';
// Self-hosted Noto Sans Thai (Latin + Thai subsets only): works offline, no third-party request.
import '@fontsource/noto-sans-thai/latin-400.css';
import '@fontsource/noto-sans-thai/latin-600.css';
import '@fontsource/noto-sans-thai/latin-700.css';
import '@fontsource/noto-sans-thai/thai-400.css';
import '@fontsource/noto-sans-thai/thai-600.css';
import '@fontsource/noto-sans-thai/thai-700.css';
import './styles.css';

render(<App />, document.getElementById('app')!);

if (Capacitor.isNativePlatform()) {
  // Android app: files are bundled, so no service worker; set up the rest-end notification channel.
  void initNativeAlerts();
} else {
  registerSW({ immediate: true });
  // The first web release cached Google Fonts at runtime. Fonts are self-hosted now, so drop that cache.
  if ('caches' in window) void caches.delete('google-fonts').catch(() => {});
}
