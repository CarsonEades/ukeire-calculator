// Hand + visible tiles <-> URL hash, e.g. #h=123m456p789s1122z&v=5z

export interface UrlState {
  hand: string;
  visible: string;
}

export function readHash(hash: string): UrlState {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  return { hand: params.get('h') ?? '', visible: params.get('v') ?? '' };
}

export function writeHash(state: UrlState): string {
  const parts: string[] = [];
  // Keep the common characters readable; only escape what URLs need.
  const enc = (s: string) => encodeURIComponent(s.trim()).replace(/%5B/g, '[').replace(/%5D/g, ']').replace(/%20/g, '+');
  if (state.hand.trim()) parts.push(`h=${enc(state.hand)}`);
  if (state.visible.trim()) parts.push(`v=${enc(state.visible)}`);
  return parts.length ? `#${parts.join('&')}` : '';
}
