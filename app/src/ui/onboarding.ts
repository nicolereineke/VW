import type { BackendService } from '../services/backend.js';
import type { Rivalry, Team, Trip, User } from '../types.js';
import { qs, qsAll } from './dom.js';
import { beetleIconSvg } from '../theme/tokens.js';

export interface OnboardingResult {
  user: User;
  trip: Trip;
  team: Team | null;
  rivalry: Rivalry | null;
}

function template(): string {
  return `
  <div class="onboarding">
    <div class="ob-timer" id="ob-timer" data-testid="ob-timer" style="display:none;">⏱ <span id="ob-timer-val">0:00.0</span></div>

    <div class="ob-step active" id="ob-step-welcome">
      <div class="ob-center">
        <div class="logo-row">
          ${beetleIconSvg('var(--reineke)', 26)}
          <h1 class="logo">PUNCH BUGGY</h1>
          ${beetleIconSvg('var(--ouellette)', 26)}
        </div>
        <p class="ob-sub">Spot Beetles, log the call, build your collection — or start a rivalry with another family.</p>
      </div>
      <button class="big-start" id="ob-get-started" data-testid="ob-get-started">Get Started</button>
    </div>

    <div class="ob-step" id="ob-step-register">
      <p class="ob-h">Who's playing?</p>
      <p class="ob-sub" style="max-width:none;margin-bottom:14px;">Just enough to save your progress.</p>

      <p class="ob-field-label">Your name</p>
      <input class="text-input" id="ob-name" data-testid="ob-name" type="text" placeholder="e.g. Alex" maxlength="24">

      <p class="ob-field-label">Reach you at</p>
      <div class="seg" id="ob-contact-method">
        <button data-method="email" aria-pressed="true">Email</button>
        <button data-method="phone" aria-pressed="false">Phone</button>
      </div>
      <input class="text-input" id="ob-contact" data-testid="ob-contact" type="email" placeholder="you@example.com">

      <button class="add-member-btn" id="ob-toggle-code" type="button">Have an invite code?</button>
      <input class="text-input" id="ob-code" data-testid="ob-code" type="text" placeholder="e.g. RIVAL-K92M" style="display:none;margin-top:10px;text-transform:uppercase;">

      <p class="ob-error" id="ob-register-error"></p>
      <div style="flex:1;"></div>
      <button class="big-start" id="ob-continue" data-testid="ob-continue">Continue</button>
    </div>

    <div class="ob-step" id="ob-step-verify">
      <p class="ob-h">Check your <span id="ob-method-label">email</span></p>
      <p class="ob-sub" id="ob-sent-to" style="max-width:none;margin-bottom:18px;">We sent a code.</p>
      <input class="text-input ob-otp" id="ob-otp" data-testid="ob-otp" type="tel" inputmode="numeric" maxlength="6" placeholder="······" autocomplete="one-time-code">
      <p class="ob-error" id="ob-verify-error"></p>
    </div>

    <div class="ob-step" id="ob-step-done">
      <div class="ob-center">
        <div style="font-size:38px;margin-bottom:8px;">✅</div>
        <h2 class="ob-h" id="ob-welcome-msg">You're in.</h2>
        <p class="ob-sub" id="ob-time-result">Registered and playing.</p>
      </div>
      <button class="big-start" id="ob-start-playing" data-testid="ob-start-playing">Start Your First Trip →</button>
    </div>
  </div>`;
}

function formatElapsed(ms: number): string {
  const s = ms / 1000;
  const m = Math.floor(s / 60);
  const rem = s - m * 60;
  return `${m}:${rem < 10 ? '0' : ''}${rem.toFixed(1)}`;
}

export function mountOnboarding(
  container: HTMLElement,
  backend: BackendService,
  onComplete: (result: OnboardingResult) => void,
): void {
  container.innerHTML = template();

  let contactMethod: 'email' | 'phone' = 'email';
  let obStart = 0;
  let timerInterval: ReturnType<typeof setInterval> | undefined;

  function showStep(id: string): void {
    qsAll(container, '.ob-step').forEach((s) => s.classList.remove('active'));
    qs(container, `#${id}`).classList.add('active');
  }

  qs(container, '#ob-get-started').addEventListener('click', () => {
    obStart = Date.now();
    const timer = qs(container, '#ob-timer');
    timer.style.display = 'block';
    timerInterval = setInterval(() => {
      qs(container, '#ob-timer-val').textContent = formatElapsed(Date.now() - obStart);
    }, 100);
    showStep('ob-step-register');
    qs<HTMLInputElement>(container, '#ob-name').focus();
  });

  qsAll(container, '#ob-contact-method button').forEach((btn) => {
    btn.addEventListener('click', () => {
      contactMethod = btn.dataset['method'] as 'email' | 'phone';
      qsAll(container, '#ob-contact-method button').forEach((b) =>
        b.setAttribute('aria-pressed', b === btn ? 'true' : 'false'),
      );
      const input = qs<HTMLInputElement>(container, '#ob-contact');
      input.type = contactMethod === 'email' ? 'email' : 'tel';
      input.placeholder = contactMethod === 'email' ? 'you@example.com' : '(555) 123-4567';
      input.value = '';
    });
  });

  qs(container, '#ob-toggle-code').addEventListener('click', () => {
    const field = qs<HTMLInputElement>(container, '#ob-code');
    field.style.display = field.style.display === 'none' ? 'block' : 'none';
  });

  qs(container, '#ob-continue').addEventListener('click', () => {
    void (async () => {
      const name = qs<HTMLInputElement>(container, '#ob-name').value.trim();
      const contact = qs<HTMLInputElement>(container, '#ob-contact').value.trim();
      const errorEl = qs(container, '#ob-register-error');
      errorEl.textContent = '';
      if (!name || !contact) {
        errorEl.textContent = 'Enter your name and an email or phone number to continue.';
        return;
      }
      await backend.requestOtp(contact, contactMethod);
      qs(container, '#ob-method-label').textContent = contactMethod;
      qs(container, '#ob-sent-to').textContent = `We sent a code to ${contact}`;
      showStep('ob-step-verify');
      const otp = qs<HTMLInputElement>(container, '#ob-otp');
      otp.value = '';
      otp.focus();
    })();
  });

  qs(container, '#ob-otp').addEventListener('input', () => {
    const input = qs<HTMLInputElement>(container, '#ob-otp');
    input.value = input.value.replace(/\D/g, '');
    if (input.value.length === 6) {
      void completeOnboarding(input.value);
    }
  });

  async function completeOnboarding(code: string): Promise<void> {
    const name = qs<HTMLInputElement>(container, '#ob-name').value.trim() || 'Player';
    const contact = qs<HTMLInputElement>(container, '#ob-contact').value.trim();
    const inviteCode = qs<HTMLInputElement>(container, '#ob-code').value.trim();
    const errorEl = qs(container, '#ob-verify-error');

    let user: User;
    try {
      user = await backend.verifyOtp(contact, code, name);
    } catch {
      errorEl.textContent = 'That code didn’t match — check the digits and try again.';
      return;
    }
    errorEl.textContent = '';

    let team: Team | null = null;
    let rivalry: Rivalry | null = null;
    if (inviteCode) {
      try {
        const joined = await backend.redeemInviteCode(user.id, inviteCode, name);
        if (joined) {
          team = joined.team;
          rivalry = joined.rivalry;
        }
      } catch {
        errorEl.textContent = `"${inviteCode}" wasn't recognized — continuing solo instead.`;
      }
    }

    const trip = await backend.startTrip(user.id, team?.id ?? null);

    clearInterval(timerInterval);
    const elapsedStr = formatElapsed(Date.now() - obStart);
    qs(container, '#ob-timer-val').textContent = elapsedStr;
    qs(container, '#ob-timer').classList.add('locked');

    const firstName = user.displayName.split(' ')[0];
    qs(container, '#ob-welcome-msg').textContent = `You're in, ${firstName}.`;
    qs(container, '#ob-time-result').textContent = team
      ? `Registered and playing in ${elapsedStr} · playing for ${team.label}`
      : `Registered and playing in ${elapsedStr} · playing solo`;
    showStep('ob-step-done');

    qs(container, '#ob-start-playing').addEventListener(
      'click',
      () => onComplete({ user, trip, team, rivalry }),
      { once: true },
    );
  }
}
