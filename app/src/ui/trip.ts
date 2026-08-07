import type { BackendService } from '../services/backend.js';
import type { BodyStyle, Rivalry, Team, Trip, User } from '../types.js';
import { qs, qsAll, escapeHtml } from './dom.js';
import { OFFICIAL_COLOR_NAMES } from '../logic/colors.js';

export interface TripContext {
  user: User;
  trip: Trip;
  team: Team | null;
  rivalry: Rivalry | null;
}

const BODY_STYLES: BodyStyle[] = ['Beetle', 'Convertible', 'New Beetle', 'Thing'];

function template(ctx: TripContext): string {
  const roundSection = ctx.rivalry
    ? `<div class="score-row" id="score-row" data-testid="score-row">
         <div class="team"><div class="name">Round</div><div class="num" id="round-total">0</div></div>
         <div class="team"><div class="name">Target</div><div class="num">${ctx.rivalry.roundTarget}</div></div>
       </div>`
    : '';

  return `
  <div class="screen">
    <h2 class="screen-title">Trip</h2>
    <p class="screen-sub">${ctx.team ? `Playing for ${escapeHtml(ctx.team.label)}` : 'Playing solo'}</p>

    <div class="streak-chip" id="streak-chip" data-testid="streak-chip"></div>

    ${roundSection}

    <div class="punch-wrap">
      <button class="punch-btn" id="open-log" data-testid="open-log">PUNCH<br>BUGGY</button>
    </div>

    <div id="log-form" style="display:none;">
      <p class="section-label">Colors</p>
      <div class="chips" id="color-chips" data-testid="color-chips">
        ${OFFICIAL_COLOR_NAMES.map((c) => `<button class="chip" aria-pressed="false" data-color="${escapeHtml(c)}">${escapeHtml(c)}</button>`).join('')}
      </div>
      <p class="section-label">Body style</p>
      <div class="seg" id="body-style" data-testid="body-style">
        ${BODY_STYLES.map((s, i) => `<button data-style="${s}" aria-pressed="${i === 0}">${s}</button>`).join('')}
      </div>
      <button class="big-start" id="submit-log" data-testid="submit-log">Log Hit <span id="pv">+1 pt</span></button>
    </div>

    <p class="section-label">Logged this trip</p>
    <div id="call-list" data-testid="call-list"><p class="hint">No calls yet. Go find a Beetle.</p></div>

    <p id="round-win-banner" class="hint" data-testid="round-win-banner" style="display:none;margin-top:14px;"></p>
  </div>`;
}

export async function mountTrip(
  container: HTMLElement,
  backend: BackendService,
  ctx: TripContext,
): Promise<void> {
  container.innerHTML = template(ctx);

  let selectedColors: string[] = [];
  let selectedStyle: BodyStyle = 'Beetle';
  let callCount = 0;

  async function renderStreak(): Promise<void> {
    const fresh = await backend.getUser(ctx.user.id);
    const chip = qs(container, '#streak-chip');
    const streak = fresh?.currentStreak ?? 0;
    chip.innerHTML = `🔥 <b>${streak}</b>-day streak`;
  }
  await renderStreak();

  qs(container, '#open-log').addEventListener('click', () => {
    const form = qs(container, '#log-form');
    form.style.display = form.style.display === 'none' ? 'block' : 'none';
  });

  qsAll(container, '#color-chips .chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      const on = chip.getAttribute('aria-pressed') === 'true';
      chip.setAttribute('aria-pressed', on ? 'false' : 'true');
      const color = chip.dataset['color']!;
      selectedColors = on ? selectedColors.filter((c) => c !== color) : [...selectedColors, color];
    });
  });

  qsAll(container, '#body-style button').forEach((btn) => {
    btn.addEventListener('click', () => {
      qsAll(container, '#body-style button').forEach((b) => b.setAttribute('aria-pressed', 'false'));
      btn.setAttribute('aria-pressed', 'true');
      selectedStyle = btn.dataset['style'] as BodyStyle;
    });
  });

  qs(container, '#submit-log').addEventListener('click', () => {
    void (async () => {
      if (selectedColors.length === 0) return;
      const result = await backend.logCall({
        tripId: ctx.trip.id,
        userId: ctx.user.id,
        colors: selectedColors,
        bodyStyle: selectedStyle,
      });

      const list = qs(container, '#call-list');
      if (callCount === 0) list.innerHTML = '';
      callCount++;
      const row = document.createElement('div');
      row.className = 'call-row';
      row.innerHTML = `<span>${escapeHtml(selectedColors.join(', '))} · ${selectedStyle}</span><span class="pts">+${result.call.points}</span>`;
      list.insertBefore(row, list.firstChild);

      if (ctx.rivalry && result.call.roundId) {
        const round = await backend.getRound(result.call.roundId);
        if (round && ctx.team) {
          qs(container, '#round-total').textContent = String(round.teamScores[ctx.team.id] ?? 0);
        }
      }

      if (result.roundWinnerTeamId) {
        const banner = qs(container, '#round-win-banner');
        const won = result.roundWinnerTeamId === ctx.team?.id;
        banner.textContent = won
          ? '🏁 Round won! A new round has already started.'
          : '🏁 The other team won this round. A new round has already started.';
        banner.style.display = 'block';
        qs(container, '#round-total').textContent = '0';
      }

      await renderStreak();

      selectedColors = [];
      qsAll(container, '#color-chips .chip').forEach((c) => c.setAttribute('aria-pressed', 'false'));
      qs(container, '#log-form').style.display = 'none';
    })();
  });
}
