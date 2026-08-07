import type { BackendService } from '../services/backend.js';
import type { OnboardingResult } from './onboarding.js';
import { mountScore } from './score.js';
import { mountTrip } from './trip.js';
import { mountTeam } from './team.js';
import { mountHistory } from './history.js';
import { mountRules } from './rules.js';
import { qs, qsAll } from './dom.js';

type TabId = 'score' | 'trip' | 'team' | 'history' | 'rules';

export function mountAppShell(
  root: HTMLElement,
  backend: BackendService,
  initial: OnboardingResult,
): void {
  const ctx = { ...initial };

  root.innerHTML = `
    <div class="app-body" id="app-body"></div>
    <div class="tabbar" id="tabbar">
      <button data-tab="score" class="active" data-testid="tab-score">Score</button>
      <button data-tab="trip" data-testid="tab-trip">Trip</button>
      <button data-tab="team" data-testid="tab-team">Team</button>
      <button data-tab="history" data-testid="tab-history">History</button>
      <button data-tab="rules" data-testid="tab-rules">Rules</button>
    </div>
  `;

  const body = qs(root, '#app-body');

  async function renderTab(tab: TabId): Promise<void> {
    qsAll(root, '#tabbar button').forEach((b) =>
      b.classList.toggle('active', b.dataset['tab'] === tab),
    );
    if (tab === 'score') {
      await mountScore(body, backend, {
        user: ctx.user,
        team: ctx.team,
        rivalry: ctx.rivalry,
        onStartRivalry: () => void startRivalry(),
      });
    } else if (tab === 'trip') {
      await mountTrip(body, backend, {
        user: ctx.user,
        trip: ctx.trip,
        team: ctx.team,
        rivalry: ctx.rivalry,
      });
    } else if (tab === 'team') {
      await mountTeam(body, backend, { user: ctx.user, team: ctx.team });
    } else if (tab === 'history') {
      await mountHistory(body, backend, { user: ctx.user, rivalry: ctx.rivalry });
    } else if (tab === 'rules') {
      await mountRules(body, backend, { user: ctx.user, team: ctx.team, rivalry: ctx.rivalry });
    }
  }

  async function startRivalry(): Promise<void> {
    const label = window.prompt(
      'Name your team (e.g. "Team Reineke")',
      `Team ${ctx.user.displayName.split(' ')[0]}`,
    );
    if (!label) return;
    const { rivalry, team } = await backend.createRivalry(ctx.user.id, label);
    ctx.team = team;
    ctx.rivalry = rivalry;
    // The active trip predates the rivalry — start a fresh one under the new team
    // rather than retroactively attributing already-logged solo calls to it.
    ctx.trip = await backend.startTrip(ctx.user.id, team.id);
    await renderTab('score');
  }

  qsAll(root, '#tabbar button').forEach((btn) => {
    btn.addEventListener('click', () => void renderTab(btn.dataset['tab'] as TabId));
  });

  void renderTab('score');
}
