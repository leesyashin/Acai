// Level map art (cartoon style, thick ink outlines, light from the top left): a tall map the player scrolls up,
// in three regions – the beach at the bottom (levels 1–7), the town promenade (8–14), the rainforest where açaí
// grows (15–20). Pure module: every export returns markup strings or numbers.
//   MAP_W, MAP_H, MAP_BLEED     the map is MAP_W wide plus MAP_BLEED on either side (art for wider screens)
//   mapLevelPos(i)              centre of level node i (0-based) in map px (x as on the stage)
//   MAP_REGIONS                 [{ id, first, last, top, bottom }] from the bottom up, in map px
//   mapRegionSVG(id)            one region's picture (MAP_W + 2·MAP_BLEED wide, its region's height)
//   mapRoadData(count)          the road through the first `count` nodes (from the bottom edge), an SVG path
//   mapBackgroundSVG()          all three regions in one picture (art preview)

import {
  INK, WHITE, PINK, LAGOON, MANGO, CREAM, WOOD, WOOD_D, FONT, f, uid, rngFor, lighten, darken, svgWrap, stroke, op, circle,
  ellipse, path, rect, g, line, tube, shape, rrect, ball, bigLeaf, starPoints, polyPath, puffs, frond,
} from './svg.js';

export const MAP_W = 1280;
export const MAP_BLEED = 360;
const FULL_W = MAP_W + 2 * MAP_BLEED;
const SW = 3;

const LEVEL_COUNT = 20;
const SPACING = 124; // vertical distance between two nodes
const BOTTOM = 170; // level 1 above the map's bottom edge
const TOP = 190; // level 20 below the top edge (the header lies over the top)
export const MAP_H = TOP + (LEVEL_COUNT - 1) * SPACING + BOTTOM;

export function mapLevelPos(i) {
  return { x: Math.round(640 + 280 * Math.sin(0.9 * i - 0.3)), y: MAP_H - BOTTOM - i * SPACING };
}

const between = (a, b) => Math.round((mapLevelPos(a).y + mapLevelPos(b).y) / 2);
export const MAP_REGIONS = [
  { id: 'beach', first: 1, last: 7, top: between(6, 7), bottom: MAP_H },
  { id: 'town', first: 8, last: 14, top: between(13, 14), bottom: between(6, 7) },
  { id: 'forest', first: 15, last: 20, top: 0, bottom: between(13, 14) },
];

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

// ---------------------------------------------------------------- beach (levels 1–7)
function beach(H) {
  const X0 = -MAP_BLEED;
  const X1 = MAP_W + MAP_BLEED;
  const sea = uid('sea');
  let s = `<defs><linearGradient id="${sea}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#119ac0"/><stop offset="1" stop-color="#5fe0e0"/></linearGradient></defs>`;
  s += rect(X0, 0, FULL_W, H, 0, '#ffe2a6');
  // soft sand patches and grains
  const rng = rngFor('map-beach');
  for (let i = 0; i < 16; i++) s += ellipse(X0 + rng.next() * FULL_W, 140 + rng.next() * (H - 160), 90 + rng.next() * 120, 18 + rng.next() * 14, '#fbd590', op(0.5));
  let grains = '';
  for (let i = 0; i < 220; i++) grains += `M${f(X0 + rng.next() * FULL_W)} ${f(130 + rng.next() * (H - 140))}h0.01`;
  s += line(grains, '#e9c27a', 3.2, op(0.7));
  // the sea along the left: its shore swings out at the bottom
  const shore = (y) => 120 + 70 * Math.sin(y / 120) + Math.max(0, y - 420) * 0.32;
  let edge = `M${X0} 260L${f(shore(260) - 200)} 260`;
  for (let y = 270; y <= H + 20; y += 20) edge += `L${f(shore(y))} ${y}`;
  const seaD = `${edge}L${X0} ${H + 20}Z`;
  s += path(seaD, `url(#${sea})`);
  let foam = `M${f(shore(260) - 200)} 260`;
  for (let y = 270; y <= H + 20; y += 20) foam += `L${f(shore(y) + 6)} ${y}`;
  s += line(foam, WHITE, 14, op(0.85)) + line(foam, INK, 2, op(0.25));
  let waves = '';
  for (let i = 0; i < 30; i++) {
    const y = 300 + rng.next() * (H - 320);
    const x = X0 + 20 + rng.next() * (shore(y) - X0 - 60);
    waves += `M${f(x)} ${f(y)}q10 -7 20 0`;
  }
  s += line(waves, WHITE, 2.5, op(0.65));
  // sailboat and a little island far out
  s += g('translate(-210 420)', path('M0 46H60L50 60H10Z', WHITE, stroke(SW)) + path('M30 44V0L64 44Z', PINK, stroke(SW)) + path('M28 44V10L4 44Z', MANGO, stroke(SW)));
  s += path('M-330 760Q-250 712 -170 760Z', '#ffe2a6', stroke(SW)) + palmTree(-250, 752, 50, 10, 2.2, 36);
  // the promenade boardwalk across the top (to the town)
  let boards = '';
  for (let x = X0; x < X1; x += 46) boards += line(`M${x} 8V96`, darken(WOOD, 0.28), 2);
  s += shape(`M${X0} 6H${X1}V98H${X0}Z`, WOOD, SW, boards + line(`M${X0} 16H${X1}`, lighten(WOOD, 0.3), 3, op(0.6)));
  for (let x = X0 + 40; x < X1; x += 200) s += rect(x - 6, 92, 12, 30, 3, WOOD_D, stroke(SW));
  let rope = `M${X0 + 34} 118`;
  for (let x = X0 + 40; x < X1; x += 200) rope += `Q${x + 100} 136 ${x + 200} 118`;
  s += line(rope, '#e9d3a8', 3.5) + line(rope, INK, 1, op(0.4));
  // umbrella and towel on the sand by the water
  const canopy = 'M-72 0A72 40 0 0 1 72 0Q54 11 36 0Q18 11 0 0Q-18 11 -36 0Q-54 11 -72 0Z';
  const stripes = path('M0 -40A72 40 0 0 0 -72 0Q-54 11 -36 0Q-18 -22 0 -40Z', PINK) + path('M0 -40Q4 -20 0 0Q18 11 36 0Q18 -22 0 -40Z', PINK);
  s += g('translate(250 300) rotate(-10) scale(0.8)', line('M0 -36V112', '#9aa7b6', 5) + shape(canopy, CREAM, SW, stripes) + circle(0, -42, 4, PINK, stroke(SW * 0.8)));
  s += g('rotate(-8 270 380)', shape(rrect(210, 352, 120, 56, 8), LAGOON, SW, line('M230 352V408M250 352V408', WHITE, 6, op(0.8))));
  // lifeguard tower on the right
  s += g('translate(1110 0)',
    line('M-40 520L-24 380M40 520L24 380M-36 470H36M-30 430H30', WOOD_D, 7) + line('M-40 520L-24 380M40 520L24 380', INK, 1.2, op(0.5)) +
    shape('M-46 380H46V330H-46Z', '#ff4d4d', SW, rect(-46, 344, 92, 12, 0, WHITE)) +
    shape('M-56 332L0 290L56 332Z', '#ffd36b', SW) + rect(-26, 352, 52, 22, 3, '#bfeef0', stroke(SW * 0.8)) +
    shape('M-6 290V250L30 262L-6 274', PINK, SW * 0.8));
  // surfboards in the sand, a sandcastle, beach ball, starfish and shells
  s += g('rotate(-12 1230 640)', shape('M1214 700Q1206 610 1230 560Q1254 610 1246 700Z', MANGO, SW, line('M1230 566V700', WHITE, 4, op(0.8))));
  s += g('rotate(8 1290 650)', shape('M1274 706Q1266 616 1290 566Q1314 616 1306 706Z', LAGOON, SW, line('M1290 572V706', PINK, 5)));
  s += g('translate(1040 820)', shape('M-50 0V-36H-38V-28H-26V-36H-14V0Z', '#f3c97a', SW) + shape('M-14 0V-56H-2V-48H10V-56H22V0Z', '#f3c97a', SW) + shape('M22 0V-30H50V0Z', '#f3c97a', SW) + tube('M4 -56V-80', INK, 1, 1) + path('M4 -80L22 -74L4 -68Z', PINK, stroke(SW * 0.7)));
  s += ball(1050, 230, 22, WHITE, '#d9d2e0', SW) + path('M1050 208A22 22 0 0 1 1072 230H1050Z', PINK) + path('M1050 252A22 22 0 0 1 1028 230H1050Z', LAGOON) + circle(1050, 230, 22, 'none', stroke(SW));
  const starfish = (x, y, k, deg) => g(`translate(${x} ${y}) rotate(${deg}) scale(${k})`, path(polyPath(starPoints(0, 0, 16, 7)), '#ff8a5c', stroke(SW / k)) + circle(0, 0, 2, '#ffd0b8'));
  s += starfish(1180, 860, 1, 12) + starfish(330, 560, 0.8, -20) + starfish(1000, 520, 0.7, 30);
  const shell = (x, y, deg) => g(`translate(${x} ${y}) rotate(${deg})`, path('M0 10L-12 -2Q0 -16 12 -2Z', '#ffd6e6', stroke(2.4)) + line('M0 10L-6 -6M0 10V-9M0 10L6 -6', '#e8a0bd', 1.6));
  s += shell(420, 880, -10) + shell(1210, 300, 15) + shell(180, 520, 0);
  // palms
  s += palmTree(1230, 470, 300, -60, SW, 104) + palmTree(1440, 760, 330, -50, SW, 110) + palmTree(1580, 400, 260, -40, SW, 96);
  s += palmTree(150, 250, 220, 50, SW, 90);
  return s;
}

// ---------------------------------------------------------------- town promenade (levels 8–14)
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
  const left = [[-340, 300, 200, 220, '#ffb3c7', '#8e4f22'], [-120, 330, 190, 250, '#a8e6cf', '#c0607f', 'Açaí'], [-330, 600, 210, 230, '#ffe08a', '#6c2a8f'], [-110, 640, 200, 200, '#cdb4f0', '#8e4f22'], [-320, 880, 200, 210, '#ffcf9e', '#2e8a8f'], [-100, 900, 190, 240, '#ffb3c7', '#6c2a8f']];
  const right = [[1110, 330, 190, 240, '#cdb4f0', '#c0607f'], [1320, 300, 210, 220, '#a8e6cf', '#8e4f22'], [1100, 630, 200, 220, '#ffe08a', '#2e8a8f', 'Matcha'], [1320, 600, 200, 250, '#ffb3c7', '#6c2a8f'], [1110, 900, 200, 210, '#ffcf9e', '#c0607f'], [1330, 880, 190, 230, '#cdb4f0', '#8e4f22']];
  for (const [x, base, w, h, wall, roof, sign] of [...left, ...right].sort((a, b) => a[1] - b[1])) {
    if (base - h > H) continue;
    s += house(x, base, w, h, wall, roof, sign);
  }
  // lamps and palms in planters by the road
  for (const [x, base] of [[160, 300], [160, 640], [1070, 470], [1070, 820], [160, 860]]) s += lamp(x, base);
  const planter = (x, base) => palmTree(x, base - 26, 150, 14, SW, 70) + shape(rrect(x - 30, base - 30, 60, 34, 6), '#c4a27b', SW, line(`M${x - 30} ${base - 20}H${x + 30}`, '#987650', 2));
  s += planter(250, 520) + planter(1010, 260) + planter(1000, 680);
  // fountain on the open square right of the road's bend
  const fx = 780;
  const fy = 210;
  s += ellipse(fx, fy + 24, 96, 30, '#c9c2d6', stroke(SW)) + ellipse(fx, fy + 18, 80, 22, '#5fd3e0', stroke(SW)) + ellipse(fx, fy + 14, 60, 12, '#9ef0f2', op(0.7));
  s += shape(`M${fx - 12} ${fy + 14}V${fy - 30}H${fx + 12}V${fy + 14}Z`, '#e8e1ef', SW) + ellipse(fx, fy - 30, 34, 10, '#c9c2d6', stroke(SW));
  s += line(`M${fx} ${fy - 40}Q${fx - 30} ${fy - 80} ${fx - 46} ${fy + 4}M${fx} ${fy - 40}Q${fx + 30} ${fy - 80} ${fx + 46} ${fy + 4}M${fx} ${fy - 40}V${fy - 84}`, '#9ef0f2', 6) + line(`M${fx} ${fy - 40}Q${fx - 30} ${fy - 80} ${fx - 46} ${fy + 4}M${fx} ${fy - 40}Q${fx + 30} ${fy - 80} ${fx + 46} ${fy + 4}`, WHITE, 2, op(0.8));
  // an ice-cream cart on the left of the road
  s += g('translate(470 590)',
    shape(rrect(-60, -40, 120, 56, 10), CREAM, SW, rect(-60, -18, 120, 10, 0, PINK)) +
    ball(-36, 24, 14, '#3b2a33', '#1a141f', SW) + ball(36, 24, 14, '#3b2a33', '#1a141f', SW) +
    line('M-50 -40V-96M50 -40V-96', '#9aa7b6', 4) + shape('M-74 -94Q0 -138 74 -94Z', LAGOON, SW, path('M-24 -94Q0 -128 24 -94Z', WHITE)) +
    circle(-14, -52, 11, '#ffb3c7', stroke(SW * 0.7)) + circle(6, -56, 11, '#a8e6cf', stroke(SW * 0.7)) + circle(24, -50, 10, '#ffe08a', stroke(SW * 0.7)));
  // flower beds
  for (const [x, y] of [[300, 780], [970, 110], [520, 140]]) {
    s += ellipse(x, y, 60, 18, '#4caf6a', stroke(SW));
    s += flower(x - 30, y - 8, 10, PINK) + flower(x, y - 12, 10, MANGO) + flower(x + 30, y - 6, 10, '#c5a2e8');
  }
  return s;
}

// ---------------------------------------------------------------- rainforest (levels 15–20)
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
  s += acaiPalm(1150, 560, 300, -30) + acaiPalm(1350, 460, 340, -20) + acaiPalm(1560, 640, 360, -40) + acaiPalm(1120, 860, 250, -20);
  s += leafs(-320, 860, 1.2, false) + leafs(40, 300, 0.9, false) + leafs(1600, 860, 1.2, true) + leafs(1250, 300, 0.9, true) + leafs(-200, 300, 1, false);
  for (const [x, y, c] of [[230, 640, PINK], [1010, 640, '#ff8a5c'], [260, 240, MANGO], [980, 330, PINK], [1240, 720, '#c5a2e8'], [60, 780, PINK]]) s += flower(x, y, 13, c);
  // a toucan on a branch at the right
  s += g('translate(1240 220)',
    line('M-80 30Q0 10 80 26', '#6e5238', 9) + line('M-80 30Q0 10 80 26', INK, 1.4, op(0.5)) +
    shape('M-10 26Q-30 -10 -6 -36Q14 -40 18 -14Q22 10 10 26Z', '#1d1d22', SW) + shape('M-2 -26Q4 -12 16 -10Q20 -26 10 -34Z', WHITE, SW * 0.8) +
    shape('M12 -30Q46 -34 58 -18Q40 -14 14 -18Z', MANGO, SW * 0.8, path('M40 -24Q52 -24 58 -18Q48 -18 40 -20Z', '#ff4d4d')) + circle(4, -26, 2.6, INK));
  // butterflies
  const fly = (x, y, c) => g(`translate(${x} ${y})`, ellipse(-7, -4, 8, 6, c, stroke(SW * 0.6)) + ellipse(7, -4, 8, 6, c, stroke(SW * 0.6)) + ellipse(-5, 5, 5, 4, c, stroke(SW * 0.6)) + ellipse(5, 5, 5, 4, c, stroke(SW * 0.6)) + line('M0 -8V8', INK, 2));
  s += fly(330, 380, '#ffb3c7') + fly(940, 540, '#9fe0ff') + fly(560, 220, MANGO);
  return s;
}

const DRAW = { beach, town, forest };

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
