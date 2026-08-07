import { LocalBackend } from './services/localBackend.js';
import { mountOnboarding } from './ui/onboarding.js';
import { mountAppShell } from './ui/app-shell.js';

const backend = new LocalBackend();
const root = document.getElementById('app');
if (!root) throw new Error('#app root element not found.');

mountOnboarding(root, backend, (result) => {
  mountAppShell(root, backend, result);
});

// Exposed for e2e tests only — never used by production UI code.
(window as unknown as { __backend: LocalBackend }).__backend = backend;
