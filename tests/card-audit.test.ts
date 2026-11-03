import { describe, it, expect } from 'vitest';
import { CARDS } from '../src/data';
import { ruleChecks, auditCard, faces, type SourceRow } from './card-audit-runner';
import spm from '../src/data/sets/spm-catalog.json';
import { stats } from '../src/engine/state';
import { moveCard } from '../src/engine/zones';
import { performAction, castDef } from '../src/engine/actions';
import { mk, put, inHand, lands, resolve, settleAll } from './helpers';

describe('independent per-card rule checker', () => {
  const divination = CARDS.find(c => c.name === 'Divination')!;
  const row = { name: 'Divination', text: 'Draw two cards.', set: 'FDN', number: 1 } as SourceRow;
  it('checks a real draw spell against the source text', () => {
    expect(divination).toBeDefined();
    expect(ruleChecks(row, divination).checks.every(c => c.status === 'pass')).toBe(true);
  });
  it('detects an incorrect implementation despite unchanged displayed rules', () => {
    const wrong = { ...divination, spell: { effects: [{ e: 'draw' as const, n: 1 }] } };
    expect(ruleChecks(row, wrong).checks.some(c => c.status === 'fail')).toBe(true);
  });
  it('leaves unrecognized complex rules explicitly unverified', () => {
    const r = ruleChecks({ ...row, text: 'Look at the top five cards of your library. You may reveal a card from among them.' }, divination);
    expect(r.remaining).toHaveLength(1);
    expect(r.checks).toHaveLength(0);
  });
  it('detects a missing printed keyword using an intentionally wrong definition', () => {
    const wrong = { ...divination, types: ['Creature' as const], keywords: [], spell: undefined, power: 2, toughness: 2 };
    const r = ruleChecks({ ...row, text: 'Flying' }, wrong);
    expect(r.checks.find(c => c.name === 'keyword: flying')?.status).toBe('fail');
  });
  it('handles lethal-looking pump amounts without reading reset graveyard stats', () => {
    for (const name of ["Scorpion's Sting", 'Overkill']) {
      const def = CARDS.find(c => c.name === name)!;
      expect(ruleChecks({ ...row, name, text: name === 'Overkill' ? 'Target creature gets -0/-9999 until end of turn.' : 'Target creature gets -3/-3 until end of turn.' }, def).checks.every(c => c.status === 'pass')).toBe(true);
    }
  });
  it('reports missing definitions and separately lists additional faces', () => {
    expect(auditCard(row, undefined).data[0].status).toBe('fail');
    const peter = spm.find(c => c.name === 'Peter Parker')!;
    expect(faces(peter as SourceRow).map(f => f.face)).toEqual(['front', 'back']);
  });
});

describe('defects exposed by the individual-card sweep', () => {
  it('evaluates flying anthems without recursive stats or self-buffing the Eagle', () => {
    const g = mk(), flyer = put(g, 0, 'armament-dragon'), ground = put(g, 0, 'brave-kin-duo');
    const flyingBase = stats(g, flyer), groundBase = stats(g, ground);
    const eagle = put(g, 0, 'empyrean-eagle');
    expect(stats(g, eagle).p).toBe(2);
    expect(stats(g, flyer).p).toBe(flyingBase.p + 1);
    expect(stats(g, ground).p).toBe(groundBase.p);
    const second = put(g, 0, 'empyrean-eagle');
    expect(stats(g, eagle).p).toBe(3);
    expect(stats(g, second).p).toBe(3);
    moveCard(g, second, 'hand');
    expect(stats(g, eagle).p).toBe(2);
    put(g, 0, 'air-nomad-legacy'); settleAll(g);
    expect(stats(g, flyer).p).toBe(flyingBase.p + 2);
  });
  it('reevaluates the Sentry condition after counters change its power', () => {
    const g = mk(), sentry = put(g, 0, 'bristlepack-sentry');
    expect(stats(g, sentry).ignoreDefender).not.toBe(true);
    sentry.counters = 1;
    expect(stats(g, sentry).ignoreDefender).toBe(true);
    sentry.counters = 0;
    expect(stats(g, sentry).ignoreDefender).not.toBe(true);
  });
  it('gives Krang its printed indestructible and Thor exactly two prowess boosts', () => {
    const g = mk(), krang = put(g, 0, 'krang-utrom-warlord'), thor = put(g, 0, 'thor-odinson');
    expect(stats(g, krang).kw.has('indestructible')).toBe(true);
    const before = stats(g, thor), spell = inHand(g, 0, 'opt'); lands(g, 0, 'island', 1);
    expect(performAction(g, 0, { type: 'cast', card: spell.id, targets: [] })).toBeNull();
    settleAll(g);
    expect(stats(g, thor).p).toBe(before.p + 2);
    expect(stats(g, thor).t).toBe(before.t + 2);
  });
  it('split-card halves have no Adventure subtype', () => {
    for (const name of ['Cease // Desist', 'Flotsam // Jetsam', 'Fuss // Bother', 'Hustle // Bustle', 'Push // Pull']) {
      const def = CARDS.find(c => c.name === name)!;
      expect(castDef(def, 'adventure').subtypes).toEqual([]);
    }
  });
  it('Focus Fire resolves its source count as damage instead of throwing', () => {
    const g = mk(); put(g, 0, 'brave-kin-duo');
    const victim = put(g, 1, 'armament-dragon'), spell = inHand(g, 0, 'focus-fire');
    victim.attacking = true; lands(g, 0, 'plains', 1);
    expect(performAction(g, 0, { type: 'cast', card: spell.id, targets: [{ c: victim.id }] })).toBeNull();
    resolve(g); expect(victim.damage).toBe(3);
  });
  it('Woodland Acolyte draws exactly one card on entry', () => {
    const g = mk(), source = inHand(g, 0, 'woodland-acolyte'); lands(g, 0, 'plains', 3);
    const hand = g.players[0].hand.length;
    expect(performAction(g, 0, { type: 'cast', card: source.id, targets: [] })).toBeNull(); resolve(g); settleAll(g);
    expect(source.zone).toBe('battlefield'); expect(g.players[0].hand.length).toBe(hand);
  });
});
