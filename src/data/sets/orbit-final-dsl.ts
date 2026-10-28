import { setBuilder } from './frontier-dsl';
import type { Ability, Amt, Effect, Ref, TargetSpec, TriggeredAbility } from '../../engine/types';
export function finalDsl(b: ReturnType<typeof setBuilder>, code: 'eoe' | 'tdm') {
    const d = (n: number, p: Partial<import('../../engine/types').CardDef>) => b.d(n, { ...p, meadow: { ...b.patches.get(n)?.meadow, ...p.meadow, orbitFinal: true } });
    const a = (n: number, abilities: Ability[]) => d(n, { abilities });
    const s = (n: number, effects: Effect[], targets?: TargetSpec[]) => d(n, { spell: { effects, targets } });
    const modes = (n: number, modes: import('../../engine/types').Mode[]) => d(n, { spell: { modes } });
    const saga = (n: number, chapters: NonNullable<import('../../engine/types').CardDef['saga']>['chapters']) => d(n, { saga: { chapters } });
    const E = (key: string | number, what: Ref = 'T0', n?: number): Effect => b.E('final:' + key, what, n);
    const C = (key: string) => b.C(code + ':final:' + key), N = (key: string): Amt => ({ frontier: code + ':final:' + key }), F = (key: string): Ability => b.F(code + ':final:' + key);
    const event = (key: string, effects: Effect[], extra: Partial<TriggeredAbility> = {}) => b.event(code + ':final:' + key, effects, extra);
    const renew = (mana: string, effects: Effect[], targets?: TargetSpec[]): Ability => ({ kind: 'activated', cost: { mana, exileSelf: true }, fromGraveyard: true, sorcery: true, effects, targets, label: '復新：放逐此牌' });
    return { ...b, d, a, s, modes, saga, E, C, N, F, event, renew };
}
