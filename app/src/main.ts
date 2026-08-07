import { LocalBackend } from './services/localBackend.js';
import { mountOnboarding } from './ui/onboarding.js';
import { mountTrip } from './ui/trip.js';

const backend = new LocalBackend();
const root = document.getElementById('app');
if (!root) throw new Error('#app root element not found.');

mountOnboarding(root, backend, (result) => {
  void mountTrip(root, backend, {
    user: result.user,
    trip: result.trip,
    team: result.team,
    rivalry: result.rivalry,
  });
});

// Exposed for e2e tests only — never used by production UI code.
(window as unknown as { __backend: LocalBackend }).__backend = backend;
