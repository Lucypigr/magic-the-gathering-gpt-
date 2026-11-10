import { describe, expect, it } from 'vitest';
import '../src/data';
import { CARDS } from '../src/data';
import { runHeadless } from '../src/engine/controller';
import type { CardDef } from '../src/engine/types';

// 用新機制的卡組成套牌，AI 互打確認不會卡住或出錯
const NEW = (d: CardDef) =>
  !!(d.disguise || d.plot || d.cycling || d.warp || d.offspring || d.convoke || d.harmonize || d.mayhem || d.prepare || d.startEngines || d.changeling || d.wardLife ||
    d.abilities?.some((a) => (a.kind === 'activated' && (a.oncePerGame || a.fromGraveyard || a.powerUp || a.effects.some((e) => e.e === 'saddle'))) ||
      (a.kind === 'trigger' && a.effects.some((e) => e.e === 'manifestDread' || e.e === 'cloak' || e.e === 'endure'))) ||
    d.spell?.modes?.some((m) => m.cost) ||
    d.spell?.effects?.some((e) => e.e === 'manifestDread'));

function deck(color: string, seed: number): string[] {
  const pool = CARDS.filter((d) => NEW(d) && !d.types.includes('Land') && (d.cost ?? '').replace(/[^WUBRG]/g, '').split('').every((c) => c === color));
  const out: string[] = [];
  for (let i = 0; i < 36; i++) out.push(pool[(i * 7 + seed) % pool.length].id);
  const basic = { W: 'plains', U: 'island', B: 'swamp', R: 'mountain', G: 'forest' }[color]!;
  for (let i = 0; i < 24; i++) out.push(basic);
  return out;
}

describe('新機制 AI 互打', () => {
  // Preserve the same ten deterministic games, each with its own timeout and result.
  const cols = ['W', 'U', 'B', 'R', 'G'];
  const games = cols.flatMap((color, i) => (['normal', 'hard'] as const).map((level, j) => ({ color, opponent: cols[(i + 2) % 5], level, seed: 7 + i * 2 + j })));
  it.each(games)('$color 對 $opponent（$level，seed $seed）能正常打完', ({color, opponent, level, seed}) => {
    const g = runHeadless(
      { name: 'A', deckName: color, deck: deck(color, seed), isAI: true },
      { name: 'B', deckName: opponent, deck: deck(opponent, seed + 3), isAI: true },
      [level, level], seed,
    );
    expect(g.winner).not.toBeNull();
  });
});
