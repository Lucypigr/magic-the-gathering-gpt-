// Diagnostic runner: Oracle assertions and execution probes have separate results.
// Expected rules come from the preserved source catalog, never from the effect DSL.
import { CARDS, slug } from '../src/data';
import { traditionalRulesText } from '../src/data/localization';
import { createGame, newCard, stats, isCreature, GameOver } from '../src/engine/state';
import { colorsOf } from '../src/engine/mana';
import { enterBattlefield, moveCard, emit, sacrifice, dealDamage } from '../src/engine/zones';
import { castOptionsFor, performAction, abilitiesFor, canActivate, castTargetSpecs, modeCount, castDef, sacChoices, spellCost, frontierStackChoices } from '../src/engine/actions';
import { legalTargets, validateTargets, sameTarget } from '../src/engine/targets';
import { settle, resolveTop } from '../src/engine/flow';
import { runEffects } from '../src/engine/effects';
import type { Card, CardDef, Decision, Response, GameState, Keyword, TargetRef, TargetSpec, PID, Zone, PriorityAction } from '../src/engine/types';

export type SourceRow = Partial<CardDef> & { name: string; text: string; set: string; number: number; [key: string]: unknown };
export interface Check { name: string; status: 'pass' | 'fail' | 'blocked'; detail?: string }
export interface CardResult {
  set: string; number: number; name: string; face: string; definition: string;
  data: Check[]; rules: Check[]; execution: Check[]; remainingRules: string[];
}
const intrinsic: Record<string, Keyword> = { flying: 'flying', reach: 'reach', 'first strike': 'first_strike', 'double strike': 'double_strike', deathtouch: 'deathtouch', trample: 'trample', lifelink: 'lifelink', vigilance: 'vigilance', haste: 'haste', menace: 'menace', defender: 'defender', indestructible: 'indestructible', hexproof: 'hexproof', flash: 'flash', prowess: 'prowess' };
const shortError = (e: unknown) => e instanceof RangeError ? e.stack?.split('\n').slice(0, 9).join('\n') ?? e.message : e instanceof Error ? e.message : String(e);
const ensure = (ok: unknown, text: string) => { if (!ok) throw new Error(text); };
function check(out: Check[], name: string, f: () => void) { try { f(); out.push({ name, status: 'pass' }); } catch (e) { out.push({ name, status: 'fail', detail: shortError(e) }); } }
const clean = (s: string) => s.replace(/\([^()]*\)/g, '').replace(/[ \t]+/g, ' ').trim();
const normalize = (v: unknown) => JSON.stringify(Array.isArray(v) ? [...v].sort() : v);

// Deliberately inert test pieces: no incidental ETB/static abilities to mask a bug.
const piece = (name: string, types: CardDef['types'], p = 2, t = 2): CardDef => ({ id: 'audit-' + slug(name), name, set: 'TOK', rarity: 'T', cost: '{2}', types, subtypes: types.includes('Creature') ? ['Human', 'Spider', 'Elf', 'Dwarf', 'Ally', 'Wizard', 'Goblin', 'Wolf', 'Bear', 'Villain', 'Hero', 'Dragon'] : [], colors: [], power: p, toughness: t, text: '' });
function add(g: GameState, d: CardDef, p: PID, zone: Zone): Card {
  const c = newCard(g, d, p); c.zone = zone;
  if (zone === 'battlefield') { g.battlefield.push(c.id); c.sick = false; }
  else if (zone !== 'stack') g.players[p][zone].push(c.id);
  return c;
}
export function fixture(def: CardDef, rich = true) {
  const deck = Array(45).fill('plains');
  const g = createGame({ name: 'A', deckName: '', deck, isAI: true }, { name: 'B', deckName: '', deck, isAI: true }, 491);
  g.turn = 10; g.active = 0; g.phase = 'main1';
  for (const p of g.players) { p.life = 40; p.pool = Array.from({ length: 20 }, () => ['W', 'U', 'B', 'R', 'G', 'C'] as const).flat(); }
  const own = add(g, piece('Own creature', ['Creature']), 0, 'battlefield');
  const enemy = add(g, piece('Enemy creature', ['Creature'], 4, 4), 1, 'battlefield');
  const land = add(g, { ...piece('Own land', ['Land']), cost: '', subtypes: ['Forest'], produces: ['G'] }, 0, 'battlefield');
  if (rich) for (const p of [0, 1] as PID[]) {
    add(g, piece('Artifact ' + p, ['Artifact']), p, 'battlefield');
    add(g, piece('Enchantment ' + p, ['Enchantment']), p, 'battlefield');
    add(g, piece('Grave creature ' + p, ['Creature']), p, 'graveyard');
    add(g, piece('Grave artifact ' + p, ['Artifact']), p, 'graveyard');
    add(g, piece('Hand creature ' + p, ['Creature']), p, 'hand');
    add(g, piece('Hand instant ' + p, ['Instant']), p, 'hand');
  }
  const source = add(g, def, 0, 'hand');
  return { g, source, own, enemy, land };
}

function targets(g: GameState, specs: TargetSpec[], p: PID, source: number): (TargetRef | null)[] | null {
  let attempts = 0;
  const walk = (i: number, chosen: (TargetRef | null)[]): (TargetRef | null)[] | null => {
    if (++attempts > 400) return null;
    if (i === specs.length) return validateTargets(g, specs, chosen, p, source) ? null : chosen;
    const candidates: (TargetRef | null)[] = [...legalTargets(g, specs[i], p, source), ...(specs[i].optional ? [null] : [])];
    for (const candidate of candidates) {
      if (candidate && !specs[i].allowRepeat && chosen.some((x, j) => sameTarget(x, candidate) && specs[j].kind === specs[i].kind)) continue;
      const result = walk(i + 1, [...chosen, candidate]); if (result) return result;
    }
    return null;
  };
  return walk(0, []);
}
function answer(g: GameState, d: Decision): Response {
  if (d.type === 'targets') return { type: 'targets', targets: targets(g, d.specs, d.player, d.source) ?? d.specs.map(() => null) };
  if (d.type === 'choose') return { type: 'choose', ids: d.options.slice(0, d.min) };
  if (d.type === 'mode') {
    const indices = d.options.map((_, i) => i);
    if (d.meta) indices.sort((a, b) => Number(!targets(g, d.meta!.specs[a] ?? [], d.player, d.source ?? -1)) - Number(!targets(g, d.meta!.specs[b] ?? [], d.player, d.source ?? -1)));
    return { type: 'modes', picks: indices.slice(0, d.count) };
  }
  if (d.type === 'yesno') return { type: 'yesno', yes: true };
  return { type: 'pass' };
}
function drive(g: GameState, gen: Generator<Decision, unknown, Response>) {
  let r = gen.next(); let n = 0;
  while (!r.done) { ensure(++n <= 250, 'decision loop exceeded 250 choices'); r = gen.next(answer(g, r.value)); }
}
function finish(g: GameState) {
  try {
    for (let i = 0; i < 100; i++) {
      drive(g, settle(g));
      if (!g.stack.length) return;
      drive(g, resolveTop(g));
    }
    throw new Error('stack did not settle within 100 resolutions');
  } catch (e) { if (!(e instanceof GameOver)) throw e; }
}
function invariant(g: GameState) {
  for (const p of g.players) ensure(Number.isFinite(p.life), 'non-finite life');
  const seen = new Set<number>();
  const visit = (id: number, zone: Zone) => { const c = g.cards[id]; ensure(c, 'missing card ' + id); ensure(c.zone === zone, c.def.name + ': zone list ' + zone + ' disagrees with ' + c.zone); ensure(!seen.has(id), c.def.name + ': duplicate zone membership'); seen.add(id); };
  for (const id of g.battlefield) { visit(id, 'battlefield'); const s = stats(g, g.cards[id]); ensure(Number.isFinite(s.p) && Number.isFinite(s.t), 'non-finite stats'); }
  for (const p of g.players) for (const zone of ['library', 'hand', 'graveyard', 'exile', 'outside'] as const) for (const id of p[zone]) visit(id, zone);
}

function enrich(f: ReturnType<typeof fixture>) {
  for (const p of [0, 1] as PID[]) {
    for (let i = 0; i < 3; i++) {
      const c = add(f.g, { ...piece('Additional creature ' + p + '-' + i, ['Creature'], 3 + i, 3 + i), colors: ['W', 'U', 'B', 'R', 'G'], cost: '{4}' }, p, 'battlefield');
      c.tapped = true; c.attacking = true; c.damage = 1; c.token = i === 0;
    }
    add(f.g, { ...piece('Additional land ' + p, ['Land']), cost: '', subtypes: ['Island'] }, p, 'battlefield');
    add(f.g, { ...piece('Equipment ' + p, ['Artifact']), subtypes: ['Equipment'], equip: { cost: '{2}', grant: { p: 1 } } }, p, 'battlefield');
    add(f.g, piece('Grave instant ' + p, ['Instant']), p, 'graveyard');
    const evidence = add(f.g, { ...piece('Evidence ' + p, ['Enchantment']), cost: '{20}' }, p, 'hand');
    moveCard(f.g, evidence, 'graveyard');
    if (p === 0) dealDamage(f.g, f.own, 0, { p: 1 }, 1);
  }
}

function cast(f: ReturnType<typeof fixture>, forced?: TargetRef[], mode?: number) {
  const { g, source } = f;
  const options = castOptionsFor(g, 0, source).filter(o => o.alt === undefined && (mode === undefined || o.mode === mode));
  const option = options[0];
  ensure(option, 'no normal cast/play option in fixture');
  const chosen = forced ?? targets(g, option.specs, 0, source.id);
  ensure(chosen, 'no jointly legal targets in fixture');
  const sacrifice = option.sacFilter ? sacChoices(g, 0, option.sacFilter, source.id)[0] : undefined;
  const total = typeof source.def.frontier?.distribute === 'number' ? source.def.frontier.distribute : source.def.frontier?.distribute === 'X' ? (option.maxX ? 1 : 0) : undefined;
  const selected = chosen!.filter(Boolean);
  const distribution = total !== undefined ? selected.map((_, i) => i === 0 ? total - selected.length + 1 : 1) : undefined;
  const kinds = source.def.spell?.modes?.[option.mode ?? 0]?.frontierStackTargets ?? (source.def.frontierStack ? [source.def.frontierStack] : []);
  const stackTargetSids = kinds.map(k => frontierStackChoices(g, 0, k)[0]?.sid).filter((x): x is number => x !== undefined);
  const stackTargetSid = source.def.fin?.stackTarget ? g.stack.find(s => s.kind !== 'spell' || !g.cards[s.cardId].def.types.includes('Creature'))?.sid : stackTargetSids[0];
  const error = performAction(g, 0, option.kind === 'play' ? { type: 'play', card: source.id } : { type: 'cast', card: source.id, mode: option.mode, targets: chosen!, sac: sacrifice, stackTargetSid, stackTargetSids, evidenceCards: g.players[0].graveyard, distribution, discard: g.players[0].hand.find(id => id !== source.id), x: option.maxX ? 1 : undefined });
  ensure(error === null, 'cast rejected: ' + error); finish(g); return option;
}

/** Small, strict grammar: anything not recognized stays explicitly unverified. */
export function ruleChecks(row: SourceRow, def: CardDef): { checks: Check[]; remaining: string[] } {
  const checks: Check[] = [], remaining: string[] = [];
  const lines = row.text.split('\n').map(clean).filter(Boolean);
  const substantive: string[] = [];
  for (const line of lines) {
    const words = line.toLowerCase().replace(/\.$/, '').split(/,\s*/);
    if (words.every(w => intrinsic[w])) {
      for (const word of words) check(checks, 'keyword: ' + word, () => {
        const f = fixture(def, false); enterBattlefield(f.g, f.source, 0); finish(f.g);
        const st = stats(f.g, f.source); ensure(st.kw.has(intrinsic[word]), 'missing printed keyword ' + word); if (word === 'prowess') ensure(st.prowessCount === words.filter(w => w === 'prowess').length, 'incorrect prowess multiplicity');
      });
    } else substantive.push(line);
  }
  if (!substantive.length && lines.some(line => /prowess/i.test(line))) check(checks, 'Oracle: prowess grants exactly its printed number of boosts', () => {
    const f = fixture(def); enterBattlefield(f.g, f.source, 0); finish(f.g);
    const before = stats(f.g, f.source), spell = f.g.players[0].hand.map(id => f.g.cards[id]).find(c => c.def.types.includes('Instant'))!;
    ensure(!performAction(f.g, 0, { type: 'cast', card: spell.id, targets: [] }), 'probe instant could not be cast'); finish(f.g);
    const after = stats(f.g, f.source), n = lines.join(',').toLowerCase().split(/,\s*/).filter(w => w === 'prowess').length;
    ensure(after.p === before.p + n && after.t === before.t + n, 'prowess boosted ' + (after.p - before.p) + '/' + (after.t - before.t) + ' instead of ' + n + '/' + n);
  });
  const text = substantive.join('\n');
  let matched = false;
  const words: Record<string, number> = { a: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7 };
  const count = (s: string) => words[s.toLowerCase()] ?? Number(s);
  let m: RegExpMatchArray | null;
  if (!text) {
    matched = true;
    if (!lines.length) check(checks, 'printed vanilla has no extra spell/activated/triggered ability', () => ensure(!(def.abilities ?? []).some(a => a.kind !== 'static') && !def.spell, 'unprinted triggered/activated/spell effect'));
  } else if ((m = text.match(/^Draw (a|one|two|three|four|five|six|seven|\d+) cards?\.$/i))) {
    matched = true; const n = count(m[1]);
    check(checks, 'Oracle: draw ' + n, () => { const f = fixture(def); const hand = f.g.players[0].hand.length; cast(f); ensure(f.g.players[0].hand.length === hand - 1 + n, 'incorrect number of cards drawn'); });
  } else if ((m = text.match(/^You gain (\d+) life\.$/))) {
    matched = true; const n = Number(m[1]);
    check(checks, 'Oracle: gain ' + n + ' life', () => { const f = fixture(def); cast(f); ensure(f.g.players[0].life === 40 + n, 'incorrect life gain'); });
  } else if ((m = text.match(/^Target creature( you control)? gets ([+-]\d+)\/([+-]\d+)(?: and gains (flying|trample|haste|lifelink|hexproof|indestructible))? until end of turn\.$/))) {
    matched = true; const p = Number(m[2]), t = Number(m[3]), kw = m[4];
    check(checks, 'Oracle: target pump and duration', () => { const f = fixture(def); f.own.def = { ...f.own.def, power: Math.abs(p) + 50, toughness: Math.abs(t) + 50 }; const before = stats(f.g, f.own); cast(f, [{ c: f.own.id }]); const after = stats(f.g, f.own); ensure(after.p === before.p + p && after.t === before.t + t, 'incorrect pump'); if (kw) ensure(after.kw.has(intrinsic[kw]), 'missing granted keyword'); f.g.eot = []; ensure(stats(f.g, f.own).p === before.p && stats(f.g, f.own).t === before.t, 'pump leaked beyond duration'); });
  } else if ((m = text.match(/^(?:Destroy|Exile) target (creature|artifact|enchantment)\.$/))) {
    matched = true; const action = text.startsWith('Destroy') ? 'graveyard' : 'exile', type = m[1][0].toUpperCase() + m[1].slice(1);
    check(checks, 'Oracle: ' + text, () => { const f = fixture(def); const victim = f.g.battlefield.map(id => f.g.cards[id]).find(c => c.controller === 1 && c.def.types.includes(type as any))!; const land = { c: f.land.id }; ensure(!legalTargets(f.g, castTargetSpecs(def)[0], 0, f.source.id).some(t => sameTarget(t, land)), 'incorrectly targets a land'); cast(f, [{ c: victim.id }]); ensure(victim.zone === action, 'target moved to ' + victim.zone + ' instead of ' + action); });
  } else if ((m = def.types.some(t => t === 'Instant' || t === 'Sorcery') ? text.match(/^.+ deals (\d+) damage to (any target|target creature|target opponent)\.$/) : null)) {
    matched = true; const n = Number(m[1]), toPlayer = m[2] !== 'target creature';
    check(checks, 'Oracle: damage ' + n, () => { const f = fixture(def); cast(f, [toPlayer ? { p: 1 } : { c: f.enemy.id }]); ensure(toPlayer ? f.g.players[1].life === 40 - n : f.enemy.damage === n || f.enemy.zone === 'graveyard' && n >= 4, 'incorrect actual damage'); });
  } else if ((m = text.match(/^When (.+?) enters(?: the battlefield)?, (?:you may )?draw (a|one|two|three|\d+) cards?\.$/i)) && (m[1] === row.name || /^this (?:creature|artifact|enchantment|permanent|land)$/i.test(m[1]))) {
    matched = true; const n = count(m[2]);
    check(checks, 'Oracle: ETB draw ' + n, () => { const f = fixture(def); const hand = f.g.players[0].hand.length; cast(f); ensure(f.g.players[0].hand.length === hand - 1 + n, 'ETB drew incorrect count'); });
  }
  if (!matched) remaining.push(...substantive);
  // This is a real action-contract assertion for every source card using earthbend N.
  const earth = row.text.match(/\b[Ee]arthbend (\d+)/);
  if (earth) check(checks, 'Oracle: earthbend must animate an existing land', () => {
    const f = fixture(def); const n = Number(earth[1]);
    drive(f.g, runEffects(f.g, { source: f.source.id, controller: 0, targets: [{ c: f.land.id }] }, [{ e: 'earthbend', n }]));
    ensure(isCreature(f.land) && f.land.def.types.includes('Land') && f.land.counters === n, 'earthbend created a token instead of animating the chosen land');
  });
  const symbols = (row.cost ?? '').match(/\{[^}]+\}/g) ?? [];
  if (symbols.length && !def.types.includes('Land') && !/costs?[^.\n]*less|additional cost|spree|affinity|convoke|delve|improvise|waterbend|\/P\}/i.test(row.text + ' ' + row.cost)) check(checks, 'Oracle: normal mana cost agrees with printed symbols', () => {
    const f = fixture(def, false), quoted = spellCost(f.g, f.source, 0);
    const expected = symbols.reduce((n, s) => n + (/^\{\d+\}$/.test(s) ? Number(s.slice(1, -1)) : s === '{X}' ? 0 : 1), 0);
    const actual = quoted.generic + quoted.W + quoted.U + quoted.B + quoted.R + quoted.G + quoted.C + (quoted.hyb?.length ?? 0) + (quoted.twoHyb?.length ?? 0);
    ensure(actual === expected, 'printed minimum ' + expected + ' differs from normal cost ' + actual);
  });
  return { checks, remaining };
}

export function executionChecks(def: CardDef): Check[] {
  const checks: Check[] = [];
  const probe = (name: string, fn: () => void) => { try { fn(); checks.push({ name, status: 'pass' }); } catch(e) { const detail = shortError(e); checks.push({ name, status: /^(?:no normal cast|no jointly legal targets|cast rejected:)/.test(detail) ? 'blocked' : 'fail', detail }); } };
  const modes = new Set(Array.from({ length: modeCount(def) }, (_, i) => i));
  if (def.ecl?.variableTargets) for (const n of [1, 2, 3]) modes.add(n);
  for (const mode of modes) {
    const f = fixture(def);
    const specs = castTargetSpecs(def, mode);
    if (/collect evidence/i.test(def.text)) enrich(f);
    if (def.frontierStack || def.fin?.stackTarget || def.spell?.modes?.[mode]?.frontierStackTargets?.length || specs.some(s => ['spell', 'spellOrCreature', 'spellOrPermanent'].includes(s.kind))) {
      for (const p of [0, 1] as PID[]) for (const type of ['Creature', 'Instant', 'Artifact'] as const) {
        const countered = add(f.g, { ...piece('Pending ' + type + p, [type]), cost: '{4}', colors: ['R', 'B', 'G'] }, p, 'stack');
        f.g.stack.push({ sid: f.g.nextSid++, cardId: countered.id, kind: 'spell', controller: p, targets: type === 'Instant' ? [{ p: 0 }] : [], targetSpecs: type === 'Instant' ? [{ kind: 'player' }] : [], effects: [], text: '' });
      }
      const small = add(f.g, { ...piece('Pending small instant', ['Instant']), cost: '{2}' }, 1, 'stack');
      f.g.stack.push({ sid: f.g.nextSid++, cardId: small.id, kind: 'spell', controller: 1, targets: [], targetSpecs: [], effects: [], text: '' });
      f.g.stack.push({ sid: f.g.nextSid++, cardId: f.own.id, kind: 'activated', controller: 0, targets: [], targetSpecs: [], effects: [], text: 'Inert test ability' });
    }
    let option;
    try { option = castOptionsFor(f.g, 0, f.source).find(o => o.alt === undefined && (o.mode ?? 0) === mode); }
    catch (e) { checks.push({ name: 'cast mode ' + mode, status: 'fail', detail: shortError(e) }); continue; }
    if (!option || !targets(f.g, option.specs, 0, f.source.id)) {
      enrich(f);
      try { option = castOptionsFor(f.g, 0, f.source).find(o => o.alt === undefined && (o.mode ?? 0) === mode); }
      catch (e) { checks.push({ name: 'cast mode ' + mode, status: 'fail', detail: shortError(e) }); continue; }
    }
    if (!option) { checks.push({ name: 'cast mode ' + mode, status: 'blocked', detail: 'fixture does not meet cast conditions/targets/additional costs' }); continue; }
    probe('cast mode ' + mode, () => { cast(f, undefined, def.spell?.modes || def.ecl?.variableTargets ? mode : undefined); invariant(f.g); });
  }
  if (!def.types.some(t => t === 'Instant' || t === 'Sorcery')) {
    probe('entry / ordinary triggers / death', () => {
      const f = fixture(def); enterBattlefield(f.g, f.source, 0); finish(f.g);
      for (const [step, phase] of [['upkeep', 'upkeep'], ['main1', 'main1'], ['combatStart', 'combat_begin'], ['main2', 'main2'], ['endStep', 'end']] as const) {
        if (f.g.winner) break;
        f.g.phase = phase; emit(f.g, { type: 'step', step, player: 0 }); finish(f.g); invariant(f.g);
      }
      if (f.source.zone === 'battlefield') { sacrifice(f.g, f.source); finish(f.g); invariant(f.g); }
    });
    const base = fixture(def); enterBattlefield(base.g, base.source, 0);
    let abs;
    try { finish(base.g); abs = abilitiesFor(base.g, base.source); }
    catch (e) { return checks; }
    for (let i = 0; i < abs.length; i++) {
      const f = fixture(def); enterBattlefield(f.g, f.source, 0);
      try {
        finish(f.g); f.source.sick = false; f.source.tapped = false;
        if (abs[i].fromGraveyard) moveCard(f.g, f.source, 'graveyard');
        if (abs[i].fromHand) moveCard(f.g, f.source, 'hand');
        if (!canActivate(f.g, 0, f.source, i)) { checks.push({ name: 'activate ' + i, status: 'blocked', detail: 'fixture does not meet activation condition/cost' }); continue; }
        const chosen = targets(f.g, abs[i].targets ?? [], 0, f.source.id);
        if (!chosen) { checks.push({ name: 'activate ' + i, status: 'blocked', detail: 'fixture lacks jointly legal targets' }); continue; }
        const action: PriorityAction = { type: 'activate', card: f.source.id, ability: i, targets: chosen, sac: abs[i].cost.sacOther ? sacChoices(f.g, 0, abs[i].cost.sacOther!, f.source.id)[0] : undefined, discard: f.g.players[0].hand[0], x: abs[i].xMana ? 1 : undefined };
        const error = performAction(f.g, 0, action);
        if (error) { checks.push({ name: 'activate ' + i, status: 'blocked', detail: error }); continue; }
        finish(f.g); invariant(f.g); checks.push({ name: 'activate ' + i, status: 'pass' });
      } catch (e) { checks.push({ name: 'activate ' + i, status: 'fail', detail: shortError(e) }); }
    }
  }
  return checks;
}

export function auditCard(row: SourceRow, def: CardDef | undefined, face = 'front'): CardResult {
  const result: CardResult = { set: row.set, number: row.number, name: row.name, face, definition: def?.id ?? '', data: [], rules: [], execution: [], remainingRules: [] };
  if (!def) { result.data.push({ name: 'definition exists', status: 'fail', detail: 'missing card/face definition' }); return result; }
  for (const key of ['cost', 'types', 'subtypes', 'supertypes', 'colors', 'power', 'toughness', 'loyalty'] as const) if (key in row) check(result.data, key, () => {
    const actual = key === 'colors' ? colorsOf(def) : key === 'cost' ? def.cost ?? '' : def[key];
    ensure(normalize(actual ?? (Array.isArray(row[key]) ? [] : undefined)) === normalize(row[key]), 'source ' + normalize(row[key]) + ' differs from ' + normalize(actual));
  });
  if (def.text) check(result.data, 'Chinese rules available', () => ensure(/[\u3400-\u9fff]/.test(traditionalRulesText(def.text)), 'rules still in English'));
  try { const rules = ruleChecks(row, def); result.rules = rules.checks; result.remainingRules = rules.remaining; } catch (e) { result.rules.push({ name: 'Oracle checker', status: 'fail', detail: shortError(e) }); }
  try { result.execution = executionChecks(def); } catch (e) { result.execution.push({ name: 'execution checker', status: 'fail', detail: shortError(e) }); }
  return result;
}

export function faces(row: SourceRow): { row: SourceRow; def: CardDef | undefined; face: string }[] {
  const def = CARDS.find(c => c.id === slug(row.name));
  const out = [{ row, def, face: 'front' }];
  for (const key of ['back', 'adventure', 'prepare'] as const) if (row[key]) {
    const source = row[key] as SourceRow;
    const actual = def?.[key] ?? (key === 'back' ? def?.adventure : undefined);
    const actualFace: CardDef | undefined = actual ? (key === 'back' && def?.back ? actual as CardDef : castDef(def!, key === 'prepare' ? 'prepared' : 'adventure')) : undefined;
    out.push({ row: { ...source, set: row.set, number: row.number }, def: actualFace ? { ...actualFace, id: actualFace.id ?? def!.id + '-' + key, back: undefined, adventure: undefined, prepare: undefined } as CardDef : undefined, face: key });
  }
  if (row.room) for (const key of ['left', 'right'] as const) {
    const source = (row.room as any)[key], actual = def?.room?.[key];
    if (source) out.push({ row: { ...source, set: row.set, number: row.number }, def: actual ? castDef(def!, key === 'left' ? 'roomLeft' : 'roomRight') : undefined, face: 'room-' + key });
  }
  return out;
}
