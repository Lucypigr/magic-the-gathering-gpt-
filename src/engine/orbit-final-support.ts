import { abilitiesSuppressed, isCreature, isLand, other, stats, checkCond } from './state';
import { frontierFlags, frontierStatic } from './frontier-support';
import { colorsOf, manaValue } from './mana';
import { counterKinds } from './ecl-support';
import { campusCondition, campusTrigger } from './campus-support';
import type { ActivatedAbility, Card, CardDef, GameEvent, GameState, PID, TargetRef, TriggeredAbility } from './types';
export const finalStatic = (g: GameState, p: PID, key: string) => g.orbitFinalGlobals ? [...frontierStatic(g, p, 'eoe:final:' + key), ...frontierStatic(g, p, 'tdm:final:' + key)] : [];
export const finalKey = (action: string) => action.split(':').slice(2).join(':');
const own = (g: GameState, p: PID) => g.battlefield.map(id => g.cards[id]).filter(c => c.controller === p);
export const finalCounterKinds = (c: Card) => Object.entries(counterKinds(c)).filter(([, n]) => n > 0).map(([k]) => k);
export const finalNamedLands = (g: GameState, p: PID) => new Set(own(g, p).filter(isLand).map(c => c.def.name)).size;
export function finalCondition(g: GameState, key: string, p: PID, id: number, e?: GameEvent) {
    const k = finalKey(key), c = g.cards[id], f = frontierFlags(g, p), us = own(g, p);
    switch (k) {
        case 'mode0': return (c.frontierMarks?.finalMode ?? 0) === 0;
        case 'mode1': return c.frontierMarks?.finalMode === 1;
        case 'anotherSpell': return g.players[p].spellsThisTurn > 1;
        case 'twoSpells': return g.players[p].spellsThisTurn >= 2;
        case 'beforeSecond': return g.players[p].spellsThisTurn === 1;
        case 'grave7': return g.players[p].graveyard.length >= 7;
        case 'counterKinds3': return new Set(us.filter(isCreature).flatMap(finalCounterKinds)).size >= 3;
        case 'eventWasCast': return e?.type === 'etb' && !!g.cards[e.card].wasCast;
        case 'bothSpellTypes': return !!f.finalCreatureSpell && !!f.finalNoncreatureSpell;
        case 'toughness10': return us.filter(isCreature).reduce((n, c) => n + stats(g, c).t, 0) >= 10;
        case 'noDamageYet': return !c.frontierMarks?.finalDealtEver;
        case 'emptyCreatures': return [p, other(p)].some(who => !own(g, who).some(isCreature));
        case 'tappedTwo': return us.filter(c => isCreature(c) && c.tapped).length >= 2;
        case 'beholdDragon': return [...g.players[p].hand, ...g.battlefield.filter(id => g.cards[id].controller === p)].some(id => g.cards[id].def.subtypes?.includes('Dragon'));
        default: return campusCondition(g, key.split(':')[0] + ':' + k, p, id, e);
    }
}
export function finalAmount(g: GameState, p: PID, id: number, key: string, e?: GameEvent) {
    const k = finalKey(key);
    switch (k) {
        case 'eventMv': return e?.type === 'cast' ? manaValue(g.cards[e.card].castFace ?? g.cards[e.card].def) : 0;
        case 'attackers': return own(g, p).filter(c => c.attacking).length;
        case 'halfOpponentLife': return Math.ceil(g.players[other(p)].life / 2);
        case 'namedLands': return finalNamedLands(g, p);
        case 'life': return g.players[p].life;
        default: throw Error('Unknown final amount ' + key + ' source ' + id);
    }
}
export function finalTrigger(g: GameState, c: Card, a: TriggeredAbility, e: GameEvent) {
    const key = finalKey(a.frontierEvent!), p = c.controller, ec = 'card' in e ? g.cards[e.card] : undefined, m = c.frontierMarks;
    switch (key) {
        case 'castSelf': return e.type === 'cast' && e.card === c.id;
        case 'colorlessCast': return e.type === 'cast' && e.player === p && !!ec && colorsOf(ec.castFace ?? ec.def).length === 0;
        case 'graveCreatureDies': return c.zone === 'graveyard' && e.type === 'dies' && e.controller === p;
        case 'anyCombat': return e.type === 'step' && e.step === 'combatStart';
        case 'ownCreatureTargeted': return e.type === 'targeted' && e.by !== p && !!ec && ec.controller === p && isCreature(ec);
        case 'graveLeaveBatch': return e.type === 'fin' && e.action === 'zoneMove' && e.from === 'graveyard' && e.player === p && g.active === p && finalBatch(g, c, 'grave');
        case 'firstCounterCreature': return e.type === 'counterPlaced' && e.controller === p && !!ec && isCreature(ec) && !!e.orbitFirst;
        case 'otherArtifactEtb': return e.type === 'etb' && e.controller === p && e.card !== c.id && !!ec?.def.types.includes('Artifact');
        case 'artifactEtb': return e.type === 'etb' && e.controller === p && !!ec?.def.types.includes('Artifact');
        case 'ownArtifactCreatureEtb': return e.type === 'etb' && e.controller === p && !!ec?.def.types.some(t => t === 'Creature' || t === 'Artifact');
        case 'nontokenArtifactEtb': return e.type === 'etb' && e.controller === p && !ec?.token && !!ec?.def.types.includes('Artifact');
        case 'attachedTappedDamaged': return c.attachedTo !== null && ((e.type === 'tapped' || e.type === 'damaged') && e.card === c.attachedTo);
        case 'attachedDamaged': return e.type === 'damaged' && e.card === c.attachedTo;
        case 'kavuEtb': return e.type === 'etb' && e.controller === p && !!ec && (ec.id === c.id || ec.def.subtypes?.includes('Kavu') === true);
        case 'blocksFlying': return e.type === 'blocks' && e.card === c.id && c.blocking !== null && stats(g, g.cards[c.blocking]).kw.has('flying');
        case 'plusCreature': return e.type === 'counterPlaced' && e.controller === p && (e.actor ?? p) === p && (e.counterKind === 'plus' || e.counterKind === '+1/+1') && !!ec && isCreature(ec);
        case 'counterCombatBatch': return e.type === 'combatDamage' && !!g.cards[e.source] && g.cards[e.source].controller === p && g.cards[e.source].counters > 0 && finalBatch(g, c, 'counterCombat');
        case 'landOrSpell': return e.type === 'cast' && e.player === p || e.type === 'frontier' && e.action === 'orbitLandPlayed' && e.player === p;
        case 'otherCreatureDiesExiles': return e.type === 'dies' && e.controller === p && e.card !== c.id || e.type === 'fin' && e.action === 'orbitExileBF' && e.player === p && e.card !== c.id && !!ec && isCreature(ec);
        case 'selfDiesExiles4': return e.type === 'dies' && e.card === c.id && e.power >= 4 || e.type === 'fin' && e.action === 'orbitExileBF' && e.card === c.id && stats(g, c).p >= 4;
    }
    if (key.startsWith('mode')) {
        const mode = Number(key[4]);
        if ((m?.finalMode ?? 0) !== mode)
            return false;
        switch (key.slice(5)) {
            case 'End': return e.type === 'step' && e.step === 'endStep' && e.player === p;
            case 'Upkeep': return e.type === 'step' && e.step === 'upkeep' && e.player === p;
            case 'CombatBatch': return e.type === 'combatBatch' && e.attacker === p;
            case 'InstantSorcery': return e.type === 'cast' && e.player === p && !!ec && (ec.castFace ?? ec.def).types.some(t => t === 'Instant' || t === 'Sorcery');
            case 'CreatureCounter': return e.type === 'counterPlaced' && e.controller === p && !!ec && isCreature(ec);
            case 'Attack': return e.type === 'youAttack' && e.player === p;
        }
    }
    return campusTrigger(g, c, { ...a, frontierEvent: a.frontierEvent!.split(':')[0] + ':' + key }, e);
}
function finalBatch(g: GameState, c: Card, key: string) { const n = g.meadowZoneBatch ?? g.frontierEntryBatch ?? g.eclEventGroup; const m = c.frontierMarks ??= {}; if (n === undefined)
    return true; if (m['finalBatch:' + key] === n)
    return false; m['finalBatch:' + key] = n ?? g.version; return true; }
export function finalBaseStats(g: GameState, c: Card, st: import('./state').Stats) {
    if (c.def.meadow?.orbitSize === 'exileGoyf' && !abilitiesSuppressed(g, c)) {
        st.p = g.players[c.owner].exile.length;
        st.t = st.p + 1;
    }
}
export function finalStats(g: GameState, c: Card, st: import('./state').Stats) {
    if (c.frontierMarks?.finalSuspendHaste === c.controller + 1)
        st.kw.add('haste');
    if ((c.eclCounters?.decayed ?? 0) > 0)
        st.cantBlock = true;
    if (c.def.meadow?.orbitFinal && !abilitiesSuppressed(g, c)) {
        if (c.def.abilities?.some(a => a.kind === 'static' && a.frontier === 'eoe:final:greatestArtifactMv'))
            st.p += Math.max(0, ...own(g, c.controller).filter(x => x.id !== c.id && x.def.types.includes('Artifact')).map(x => manaValue(x.def)));
    }
    if (g.orbitFinalGlobals && isCreature(c) && st.t > st.p && finalStatic(g, c.controller, 'toughnessDamage').length)
        st.damageByToughness = true;
}
export function finalCanBlock(g: GameState, b: Card, a: Card) {
    if (a.def.meadow?.orbitFinal && !abilitiesSuppressed(g, a) && a.def.abilities?.some(x => x.kind === 'static' && x.frontier === 'tdm:final:smallerCantBlock') && stats(g, b).p < stats(g, a).p)
        return false;
    if (b.def.id === 'tok-or-drone' && !stats(g, a).kw.has('flying') && !abilitiesSuppressed(g, b))
        return false;
    if (finalProtected(g, a, colorsOf(b.def)))
        return false;
    return true;
}
export function finalProtected(g: GameState, c: Card, colors: import('./types').Color[]) { return !!c.def.protectionColors?.some(col => colors.includes(col)) && !abilitiesSuppressed(g, c); }
export function finalMonoHexproof(g: GameState, c: Card, source: Card, by: PID) { return !!g.orbitFinalGlobals && c.controller !== by && colorsOf(source.castFace ?? source.def).length === 1 && g.battlefield.some(id => { const a = g.cards[id]; return a.attachedTo === c.id && a.def.abilities?.some(ab => ab.kind === 'static' && ab.frontier === 'tdm:final:dragonfireBlade') && !abilitiesSuppressed(g, a); }); }
export function finalCanSac(g: GameState, c: Card) { return !(g.orbitFinalGlobals && g.phase === 'end' && g.active === c.controller && c.token && c.def.subtypes?.includes('Warrior') && finalStatic(g, c.controller, 'keepWarriors').length); }
export function finalCounterMultiplier(g: GameState, c: Card) { return g.orbitFinalGlobals && (isCreature(c) || c.def.subtypes?.some(t => t === 'Spacecraft' || t === 'Planet')) ? 2 ** finalStatic(g, c.controller, 'doubleRelevantCounters').length : 1; }
export function finalExtraTriggers(g: GameState, c: Card, e: GameEvent) {
    if (!g.orbitFinalGlobals)
        return 0;
    const p = c.controller;
    return (e.type === 'etb' ? finalStatic(g, p, 'etbDouble').length : 0) + ((e.type === 'attacks' || e.type === 'youAttack') ? finalStatic(g, p, 'siegeAttackDouble').filter(s => (s.frontierMarks?.finalMode ?? 0) === 0).length : 0);
}
export function finalEntry(g: GameState, c: Card, p: PID) {
    if (c.def.meadow?.orbitFinal)
        g.orbitFinalActive = true;
    if (c.def.abilities?.some(a => a.kind === 'static' && a.frontier?.includes(':final:')))
        g.orbitFinalGlobals = true;
    const meta = c.def.meadow, m = c.frontierMarks ??= {};
    if (meta?.finalTwoSpellEntry && g.players[p].spellsThisTurn >= 2)
        c.counters += 2;
    if (meta?.finalManaCounters)
        c.counters += c.manaSpent ?? 0;
    if (m.finalDevourCount) {
        c.counters += 3 * m.finalDevourCount;
        delete m.finalDevourCount;
    }
    if (m.finalEntryHexproof) {
        c.hexproofCounters = (c.hexproofCounters ?? 0) + 1;
        delete m.finalEntryHexproof;
    }
    if (m.finalEntryIndestructible) {
        (c.eclCounters ??= {}).indestructible = 1;
        delete m.finalEntryIndestructible;
    }
    if (m.finalFromGrave)
        c.finality = true;
    delete m.finalFromGrave;
    if (g.orbitFinalGlobals && isCreature(c))
        c.counters += (frontierFlags(g, p).finalLandEntries ?? 0) * finalStatic(g, p, 'entryLandCounters').length;
}
export function finalRestore(g: GameState) { if (!g.orbitFinalActive)
    return; for (const id of g.battlefield) {
    const c = g.cards[id];
    if (c.orbitFinalBase) {
        if (c.def === c.orbitFinalApplied)
            c.def = c.orbitFinalBase;
        c.orbitFinalBase = undefined;
        c.orbitFinalApplied = undefined;
    }
} }
export function finalRefresh(g: GameState) {
    if (!g.orbitFinalGlobals)
        return;
    for (const c of g.battlefield.map(id => g.cards[id])) {
        const m = c.frontierMarks;
        if (m?.finalControlAura) {
            const a = g.cards[m.finalControlAura - 1];
            if (!a || a.zone !== 'battlefield' || a.attachedTo !== c.id || abilitiesSuppressed(g, a)) {
                c.controller = (m.finalControlOld - 1) as PID;
                delete m.finalControlAura;
            }
            else
                c.controller = a.controller;
        }
    }
    for (const id of g.battlefield) {
        const a = g.cards[id], c = g.cards[a.attachedTo ?? -1];
        if (c && c.zone === 'battlefield' && !abilitiesSuppressed(g, a) && a.def.abilities?.some(ab => ab.kind === 'static' && ab.frontier === 'eoe:final:controlAttached')) {
            const m = c.frontierMarks ??= {};
            if (!m.finalControlAura) {
                m.finalControlAura = id + 1;
                m.finalControlOld = c.controller + 1;
            }
            c.controller = a.controller;
        }
    }
    for (const c of g.battlefield.map(id => g.cards[id])) {
        if (c.def.types.includes('Artifact') && finalStatic(g, c.controller, 'artifactFoods').length && !c.def.subtypes?.includes('Food')) {
            c.orbitFinalBase = c.def;
            c.def = { ...c.def, subtypes: [...(c.def.subtypes ?? []), 'Food'] };
            c.orbitFinalApplied = c.def;
        }
    }
}
export function finalGranted(g: GameState, c: Card): ActivatedAbility[] {
    if (!g.orbitFinalGlobals || c.zone !== 'battlefield')
        return [];
    const out: ActivatedAbility[] = [];
    if (c.def.types.includes('Artifact') && finalStatic(g, c.controller, 'artifactFoods').length)
        out.push({ kind: 'activated', cost: { mana: '{2}', tap: true, sacSelf: true }, effects: [{ e: 'gain', n: 3 }], label: '犧牲食物：獲得三點生命' });
    if (c.def.types.includes('Artifact') && finalStatic(g, c.controller, 'artifactOutsideMana').length)
        out.push({ kind: 'activated', cost: { tap: true }, effects: [{ e: 'frontier', action: 'eoe:final:restricted:outside:U' }], manaAbility: true, label: '加入從手牌以外施放咒語專用的藍色法術力' });
    for (const id of g.battlefield) {
        const eq = g.cards[id];
        if (eq.attachedTo === c.id && eq.def.abilities?.some(a => a.kind === 'static' && a.frontier === 'eoe:final:dominionGrant') && !abilitiesSuppressed(g, eq))
            out.push({ kind: 'activated', cost: { mana: '{15}' }, effects: [{ e: 'frontier', action: 'eoe:final:dominion', n: eq.id }], sorcery: true, targets: [{ kind: 'opponent' }], orbitDominion: eq.id, label: '放逐手環：操控對手的下回合' });
    }
    return out;
}
export function finalPermission(g: GameState, p: PID, c: Card) {
    if (c.zone === 'graveyard' && c.owner === p) {
        if (c.def.meadow?.finalGraveCast)
            return true;
        if (isLand(c) && finalStatic(g, p, 'graveLands').length)
            return true;
        if (isLand(c) && finalStatic(g, p, 'siegeGraveLands').some(s => s.frontierMarks?.finalMode === 1))
            return true;
    }
    if (c.zone === 'library' && c.owner === p && g.players[p].library[0] === c.id && c.def.types.includes('Artifact') && finalStatic(g, p, 'topArtifacts').length)
        return true;
    if (c.zone === 'exile' && c.frontierMarks?.finalKavuPermission === p + 1 && own(g, p).some(c => c.def.subtypes?.includes('Kavu')))
        return true;
    return false;
}
export function finalFree(g: GameState, p: PID, c: Card) { return !!(finalStatic(g, p, 'freeDragons').length && c.def.subtypes?.includes('Dragon') || g.active === p && g.players[p].spellsThisTurn === 0 && [...finalStatic(g, 0, 'firstSpellFree'), ...finalStatic(g, 1, 'firstSpellFree')].length); }
export function finalCost(g: GameState, p: PID, c: Card, def: CardDef, cost: import('./mana').ManaCost, targets: (TargetRef | null)[] | undefined) {
    const meta = def.meadow;
    if (meta?.finalNamedLandDiscount)
        cost.generic = Math.max(0, cost.generic - finalNamedLands(g, p));
    if (meta?.finalAffinitySlivers)
        cost.generic = Math.max(0, cost.generic - own(g, p).filter(c => c.def.subtypes?.includes('Sliver')).length);
    if (meta?.finalAttackerDiscount)
        cost.generic = Math.max(0, cost.generic - g.battlefield.filter(id => g.cards[id].attacking).length);
    if (meta?.finalBlockingDiscount && targets?.some(t => t && 'c' in t && g.cards[t.c].blockedBy.length))
        cost.generic = Math.max(0, cost.generic - Number(meta.finalBlockingDiscount));
    if (c.frontierMarks?.finalInquisitor)
        cost.generic++;
    if (g.orbitFinalGlobals) {
        if (finalStatic(g, p, 'affinityArtifacts').length)
            cost.generic = Math.max(0, cost.generic - own(g, p).filter(c => c.def.types.includes('Artifact')).length);
        if (g.active === p)
            cost.generic = Math.max(0, cost.generic - finalStatic(g, p, 'ferociousDiscount').length * own(g, p).filter(c => isCreature(c) && stats(g, c).p >= 4).length);
    }
}
export function finalObserve(g: GameState, e: GameEvent) {
    if (e.type === 'targeted' && g.orbitFinalGlobals) {
        const c = g.cards[e.card];
        if (c && c.controller !== e.by)
            for (const id of g.battlefield) {
                const a = g.cards[id];
                if (a.attachedTo === c.id && a.def.abilities?.some(ab => ab.kind === 'static' && ab.frontier === 'eoe:final:wardAttached1') && !abilitiesSuppressed(g, a))
                    g.pending.push({ source: a.id, controller: a.controller, abilityIndex: -354, ev: e, ability: { kind: 'trigger', on: 'targeted', effects: [{ e: 'frontier', action: 'eoe:final:ward1', n: e.stackSid }] } });
            }
    }
    if (e.type === 'cast') {
        const c = g.cards[e.card], f = frontierFlags(g, e.player), view = c.castFace ?? c.def;
        if (c.zone === 'stack' && view.name === c.def.name)
            for (const [i, a] of (c.def.abilities ?? []).entries())
                if (a.kind === 'trigger' && a.frontierEvent?.endsWith(':final:castSelf') && (!a.cond || checkCond(g, a.cond, e.player, c.id, [], e)))
                    g.pending.push({ source: c.id, controller: e.player, abilityIndex: i, ev: e, ability: a });
        if (view.types.includes('Creature'))
            f.finalCreatureSpell = 1;
        else
            f.finalNoncreatureSpell = 1;
        if (f.finalNextCopy) {
            f.finalNextCopy--;
            g.pending.push({ source: c.id, controller: e.player, abilityIndex: -350, ev: e, ability: { kind: 'trigger', on: 'castAny', effects: [{ e: 'copySpell' }] } });
        }
    }
    if (e.type === 'leaves')
        delete g.cards[e.card].frontierMarks?.finalSuspendHaste;
    if (e.type === 'fin' && e.action === 'controlChange')
        delete g.cards[e.card].frontierMarks?.finalSuspendHaste;
    if (e.type === 'etb') {
        const c = g.cards[e.card];
        delete c.frontierMarks?.finalDealtEver;
        if (isLand(c))
            frontierFlags(g, e.controller).finalLandEntries = (frontierFlags(g, e.controller).finalLandEntries ?? 0) + 1;
        if (c.frontierMarks?.finalCommandSac) {
            delete c.frontierMarks.finalCommandSac;
            g.pending.push({ source: c.id, controller: e.controller, abilityIndex: -351, ev: e, ability: { kind: 'trigger', on: 'etb', effects: [{ e: 'sac', what: 'self' }] } });
        }
    }
    if (e.type === 'counterPlaced') {
        const c = g.cards[e.card];
        if (c) {
            const m = c.frontierMarks ??= {};
            e.orbitFirst = m.finalFirstCounterTurn !== g.turn;
            m.finalFirstCounterTurn = g.turn;
        }
    }
    if (!g.orbitFinalActive)
        return;
    if (e.type === 'attacks') {
        const c = g.cards[e.card];
        if (c.def.subtypes?.includes('Spacecraft'))
            frontierFlags(g, c.controller).finalSpacecraftAttack = 1;
        if ((c.eclCounters?.decayed ?? 0) > 0)
            (g.delayed ??= []).push({ source: c.id, controller: c.controller, on: 'endCombat', once: true, persistent: true, effects: [{ e: 'frontier', action: 'tdm:final:sacDecay' }] });
        for (const id of g.battlefield) {
            const aura = g.cards[id];
            if (aura.attachedTo === c.id && aura.def.abilities?.some(a => a.kind === 'static' && a.frontier === 'eoe:final:choraleAttack') && !abilitiesSuppressed(g, aura))
                g.pending.push({ source: aura.id, controller: aura.controller, abilityIndex: -352, ev: e, ability: { kind: 'trigger', on: 'attacks', targets: [{ kind: 'gyCard', filter: { ctrl: 'opp', type: 'Creature' } }], effects: [{ e: 'frontier', action: 'eoe:final:choraleReturn' }] } });
        }
    }
}
export function finalPreventDamage(g: GameState, source: Card | undefined, controller: PID, victim: PID, n: number) {
    if (!source || n <= 0)
        return false;
    const shield = g.orbitShields?.find(s => s.player === victim && s.turn === g.turn && s.source === source.id && (s.link === undefined || s.link === source.tmtLinkKey));
    if (!shield)
        return false;
    g.orbitShields = g.orbitShields!.filter(s => s !== shield);
    g.pending.push({ source: shield.spell, controller: victim, abilityIndex: -353, ev: { type: 'noncombat', player: victim, amount: n, sourceController: controller }, ability: { kind: 'trigger', on: 'castAny', effects: [{ e: 'damage', to: controller === victim ? 'you' : 'opp', n }, { e: 'draw', n }] } });
    return true;
}
export function finalActivationBlocked(g: GameState, c: Card, a: ActivatedAbility) {
    if (a.orbitDominion !== undefined) {
        const eq = g.cards[a.orbitDominion];
        if (!eq || eq.zone !== 'battlefield' || eq.attachedTo !== c.id)
            return true;
    }
    if ((c.def.types.includes('Artifact') || isCreature(c) || c.def.types.includes('Planeswalker')) && [...finalStatic(g, 0, 'noActivations'), ...finalStatic(g, 1, 'noActivations')].length)
        return true;
    return false;
}
export function finalAbilityCost(g: GameState, c: Card, a: ActivatedAbility, cost: import('./mana').ManaCost, targets?: (TargetRef | null)[]) {
    if (a.orbitNamedLandDiscount)
        cost.generic = Math.max(0, cost.generic - finalNamedLands(g, c.controller));
    if (a.orbitSpacecraftAttackDiscount && frontierFlags(g, c.controller).finalSpacecraftAttack)
        cost.generic = Math.max(0, cost.generic - 3);
    if (a.orbitCounterDiscount && own(g, c.controller).some(c => isCreature(c) && c.counters > 0))
        cost.generic = Math.max(0, cost.generic - a.orbitCounterDiscount);
    if (a.orbitDominion !== undefined)
        cost.generic = Math.max(0, cost.generic - Math.max(0, stats(g, c).p));
    if (a.isEquip && c.def.abilities?.some(ab => ab.kind === 'static' && ab.frontier === 'tdm:final:dragonfireBlade')) {
        const ref = targets?.[0];
        if (ref && 'c' in ref)
            cost.generic = Math.max(0, cost.generic - colorsOf(g.cards[ref.c].def).length);
    }
}
export function finalQuote(g: GameState, p: PID, c: Card, cost: import('./mana').ManaCost) { return finalStatic(g, p, 'delveSpells').length ? { ...cost, generic: Math.max(0, cost.generic - g.players[p].graveyard.filter(id => id !== c.id).length) } : cost; }
export function finalCastTargets(g: GameState, p: PID, c: Card, specs: import('./types').TargetSpec[]) {
    if (c.def.meadow?.finalManaTarget)
        return specs.map(s => ({ ...s, filter: { ...s.filter, mvMax: c.manaSpent ?? 0 } }));
    return specs;
}
export const finalSilenced = (g: GameState, p: PID) => g.active !== p && finalStatic(g, g.active, 'ownTurnSilence').length > 0;
export function finalTriggerAbility(g: GameState, c: Card, a: TriggeredAbility): TriggeredAbility {
    if (c.def.meadow?.finalManaTarget)
        a = { ...a, targets: a.targets?.map(s => ({ ...s, filter: { ...s.filter, mvMax: c.manaSpent ?? 0 } })) };
    if (a.orbitNotAttached)
        a = { ...a, targets: a.targets?.map(s => ({ ...s, filter: { ...s.filter, notIds: c.attachedTo !== null ? [c.attachedTo] : [] } })) };
    return a;
}
