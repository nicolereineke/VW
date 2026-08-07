// Minimal DOM helpers. No framework — the app is small enough that
// querySelector + innerHTML, done consistently, is clearer than pulling in
// a virtual-DOM dependency this sandbox couldn't install anyway.

export function qs<T extends HTMLElement = HTMLElement>(root: ParentNode, selector: string): T {
  const el = root.querySelector<T>(selector);
  if (!el) throw new Error(`Expected element not found: ${selector}`);
  return el;
}

export function qsAll<T extends HTMLElement = HTMLElement>(
  root: ParentNode,
  selector: string,
): T[] {
  return Array.from(root.querySelectorAll<T>(selector));
}

export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
