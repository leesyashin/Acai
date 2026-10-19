// Outlined UI icons for buttons (viewBox 48×48, thick ink line under a coloured one), shared by the
// menu screens (js/screens.js) and the game view's pause menu (js/game-view.js). Pure strings.

export const INK = '#2a1236';
const svg48 = (body, size, cls = '') => `<svg class="sc-icon ${cls}" viewBox="0 0 48 48" width="${size}" height="${size}" aria-hidden="true" focusable="false" stroke-linejoin="round" stroke-linecap="round">${body}</svg>`;
// Outlined stroke: thick ink line with a coloured line on top.
const duo = (d, color = '#fff', w = 5) => `<path d="${d}" fill="none" stroke="${INK}" stroke-width="${w + 6}"/><path d="${d}" fill="none" stroke="${color}" stroke-width="${w}"/>`;

function gearPath() {
  const pts = [];
  const teeth = 8;
  for (let i = 0; i < teeth * 2; i++) {
    const a0 = (i / (teeth * 2)) * Math.PI * 2;
    const a1 = ((i + 1) / (teeth * 2)) * Math.PI * 2;
    const r = i % 2 ? 15.5 : 21;
    for (const a of [a0 + 0.06, a1 - 0.06]) pts.push(`${(24 + Math.cos(a) * r).toFixed(1)} ${(24 + Math.sin(a) * r).toFixed(1)}`);
  }
  return `M${pts.join('L')}Z`;
}
const GEAR = gearPath();

export const ICON = {
  back: (s = 36) => svg48('<path d="M5 24L22 8V17H42V31H22V40Z" fill="#fff" stroke="#2a1236" stroke-width="3.5"/>', s),
  next: (s = 36) => svg48('<path d="M43 24L26 8V17H6V31H26V40Z" fill="#fff" stroke="#2a1236" stroke-width="3.5"/>', s),
  close: (s = 30) => svg48(duo('M13 13L35 35M35 13L13 35', '#fff', 6), s),
  play: (s = 40) => svg48('<path d="M14 7L41 24L14 41Z" fill="#fff" stroke="#2a1236" stroke-width="3.5"/>', s),
  check: (s = 26) => svg48(duo('M11 25L20 34L37 14', '#fff', 6), s),
  gear: (s = 40) => svg48(`<path d="${GEAR}" fill="#fff" stroke="#2a1236" stroke-width="3.2"/><circle cx="24" cy="24" r="7" fill="#18c2c9" stroke="#2a1236" stroke-width="3.2"/>`, s),
  soundOn: (s = 40) => svg48('<path d="M6 18H14L25 8V40L14 30H6Z" fill="#fff" stroke="#2a1236" stroke-width="3.2"/>' + duo('M31 17Q36 24 31 31', '#18c2c9', 4) + duo('M36 11Q45 24 36 37', '#18c2c9', 4), s),
  soundOff: (s = 40) => svg48('<path d="M6 18H14L25 8V40L14 30H6Z" fill="#ddd3e4" stroke="#2a1236" stroke-width="3.2"/>' + duo('M31 18L43 30M43 18L31 30', '#ff4d4d', 4), s),
  note: (s = 36) => svg48('<path d="M18 34V10L40 6V30" fill="none" stroke="#2a1236" stroke-width="4"/><ellipse cx="13" cy="35" rx="7" ry="5.5" fill="#ff3d8b" stroke="#2a1236" stroke-width="3"/><ellipse cx="35" cy="31" rx="7" ry="5.5" fill="#ff3d8b" stroke="#2a1236" stroke-width="3"/>', s),
  shop: (s = 40) => svg48('<path d="M9 22H39V41H9Z" fill="#fff4df" stroke="#2a1236" stroke-width="3.2"/><path d="M20 41V30H28V41" fill="#18c2c9" stroke="#2a1236" stroke-width="3"/>'
    + '<path d="M5 10H43L45 20Q41 26 37 20Q33 26 29 20Q25 26 21 20Q17 26 13 20Q9 26 3 20Z" fill="#ff3d8b" stroke="#2a1236" stroke-width="3.2"/><path d="M17 10L15.5 21M29 10L30.5 21" stroke="#fff" stroke-width="3"/>', s),
  endless: (s = 40) => svg48(duo('M24 24C19 15 8 15 8 24C8 33 19 33 24 24C29 15 40 15 40 24C40 33 29 33 24 24Z', '#ffd23f', 5), s),
  retry: (s = 36) => svg48(duo('M36 30A13 13 0 1 1 33 15', '#fff', 5) + '<path d="M27 6L39 12L30 21Z" fill="#fff" stroke="#2a1236" stroke-width="3"/>', s),
  map: (s = 36) => svg48('<path d="M5 11L17 7L31 12L43 8V37L31 41L17 36L5 40Z" fill="#fff4df" stroke="#2a1236" stroke-width="3.2"/><path d="M17 7V36M31 12V41" stroke="#2a1236" stroke-width="3"/><path d="M9 30Q16 20 24 26T39 17" fill="none" stroke="#ff3d8b" stroke-width="3" stroke-dasharray="1 5"/>', s),
  home: (s = 36) => svg48('<path d="M5 23L24 7L43 23H38V41H10V23Z" fill="#fff" stroke="#2a1236" stroke-width="3.2"/><path d="M20 41V29H28V41" fill="#ffb627" stroke="#2a1236" stroke-width="3"/>', s),
  trash: (s = 32) => svg48('<path d="M10 14H38L35 42H13Z" fill="#fff" stroke="#2a1236" stroke-width="3.2"/><path d="M7 12H41M19 12V7H29V12" fill="none" stroke="#2a1236" stroke-width="3.2"/>', s),
  bolt: (s = 40) => svg48('<path d="M28 3L9 27H22L18 45L39 19H26Z" fill="#ffd23f" stroke="#2a1236" stroke-width="3.2"/>', s),
  globe: (s = 34) => svg48('<circle cx="24" cy="24" r="18" fill="#18c2c9" stroke="#2a1236" stroke-width="3.2"/><path d="M6 24H42M24 6C14 16 14 32 24 42C34 32 34 16 24 6Z" fill="none" stroke="#2a1236" stroke-width="3"/>', s),
  vibrate: (s = 36) => svg48('<rect x="15" y="6" width="18" height="36" rx="4" fill="#fff" stroke="#2a1236" stroke-width="3.2"/><rect x="19" y="11" width="10" height="20" rx="1.5" fill="#18c2c9"/>' + duo('M8 16Q5 24 8 32M40 16Q43 24 40 32', '#ffb627', 3), s),
  noteOff: (s = 36) => svg48('<path d="M18 34V10L40 6V30" fill="none" stroke="#2a1236" stroke-width="4"/><ellipse cx="13" cy="35" rx="7" ry="5.5" fill="#ddd3e4" stroke="#2a1236" stroke-width="3"/><ellipse cx="35" cy="31" rx="7" ry="5.5" fill="#ddd3e4" stroke="#2a1236" stroke-width="3"/>' + duo('M8 8L42 42', '#ff4d4d', 4), s),
  flag: (s = 36) => svg48('<path d="M11 44V5" fill="none" stroke="#2a1236" stroke-width="5"/><path d="M11 6H39L33 15L39 24H11Z" fill="#fff" stroke="#2a1236" stroke-width="3.2"/><path d="M18 6V24M25 6V15M32 15V24" stroke="#2a1236" stroke-width="2" opacity="0.35"/>', s),
};
