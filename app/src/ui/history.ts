import type { BackendService } from '../services/backend.js';
import type { Rivalry, User } from '../types.js';
import { qs, escapeHtml } from './dom.js';

export interface HistoryContext {
  user: User;
  rivalry: Rivalry | null;
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export async function mountHistory(
  container: HTMLElement,
  backend: BackendService,
  ctx: HistoryContext,
): Promise<void> {
  container.innerHTML = `
  <div class="screen" data-testid="history-screen">
    <h2 class="screen-title">Trip History</h2>
    <p class="screen-sub">Every trip, logged and settled.</p>
    ${ctx.rivalry ? '<p class="section-label">Past Rounds</p><div id="past-rounds"></div>' : ''}
    <p class="section-label">Trips</p>
    <div id="trip-list"></div>
  </div>`;

  if (ctx.rivalry) {
    const rounds = await backend.listPastRounds(ctx.rivalry.id);
    const roundsEl = qs(container, '#past-rounds');
    roundsEl.innerHTML =
      rounds
        .map((r) => {
          const winner = r.winnerTeamId ? r.teamScores[r.winnerTeamId] : 0;
          const scores = Object.values(r.teamScores).join('–');
          return `<div class="round-card"><span>🏆 Round won, ${escapeHtml(scores)}</span><span class="hint">${formatDate(r.endedAt ?? r.startedAt)}</span></div>`;
        })
        .join('') || '<p class="hint">No rounds finished yet.</p>';
  }

  const trips = await backend.listTrips(ctx.user.id);
  const tripListEl = qs(container, '#trip-list');
  if (trips.length === 0) {
    tripListEl.innerHTML = '<p class="hint">No trips yet.</p>';
    return;
  }

  const rows = await Promise.all(
    trips.map(async (trip) => {
      const calls = await backend.listCallsForTrip(trip.id);
      const totalPts = calls.reduce((sum, c) => sum + c.points, 0);
      const detail = calls
        .map((c) => `${escapeHtml(c.colors.join(', '))} ${c.bodyStyle} (+${c.points})`)
        .join(' · ');
      return `<details class="trip-card">
        <summary><span>${formatDate(trip.startedAt)} · ${calls.length} sighting${calls.length === 1 ? '' : 's'}</span><span class="pts">+${totalPts}</span></summary>
        <div class="trip-detail">${detail || 'No calls logged on this trip.'}</div>
      </details>`;
    }),
  );
  tripListEl.innerHTML = rows.join('');
}
