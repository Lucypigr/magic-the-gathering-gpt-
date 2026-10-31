import { setBuilder } from './frontier-dsl';
import type { CardDef, Ability, Effect, Ref, TargetSpec, TriggeredAbility, Amt, Mode } from '../../engine/types';
export function webDsl(b: ReturnType<typeof setBuilder>, code: 'spm' | 'hob') {
    const d = (n: number, p: Partial<CardDef>) => b.d(n, { ...p, meadow: { ...b.patches.get(n)?.meadow, ...p.meadow, webShire: true } });
    const a = (n: number, abilities: Ability[]) => d(n, { abilities });
    const s = (n: number, effects: Effect[], targets?: TargetSpec[]) => d(n, { spell: { effects, targets } });
    const modes = (n: number, modes: Mode[]) => d(n, { spell: { modes } });
    const saga = (n: number, chapters: NonNullable<CardDef['saga']>['chapters']) => d(n, { saga: { chapters } });
    const E = (key: number | string, what: Ref = 'T0', n?: number): Effect => b.E('final:' + key, what, n);
    const C = (key: string) => b.C(code + ':final:' + key), N = (key: string): Amt => ({ frontier: code + ':final:' + key }), F = (key: string): Ability => b.F(code + ':final:' + key);
    const event = (key: string, effects: Effect[], extra: Partial<TriggeredAbility> = {}) => b.event(code + ':final:' + key, effects, extra);
    const renew = (mana: string, effects: Effect[], targets?: TargetSpec[]): Ability => ({ kind: 'activated', cost: { mana, exileSelf: true }, fromGraveyard: true, sorcery: true, effects, targets, label: '放逐墳墓場此牌' });
    const hand = (mana: string, effects: Effect[], targets?: TargetSpec[]): Ability => ({ kind: 'activated', cost: { mana, discardSelf: true }, fromHand: true, effects, targets, label: '棄掉此牌' });
    return { ...b, d, a, s, modes, saga, E, C, N, F, event, renew, hand };
}
