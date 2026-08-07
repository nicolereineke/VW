// SPEC.md §4.7. A code's prefix decides what redeeming it does — join an
// existing team, or join/create the second team of a rivalry. No code at all
// is the default, valid "solo" path, not an error state.

export type InviteCodeKind = 'solo' | 'team' | 'rivalry';

const CODE_FORMAT = /^[A-Z0-9]{2,10}-[A-Z0-9]{3,8}$/;

export function classifyInviteCode(code: string | null | undefined): InviteCodeKind {
  const trimmed = (code ?? '').trim();
  if (!trimmed) return 'solo';
  return trimmed.toUpperCase().startsWith('RIVAL') ? 'rivalry' : 'team';
}

export function isValidInviteCodeFormat(code: string): boolean {
  return CODE_FORMAT.test(code.trim().toUpperCase());
}
