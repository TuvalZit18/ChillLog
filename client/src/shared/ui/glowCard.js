// The overview's card border and hover design for a status (see glowCard.module.css):
// a problem glows in its status color; OK stays plain and turns teal on hover or focus.

import { STATUS_META } from '../status/status.js';
import glow from './glowCard.module.css';

/**
 * @param {keyof typeof STATUS_META} status the card's status (a branch card: its worst fridge's)
 * @returns {{ className: string, style?: Record<string, string> }} to spread onto the card, after
 *   combining className with the card's own layout class
 */
export function glowCard(status) {
  if (status === 'ok') return { className: `${glow.card} ${glow.calm}` };
  return {
    className: `${glow.card} ${glow.toned}`,
    style: { '--tone': STATUS_META[status].color },
  };
}
