import type { BackendService } from '../services/backend.js';
import type { Team, User } from '../types.js';
import { qs, escapeHtml } from './dom.js';

export interface TeamContext {
  user: User;
  team: Team | null;
}

export async function mountTeam(
  container: HTMLElement,
  backend: BackendService,
  ctx: TeamContext,
): Promise<void> {
  if (!ctx.team) {
    container.innerHTML = `
    <div class="screen" data-testid="team-none">
      <h2 class="screen-title">Team</h2>
      <p class="screen-sub">You're not on a team yet — start or join a rivalry from the Score tab first.</p>
    </div>`;
    return;
  }

  const members = await backend.getTeamMembers(ctx.team.id);
  container.innerHTML = `
  <div class="screen" data-testid="team-roster">
    <h2 class="screen-title">${escapeHtml(ctx.team.label)}</h2>
    <p class="screen-sub">${members.length} member${members.length === 1 ? '' : 's'} · anyone can log a call</p>

    <div class="card" id="roster-list"></div>

    <p class="section-label">Invite</p>
    <div class="card">
      <div style="font-family:var(--font-mono);font-size:17px;letter-spacing:.06em;" data-testid="team-invite-code">${ctx.team.inviteCode}</div>
      <p class="hint" style="margin-top:8px;">Anyone with this code can join ${escapeHtml(ctx.team.label)} and start logging calls under their own name.</p>
    </div>
  </div>`;

  qs(container, '#roster-list').innerHTML = members
    .map(
      (m) =>
        `<div class="roster-row"><span>${escapeHtml(m.user.displayName)}${m.user.id === ctx.user.id ? '<span class="you-tag">YOU</span>' : ''}</span><span class="pts">${m.points} pts</span></div>`,
    )
    .join('');
}
