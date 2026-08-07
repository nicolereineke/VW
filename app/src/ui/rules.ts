import type { BackendService } from '../services/backend.js';
import type { Rivalry, Team, User, Vote } from '../types.js';
import { qs, qsAll, escapeHtml } from './dom.js';

export interface RulesContext {
  user: User;
  team: Team | null;
  rivalry: Rivalry | null;
}

function toggleRow(id: string, label: string, desc: string, checked: boolean): string {
  return `<div class="rule-row">
    <div><div>${escapeHtml(label)}</div><div class="hint">${escapeHtml(desc)}</div></div>
    <label class="switch"><input type="checkbox" id="${id}" ${checked ? 'checked' : ''}><span class="track"></span><span class="knob"></span></label>
  </div>`;
}

export async function mountRules(
  container: HTMLElement,
  backend: BackendService,
  ctx: RulesContext,
): Promise<void> {
  if (!ctx.rivalry || !ctx.team) {
    container.innerHTML = `
    <div class="screen" data-testid="rules-none">
      <h2 class="screen-title">Rules</h2>
      <p class="screen-sub">House rules apply once you're in a rivalry — start one from the Score tab.</p>
    </div>`;
    return;
  }

  const rivalry = ctx.rivalry;
  const team = ctx.team;

  container.innerHTML = `
  <div class="screen" data-testid="rules-screen">
    <h2 class="screen-title">Shared Ruleset</h2>
    <p class="screen-sub">Agreed by both families · changes apply to future calls only</p>

    <div class="rule-row">
      <div><div>First to</div><div class="hint">Round ends the moment a team crosses this score</div></div>
      <div class="stepper">
        <button id="target-minus" aria-label="Decrease target">−</button>
        <span class="val" id="target-val" data-testid="round-target-val">${rivalry.roundTarget}</span>
        <button id="target-plus" aria-label="Increase target">+</button>
      </div>
    </div>
    ${toggleRow('rule-convertible', 'Convertible = 2 hits', 'Rarity bonus for cloth or fold-down tops', rivalry.rulesConvertibleMultiplier)}
    ${toggleRow('rule-thing', 'VW Thing = 10 hits', 'The Type 181 unicorn clause', rivalry.rulesThingMultiplier)}
    ${toggleRow('rule-interior', 'Interior Mode', 'Advanced: call interior color on foot sightings', rivalry.rulesInteriorMode)}

    <p class="section-label">Open Rulings</p>
    <div id="open-rulings"></div>
    <button class="add-member-btn" id="open-ask" data-testid="ask-rivalry-toggle">+ Ask the rivalry a question</button>
    <div id="ask-form" style="display:none;margin-top:10px;">
      <input class="text-input" id="ask-input" data-testid="ask-input" type="text" placeholder="Describe the scenario">
      <button class="big-start" id="ask-submit" data-testid="ask-submit" style="font-size:13px;padding:12px;">Submit Question</button>
    </div>

    <p class="section-label">Ruling Log</p>
    <div id="ruling-log"></div>
  </div>`;

  qs(container, '#target-minus').addEventListener('click', () =>
    void adjustTarget(-1),
  );
  qs(container, '#target-plus').addEventListener('click', () => void adjustTarget(1));

  async function adjustTarget(delta: number): Promise<void> {
    const next = Math.max(5, Math.min(99, rivalry.roundTarget + delta));
    rivalry.roundTarget = next;
    await backend.updateRivalryRules(rivalry.id, { roundTarget: next });
    qs(container, '#target-val').textContent = String(next);
  }

  qs<HTMLInputElement>(container, '#rule-convertible').addEventListener('change', (e) => {
    void backend.updateRivalryRules(rivalry.id, {
      rulesConvertibleMultiplier: (e.target as HTMLInputElement).checked,
    });
  });
  qs<HTMLInputElement>(container, '#rule-thing').addEventListener('change', (e) => {
    void backend.updateRivalryRules(rivalry.id, {
      rulesThingMultiplier: (e.target as HTMLInputElement).checked,
    });
  });
  qs<HTMLInputElement>(container, '#rule-interior').addEventListener('change', (e) => {
    void backend.updateRivalryRules(rivalry.id, {
      rulesInteriorMode: (e.target as HTMLInputElement).checked,
    });
  });

  qs(container, '#open-ask').addEventListener('click', () => {
    const form = qs(container, '#ask-form');
    form.style.display = form.style.display === 'none' ? 'block' : 'none';
  });
  qs(container, '#ask-submit').addEventListener('click', () => {
    void (async () => {
      const input = qs<HTMLInputElement>(container, '#ask-input');
      const question = input.value.trim();
      if (!question) return;
      await backend.proposeRuling(rivalry.id, question);
      input.value = '';
      qs(container, '#ask-form').style.display = 'none';
      await renderRulings();
    })();
  });

  async function renderRulings(): Promise<void> {
    const otherTeam = await backend.getOtherTeam(rivalry.id, team.id);
    const all = await backend.listRulings(rivalry.id);
    const open = all.filter((r) => r.resolvedVerdict === null);
    const resolved = all.filter((r) => r.resolvedVerdict !== null);

    const openEl = qs(container, '#open-rulings');
    openEl.innerHTML =
      open
        .map((r) => {
          const teams: Array<[string, string]> = [[team.id, team.label]];
          if (otherTeam) teams.push([otherTeam.id, otherTeam.label]);
          const voteRows = teams
            .map(([tid, label]) => {
              const vote: Vote = r.votes[tid] ?? null;
              return `<div class="vote-team">
                <span class="lbl">${escapeHtml(label)}</span>
                <button class="vote-btn ${vote === 'yes' ? 'picked-yes' : ''}" data-ruling="${r.id}" data-team="${tid}" data-vote="yes">Yes</button>
                <button class="vote-btn ${vote === 'no' ? 'picked-no' : ''}" data-ruling="${r.id}" data-team="${tid}" data-vote="no">No</button>
                <span class="vote-status">${vote ?? 'waiting'}</span>
              </div>`;
            })
            .join('');
          return `<div class="card ruling-card"><p class="ruling-q">"${escapeHtml(r.question)}"</p><div class="vote-row">${voteRows}</div></div>`;
        })
        .join('') || '<p class="hint">No open questions right now.</p>';

    qsAll(openEl, '.vote-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        void (async () => {
          const rulingId = btn.dataset['ruling']!;
          const teamId = btn.dataset['team']!;
          const vote = btn.dataset['vote'] as Vote;
          await backend.castVote(rulingId, teamId, vote);
          await renderRulings();
        })();
      });
    });

    qs(container, '#ruling-log').innerHTML =
      resolved
        .map(
          (r) =>
            `<div class="verdict-card"><p class="hint" style="font-style:italic;margin:0 0 4px;">"${escapeHtml(r.question)}"</p><span class="verdict-label">RULING</span><p style="font-size:12.5px;margin:3px 0 0;">${escapeHtml(r.resolvedVerdict!)}</p></div>`,
        )
        .join('') || '<p class="hint">Nothing resolved yet.</p>';
  }

  await renderRulings();
}
