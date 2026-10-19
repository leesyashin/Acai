// Level map art (cartoon style, thick ink outlines, light from the top left): a tall map the player scrolls up,
// in six regions of ten levels each, from the bottom up: the beach (levels 1–10), the town promenade (11–20), the
// rainforest where açaí grows (21–30), the tea plantation above its waterfall (31–40), the harbour (41–50) and the
// night market with the finale (51–60). Pure module: every export returns markup strings or numbers.
//   MAP_W, MAP_H, MAP_BLEED     the map is MAP_W wide plus MAP_BLEED on either side (art for wider screens)
//   mapLevelPos(i)              centre of level node i (0-based) in map px (x as on the stage)
//   MAP_REGIONS                 [{ id, first, last, top, bottom }] from the bottom up, in map px
//   mapRegionSVG(id)            one region's picture (MAP_W + 2·MAP_BLEED wide, its region's height)
//   mapRoadData(count)          the road through the first `count` nodes (from the bottom edge), an SVG path
//   mapBackgroundSVG()          all six regions in one picture (art preview)

import {
  INK, WHITE, PINK, LAGOON, MANGO, CREAM, WOOD, WOOD_D, FONT, f, uid, rngFor, lighten, darken, svgWrap, stroke, op, circle,
  ellipse, path, rect, g, line, tube, shape, rrect, ball, bigLeaf, starPoints, polyPath, puffs, frond, sparkle,
} from './svg.js';

export const MAP_W = 1280;
export const MAP_BLEED = 360;
const FULL_W = MAP_W + 2 * MAP_BLEED;
const SW = 3;

const LEVEL_COUNT = 60;
const PER_REGION = 10;
const SPACING = 124; // vertical distance between two nodes
const BOTTOM = 170; // level 1 above the map's bottom edge
const TOP = 190; // the last level below the top edge (the header lies over the top)
export const MAP_H = TOP + (LEVEL_COUNT - 1) * SPACING + BOTTOM;

export function mapLevelPos(i) {
  return { x: Math.round(640 + 280 * Math.sin(0.9 * i - 0.3)), y: MAP_H - BOTTOM - i * SPACING };
}

// The road's x at map height y: it runs through the nodes, which lie on a sine (between them too, near enough).
const roadAt = (y) => 640 + 280 * Math.sin((0.9 * (MAP_H - BOTTOM - y)) / SPACING - 0.3);

const between = (a, b) => Math.round((mapLevelPos(a).y + mapLevelPos(b).y) / 2);
// each region reaches halfway to the next region's first level
export const MAP_REGIONS = ['beach', 'town', 'forest', 'tea', 'harbor', 'night'].map((id, k) => {
  const first = k * PER_REGION + 1;
  const last = first + PER_REGION - 1;
  return { id, first, last, top: last === LEVEL_COUNT ? 0 : between(last - 1, last), bottom: first === 1 ? MAP_H : between(first - 2, first - 1) };
});

// The road: from below the bottom edge through every node (smooth Catmull-Rom curve), on past the last one.
export function mapRoadData(count) {
  const pts = [{ x: mapLevelPos(0).x - 60, y: MAP_H + 60 }];
  for (let i = 0; i < count; i++) pts.push(mapLevelPos(i));
  if (count >= LEVEL_COUNT) pts.push({ x: mapLevelPos(LEVEL_COUNT - 1).x + 120, y: 40 });
  let d = `M${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    d += `C${f(p1.x + (p2.x - p0.x) / 6)} ${f(p1.y + (p2.y - p0.y) / 6)} ${f(p2.x - (p3.x - p1.x) / 6)} ${f(p2.y - (p3.y - p1.y) / 6)} ${p2.x} ${p2.y}`;
  }
  return d;
}

// ---------------------------------------------------------------- shared props
export function palmTree(x, y, h, lean, sw, frondLen = 90) {
  const tx = x + lean;
  const ty = y - h;
  const cx = x + lean * 0.15;
  const cy = y - h * 0.5;
  let rings = '';
  for (let i = 1; i < 9; i++) {
    const k = i / 9;
    const px = (1 - k) * (1 - k) * x + 2 * k * (1 - k) * cx + k * k * tx;
    const py = (1 - k) * (1 - k) * y + 2 * k * (1 - k) * cy + k * k * ty;
    rings += line(`M${f(px - 8 + k * 3)} ${f(py)}q${f(8 - k * 3)} 4 ${f(16 - k * 6)} 0`, darken(WOOD, 0.3), 2);
  }
  let s = shape(`M${x - 10} ${y}Q${f(cx - 8)} ${f(cy)} ${f(tx - 5)} ${f(ty)}L${f(tx + 5)} ${f(ty)}Q${f(cx + 8)} ${f(cy)} ${x + 10} ${y}Z`, WOOD, sw, rings);
  const greens = ['#2fbf71', '#23a35e', '#36cf7c'];
  [-168, -128, -92, -52, -14, 22, 160].forEach((deg, i) => { s += frond(tx, ty, frondLen * (i % 2 ? 0.95 : 1.05), frondLen * 0.2, deg, greens[i % 3], sw, 0.3); });
  s += ball(tx - 6, ty + 6, 7, '#8e4f22', '#5a3d1c', sw) + ball(tx + 7, ty + 7, 7, '#8e4f22', '#5a3d1c', sw);
  return s;
}

// The açaí palm: a slender ringed trunk, feathery drooping fronds and hanging bunches of purple berries.
function acaiPalm(x, y, h, lean) {
  const tx = x + lean;
  const ty = y - h;
  let rings = '';
  for (let k = 0.12; k < 0.96; k += 0.085) rings += `M${f(x + lean * k * k - 5)} ${f(y - h * k)}h10`;
  let s = shape(`M${x - 6} ${y}Q${f(x + lean * 0.3 - 4)} ${f(y - h * 0.5)} ${f(tx - 3)} ${f(ty)}L${f(tx + 3)} ${f(ty)}Q${f(x + lean * 0.3 + 4)} ${f(y - h * 0.5)} ${x + 6} ${y}Z`, '#9a7a5a', SW, line(rings, '#6e5238', 1.6, op(0.8)));
  // berry bunches under the crown
  const bunch = (bx, by) => {
    let b = line(`M${f(bx)} ${f(by - 10)}Q${f(bx - 2)} ${f(by + 4)} ${f(bx)} ${f(by + 22)}`, '#c06b3a', 2.6);
    const rng = rngFor(`acai-bunch-${bx}-${by}`);
    for (let i = 0; i < 16; i++) {
      const px = bx + (rng.next() - 0.5) * 22 * (0.4 + i / 16);
      const py = by + i * 1.6 + rng.next() * 4;
      b += circle(px, py, 3.6, i % 3 ? '#4a1a66' : '#6c2a8f', stroke(1.2));
    }
    return b;
  };
  s += bunch(tx - 12, ty + 14) + bunch(tx + 10, ty + 18);
  const greens = ['#2e9d57', '#23824a', '#3cb567'];
  [-170, -140, -110, -70, -40, -10, 20, 160].forEach((deg, i) => { s += frond(tx, ty, 74 * (i % 2 ? 0.92 : 1.05), 11, deg, greens[i % 3], SW * 0.8, 0.42); });
  return s;
}

function bush(x, y, r, col = '#36b56b') {
  return puffs([[x - r * 0.9, y, r * 0.75], [x, y - r * 0.35, r], [x + r * 0.9, y, r * 0.75]], col, SW, darken(col, 0.18));
}

function flower(x, y, r, col) {
  let s = '';
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2 - Math.PI / 2;
    s += ellipse(x + Math.cos(a) * r * 0.62, y + Math.sin(a) * r * 0.62, r * 0.55, r * 0.42, col, stroke(SW * 0.6) + ` transform="rotate(${f((a * 180) / Math.PI)} ${f(x + Math.cos(a) * r * 0.62)} ${f(y + Math.sin(a) * r * 0.62)})"`);
  }
  return s + circle(x, y, r * 0.32, MANGO, stroke(SW * 0.6));
}

// A seagull in flight (a wide, flat "m").
const gull = (x, y, k = 1) => line(`M${f(x - 16 * k)} ${f(y)}q${f(8 * k)} ${f(-9 * k)} ${f(16 * k)} 0q${f(8 * k)} ${f(-9 * k)} ${f(16 * k)} 0`, INK, 2.6 * k);

// ---------------------------------------------------------------- beach (levels 1–10)
// The beach bar: a counter with a striped front under a thatched roof, an "Açaí" board on top and two stools.
function beachBar(x, base) {
  const w = 230;
  const L = x - w / 2;
  let stripes = '';
  for (let k = 0; k < w; k += 46) stripes += rect(L + k, base - 74, 23, 74, 0, WHITE);
  let s = rect(L + 14, base - 172, 14, 110, 3, WOOD_D, stroke(SW)) + rect(L + w - 28, base - 172, 14, 110, 3, WOOD_D, stroke(SW));
  s += shape(`M${L + 28} ${base - 150}H${L + w - 28}V${base - 80}H${L + 28}Z`, '#7fd8d0', SW, line(`M${L + 40} ${base - 120}H${L + w - 40}`, WOOD_D, 5));
  // bottles and bowls on the shelf behind
  for (const [bx, c] of [[L + 56, PINK], [L + 84, MANGO], [L + 112, '#6c2a8f']]) s += shape(rrect(bx - 8, base - 150, 16, 28, 5), c, SW * 0.7);
  s += path(`M${L + w - 98} ${base - 132}A22 14 0 0 0 ${L + w - 54} ${base - 132}Z`, '#5a1f73', stroke(SW * 0.7)) + circle(L + w - 82, base - 136, 5, PINK, stroke(1.5)) + circle(L + w - 70, base - 137, 5, MANGO, stroke(1.5));
  s += shape(rrect(L, base - 74, w, 74, 6), PINK, SW, stripes) + shape(rrect(L - 12, base - 88, w + 24, 18, 7), WOOD, SW, line(`M${L - 4} ${base - 83}H${L + w + 4}`, lighten(WOOD, 0.35), 3, op(0.7)));
  // thatched roof with a fringe
  let fringe = `M${L - 40} ${base - 166}`;
  for (let k = 0; k <= 12; k++) fringe += `L${f(L - 40 + ((k + 0.5) * (w + 80)) / 13)} ${base - 148}L${f(L - 40 + ((k + 1) * (w + 80)) / 13)} ${base - 166}`;
  let straws = '';
  for (let k = 1; k < 10; k++) straws += `M${f(x + (k - 5) * 8)} ${base - 232}L${f(L - 40 + (k * (w + 80)) / 10)} ${base - 168}`;
  s += shape(`${fringe}L${x} ${base - 236}Z`, '#f2c766', SW, line(straws, '#c99a3a', 2.4, op(0.8)));
  s += shape(rrect(x - 56, base - 276, 112, 40, 10), '#32283a', SW * 0.8) + `<text x="${x}" y="${base - 247}" text-anchor="middle" font-family="${FONT}" font-size="28" fill="#ef86b2">Açaí</text>`;
  const stool = (sx) => line(`M${sx - 12} ${base + 30}L${sx - 6} ${base}M${sx + 12} ${base + 30}L${sx + 6} ${base}`, WOOD_D, 5) + shape(`M${sx - 20} ${base - 6}H${sx + 20}V${base + 4}H${sx - 20}Z`, LAGOON, SW * 0.8);
  return s + stool(x - 60) + stool(x + 50);
}

function beach(H) {
  const X0 = -MAP_BLEED;
  const X1 = MAP_W + MAP_BLEED;
  // the beach's lower part was drawn for the first seven levels; it keeps its place above the map's bottom edge
  const D = H - 976;
  const sea = uid('sea');
  let s = `<defs><linearGradient id="${sea}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#119ac0"/><stop offset="1" stop-color="#5fe0e0"/></linearGradient></defs>`;
  s += rect(X0, 0, FULL_W, H, 0, '#ffe2a6');
  // soft sand patches and grains
  const rng = rngFor('map-beach');
  for (let i = 0; i < 22; i++) s += ellipse(X0 + rng.next() * FULL_W, 140 + rng.next() * (H - 160), 90 + rng.next() * 120, 18 + rng.next() * 14, '#fbd590', op(0.5));
  let grains = '';
  for (let i = 0; i < 300; i++) grains += `M${f(X0 + rng.next() * FULL_W)} ${f(130 + rng.next() * (H - 140))}h0.01`;
  s += line(grains, '#e9c27a', 3.2, op(0.7));
  // the sea along the left: its shore swings out at the bottom
  const shore = (y) => 120 + 70 * Math.sin((y - D) / 120) + Math.max(0, y - D - 420) * 0.32;
  let edge = `M${X0} 200L${f(shore(200) - 200)} 200`;
  for (let y = 210; y <= H + 20; y += 20) edge += `L${f(shore(y))} ${y}`;
  const seaD = `${edge}L${X0} ${H + 20}Z`;
  s += path(seaD, `url(#${sea})`);
  let foam = `M${f(shore(200) - 200)} 200`;
  for (let y = 210; y <= H + 20; y += 20) foam += `L${f(shore(y) + 6)} ${y}`;
  s += line(foam, WHITE, 14, op(0.85)) + line(foam, INK, 2, op(0.25));
  let waves = '';
  for (let i = 0; i < 42; i++) {
    const y = 240 + rng.next() * (H - 260);
    const x = X0 + 20 + rng.next() * (shore(y) - X0 - 60);
    waves += `M${f(x)} ${f(y)}q10 -7 20 0`;
  }
  s += line(waves, WHITE, 2.5, op(0.65));
  // a jetty into the sea with a rowing boat
  let planks = '';
  for (let x = X0 + 10; x < 140; x += 26) planks += `M${x} 276V310`;
  for (let x = X0 + 60; x < 140; x += 120) s += rect(x - 6, 300, 12, 34, 3, WOOD_D, stroke(SW));
  s += shape(`M${X0} 274H140V312H${X0}Z`, WOOD, SW, line(planks, darken(WOOD, 0.28), 2));
  s += g('translate(-90 360) rotate(-6)', shape('M-62 0H62Q52 30 30 34H-30Q-52 30 -62 0Z', '#ff8a5c', SW, rect(-62, 0, 124, 8, 0, WHITE)) + line('M-30 4L-4 -30M30 4L4 -30', WOOD_D, 4)) + line('M-40 358Q-10 330 20 306', '#e9d3a8', 3);
  // the promenade boardwalk across the top (to the town)
  let boards = '';
  for (let x = X0; x < X1; x += 46) boards += line(`M${x} 8V96`, darken(WOOD, 0.28), 2);
  s += shape(`M${X0} 6H${X1}V98H${X0}Z`, WOOD, SW, boards + line(`M${X0} 16H${X1}`, lighten(WOOD, 0.3), 3, op(0.6)));
  for (let x = X0 + 40; x < X1; x += 200) s += rect(x - 6, 92, 12, 30, 3, WOOD_D, stroke(SW));
  let rope = `M${X0 + 34} 118`;
  for (let x = X0 + 40; x < X1; x += 200) rope += `Q${x + 100} 136 ${x + 200} 118`;
  s += line(rope, '#e9d3a8', 3.5) + line(rope, INK, 1, op(0.4));
  // the upper beach: a volleyball net, the beach bar, a palm and gulls
  s += line('M200 300V196M440 266V162', WOOD_D, 7) + line('M200 300V196M440 266V162', INK, 1.2, op(0.5));
  let mesh = '';
  for (let k = 1; k < 12; k++) mesh += `M${200 + k * 20} ${f(200 - k * 3)}V${f(236 - k * 3)}`;
  mesh += 'M200 212L440 176M200 224L440 188';
  s += line(mesh, WHITE, 2, op(0.9)) + line('M200 200L440 164M200 236L440 200', WHITE, 5) + line('M200 200L440 164M200 236L440 200', INK, 1.2, op(0.45));
  s += ball(150, 176, 20, WHITE, '#d9d2e0', SW) + path('M150 156A20 20 0 0 1 170 176H150Z', MANGO) + circle(150, 176, 20, 'none', stroke(SW)) + line('M126 204q-8 6 -16 6M174 204q8 6 16 6', INK, 2, op(0.5));
  s += beachBar(960, 500) + palmTree(1350, 470, 280, -40, SW, 100);
  s += gull(-170, 200) + gull(-120, 228, 0.8) + gull(640, 520, 0.9);
  const lower = (body) => g(`translate(0 ${D})`, body);
  let low = '';
  // sailboat and a little island far out
  low += g('translate(-210 420)', path('M0 46H60L50 60H10Z', WHITE, stroke(SW)) + path('M30 44V0L64 44Z', PINK, stroke(SW)) + path('M28 44V10L4 44Z', MANGO, stroke(SW)));
  low += path('M-330 760Q-250 712 -170 760Z', '#ffe2a6', stroke(SW)) + palmTree(-250, 752, 50, 10, 2.2, 36);
  // umbrella and towel on the sand by the water
  const canopy = 'M-72 0A72 40 0 0 1 72 0Q54 11 36 0Q18 11 0 0Q-18 11 -36 0Q-54 11 -72 0Z';
  const stripes = path('M0 -40A72 40 0 0 0 -72 0Q-54 11 -36 0Q-18 -22 0 -40Z', PINK) + path('M0 -40Q4 -20 0 0Q18 11 36 0Q18 -22 0 -40Z', PINK);
  low += g('translate(250 300) rotate(-10) scale(0.8)', line('M0 -36V112', '#9aa7b6', 5) + shape(canopy, CREAM, SW, stripes) + circle(0, -42, 4, PINK, stroke(SW * 0.8)));
  low += g('rotate(-8 270 380)', shape(rrect(210, 352, 120, 56, 8), LAGOON, SW, line('M230 352V408M250 352V408', WHITE, 6, op(0.8))));
  // lifeguard tower on the right
  low += g('translate(1110 0)',
    line('M-40 520L-24 380M40 520L24 380M-36 470H36M-30 430H30', WOOD_D, 7) + line('M-40 520L-24 380M40 520L24 380', INK, 1.2, op(0.5)) +
    shape('M-46 380H46V330H-46Z', '#ff4d4d', SW, rect(-46, 344, 92, 12, 0, WHITE)) +
    shape('M-56 332L0 290L56 332Z', '#ffd36b', SW) + rect(-26, 352, 52, 22, 3, '#bfeef0', stroke(SW * 0.8)) +
    shape('M-6 290V250L30 262L-6 274', PINK, SW * 0.8));
  // surfboards in the sand, a sandcastle, beach ball, starfish and shells
  low += g('rotate(-12 1230 640)', shape('M1214 700Q1206 610 1230 560Q1254 610 1246 700Z', MANGO, SW, line('M1230 566V700', WHITE, 4, op(0.8))));
  low += g('rotate(8 1290 650)', shape('M1274 706Q1266 616 1290 566Q1314 616 1306 706Z', LAGOON, SW, line('M1290 572V706', PINK, 5)));
  low += g('translate(1040 820)', shape('M-50 0V-36H-38V-28H-26V-36H-14V0Z', '#f3c97a', SW) + shape('M-14 0V-56H-2V-48H10V-56H22V0Z', '#f3c97a', SW) + shape('M22 0V-30H50V0Z', '#f3c97a', SW) + tube('M4 -56V-80', INK, 1, 1) + path('M4 -80L22 -74L4 -68Z', PINK, stroke(SW * 0.7)));
  low += ball(1050, 230, 22, WHITE, '#d9d2e0', SW) + path('M1050 208A22 22 0 0 1 1072 230H1050Z', PINK) + path('M1050 252A22 22 0 0 1 1028 230H1050Z', LAGOON) + circle(1050, 230, 22, 'none', stroke(SW));
  const starfish = (x, y, k, deg) => g(`translate(${x} ${y}) rotate(${deg}) scale(${k})`, path(polyPath(starPoints(0, 0, 16, 7)), '#ff8a5c', stroke(SW / k)) + circle(0, 0, 2, '#ffd0b8'));
  low += starfish(1180, 860, 1, 12) + starfish(330, 560, 0.8, -20) + starfish(1000, 520, 0.7, 30);
  const shell = (x, y, deg) => g(`translate(${x} ${y}) rotate(${deg})`, path('M0 10L-12 -2Q0 -16 12 -2Z', '#ffd6e6', stroke(2.4)) + line('M0 10L-6 -6M0 10V-9M0 10L6 -6', '#e8a0bd', 1.6));
  low += shell(420, 880, -10) + shell(1210, 300, 15) + shell(180, 520, 0);
  // palms
  low += palmTree(1230, 470, 300, -60, SW, 104) + palmTree(1440, 760, 330, -50, SW, 110) + palmTree(1580, 400, 260, -40, SW, 96);
  low += palmTree(150, 250, 220, 50, SW, 90);
  s += lower(low) + starfish(560, 150, 0.8, 10) + shell(740, 380, 20);
  return s;
}

// ---------------------------------------------------------------- town promenade (levels 11–20)
function house(x, base, w, h, wall, roof, sign = '') {
  let s = shape(`M${x} ${base}V${base - h}H${x + w}V${base}Z`, wall, SW, rect(x + w - 16, base - h, 16, h, 0, darken(wall, 0.12), op(0.6)));
  s += shape(`M${x - 10} ${base - h + 2}L${x + w / 2} ${base - h - 46}L${x + w + 10} ${base - h + 2}Z`, roof, SW, line(`M${x + 6} ${base - h - 6}L${x + w / 2} ${base - h - 38}`, lighten(roof, 0.3), 3, op(0.6)));
  // windows
  for (let r = 0; r < Math.floor((h - 70) / 56); r++) {
    for (let c = 0; c < Math.floor(w / 58); c++) {
      const wx = x + 18 + c * 58;
      const wy = base - h + 22 + r * 56;
      s += shape(rrect(wx, wy, 34, 38, 6), '#bfeef0', SW * 0.8, rect(wx + 4, wy + 4, 8, 30, 3, WHITE, op(0.6)) + line(`M${wx + 17} ${wy}V${wy + 38}`, INK, 1.4, op(0.5)));
      s += rect(wx - 4, wy + 36, 42, 6, 2, darken(wall, 0.25), stroke(SW * 0.6));
    }
  }
  // shop front: striped awning over a door
  const ax = x + 10;
  const aw = w - 20;
  let stripes = '';
  for (let k = 0; k < aw; k += 24) stripes += rect(ax + k, base - 70, 12, 22, 0, k % 48 ? WHITE : PINK);
  s += shape(`M${ax} ${base - 70}H${ax + aw}V${base - 48}H${ax}Z`, PINK, SW * 0.8, stripes);
  s += shape(rrect(x + w / 2 - 18, base - 46, 36, 46, 4), WOOD_D, SW * 0.8, circle(x + w / 2 + 10, base - 22, 2.6, MANGO));
  if (sign) {
    s += shape(rrect(x + w / 2 - 50, base - h - 4 - 32, 100, 30, 8), '#32283a', SW * 0.8);
    s += `<text x="${x + w / 2}" y="${base - h - 13}" text-anchor="middle" font-family="${FONT}" font-size="20" fill="#ef86b2">${sign}</text>`;
  }
  return s;
}

function lamp(x, base) {
  return line(`M${x} ${base}V${base - 120}`, '#3b2a33', 7) + line(`M${x} ${base}V${base - 120}`, '#5c4569', 3) +
    path(`M${x - 16} ${base - 120}H${x + 16}L${x + 10} ${base - 146}H${x - 10}Z`, '#3b2a33', stroke(SW * 0.6)) +
    circle(x, base - 132, 16, '#fff3b8', op(0.45)) + circle(x, base - 132, 7, '#fff3b8', stroke(1.4)) + rect(x - 12, base - 6, 24, 8, 3, '#3b2a33');
}

function town(H) {
  const X0 = -MAP_BLEED;
  const X1 = MAP_W + MAP_BLEED;
  let s = rect(X0, 0, FULL_W, H, 0, '#f6e3c8');
  // paving
  let grid = '';
  for (let y = 24; y < H; y += 40) grid += `M${X0} ${y}H${X1}`;
  for (let y = 0; y < H; y += 40) for (let x = X0 + ((y / 40) % 2 ? 0 : 30); x < X1; x += 60) grid += `M${x} ${y + 4}v20`;
  s += line(grid, '#e8cfae', 2, op(0.8));
  // the hedge at the top (to the rainforest)
  for (let x = X0 + 30; x < X1; x += 90) s += bush(x, 34, 34, x % 180 ? '#36b56b' : '#2ea35f');
  // houses along both sides, back to front
  const left = [[-340, 300, 200, 220, '#ffb3c7', '#8e4f22'], [-120, 330, 190, 250, '#a8e6cf', '#c0607f', 'Açaí'], [-330, 600, 210, 230, '#ffe08a', '#6c2a8f'], [-110, 640, 200, 200, '#cdb4f0', '#8e4f22'], [-320, 880, 200, 210, '#ffcf9e', '#2e8a8f'], [-100, 900, 190, 240, '#ffb3c7', '#6c2a8f'], [-330, 1160, 210, 230, '#a8e6cf', '#6c2a8f'], [-110, 1190, 200, 220, '#ffe08a', '#c0607f']];
  const right = [[1110, 330, 190, 240, '#cdb4f0', '#c0607f'], [1320, 300, 210, 220, '#a8e6cf', '#8e4f22'], [1100, 630, 200, 220, '#ffe08a', '#2e8a8f', 'Matcha'], [1320, 600, 200, 250, '#ffb3c7', '#6c2a8f'], [1110, 900, 200, 210, '#ffcf9e', '#c0607f'], [1330, 880, 190, 230, '#cdb4f0', '#8e4f22'], [1100, 1180, 200, 230, '#ffb3c7', '#2e8a8f'], [1320, 1160, 210, 210, '#ffe08a', '#c0607f']];
  for (const [x, base, w, h, wall, roof, sign] of [...left, ...right].sort((a, b) => a[1] - b[1])) {
    if (base - h > H) continue;
    s += house(x, base, w, h, wall, roof, sign);
  }
  // lamps and palms in planters by the road
  for (const [x, base] of [[160, 300], [160, 640], [160, 980], [1070, 470], [1070, 820], [1070, 1150]]) s += lamp(x, base);
  const planter = (x, base) => palmTree(x, base - 26, 150, 14, SW, 70) + shape(rrect(x - 30, base - 30, 60, 34, 6), '#c4a27b', SW, line(`M${x - 30} ${base - 20}H${x + 30}`, '#987650', 2));
  s += planter(250, 470) + planter(1010, 260) + planter(1000, 680) + planter(1010, 1030);
  // fountain on the open square right of the road's bend
  const fx = 790;
  const fy = 860;
  s += ellipse(fx, fy + 24, 96, 30, '#c9c2d6', stroke(SW)) + ellipse(fx, fy + 18, 80, 22, '#5fd3e0', stroke(SW)) + ellipse(fx, fy + 14, 60, 12, '#9ef0f2', op(0.7));
  s += shape(`M${fx - 12} ${fy + 14}V${fy - 30}H${fx + 12}V${fy + 14}Z`, '#e8e1ef', SW) + ellipse(fx, fy - 30, 34, 10, '#c9c2d6', stroke(SW));
  s += line(`M${fx} ${fy - 40}Q${fx - 30} ${fy - 80} ${fx - 46} ${fy + 4}M${fx} ${fy - 40}Q${fx + 30} ${fy - 80} ${fx + 46} ${fy + 4}M${fx} ${fy - 40}V${fy - 84}`, '#9ef0f2', 6) + line(`M${fx} ${fy - 40}Q${fx - 30} ${fy - 80} ${fx - 46} ${fy + 4}M${fx} ${fy - 40}Q${fx + 30} ${fy - 80} ${fx + 46} ${fy + 4}`, WHITE, 2, op(0.8));
  // an ice-cream cart on the left of the road
  s += g('translate(520 410)',
    shape(rrect(-60, -40, 120, 56, 10), CREAM, SW, rect(-60, -18, 120, 10, 0, PINK)) +
    ball(-36, 24, 14, '#3b2a33', '#1a141f', SW) + ball(36, 24, 14, '#3b2a33', '#1a141f', SW) +
    line('M-50 -40V-96M50 -40V-96', '#9aa7b6', 4) + shape('M-74 -94Q0 -138 74 -94Z', LAGOON, SW, path('M-24 -94Q0 -128 24 -94Z', WHITE)) +
    circle(-14, -52, 11, '#ffb3c7', stroke(SW * 0.7)) + circle(6, -56, 11, '#a8e6cf', stroke(SW * 0.7)) + circle(24, -50, 10, '#ffe08a', stroke(SW * 0.7)));
  // café tables with parasols by the boardwalk
  const table = (x, y, c) => line(`M${x - 34} ${y + 30}V${y + 6}M${x + 34} ${y + 30}V${y + 6}`, '#5c4569', 4) + ellipse(x, y + 8, 30, 9, WHITE, stroke(SW * 0.8)) +
    line(`M${x} ${y + 8}V${y - 60}`, '#9aa7b6', 4) + shape(`M${x - 56} ${y - 50}Q${x} ${y - 96} ${x + 56} ${y - 50}Z`, c, SW, path(`M${x - 18} ${y - 50}Q${x} ${y - 90} ${x + 18} ${y - 50}Z`, WHITE)) +
    shape(rrect(x - 50, y + 10, 16, 22, 4), c, SW * 0.7) + shape(rrect(x + 34, y + 10, 16, 22, 4), c, SW * 0.7);
  s += table(470, 1180, PINK) + table(640, 1196, LAGOON);
  // flower beds
  for (const [x, y] of [[330, 580], [900, 140], [250, 1010]]) {
    s += ellipse(x, y, 60, 18, '#4caf6a', stroke(SW));
    s += flower(x - 30, y - 8, 10, PINK) + flower(x, y - 12, 10, MANGO) + flower(x + 30, y - 6, 10, '#c5a2e8');
  }
  return s;
}

// ---------------------------------------------------------------- rainforest (levels 21–30)
function forest(H) {
  const X0 = -MAP_BLEED;
  const X1 = MAP_W + MAP_BLEED;
  const grass = uid('grass');
  const water = uid('water');
  let s = `<defs><linearGradient id="${grass}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3f9a55"/><stop offset="1" stop-color="#7fd47a"/></linearGradient>` +
    `<linearGradient id="${water}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#2bb7d0"/><stop offset="1" stop-color="#6fe0e6"/></linearGradient></defs>`;
  s += rect(X0, 0, FULL_W, H, 0, `url(#${grass})`);
  const rng = rngFor('map-forest');
  let tufts = '';
  for (let i = 0; i < 120; i++) {
    const x = X0 + rng.next() * FULL_W;
    const y = 60 + rng.next() * (H - 60);
    tufts += `M${f(x)} ${f(y)}l4 -10l3 9l4 -12l3 13`;
  }
  s += line(tufts, '#2e8a46', 2.2, op(0.6));
  // cliffs with a waterfall at the top right, the river winding down to the left edge
  s += shape(`M${X0} 0H${X1}V120Q1500 150 1380 130Q1250 170 1120 140Q980 180 860 130Q700 160 560 120Q380 150 200 110Q0 150 ${X0} 120Z`, '#8f8aa0', SW,
    path(`M${X0} 0H${X1}V60Q1200 90 900 70Q600 100 300 64Q0 90 ${X0} 70Z`, '#a9a3bb') + line('M100 40l40 30M520 30l30 40M1300 40l40 30M760 50l20 30', '#6e6982', 3));
  const river = 'M1090 120C1120 220 1220 260 1180 340C1130 440 900 420 780 480C640 550 520 520 380 560C230 600 120 700 -60 720C-200 735 -300 760 -400 770';
  s += line(river, INK, 70) + line(river, `url(#${water})`, 62) + line(river, WHITE, 3, op(0.55) + ' stroke-dasharray="18 26"');
  s += path('M1060 0H1122V130H1060Z', '#8ee7ee', stroke(SW)) + line('M1072 4V128M1088 0V130M1104 6V126', WHITE, 4, op(0.85));
  s += puffs([[1070, 132, 18], [1096, 126, 22], [1120, 136, 16]], WHITE, SW);
  // big leaves along both edges, açaí palms, flowers
  const leafs = (x, y, k, flip) => {
    const d = flip ? -1 : 1;
    return bigLeaf(x, y, 120 * k, 50 * k, flip ? -150 : -30, '#2fbf71', SW) + bigLeaf(x, y, 100 * k, 44 * k, flip ? -110 : -70, '#23a35e', SW) +
      bigLeaf(x + 10 * d, y, 110 * k, 46 * k, flip ? -190 : 10, '#36cf7c', SW);
  };
  s += acaiPalm(-260, 520, 360, 30) + acaiPalm(-60, 640, 300, 40) + acaiPalm(140, 420, 280, -20) + acaiPalm(170, 820, 260, 30);
  s += acaiPalm(-230, 1130, 330, 30) + acaiPalm(70, 1250, 260, 20) + acaiPalm(1190, 1200, 290, -30) + acaiPalm(1440, 1060, 340, -30);
  s += acaiPalm(1150, 560, 300, -30) + acaiPalm(1350, 460, 340, -20) + acaiPalm(1560, 640, 360, -40) + acaiPalm(1120, 860, 250, -20);
  s += leafs(-320, 860, 1.2, false) + leafs(40, 300, 0.9, false) + leafs(1600, 860, 1.2, true) + leafs(1250, 300, 0.9, true) + leafs(-200, 300, 1, false);
  s += leafs(-60, 1000, 1, false) + leafs(1580, 1250, 1.1, true) + leafs(1160, 1000, 0.8, true);
  for (const [x, y, c] of [[230, 640, PINK], [1010, 640, '#ff8a5c'], [260, 240, MANGO], [980, 330, PINK], [1240, 720, '#c5a2e8'], [60, 780, PINK], [230, 980, MANGO], [1000, 1110, PINK], [880, 1200, '#c5a2e8']]) s += flower(x, y, 13, c);
  // a woven basket full of açaí berries beside the road
  let berries = '';
  const brng = rngFor('map-forest-basket');
  for (let i = 0; i < 22; i++) berries += ball(680 + (brng.next() - 0.5) * 70, 1150 - brng.next() * 14 - (i > 14 ? 8 : 0), 7, i % 3 ? '#4a1a66' : '#6c2a8f', '#2b0b3d', 1.6, 0.5);
  let weave = '';
  for (let k = 0; k < 4; k++) weave += `M${626 + k * 2} ${1166 + k * 12}H${734 - k * 2}`;
  s += berries + shape('M622 1154H738L726 1206H634Z', '#d9a35b', SW, line(weave, '#a8742f', 2.4) + line('M650 1156L656 1206M680 1156V1206M710 1156L704 1206', '#a8742f', 2));
  // a toucan on a branch at the right
  s += g('translate(1240 220)',
    line('M-80 30Q0 10 80 26', '#6e5238', 9) + line('M-80 30Q0 10 80 26', INK, 1.4, op(0.5)) +
    shape('M-10 26Q-30 -10 -6 -36Q14 -40 18 -14Q22 10 10 26Z', '#1d1d22', SW) + shape('M-2 -26Q4 -12 16 -10Q20 -26 10 -34Z', WHITE, SW * 0.8) +
    shape('M12 -30Q46 -34 58 -18Q40 -14 14 -18Z', MANGO, SW * 0.8, path('M40 -24Q52 -24 58 -18Q48 -18 40 -20Z', '#ff4d4d')) + circle(4, -26, 2.6, INK));
  // butterflies
  const fly = (x, y, c) => g(`translate(${x} ${y})`, ellipse(-7, -4, 8, 6, c, stroke(SW * 0.6)) + ellipse(7, -4, 8, 6, c, stroke(SW * 0.6)) + ellipse(-5, 5, 5, 4, c, stroke(SW * 0.6)) + ellipse(5, 5, 5, 4, c, stroke(SW * 0.6)) + line('M0 -8V8', INK, 2));
  s += fly(600, 330, '#ffb3c7') + fly(1000, 520, '#9fe0ff') + fly(220, 1060, MANGO) + fly(560, 860, '#ffb3c7');
  return s;
}

// ---------------------------------------------------------------- tea plantation (levels 31–40)
// A stone lantern: a slab, a post, the lit fire box and a wide cap.
function stoneLantern(x, base) {
  const st = '#b9b3c4';
  return shape(`M${x - 30} ${base}H${x + 30}V${base - 12}H${x - 30}Z`, darken(st, 0.1), SW) + shape(`M${x - 10} ${base - 12}V${base - 62}H${x + 10}V${base - 12}Z`, st, SW) +
    shape(`M${x - 26} ${base - 62}H${x + 26}V${base - 72}H${x - 26}Z`, darken(st, 0.1), SW) +
    shape(`M${x - 20} ${base - 72}V${base - 108}H${x + 20}V${base - 72}Z`, st, SW, rect(x - 11, base - 100, 22, 22, 3, '#ffe27a', stroke(SW * 0.6))) +
    circle(x, base - 89, 24, '#fff3b8', op(0.35)) +
    shape(`M${x - 40} ${base - 104}Q${x} ${base - 120} ${x + 40} ${base - 104}L${x + 18} ${base - 134}H${x - 18}Z`, darken(st, 0.18), SW) + ball(x, base - 140, 9, st, darken(st, 0.25), SW);
}

// A cherry tree in bloom with petals on the ground.
function cherryTree(x, base, k = 1) {
  const pink = '#ffb7d0';
  let s = shape(`M${x - 12 * k} ${base}Q${x - 4 * k} ${base - 60 * k} ${x - 30 * k} ${base - 118 * k}L${x - 18 * k} ${base - 124 * k}Q${x + 4 * k} ${base - 80 * k} ${x + 10 * k} ${base - 70 * k}Q${x + 24 * k} ${base - 104 * k} ${x + 40 * k} ${base - 120 * k}L${x + 48 * k} ${base - 112 * k}Q${x + 24 * k} ${base - 74 * k} ${x + 12 * k} ${base}Z`, '#7a4a3a', SW);
  s += puffs([[x - 70 * k, base - 140 * k, 44 * k], [x - 20 * k, base - 178 * k, 54 * k], [x + 44 * k, base - 160 * k, 50 * k], [x + 76 * k, base - 120 * k, 38 * k], [x - 40 * k, base - 112 * k, 40 * k], [x + 14 * k, base - 120 * k, 46 * k]], pink, SW, '#ff8fb8');
  const rng = rngFor(`cherry-${x}-${base}`);
  for (let i = 0; i < 12; i++) s += ellipse(x + (rng.next() - 0.5) * 220 * k, base - 160 * k + rng.next() * 110 * k, 5, 3.4, WHITE, op(0.85));
  for (let i = 0; i < 9; i++) s += ellipse(x + (rng.next() - 0.5) * 240 * k, base + 6 + rng.next() * 30, 5, 3, '#ff9cc2', op(0.9));
  return s;
}

// A clump of bamboo: tall jointed stalks with a few narrow leaves.
function bamboo(x, base, n, h) {
  let s = '';
  const rng = rngFor(`bamboo-${x}-${base}`);
  for (let i = 0; i < n; i++) {
    const bx = x + i * 26 + rng.next() * 10;
    const top = base - h * (0.75 + rng.next() * 0.3);
    const col = i % 2 ? '#8cc152' : '#a3cf5a';
    let joints = '';
    for (let y = base - 50; y > top + 20; y -= 54 + rng.next() * 10) joints += `M${f(bx - 9)} ${f(y)}H${f(bx + 9)}`;
    s += shape(`M${f(bx - 9)} ${base}V${f(top)}H${f(bx + 9)}V${base}Z`, col, SW, line(joints, darken(col, 0.3), 3) + line(`M${f(bx - 4)} ${base - 6}V${f(top + 6)}`, lighten(col, 0.4), 3, op(0.6)));
    for (let k = 0; k < 3; k++) {
      const ly = top + 30 + k * 70 + rng.next() * 20;
      s += g(`translate(${f(bx)} ${f(ly)}) rotate(${k % 2 ? -150 : -30})`, shape('M0 0Q24 -8 52 0Q24 6 0 0Z', '#5fae47', SW * 0.7));
    }
  }
  return s;
}

function tea(H) {
  const X0 = -MAP_BLEED;
  const X1 = MAP_W + MAP_BLEED;
  const water = uid('water');
  let s = `<defs><linearGradient id="${water}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#2bb7d0"/><stop offset="1" stop-color="#6fe0e6"/></linearGradient></defs>`;
  s += rect(X0, 0, FULL_W, H, 0, '#b8e39c');
  // terraced rows of round-clipped tea bushes, following the slope
  const dots = (w, gap) => ` stroke-linecap="round" stroke-dasharray="0 ${gap}" stroke-width="${w}"`;
  for (let y0 = 116; y0 < H + 40; y0 += 62) {
    let d = '';
    for (let x = X0 - 40; x <= X1 + 40; x += 60) d += `${d ? 'L' : 'M'}${x} ${f(y0 + 16 * Math.sin(x / 230 + y0 / 80))}`;
    s += line(d, INK, 38) + line(d, '#3f9c50', 32);
    s += path(d, 'none', ` transform="translate(0 -9)" stroke="${INK}"` + dots(34, 28)) + path(d, 'none', ` transform="translate(0 -9)" stroke="#4fb35d"` + dots(28, 28));
    s += path(d, 'none', ` transform="translate(-5 -15)" stroke="#8edc8e" opacity="0.75"` + dots(7, 28));
  }
  // the bamboo fence across the top (to the harbour)
  let poles = '';
  for (let x = X0; x < X1; x += 22) poles += `M${x} 4V${86 + (x % 44 ? 0 : 8)}`;
  s += line(poles, INK, 22) + line(poles, '#d6c46a', 16) + line(poles.replace(/M(-?\d+) /g, (m, x) => `M${Number(x) - 3} `), '#efe2a0', 4, op(0.8));
  s += line(`M${X0} 30H${X1}M${X0} 66H${X1}`, INK, 12) + line(`M${X0} 30H${X1}M${X0} 66H${X1}`, '#a98c3e', 7);
  // the koi pond up at the right, its stream running down to the waterfall in the rainforest below
  const stream = `M1250 300C1200 430 1320 520 1260 620C1200 720 1290 820 1200 920C1120 1000 1080 1100 1091 ${H + 10}`;
  s += line(stream, INK, 70) + line(stream, `url(#${water})`, 62) + line(stream, WHITE, 3, op(0.55) + ' stroke-dasharray="18 26"');
  for (const [x, y, r] of [[1120, 250, 22], [1150, 310, 18], [1390, 230, 26], [1360, 312, 20], [1200, 196, 16], [1310, 186, 20]]) s += ball(x, y, r, '#b9b3c4', '#8d86a0', SW, 0.4);
  s += ellipse(1260, 255, 140, 64, `url(#${water})`, stroke(SW)) + ellipse(1250, 250, 100, 38, '#9ef0f2', op(0.45));
  const koi = (x, y, deg, c) => g(`translate(${x} ${y}) rotate(${deg})`, shape('M-20 0Q-8 -10 12 -4Q20 0 12 4Q-8 10 -20 0ZM-20 0L-30 -8L-28 0L-30 8Z', c, SW * 0.6, circle(-4, -2, 4, WHITE, op(0.8))));
  s += koi(1220, 250, 20, '#ff8a3c') + koi(1300, 270, -160, WHITE) + koi(1270, 230, 190, '#ff5d4d');
  s += ellipse(1190, 278, 18, 8, '#4caf6a', stroke(SW * 0.7)) + ellipse(1330, 236, 16, 7, '#4caf6a', stroke(SW * 0.7)) + flower(1330, 232, 8, '#ffb7d0');
  // a red arched bridge over the stream
  s += g('translate(1262 690)',
    shape('M-90 18Q0 -40 90 18L90 32Q0 -24 -90 32Z', '#e2463f', SW) +
    line('M-80 4V-24M-40 -14V-44M0 -22V-52M40 -14V-44M80 4V-24', '#b8302c', 6) + line('M-84 -22Q0 -76 84 -22', INK, 10) + line('M-84 -22Q0 -76 84 -22', '#e2463f', 6));
  // bamboo, the tea house with its "Matcha" board, stone lanterns, cherry trees and baskets of leaves
  s += bamboo(-330, 520, 8, 420) + bamboo(10, 470, 4, 360) + bamboo(1420, 900, 6, 360);
  const hx = 250;
  const hb = 520;
  let shoji = '';
  for (let k = 0; k < 6; k++) shoji += `M${hx - 112 + k * 34} ${hb - 128}V${hb - 24}`;
  shoji += `M${hx - 112} ${hb - 92}H${hx + 112}M${hx - 112} ${hb - 58}H${hx + 112}`;
  s += shape(`M${hx - 140} ${hb}H${hx + 140}V${hb - 24}H${hx - 140}Z`, '#b9b3c4', SW, line(`M${hx - 90} ${hb - 24}V${hb}M${hx - 20} ${hb - 24}V${hb}M${hx + 60} ${hb - 24}V${hb}`, '#8d86a0', 2));
  s += shape(`M${hx - 118} ${hb - 24}V${hb - 134}H${hx + 118}V${hb - 24}Z`, '#fff4df', SW, line(shoji, '#c9a06a', 3));
  s += rect(hx - 126, hb - 140, 14, 116, 3, WOOD_D, stroke(SW)) + rect(hx + 112, hb - 140, 14, 116, 3, WOOD_D, stroke(SW));
  let noren = '';
  for (let k = 0; k < 3; k++) noren += shape(rrect(hx - 46 + k * 32, hb - 134, 28, 58, 4), '#2f6b4a', SW * 0.7, circle(hx - 32 + k * 32, hb - 104, 6, WHITE, op(0.85)));
  s += noren;
  s += shape(`M${hx - 176} ${hb - 128}Q${hx - 150} ${hb - 132} ${hx - 120} ${hb - 162}L${hx - 70} ${hb - 214}H${hx + 70}L${hx + 120} ${hb - 162}Q${hx + 150} ${hb - 132} ${hx + 176} ${hb - 128}Q${hx + 120} ${hb - 150} ${hx} ${hb - 148}Q${hx - 120} ${hb - 150} ${hx - 176} ${hb - 128}Z`, '#4b4f6b', SW,
    line(`M${hx - 100} ${hb - 160}L${hx - 60} ${hb - 206}M${hx - 40} ${hb - 152}L${hx - 20} ${hb - 208}M${hx + 20} ${hb - 152}L${hx + 20} ${hb - 208}M${hx + 80} ${hb - 156}L${hx + 60} ${hb - 206}`, '#6b7090', 3));
  s += shape(`M${hx - 90} ${hb - 212}H${hx + 90}Q${hx + 70} ${hb - 232} ${hx} ${hb - 234}Q${hx - 70} ${hb - 232} ${hx - 90} ${hb - 212}Z`, '#3a3d56', SW);
  s += shape(rrect(hx - 58, hb - 276, 116, 36, 9), '#32283a', SW * 0.8) + `<text x="${hx}" y="${hb - 250}" text-anchor="middle" font-family="${FONT}" font-size="24" fill="#9ee08a">Matcha</text>`;
  s += stoneLantern(470, 330) + stoneLantern(690, 790) + stoneLantern(-80, 1000);
  s += cherryTree(-210, 860, 1.1) + cherryTree(130, 1190, 0.9) + cherryTree(1050, 760, 0.85) + cherryTree(1500, 560, 1);
  const basket = (x, y) => {
    let leaves = '';
    for (let k = 0; k < 6; k++) leaves += g(`translate(${x - 26 + k * 10} ${y - 30}) rotate(${-60 - k * 12})`, shape('M0 0Q10 -6 22 0Q10 6 0 0Z', '#4fb35d', SW * 0.6));
    return leaves + shape(`M${x - 34} ${y - 30}H${x + 34}L${x + 26} ${y + 14}H${x - 26}Z`, '#d9a35b', SW, line(`M${x - 31} ${y - 16}H${x + 31}M${x - 29} ${y - 2}H${x + 29}`, '#a8742f', 2.4));
  };
  s += basket(640, 1196) + basket(720, 1214);
  return s;
}
// ---------------------------------------------------------------- harbour (levels 41–50)
// A paper lantern with its glow, hanging at (x, y).
function lantern(x, y, c, r = 14, glow = '') {
  return (glow ? circle(x, y + r, r * 3, glow) : circle(x, y + r, r * 2.1, '#ffd36b', op(0.22))) + line(`M${x} ${y - 6}V${y}`, INK, 2) +
    shape(`M${x - r * 0.5} ${y}H${x + r * 0.5}Q${x + r * 1.1} ${y + r} ${x + r * 0.5} ${y + r * 2}H${x - r * 0.5}Q${x - r * 1.1} ${y + r} ${x - r * 0.5} ${y}Z`, c, SW * 0.7,
      line(`M${x} ${y + 2}V${y + r * 2 - 2}M${x - r * 0.45} ${y + 4}Q${x - r * 0.75} ${y + r} ${x - r * 0.45} ${y + r * 2 - 4}M${x + r * 0.45} ${y + 4}Q${x + r * 0.75} ${y + r} ${x + r * 0.45} ${y + r * 2 - 4}`, darken(c, 0.25), 1.4) +
      ellipse(x - r * 0.3, y + r * 0.7, r * 0.18, r * 0.4, WHITE, op(0.5)));
}

// A string of lanterns sagging between two points.
function garland(x0, y0, x1, y1, sag, cols, gap = 70, glow = '') {
  const n = Math.max(2, Math.round(Math.abs(x1 - x0) / gap));
  const pt = (k) => [x0 + (x1 - x0) * k, y0 + (y1 - y0) * k + sag * 4 * k * (1 - k)];
  let s = line(`M${x0} ${y0}Q${f((x0 + x1) / 2)} ${f((y0 + y1) / 2 + sag * 2)} ${x1} ${y1}`, INK, 2.2);
  for (let i = 1; i < n; i++) {
    const [x, y] = pt(i / n);
    s += lantern(f(x), f(y + 4), cols[i % cols.length], 11, glow);
  }
  return s;
}

// A fishing boat seen from above and the side: hull, wheelhouse, mast with a flag.
function fishingBoat(x, y, flip = false, c = '#ff5d4d') {
  return g(`translate(${x} ${y})${flip ? ' scale(-1 1)' : ''}`,
    shape('M-110 -10H110Q96 34 70 40H-84Q-104 30 -110 -10Z', c, SW, rect(-110, -10, 220, 12, 0, WHITE) + line('M-96 20H90', darken(c, 0.25), 3)) +
    shape(rrect(-60, -66, 70, 56, 8), WHITE, SW, rect(-50, -56, 20, 18, 4, '#bfeef0', stroke(SW * 0.6)) + rect(-24, -56, 20, 18, 4, '#bfeef0', stroke(SW * 0.6))) +
    shape('M-66 -66H16L10 -78H-60Z', LAGOON, SW * 0.8) + line('M50 -10V-120', WOOD_D, 5) + line('M50 -116L104 -10M50 -116L-10 -66', INK, 1.4, op(0.6)) +
    shape('M50 -120L80 -112L50 -104Z', MANGO, SW * 0.7) + ball(-90, -2, 8, MANGO, '#d18a10', SW * 0.7) + ball(80, -2, 8, LAGOON, '#0f8f95', SW * 0.7));
}

function harbor(H) {
  const X0 = -MAP_BLEED;
  const X1 = MAP_W + MAP_BLEED;
  const sea = uid('sea');
  let s = `<defs><linearGradient id="${sea}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#1b8fbf"/><stop offset="1" stop-color="#49c6dc"/></linearGradient></defs>`;
  // the quay: stone slabs; two basins of water left and right of it
  s += rect(X0, 0, FULL_W, H, 0, '#ece2d2');
  let slabs = '';
  for (let y = 30; y < H; y += 56) slabs += `M${X0} ${y}H${X1}`;
  for (let y = 0; y < H; y += 56) for (let x = X0 + ((y / 56) % 2 ? 0 : 45); x < X1; x += 90) slabs += `M${x} ${y + 32}v22`;
  s += line(slabs, '#d9ccb6', 2.4, op(0.9));
  const top = 150;
  const bot = H - 130;
  const basins = [`M${X0 - 20} ${top}H250V${bot}H${X0 - 20}Z`, `M${X1 + 20} ${top}H1060V${bot}H${X1 + 20}Z`];
  const rng = rngFor('map-harbor');
  for (const d of basins) s += path(d, `url(#${sea})`);
  let waves = '';
  for (let i = 0; i < 60; i++) {
    const y = top + 40 + rng.next() * (bot - top - 70);
    const left = rng.next() < 0.5;
    const x = left ? X0 + 20 + rng.next() * 200 : 1090 + rng.next() * 480;
    waves += `M${f(x)} ${f(y)}q10 -7 20 0q10 7 20 0`;
  }
  s += line(waves, WHITE, 2.5, op(0.6));
  for (const d of basins) s += line(d, INK, 24) + line(d, '#b3a58f', 17) + line(d, '#cfc2ab', 5, op(0.8));
  // bollards and tyres along the quay walls
  const bollard = (x, y) => ball(x, y, 11, '#4d4458', '#2d2638', SW) + ellipse(x, y - 3, 6, 3, '#7a7088');
  const tyre = (x, y) => circle(x, y, 13, 'none', stroke(9, INK)) + circle(x, y, 13, 'none', stroke(5, '#3a3442'));
  for (let y = top + 80; y < bot - 20; y += 190) s += bollard(276, y) + bollard(1034, y + 90) + tyre(252, y + 50) + tyre(1058, y + 140);
  // left basin: a jetty with a rowing boat, the fishing boat at the wall, a crane lifting a crate
  let planks = '';
  for (let x = X0 + 10; x < 250; x += 26) planks += `M${x} 324V364`;
  for (let x = X0 + 50; x < 250; x += 110) s += rect(x - 6, 356, 12, 34, 3, WOOD_D, stroke(SW));
  s += shape(`M${X0} 322H250V366H${X0}Z`, WOOD, SW, line(planks, darken(WOOD, 0.28), 2));
  s += g('translate(-60 420) rotate(4)', shape('M-62 0H62Q52 30 30 34H-30Q-52 30 -62 0Z', LAGOON, SW, rect(-62, 0, 124, 8, 0, WHITE)) + line('M-30 4L-4 -30M30 4L4 -30', WOOD_D, 4)) + line('M-20 418Q20 400 40 366', '#e9d3a8', 3);
  s += fishingBoat(60, 900);
  s += line('M188 878Q214 860 262 846', '#e9d3a8', 3.5);
  // the crane: a yellow tower on legs at the quay's edge, its jib out over the water
  s += g('translate(330 690)',
    line('M-46 0L-20 -150M46 0L20 -150M-36 -50H36M-28 -100H28M-40 -2L28 -96M40 -2L-28 -96', INK, 12) + line('M-46 0L-20 -150M46 0L20 -150M-36 -50H36M-28 -100H28M-40 -2L28 -96M40 -2L-28 -96', '#ffc93c', 7) +
    shape('M-36 -150H40V-206H-36Z', '#ffc93c', SW, rect(-24, -196, 30, 24, 4, '#bfeef0', stroke(SW * 0.6))) +
    line('M30 -196L-290 -176M30 -170L-290 -176', INK, 12) + line('M30 -196L-290 -176M30 -170L-290 -176', '#ffc93c', 7) +
    line('M-240 -178V-60', INK, 2.4) + path('M-250 -60Q-240 -46 -230 -60', 'none', stroke(4)) +
    shape('M-282 -44H-198V-6H-282Z', '#ff8a5c', SW, line('M-282 -25H-198M-254 -44V-6M-226 -44V-6', darken('#ff8a5c', 0.3), 2.4)) +
    line('M-240 -60L-276 -44M-240 -60L-204 -44', INK, 1.6));
  // right basin: a lighthouse on its rocks, a moored sailboat, a jetty and buoys
  s += shape('M1124 500L1140 456L1176 436L1214 446L1240 424L1282 436L1306 462L1336 474L1344 500Z', '#8f8aa0', SW,
    path('M1140 456L1176 436L1214 446L1200 474L1160 480ZM1240 424L1282 436L1266 466L1236 462Z', '#a9a3bb') + line('M1200 474L1214 500M1266 466L1290 500M1160 480L1150 500', '#6e6982', 3));
  s += g('translate(1230 440)',
    shape('M-34 0L-24 -200H24L34 0Z', WHITE, SW, path('M-31 -30L-28 -70H28L31 -30Z', '#ff4d4d') + path('M-27 -110L-25 -150H25L27 -110Z', '#ff4d4d')) +
    shape('M-36 -200H36V-212H-36Z', '#4d4458', SW) + shape('M-22 -212H22V-252H-22Z', '#fff3b8', SW, line('M-8 -212V-252M8 -212V-252', INK, 1.6, op(0.5))) +
    path('M22 -244L170 -276L170 -196L22 -222Z', '#fff3b8', op(0.4)) + path('M-22 -244L-150 -280L-150 -204L-22 -222Z', '#fff3b8', op(0.3)) +
    shape('M-28 -252Q0 -290 28 -252Z', '#ff4d4d', SW) + ball(0, -282, 6, '#4d4458', '#2d2638', SW * 0.8) + shape(rrect(-10, -36, 20, 34, 8), WOOD_D, SW * 0.8));
  s += g('translate(1200 820)', path('M-70 0H70L56 26H-56Z', WHITE, stroke(SW)) + line('M-70 6H70', LAGOON, 5) + line('M0 0V-140', WOOD_D, 5) +
    path('M4 -134L66 -8H4Z', PINK, stroke(SW)) + path('M-4 -120L-56 -8H-4Z', MANGO, stroke(SW)));
  let planks2 = '';
  for (let x = 1070; x < X1; x += 26) planks2 += `M${x} 934V974`;
  for (let x = 1120; x < X1; x += 110) s += rect(x - 6, 966, 12, 34, 3, WOOD_D, stroke(SW));
  s += shape(`M1060 932H${X1}V976H1060Z`, WOOD, SW, line(planks2, darken(WOOD, 0.28), 2));
  s += fishingBoat(1360, 1050, true, '#2e8a8f');
  const buoy = (x, y, c) => ellipse(x, y + 12, 22, 7, WHITE, op(0.5)) + shape(`M${x - 14} ${y + 10}Q${x - 14} ${y - 20} ${x} ${y - 22}Q${x + 14} ${y - 20} ${x + 14} ${y + 10}Z`, c, SW, rect(x - 14, y - 8, 28, 8, 0, WHITE));
  s += buoy(150, 1060, '#ff4d4d') + buoy(-220, 620, MANGO) + buoy(1110, 640, '#ff4d4d') + buoy(1500, 300, MANGO);
  // on the quay: crates, barrels, a fish stall, an anchor with a coil of rope, containers
  const crate = (x, y, c) => shape(`M${x - 28} ${y}H${x + 28}V${y - 50}H${x - 28}Z`, c, SW, line(`M${x - 28} ${y - 50}L${x + 28} ${y}M${x - 28} ${y - 25}H${x + 28}`, darken(c, 0.3), 3));
  s += crate(310, 940, '#d9a35b') + crate(366, 940, '#c98c45') + crate(338, 890, '#d9a35b');
  const barrel = (x, y) => shape(`M${x - 22} ${y}Q${x - 28} ${y - 30} ${x - 22} ${y - 60}H${x + 22}Q${x + 28} ${y - 30} ${x + 22} ${y}Z`, '#b8743a', SW, line(`M${x - 25} ${y - 14}H${x + 25}M${x - 25} ${y - 46}H${x + 25}`, '#4d4458', 4));
  s += barrel(650, 1200) + barrel(700, 1210) + barrel(676, 1160);
  const fx = 850;
  const fb = 1110;
  let ice = '';
  for (let k = 0; k < 5; k++) ice += g(`translate(${fx - 64 + k * 32} ${fb - 52}) rotate(${k % 2 ? 12 : -12})`, shape('M-14 0Q0 -8 12 0Q0 8 -14 0ZM-14 0L-22 -6V6Z', k % 2 ? '#9fb7d0' : '#ff9c7a', SW * 0.6, circle(6, -1, 1.8, INK)));
  s += line(`M${fx - 90} ${fb}V${fb - 130}M${fx + 90} ${fb}V${fb - 130}`, '#5c4569', 6);
  s += shape(rrect(fx - 96, fb - 50, 192, 50, 6), '#7fd8d0', SW, rect(fx - 96, fb - 50, 192, 10, 0, WHITE)) + shape(`M${fx - 92} ${fb - 60}H${fx + 92}V${fb - 44}H${fx - 92}Z`, '#e8f6ff', SW * 0.8) + ice;
  let aw = '';
  for (let k = 0; k < 8; k++) aw += path(`M${fx - 104 + k * 26} ${fb - 132}h13v26q-6.5 9 -13 0Z`, WHITE);
  s += shape(`M${fx - 104} ${fb - 132}H${fx + 104}V${fb - 106}Q${fx + 97.5} ${fb - 97} ${fx + 91} ${fb - 106}Q${fx} ${fb - 97} ${fx - 104} ${fb - 106}Z`, LAGOON, SW, aw);
  s += g('translate(730 250)', line('M0 -60V40M-30 -40H30', INK, 14) + line('M0 -60V40M-30 -40H30', '#7a7088', 8) + path('M-50 10Q-46 50 0 54Q46 50 50 10', 'none', stroke(14, INK)) + path('M-50 10Q-46 50 0 54Q46 50 50 10', 'none', stroke(8, '#7a7088')) +
    circle(0, -70, 14, 'none', stroke(12, INK)) + circle(0, -70, 14, 'none', stroke(6, '#7a7088')) + path('M-62 0L-50 10L-44 -4M62 0L50 10L44 -4', 'none', stroke(5)));
  s += circle(830, 300, 30, 'none', stroke(16, INK)) + circle(830, 300, 30, 'none', stroke(11, '#e9d3a8')) + circle(830, 300, 14, 'none', stroke(10, INK)) + circle(830, 300, 14, 'none', stroke(5, '#e9d3a8'));
  const box = (x, y, w, c) => shape(`M${x} ${y}H${x + w}V${y - 62}H${x}Z`, c, SW, line(Array.from({ length: Math.floor(w / 18) }, (_, k) => `M${x + 10 + k * 18} ${y - 54}V${y - 8}`).join(''), darken(c, 0.25), 3));
  s += box(860, 214, 170, '#ff5d4d') + box(890, 152, 150, LAGOON) + box(1040, 214, 100, MANGO);
  // a gull on a bollard and more in the air
  s += g('translate(276 460)', shape('M-14 -8Q-4 -26 12 -16Q20 -10 16 -2H-14Z', WHITE, SW * 0.8) + path('M16 -14L28 -12L16 -8Z', MANGO, stroke(1.4)) + circle(8, -14, 2, INK) + line('M-12 -6Q0 -2 10 -6', '#9fb7d0', 3)) ;
  s += gull(-180, 520) + gull(-130, 548, 0.8) + gull(1180, 660) + gull(1440, 720, 0.8) + gull(90, 220, 0.9);
  // the first lanterns of the night market, strung along the top
  const cols = ['#ff4d4d', MANGO, PINK];
  for (let x = X0; x < X1; x += 420) s += line(`M${x + 10} 0V110`, '#5c4569', 7) + line(`M${x + 10} 0V110`, INK, 1.2, op(0.5)) + garland(x + 10, 16, x + 430, 16, 26, cols);
  return s;
}
// ---------------------------------------------------------------- night market (levels 51–60)
// A market stall: posts, a lit back, its goods on the counter, a striped front and a scalloped awning with bulbs.
function stall(x, base, w, c, goods, glow) {
  const L = x - w / 2;
  let s = ellipse(x, base - 90, w * 0.7, 130, glow);
  s += rect(L + 8, base - 176, 12, 176, 3, '#3b2a33', stroke(SW)) + rect(L + w - 20, base - 176, 12, 176, 3, '#3b2a33', stroke(SW));
  s += shape(`M${L + 20} ${base - 160}H${L + w - 20}V${base - 76}H${L + 20}Z`, '#4a3566', SW * 0.8, ellipse(x, base - 110, w * 0.32, 34, '#ffcf6b', op(0.25)));
  s += goods(x, base - 82);
  let front = '';
  for (let k = 0; k < w; k += 40) front += rect(L + k, base - 70, 20, 70, 0, lighten(c, 0.55));
  s += shape(rrect(L, base - 70, w, 70, 6), c, SW, front) + shape(rrect(L - 10, base - 84, w + 20, 16, 6), WOOD, SW, line(`M${L - 2} ${base - 79}H${L + w + 2}`, lighten(WOOD, 0.35), 3, op(0.7)));
  let aw = '';
  const n = Math.round((w + 28) / 28);
  const sw = (w + 28) / n;
  for (let k = 0; k < n; k += 2) aw += path(`M${f(L - 14 + k * sw)} ${base - 206}H${f(L - 14 + (k + 1) * sw)}V${base - 172}Q${f(L - 14 + (k + 0.5) * sw)} ${base - 160} ${f(L - 14 + k * sw)} ${base - 172}Z`, WHITE);
  let scallop = `M${L - 14} ${base - 206}H${L + w + 14}V${base - 172}`;
  for (let k = n; k > 0; k--) scallop += `Q${f(L - 14 + (k - 0.5) * sw)} ${base - 160} ${f(L - 14 + (k - 1) * sw)} ${base - 172}`;
  s += shape(`${scallop}Z`, c, SW, aw);
  let bulbs = '';
  for (let k = 0; k < 6; k++) {
    const bx = L + 10 + ((w - 20) * (k + 0.5)) / 6;
    bulbs += circle(bx, base - 150, 12, glow) + circle(bx, base - 150, 4.5, '#fff3b8', stroke(1.4));
  }
  return s + line(`M${L + 14} ${base - 154}Q${x} ${base - 140} ${L + w - 14} ${base - 154}`, INK, 1.6) + bulbs;
}

const GOODS = {
  fruit: (x, y) => {
    let s = '';
    const rng = rngFor(`fruit-${x}-${y}`);
    for (let i = 0; i < 9; i++) {
      const c = ['#ff9c3c', '#8fd16a', '#ff5fa2'][i % 3];
      s += ball(x - 70 + i * 17 + rng.next() * 4, y - 6 - (i % 2) * 10, 11, c, darken(c, 0.2), SW * 0.7, 0.5);
    }
    return s + shape(`M${x + 70} ${y}Q${x + 58} ${y - 18} ${x + 70} ${y - 36}Q${x + 82} ${y - 18} ${x + 70} ${y}Z`, '#f5c542', SW * 0.7) + path(`M${x + 70} ${y - 36}l-8 -16l8 6l4 -14l3 14l7 -6z`, '#4caf6a', stroke(1.6));
  },
  skewers: (x, y) => {
    let s = shape(rrect(x - 80, y - 20, 160, 22, 4), '#2b2633', SW * 0.8, line(`M${x - 74} ${y - 8}H${x + 74}`, '#ff6a2b', 3, op(0.8)));
    for (let k = 0; k < 6; k++) {
      const sx = x - 66 + k * 26;
      s += line(`M${sx} ${y - 20}L${sx + 6} ${y - 60}`, '#d9b38a', 3) + ball(sx + 2, y - 30, 7, '#c0622f', '#8a3d17', 1.6, 0.4) + ball(sx + 4, y - 44, 7, k % 2 ? '#8fd16a' : '#c0622f', '#5a3d1c', 1.6, 0.4);
    }
    return s + circle(x - 20, y - 86, 16, WHITE, op(0.25)) + circle(x + 10, y - 100, 20, WHITE, op(0.2)) + circle(x + 40, y - 120, 14, WHITE, op(0.15));
  },
  drinks: (x, y) => {
    let s = '';
    for (let k = 0; k < 5; k++) {
      const cx = x - 64 + k * 32;
      const c = ['#ff7eb6', '#7fd8d0', '#ffd36b', '#c5a2e8', '#9fe07a'][k];
      s += line(`M${cx + 4} ${y - 40}L${cx + 10} ${y - 58}`, PINK, 4) + shape(`M${cx - 11} ${y - 40}H${cx + 11}L${cx + 8} ${y}H${cx - 8}Z`, c, SW * 0.7, circle(cx - 3, y - 6, 2.4, '#3b2a33') + circle(cx + 3, y - 8, 2.4, '#3b2a33'));
    }
    return s;
  },
  sweets: (x, y) => {
    let s = '';
    for (let k = 0; k < 3; k++) {
      const cx = x - 60 + k * 38;
      const c = k % 2 ? '#9fe0ff' : '#ffb3d9';
      s += line(`M${cx} ${y}V${y - 30}`, '#e9d3a8', 3) + puffs([[cx - 9, y - 40, 11], [cx + 8, y - 42, 12], [cx, y - 54, 12]], c, SW * 0.7);
    }
    for (let k = 0; k < 3; k++) s += line(`M${x + 50 + k * 20} ${y - 10}V${y - 34}`, '#d9b38a', 3) + ball(x + 50 + k * 20, y - 10, 9, '#e8303f', '#a01622', SW * 0.7, 0.6);
    return s;
  },
  acai: (x, y) => {
    let s = '';
    for (let k = 0; k < 3; k++) {
      const bx = x - 60 + k * 60;
      s += path(`M${bx - 24} ${y - 22}A24 22 0 0 0 ${bx + 24} ${y - 22}Z`, WHITE, stroke(SW * 0.7)) + ellipse(bx, y - 24, 22, 7, '#5a1f73', stroke(SW * 0.6)) +
        circle(bx - 8, y - 28, 5, PINK, stroke(1.4)) + circle(bx + 6, y - 29, 5, MANGO, stroke(1.4)) + circle(bx, y - 26, 4, '#ffe066', stroke(1.4));
    }
    return s;
  },
};

// A firework burst: rays with sparks at their tips.
function firework(x, y, r, c) {
  let rays = '';
  let sparks = '';
  for (let k = 0; k < 14; k++) {
    const a = (k / 14) * Math.PI * 2;
    rays += `M${f(x + Math.cos(a) * r * 0.3)} ${f(y + Math.sin(a) * r * 0.3)}L${f(x + Math.cos(a) * r * 0.85)} ${f(y + Math.sin(a) * r * 0.85)}`;
    sparks += circle(x + Math.cos(a) * r, y + Math.sin(a) * r, 4, c);
  }
  return circle(x, y, r * 1.1, c, op(0.12)) + line(rays, c, 3.4) + sparks + sparkle(x, y, r * 0.22, WHITE);
}

function night(H) {
  const X0 = -MAP_BLEED;
  const X1 = MAP_W + MAP_BLEED;
  const sky = uid('sky');
  const glowId = uid('glow');
  const glow = `url(#${glowId})`;
  let s = `<defs><linearGradient id="${sky}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#120d30"/><stop offset="0.3" stop-color="#2a1e55"/><stop offset="1" stop-color="#43306a"/></linearGradient>` +
    `<radialGradient id="${glowId}"><stop offset="0" stop-color="#ffc86b" stop-opacity="0.5"/><stop offset="1" stop-color="#ffc86b" stop-opacity="0"/></radialGradient></defs>`;
  s += rect(X0, 0, FULL_W, H, 0, `url(#${sky})`);
  // paving under the market, stars and the moon over it
  let tiles = '';
  for (let y = 430; y < H; y += 48) tiles += `M${X0} ${y}H${X1}`;
  for (let y = 430; y < H; y += 48) for (let x = X0 + ((y / 48) % 2 ? 0 : 40); x < X1; x += 80) tiles += `M${x} ${y}v48`;
  s += line(tiles, '#55427f', 2, op(0.6));
  const rng = rngFor('map-night');
  for (let i = 0; i < 70; i++) {
    const x = X0 + rng.next() * FULL_W;
    const y = 10 + rng.next() * 380;
    s += i % 5 ? circle(x, y, 1.6 + rng.next() * 1.6, '#fff3b8', op(0.5 + rng.next() * 0.5)) : sparkle(x, y, 7, '#fff3b8');
  }
  s += circle(470, 70, 40, '#fff3b8', op(0.18)) + path('M470 40A30 30 0 1 0 500 82A24 24 0 1 1 470 40Z', '#fff3b8', stroke(SW));
  // the finale: fireworks over the last level
  s += firework(620, 110, 66, PINK) + firework(1010, 70, 54, '#9fe0ff') + firework(1380, 140, 70, MANGO) + firework(-120, 90, 60, '#9fe07a');
  // the ferris wheel at the top left
  const wx = 190;
  const wy = 250;
  const R = 170;
  s += line(`M${wx} ${wy}L${wx - 120} ${wy + 230}M${wx} ${wy}L${wx + 120} ${wy + 230}`, INK, 16) + line(`M${wx} ${wy}L${wx - 120} ${wy + 230}M${wx} ${wy}L${wx + 120} ${wy + 230}`, '#7a6a9a', 10);
  let spokes = '';
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2;
    spokes += `M${wx} ${wy}L${f(wx + Math.cos(a) * R)} ${f(wy + Math.sin(a) * R)}`;
  }
  s += line(spokes, '#b9a6e0', 3) + circle(wx, wy, R, 'none', stroke(14, INK)) + circle(wx, wy, R, 'none', stroke(8, PINK)) + circle(wx, wy, R * 0.55, 'none', stroke(5, '#b9a6e0'));
  for (let k = 0; k < 24; k++) {
    const a = (k / 24) * Math.PI * 2;
    s += circle(wx + Math.cos(a) * R, wy + Math.sin(a) * R, 3.4, '#fff3b8');
  }
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2 + 0.2;
    const gx = wx + Math.cos(a) * R;
    const gy = wy + Math.sin(a) * R;
    const c = [MANGO, LAGOON, '#ff7eb6', '#9fe07a'][k % 4];
    s += line(`M${f(gx)} ${f(gy)}V${f(gy + 14)}`, INK, 2.4) + shape(rrect(gx - 20, gy + 12, 40, 30, 10), c, SW * 0.8, rect(gx - 13, gy + 17, 26, 10, 3, '#fff3b8', op(0.85)));
  }
  s += ball(wx, wy, 16, '#7a6a9a', '#4d4070', SW) + shape(rrect(wx - 150, wy + 226, 300, 22, 6), '#5c4569', SW);
  // stalls on both sides of the lane, the açaí bar at the top as the finale
  s += stall(150, 1290, 240, '#ff5d4d', GOODS.fruit, glow) + stall(140, 1050, 220, LAGOON, GOODS.drinks, glow) + stall(160, 650, 240, '#9b6bd6', GOODS.sweets, glow) + stall(-210, 860, 240, MANGO, GOODS.skewers, glow);
  s += stall(1120, 1180, 230, MANGO, GOODS.skewers, glow) + stall(1060, 860, 240, PINK, GOODS.fruit, glow) + stall(1120, 580, 220, '#2e8a8f', GOODS.drinks, glow) + stall(1480, 980, 240, '#ff5d4d', GOODS.sweets, glow);
  s += stall(1140, 350, 240, '#6c2a8f', GOODS.acai, glow);
  s += ellipse(1140, 110, 130, 70, glow) + shape(rrect(1060, 88, 160, 50, 12), '#32283a', SW) + `<text x="1140" y="124" text-anchor="middle" font-family="${FONT}" font-size="34" fill="#ff7eb6" stroke="#ff3d8b" stroke-width="1">Açaí</text>`;
  s += line('M1080 138V146M1200 138V146', INK, 3);
  // lantern strings between poles beside the lane
  const cols = ['#ff4d4d', MANGO, PINK, '#9fe0ff'];
  const pole = (x, y) => line(`M${x} ${y}V${y + 150}`, '#5c4569', 7) + line(`M${x} ${y}V${y + 150}`, INK, 1.2, op(0.5)) + circle(x, y, 6, '#5c4569', stroke(SW * 0.6));
  s += pole(-330, 400) + pole(20, 400) + garland(-330, 404, 20, 404, 30, cols, 70, glow);
  s += pole(1250, 680) + pole(1620, 690) + garland(1250, 684, 1620, 694, 30, cols, 70, glow);
  s += pole(-330, 1120) + pole(0, 1130) + garland(-330, 1124, 0, 1134, 30, cols, 70, glow);
  // the gate wall along the bottom (from the harbour)
  let bricks = '';
  for (let y = H - 56; y < H; y += 18) for (let x = X0 + ((y - H) % 36 ? 0 : 20); x < X1; x += 40) bricks += `M${x} ${y}v18`;
  for (let y = H - 56; y < H; y += 18) bricks += `M${X0} ${y}H${X1}`;
  s += shape(`M${X0} ${H - 60}H${X1}V${H + 2}H${X0}Z`, '#7a2e4a', SW, line(bricks, '#5a1f36', 2));
  s += shape(`M${X0} ${H - 70}H${X1}V${H - 56}H${X0}Z`, '#9b4566', SW);
  for (let x = X0 + 60; x < X1; x += 240) s += line(`M${x} ${H - 70}V${H - 118}`, '#3b2a33', 4) + lantern(x, H - 112, x % 480 ? '#ff4d4d' : MANGO, 16, glow);
  return s;
}

const DRAW = { beach, town, forest, tea, harbor, night };

export function mapRegionSVG(id) {
  const r = MAP_REGIONS.find((x) => x.id === id);
  const H = r.bottom - r.top;
  return svgWrap(FULL_W, H, FULL_W, H, g(`translate(${MAP_BLEED} 0)`, DRAW[id](H)));
}

export function mapBackgroundSVG(width = FULL_W / 2) {
  let s = '';
  for (const r of MAP_REGIONS) s += g(`translate(${MAP_BLEED} ${r.top})`, DRAW[r.id](r.bottom - r.top));
  return svgWrap(width, (width * MAP_H) / FULL_W, FULL_W, MAP_H, s);
}
