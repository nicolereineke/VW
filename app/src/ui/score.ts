import type { BackendService } from '../services/backend.js';
import type { Rivalry, Team, User } from '../types.js';
import { qs, escapeHtml } from './dom.js';
import { BUG_DEX_SIZE } from '../logic/colors.js';

export interface ScoreContext {
  user: User;
  team: Team | null;
  rivalry: Rivalry | null;
  onStartRivalry: () => void;
}

function soloTemplate(user: User): string {
  return `
  <div class="screen" data-testid="score-solo">
    <h2 class="screen-title">My Collection</h2>
    <p class="screen-sub">Just you for now — invite a family whenever you're ready.</p>
    <div class="card" style="text-align:center;padding:24px 16px;">
      <p style="font-size:12px;color:var(--ink-soft);margin:0 0 4px;">Playing solo</p>
      <div style="font-family:var(--font-mono);font-size:30px;font-weight:700;" data-testid="solo-lifetime">${user.lifetimePoints}</div>
      <p style="font-size:10.5px;color:var(--ink-faint);text-transform:uppercase;margin:2px 0 18px;">lifetime points</p>
      <button class="big-start" id="start-rivalry" data-testid="start-rivalry" style="font-size:14px;padding:14px;">+ Start a Rivalry</button>
    </div>
    <p class="section-label">Your Collection</p>
    <div class="roster-row"><span>Bug-Dex</span><span class="pts">${user.bugDex.size}/${BUG_DEX_SIZE}</span></div>
    <div class="roster-row"><span>Current streak</span><span class="pts">🔥 ${user.currentStreak}</span></div>
  </div>`;
}

function rivalryTemplate(): string {
  return `
  <div class="screen" data-testid="score-rivalry">
    <h2 class="screen-title">Rivalry</h2>
    <p class="screen-sub">Shared ruleset</p>
    <div class="score-row" data-testid="score-row">
      <div class="team"><div class="name" id="team-a-name"></div><div class="num" id="team-a-score">0</div></div>
      <div class="team"><div class="name" id="team-b-name"></div><div class="num" id="team-b-score">0</div></div>
    </div>
    <p class="hint" id="round-target-hint" style="text-align:center;margin-bottom:16px;"></p>

    <p class="section-label">Top Spotters</p>
    <div id="top-spotters"></div>
  </div>`;
}

export async function mountScore(
  container: HTMLElement,
  backend: BackendService,
  ctx: ScoreContext,
): Promise<void> {
  const freshUser = (await backend.getUser(ctx.user.id)) ?? ctx.user;

  if (!ctx.rivalry || !ctx.team) {
    container.innerHTML = soloTemplate(freshUser);
    qs(container, '#start-rivalry').addEventListener('click', ctx.onStartRivalry);
    return;
  }

  container.innerHTML = rivalryTemplate();
  const otherTeam = await backend.getOtherTeam(ctx.rivalry.id, ctx.team.id);
  const round = await backend.getCurrentRound(ctx.rivalry.id);

  qs(container, '#team-a-name').textContent = ctx.team.label;
  qs(container, '#team-b-name').textContent = otherTeam?.label ?? 'Waiting for a rival…';
  qs(container, '#team-a-score').textContent = String(round?.teamScores[ctx.team.id] ?? 0);
  qs(container, '#team-b-score').textContent = otherTeam
    ? String(round?.teamScores[otherTeam.id] ?? 0)
    : '—';
  qs(container, '#round-target-hint').textContent = `First to ${ctx.rivalry.roundTarget} wins the round`;

  const spottersEl = qs(container, '#top-spotters');
  const members = await backend.getTeamMembers(ctx.team.id);
  spottersEl.innerHTML =
    members
      .map(
        (m) =>
          `<div class="roster-row"><span>${escapeHtml(m.user.displayName)}${m.user.id === ctx.user.id ? '<span class="you-tag">YOU</span>' : ''}</span><span class="pts">${m.points}</span></div>`,
      )
      .join('') || '<p class="hint">No one has scored yet.</p>';
}
