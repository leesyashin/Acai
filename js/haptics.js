// Short vibrations for touch devices that have them (Android; iOS Safari has no Vibration API): a tap when a
// guest pays, a double knock when a guest walks out, a buzz on a wrong drop. Off with the "Vibration" setting.

import { getSave } from './save.js';

const can = typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
const touch = () => typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;

// The setting is offered only where a vibration can be felt: a touch device with the Vibration API.
export const hasHaptics = () => can && touch();

export const HAPTIC = {
  tap: 10,
  pay: 18,
  combo: [16, 40, 16],
  reject: 40,
  lost: [70, 50, 90],
};

export function buzz(pattern) {
  if (!can || getSave().settings.haptics === false) return;
  try {
    navigator.vibrate(pattern);
  } catch {
    /* blocked (no user gesture yet) – nothing to feel then */
  }
}
