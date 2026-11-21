import { render } from 'preact';
import { App } from './App';
// Self-hosted Noto Sans Thai (Latin + Thai subsets only): works offline, no third-party request.
import '@fontsource/noto-sans-thai/latin-400.css';
import '@fontsource/noto-sans-thai/latin-600.css';
import '@fontsource/noto-sans-thai/latin-700.css';
import '@fontsource/noto-sans-thai/thai-400.css';
import '@fontsource/noto-sans-thai/thai-600.css';
import '@fontsource/noto-sans-thai/thai-700.css';
import './styles.css';

render(<App />, document.getElementById('app')!);

// The first release cached Google Fonts at runtime. Fonts are self-hosted now, so drop that cache.
if ('caches' in window) void caches.delete('google-fonts').catch(() => {});
