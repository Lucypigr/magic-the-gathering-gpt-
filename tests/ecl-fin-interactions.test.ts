import { describe, it, expect } from 'vitest';
import { mk, put, inHand, lands, resolve, settleAll, answerDefault, type Answer } from './helpers';
import { runEffects } from '../src/engine/effects';
import { dealDamage, emit, putCounters, putMinusCounters, sacrifice, transformCard } from '../src/engine/zones';
import { performAction } from '../src/engine/actions';
import type { Effect, GameState, TargetRef } from '../src/engine/types';
function effects(g: GameState, source: number, es: Effect[], targets: (TargetRef | null)[] = [], answer?: Answer) {
  const f = runEffects(g, { source, controller: 0, targets }, es);
  let r = f.next();
  while (!r.done) r = f.next(answerDefault(g, r.value, answer));
}
function crown(g: GameState, host: number) {
  const c = put(g, 0, 'mirrormind-crown');
  c.attachedTo = host;
  return c;
}
const tokens = (g: GameState) => g.battlefield.map((id) => g.cards[id]).filter((c) => c.token);
const order =
  (name: string): Answer =>
  (d) =>
    d.type === 'mode' && d.options.some((s) => s.includes(name))
      ? { type: 'modes', picks: [d.options.findIndex((s) => s.includes(name))] }
      : undefined;
describe('ECL × FIN interaction regression', () => {
  it('stacks Collective Inferno and Trance Kuja damage multipliers with lifelink', () => {
    const g = mk(),
      src = put(g, 0, 'aerith-gainsborough'),
      inferno = put(g, 0, 'collective-inferno'),
      kuja = put(g, 0, 'kuja-genome-sorcerer');
    settleAll(g);
    inferno.eclType = 'Cleric';
    transformCard(g, kuja);
    const rod = put(g, 0, 'black-mages-rod');
    rod.attachedTo = src.id;
    put(g, 0, 'the-wind-crystal');
    expect(dealDamage(g, src, 0, { p: 1 }, 2)).toBe(8);
    expect(g.players[0].life).toBe(36);
  });
  it('redirection among two Adamantoises terminates and deals damage once', () => {
    const g = mk(),
      a = put(g, 0, 'ancient-adamantoise'),
      b = put(g, 0, 'ancient-adamantoise');
    expect(() => dealDamage(g, null, 1, { p: 0 }, 3)).not.toThrow();
    expect(a.damage).toBe(0);
    expect(b.damage).toBe(3);
  });
  it('wither damage is multiplied before placing minus counters, without Earth Crystal doubling them', () => {
    const g = mk(),
      src = put(g, 0, 'spinerock-tyrant'),
      victim = put(g, 1, 'ancient-adamantoise'),
      inferno = put(g, 0, 'collective-inferno');
    settleAll(g);
    inferno.eclType = src.def.subtypes![0];
    src.permanentGrants = [{ kw: ['wither'] }];
    put(g, 1, 'the-earth-crystal');
    dealDamage(g, src, 0, { c: victim.id }, 2);
    expect(victim.counters).toBe(-4);
    expect(victim.damage).toBe(0);
  });
  it('Crown then Quina makes one copy and one Frog', () => {
    const g = mk(),
      host = put(g, 0, 'vivi-ornitier');
    putCounters(g, host, 2);
    const eq = crown(g, host.id);
    put(g, 0, 'quina-qu-gourmet');
    effects(g, eq.id, [{ e: 'token', token: 'tok-fin-hero' }], [], order('Mirrormind Crown'));
    expect(tokens(g).filter((c) => c.def.id === 'vivi-ornitier')).toHaveLength(1);
    expect(tokens(g).filter((c) => c.def.id === 'tok-fin-frog')).toHaveLength(1);
  });
  it('Quina then Crown replaces both tokens while retaining the primary token for Job select', () => {
    const g = mk(),
      host = put(g, 0, 'dwarven-castle-guard'),
      eq = crown(g, host.id);
    put(g, 0, 'quina-qu-gourmet');
    effects(g, eq.id, [{ e: 'token', token: 'tok-fin-hero' }], [], order('Quina'));
    expect(tokens(g).filter((c) => c.def.id === 'dwarven-castle-guard')).toHaveLength(2);
    expect(tokens(g).filter((c) => c.def.id === 'tok-fin-frog')).toHaveLength(0);
  });
  it('multiple Crowns all consume the first token event and cannot replace the second event', () => {
    const g = mk(),
      a = put(g, 0, 'dwarven-castle-guard'),
      b = put(g, 0, 'goldmeadow-nomad'),
      eq = crown(g, a.id);
    crown(g, b.id);
    effects(g, eq.id, [{ e: 'token', token: 'tok-fin-hero' }]);
    effects(g, eq.id, [{ e: 'token', token: 'tok-fin-hero' }]);
    expect(tokens(g).filter((c) => c.def.id === 'tok-fin-hero')).toHaveLength(1);
  });
  it('a token copy exiled by its transform ability cannot return', () => {
    const g = mk(),
      src = put(g, 0, 'gogo-master-of-mimicry'),
      dion = put(g, 0, 'dion-bahamuts-dominant');
    effects(g, src.id, [{ e: 'copyCreature', what: 'T0' }], [{ c: dion.id }]);
    const copy = tokens(g)[0];
    effects(g, copy.id, [{ e: 'fin', action: 'exileBack' }]);
    expect(copy.zone).not.toBe('battlefield');
    expect(g.battlefield).not.toContain(copy.id);
  });
  it('Crown copies printed characteristics without plus counters or temporary Glamer stats', () => {
    const g = mk(),
      host = put(g, 0, 'dwarven-castle-guard'),
      eq = crown(g, host.id);
    putCounters(g, host, 2);
    effects(g, eq.id, [{ e: 'ecl', action: 'glamer' }], [{ c: host.id }]);
    effects(g, eq.id, [{ e: 'token', token: 'tok-fin-hero' }]);
    const copy = tokens(g)[0];
    expect(copy.def.power).toBe(2);
    expect(copy.counters).toBe(0);
    expect(copy.def.changeling).not.toBe(true);
  });
  it('copying a FIN adventure spell creates its spell effect rather than a Land token', () => {
    const g = mk(),
      c = inHand(g, 0, 'lindblum-industrial-regency');
    lands(g, 0, 'mountain', 3);
    expect(performAction(g, 0, { type: 'cast', card: c.id, alt: 'adventure', targets: [] })).toBeNull();
    const f = runEffects(
      g,
      { source: c.id, controller: 0, targets: [], ev: { type: 'cast', card: c.id, player: 0, opponentTurn: false } },
      [{ e: 'copySpell' }],
    );
    let r = f.next();
    while (!r.done) r = f.next(answerDefault(g, r.value));
    resolve(g);
    resolve(g);
    expect(tokens(g).filter((c) => c.def.id === 'tok-fin-wizard')).toHaveLength(2);
    expect(tokens(g).some((c) => c.def.types.includes('Land'))).toBe(false);
  });
  it('a copy of an evoked spell retains the evoke choice without inventing mana spent', () => {
    const g = mk(),
      c = inHand(g, 0, 'catharsis');
    lands(g, 0, 'plains', 2);
    expect(performAction(g, 0, { type: 'cast', card: c.id, alt: 'evoke', targets: [] })).toBeNull();
    const f = runEffects(
      g,
      { source: c.id, controller: 0, targets: [], ev: { type: 'cast', card: c.id, player: 0, opponentTurn: false } },
      [{ e: 'copySpell' }],
    );
    let r = f.next();
    while (!r.done) r = f.next(answerDefault(g, r.value));
    const cp = g.cards[g.stack.at(-1)!.cardId];
    resolve(g);
    expect(cp.manaPaid ?? []).toEqual([]);
    settleAll(g);
    expect(cp.zone).not.toBe('battlefield');
    expect(c.zone).toBe('graveyard');
  });
  it('persist returns a FIN creature once and a finality counter prevents the next return', () => {
    const g = mk(),
      eirdu = put(g, 0, 'eirdu-carrier-of-dawn'),
      c = put(g, 0, 'vivi-ornitier');
    transformCard(g, eirdu);
    sacrifice(g, c);
    settleAll(g);
    expect(c.zone).toBe('battlefield');
    expect(c.counters).toBe(-1);
    c.finality = true;
    sacrifice(g, c);
    settleAll(g);
    expect(c.zone).toBe('exile');
  });
  it('a Morningtide token is exiled permanently while a FIN nontoken returns tapped', () => {
    const g = mk(),
      src = put(g, 0, 'gogo-master-of-mimicry'),
      body = put(g, 1, 'vivi-ornitier');
    effects(g, src.id, [{ e: 'token', token: 'tok-fin-hero' }]);
    const token = tokens(g)[0];
    effects(g, src.id, [{ e: 'ecl', action: 'morningtide' }], [{ c: token.id }, { c: body.id }]);
    emit(g, { type: 'step', step: 'endStep', player: 1 });
    settleAll(g);
    expect(g.battlefield).not.toContain(token.id);
    expect(body.zone).toBe('battlefield');
    expect(body.tapped).toBe(true);
  });
  it('finality overrides persist even when Earth Crystal and Isilu are present', () => {
    const g = mk(),
      eirdu = put(g, 0, 'eirdu-carrier-of-dawn'),
      body = put(g, 0, 'dwarven-castle-guard');
    transformCard(g, eirdu);
    put(g, 0, 'the-earth-crystal');
    body.finality = true;
    sacrifice(g, body);
    settleAll(g);
    expect(body.zone).toBe('exile');
  });
  it('ECL creature ability loss suppresses FIN death triggers before dying', () => {
    const g = mk(),
      src = put(g, 0, 'curious-colossus'),
      body = put(g, 1, 'dwarven-castle-guard');
    effects(g, src.id, [{ e: 'ecl', action: 'colossus' }], [{ p: 1 }]);
    sacrifice(g, body);
    settleAll(g);
    expect(tokens(g)).toHaveLength(0);
  });
  it('Blossombind stops both Earth Crystal additions and ECL minus counters', () => {
    const g = mk(),
      body = put(g, 0, 'burdened-stoneback'),
      aura = put(g, 1, 'blossombind');
    aura.attachedTo = body.id;
    put(g, 0, 'the-earth-crystal');
    putCounters(g, body, 2);
    putMinusCounters(g, body, 1);
    expect(body.counters).toBe(-2);
  });
  it('a copied FIN Saga begins with its own first chapter and no copied lore counters', () => {
    const g = mk(),
      src = put(g, 0, 'relentless-x-atm092'),
      saga = put(g, 0, 'summon-choco-mog');
    saga.lore = 3;
    effects(g, src.id, [{ e: 'copyCreature', what: 'T0' }], [{ c: saga.id }]);
    const copy = tokens(g)[0];
    expect(copy.lore).toBe(1);
    expect(saga.lore).toBe(3);
  });
  it('Relm copying transformed Brigid retains both copiable faces and can transform', () => {
    const g = mk(),
      src = put(g, 0, 'gogo-master-of-mimicry'),
      brigid = put(g, 0, 'brigid-clachans-heart');
    settleAll(g);
    transformCard(g, brigid);
    effects(g, src.id, [{ e: 'copyCreature', what: 'T0' }], [{ c: brigid.id }]);
    const copy = tokens(g).find((c) => c.def.name === "Brigid, Doun's Mind")!;
    expect(copy).toBeDefined();
    expect(transformCard(g, copy)).toBe(true);
    expect(copy.def.name).toBe("Brigid, Clachan's Heart");
  });
  it('Crown copying a transformed FIN Saga retains its copied first chapter', () => {
    const g = mk(),
      host = put(g, 0, 'dion-bahamuts-dominant');
    effects(g, host.id, [{ e: 'fin', action: 'exileBack' }]);
    settleAll(g);
    const eq = crown(g, host.id);
    effects(g, eq.id, [{ e: 'token', token: 'tok-fin-hero' }]);
    const copy = tokens(g).find((c) => c.def.name === 'Bahamut, Warden of Light')!;
    expect(copy.lore).toBe(1);
    expect(copy.front?.name).toBe("Dion, Bahamut's Dominant");
  });
  it('Crown entering after an earlier token event waits until the next turn', () => {
    const g = mk(),
      host = put(g, 0, 'dwarven-castle-guard');
    effects(g, host.id, [{ e: 'token', token: 'tok-fin-hero' }]);
    const eq = crown(g, host.id);
    effects(g, eq.id, [{ e: 'token', token: 'tok-fin-hero' }]);
    expect(tokens(g).filter((c) => c.def.id === 'tok-fin-hero')).toHaveLength(2);
    g.turn++;
    effects(g, eq.id, [{ e: 'token', token: 'tok-fin-hero' }]);
    expect(tokens(g).filter((c) => c.def.id === 'dwarven-castle-guard')).toHaveLength(1);
  });
  it('declining one Crown does not prevent applying another to that same event', () => {
    const g = mk(),
      a = put(g, 0, 'dwarven-castle-guard'),
      b = put(g, 0, 'goldmeadow-nomad'),
      eq = crown(g, a.id);
    crown(g, b.id);
    let asked = 0;
    effects(g, eq.id, [{ e: 'token', token: 'tok-fin-hero' }], [], (d) =>
      d.type === 'yesno' ? { type: 'yesno', yes: ++asked > 1 } : undefined,
    );
    expect(tokens(g).filter((c) => c.def.id === 'goldmeadow-nomad')).toHaveLength(1);
    expect(asked).toBe(2);
  });
  it('FIN legendary copies allow choosing the original to keep', () => {
    const g = mk(),
      host = put(g, 0, 'vivi-ornitier'),
      eq = crown(g, host.id);
    effects(g, eq.id, [{ e: 'token', token: 'tok-fin-hero' }]);
    settleAll(g, (d) => (d.type === 'choose' && d.prompt.includes('傳奇規則') ? { type: 'choose', ids: [host.id] } : undefined));
    expect(host.zone).toBe('battlefield');
    expect(tokens(g).filter((c) => c.def.id === 'vivi-ornitier')).toHaveLength(0);
  });
  it('copying an ECL Omni-Changeling copies its selected FIN form and changeling exception', () => {
    const g = mk(),
      src = put(g, 0, 'gogo-master-of-mimicry'),
      target = put(g, 0, 'hill-gigas'),
      omni = put(g, 0, 'omni-changeling');
    settleAll(g, (d) => (d.type === 'choose' && d.options.includes(target.id) ? { type: 'choose', ids: [target.id] } : undefined));
    effects(g, src.id, [{ e: 'copyCreature', what: 'T0' }], [{ c: omni.id }]);
    const copy = tokens(g)[0];
    expect(copy.def.id).toBe('hill-gigas');
    expect(copy.def.changeling).toBe(true);
  });
  it('Relm copies the copied values of a permanent changed by ECL Mirrorform', () => {
    const g = mk(),
      source = put(g, 0, 'gogo-master-of-mimicry'),
      changed = put(g, 0, 'vivi-ornitier'),
      target = put(g, 0, 'iron-giant');
    effects(g, source.id, [{ e: 'ecl', action: 'mirrorform' }], [{ c: target.id }]);
    effects(g, source.id, [{ e: 'copyCreature', what: 'T0' }], [{ c: changed.id }]);
    expect(tokens(g)[0].def.id).toBe('iron-giant');
  });
  it('Crown then Draconic Visitor replaces copied Artifact creatures once', () => {
    const g = mk(),
      host = put(g, 0, 'iron-giant'),
      eq = crown(g, host.id);
    put(g, 0, 'draconic-visitor');
    effects(g, eq.id, [{ e: 'token', token: 'tok-treasure' }], [], order('Mirrormind Crown'));
    expect(tokens(g)[0].def.id).toBe('tok-fra-dragon');
  });
  it('Draconic Visitor then Crown may finish as an Artifact without applying the same effect twice', () => {
    const g = mk(),
      host = put(g, 0, 'iron-giant'),
      eq = crown(g, host.id);
    put(g, 0, 'draconic-visitor');
    effects(g, eq.id, [{ e: 'token', token: 'tok-treasure' }], [], order('Draconic Visitor'));
    expect(tokens(g)[0].def.id).toBe('iron-giant');
  });
});
