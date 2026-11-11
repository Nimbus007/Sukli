// Bootstrap: show setup help until Firebase is configured, then load the real app.
import { firebaseConfig } from './config.js';

const root = document.getElementById('app');
const notConfigured = !firebaseConfig.apiKey || firebaseConfig.apiKey.startsWith('PASTE_');

if (notConfigured) {
  root.innerHTML = `
    <div class="setup">
      <h1>Connect Firebase to start</h1>
      <p>Open <code>public/js/config.js</code> and paste your web app config from the Firebase console
      (Project settings, then Your apps, then SDK setup and configuration). Then reload this page.</p>
      <p>Step-by-step instructions are in <code>README.md</code>.</p>
    </div>`;
} else {
  import('./main.js').catch((err) => {
    console.error(err);
    root.innerHTML = `
      <div class="setup">
        <h1>The app could not load</h1>
        <p>${String(err?.message || err).replace(/</g, '&lt;')}</p>
        <p>Check your internet connection and the Firebase config in <code>public/js/config.js</code>.</p>
      </div>`;
  });
}
