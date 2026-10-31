import { abilitiesSuppressed, isCreature, isLand, matches, other, stats } from './state';
import { frontierFlags, frontierStatic } from './frontier-support';
import { colorsOf, manaValue, parseCost } from './mana';
import { counterKinds } from './ecl-support';
import { campusCondition, campusTrigger } from './campus-support';
import {} from './tla';
import { legalTargets } from './targets';
import type { ActivatedAbility, Card, CardDef, GameEvent, GameState, PID, TargetRef, TriggeredAbility, TargetSpec, Effect, SubFlow, Response, Zone } from './types';
export const webStatic = (g: GameState, p: PID, key: string): Card[] => g.webGlobals ? [...frontierStatic(g, p, 'spm:final:' + key), ...frontierStatic(g, p, 'hob:final:' + key)] : [];
export const webStory = (g: GameState, p: PID) => !!g.webStories?.[p];
export const webModified = (g: GameState, c: Card) => Object.values(counterKinds(c)).some(n => n > 0) || g.battlefield.some(id => { const a = g.cards[id]; return a.attachedTo === c.id && (!!a.def.equip || !!a.def.aura && a.controller === c.controller); });
const own = (g: GameState, p: PID) => g.battlefield.map(id => g.cards[id]).filter(c => c.controller === p);
const keyOf = (key: string) => key.split(':').slice(2).join(':');
const has = (c: Card, key: string) => c.def.abilities?.some(a => a.kind === 'static' && a.frontier?.endsWith(':final:' + key));
const linkedLive = (g: GameState, c: Card, key: string) => { const id = (c.frontierMarks?.[key + 'Source'] ?? 0) - 1, source = g.cards[id]; return !!source && source.zone === 'battlefield' && source.objectVersion === c.frontierMarks?.[key + 'Version']; };
export function webCondition(g: GameState, key: string, p: PID, id: number, e?: GameEvent) {
    const c = g.cards[id], f = frontierFlags(g, p), us = own(g, p);
    switch (keyOf(key)) {
        case 'story': return webStory(g, p);
        case 'wasCast': return !!c.wasCast;
        case 'webCast': return !!c.wasCast && !!c.frontierMarks?.webCast;
        case 'twoEntries': return (f.webCreatureEntries ?? 0) >= 2;
        case 'isCreature': return isCreature(c);
        case 'harnessed': return c.frontierMarks?.webHarnessedVersion === c.objectVersion;
        case 'modified': return webModified(g, c);
        case 'cast4Turn': return !!f.webCast4;
        case 'outsidePlayed': return !!f.webOutsidePlayed;
        case 'mayhem': return !!c.frontierMarks?.webMayhem;
        case 'castGrave': return c.castOrigin === 'graveyard';
        case 'fromGrave': return !!c.wasCast && c.castOrigin === 'graveyard';
        case 'enteredFromGrave': return !!c.frontierMarks?.webEnteredGrave;
        case 'twoSpidersAttack': return us.filter(c => c.attacking && c.def.subtypes?.includes('Spider')).length >= 2;
        case 'notToken': return !c.token;
        case 'attackPower12': return us.filter(c => c.attacking).reduce((n, c) => n + stats(g, c).p, 0) >= 12;
        default: return campusCondition(g, key.split(':')[0] + ':' + keyOf(key), p, id, e);
    }
}
export function webAmount(g: GameState, p: PID, id: number, key: string, e?: GameEvent) {
    const c = g.cards[id];
    switch (keyOf(key)) {
        case 'spiders': return own(g, p).filter(c => c.def.subtypes?.includes('Spider')).length;
        case 'modifiedCount': return own(g, p).filter(c => isCreature(c) && webModified(g, c)).length;
        case 'discarded': return g.players[p].discardedThisTurn ?? 0;
        case 'otherCreatures': return own(g, p).filter(c => c.id !== id && isCreature(c)).length;
        case 'treasures': return own(g, p).filter(c => c.def.subtypes?.includes('Treasure')).length;
        case 'opponentArtifacts': return own(g, other(p)).filter(c => c.def.types.includes('Artifact')).length;
        case 'thresholdGraves': return g.players.filter(p => p.graveyard.length >= 7).length;
        case 'eventMv': return e?.type === 'cast' ? manaValue(g.cards[e.card].castFace ?? g.cards[e.card].def) + (parseCost((g.cards[e.card].castFace ?? g.cards[e.card].def).cost).x ?? 0) * (g.cards[e.card].castX ?? 0) : 0;
        case 'graveGreatestPower': return Math.max(0, ...g.players[p].graveyard.filter(id => isCreature(g.cards[id])).map(id => stats(g, g.cards[id]).p));
        default: throw Error('Unknown web amount ' + key + ' ' + c.def.name);
    }
}
function webBatch(g: GameState, c: Card, key: string) { const batch = g.meadowZoneBatch ?? g.frontierEntryBatch ?? g.mshTokenGroup; if (batch === undefined)
    return true; const m = c.frontierMarks ??= {}; if (m['webBatch:' + key] === batch)
    return false; m['webBatch:' + key] = batch; return true; }
export function webTrigger(g: GameState, c: Card, a: TriggeredAbility, e: GameEvent) {
    const key = keyOf(a.frontierEvent!), p = c.controller, ec = 'card' in e ? g.cards[e.card] : undefined, view = ec?.castFace ?? ec?.def;
    switch (key) {
        case 'modifiedLeaves': return e.type === 'leaves' && e.controller === p && !!ec && isCreature(ec) && webModified(g, ec);
        case 'blueCast': return e.type === 'cast' && e.player === p && !!view && colorsOf(view).includes('U');
        case 'firstTwoDraws': return e.type === 'draw' && e.player === p && g.players[p].drawsThisTurn <= 2;
        case 'attackAlone': return e.type === 'attacks' && !!ec && ec.controller === p && own(g, p).filter(c => c.attacking).length === 1;
        case 'cast4': return e.type === 'cast' && e.player === p && !!view && manaValue(view) + (parseCost(view.cost).x ?? 0) * (ec?.castX ?? 0) >= 4;
        case 'castCreature': return e.type === 'cast' && e.player === p && !!view?.types.includes('Creature');
        case 'matchingCreatureCast': return e.type === 'cast' && e.player === p && !!view?.types.includes('Creature') && manaValue(view) + (parseCost(view.cost).x ?? 0) * (ec?.castX ?? 0) === stats(g, c).p;
        case 'eachMain': return e.type === 'step' && e.step === 'main1';
        case 'playExile': return e.type === 'cast' && e.player === p && ec?.castOrigin === 'exile' || e.type === 'frontier' && e.action === 'webLandPlayed' && e.player === p && e.amount === 2;
        case 'playOutside': return e.type === 'cast' && e.player === p && ec?.castOrigin !== 'hand' || e.type === 'frontier' && e.action === 'webLandPlayed' && e.player === p && e.amount !== 0;
        case 'castOutside': return e.type === 'cast' && e.player === p && ec?.castOrigin !== 'hand';
        case 'menaceAttack': return e.type === 'attacks' && !!ec && ec.controller === p && stats(g, ec).kw.has('menace');
        case 'dealt4': return e.type === 'frontier' && e.action === 'webDealt' && e.card === c.id && e.amount >= 4;
        case 'modifiedCombat': return e.type === 'combatDamage' && g.cards[e.source].controller === p && webModified(g, g.cards[e.source]);
        case 'greatestOpponentDeath': return e.type === 'dies' && e.controller !== p && e.power >= Math.max(0, ...own(g, e.controller).filter(isCreature).map(c => stats(g, c).p));
        case 'opponentDies': return e.type === 'dies' && e.controller !== p;
        case 'damagedSpider': return e.type === 'frontier' && e.action === 'webDealt' && e.card === c.id && e.other !== undefined && !!g.cards[e.other]?.def.subtypes?.includes('Spider');
        case 'blocksSelf': return e.type === 'blocks' && e.card === c.id;
        case 'artifactEtb': return e.type === 'etb' && e.controller === p && !!ec?.def.types.includes('Artifact');
        case 'draw': return e.type === 'draw' && e.player === p;
        case 'tokenEtb': return e.type === 'etb' && e.controller === p && !!ec?.token;
        case 'oppDrawSecond': return e.type === 'drawSecond' && e.player !== p;
        case 'oppFirstNoncreature': return e.type === 'cast' && e.player !== p && !!view && !view.types.includes('Creature') && g.players[e.player].noncreatureThisTurn === 1;
        case 'creatureAbility': return e.type === 'frontier' && e.action === 'webActivate' && e.player === p && !!ec && e.amount === 1;
        case 'opponentParityCast': return e.type === 'cast' && e.player !== p && !!view && ((manaValue(view) + (parseCost(view.cost).x ?? 0) * (ec?.castX ?? 0)) % 2 === (c.frontierMarks?.webParity === 1 ? 0 : 1));
        case 'graveCreatureLeave': return e.type === 'fin' && e.action === 'zoneMove' && e.from === 'graveyard' && e.player === p && !!ec && isCreature(ec);
        case 'otherDeathBatch': return e.type === 'dies' && e.card !== c.id && webBatch(g, c, 'death');
        case 'selfToGrave': return e.type === 'fin' && e.action === 'zoneMove' && e.from === 'battlefield' && e.to === 'graveyard' && e.card === c.id;
        case 'lifeLost': return e.type === 'lifeloss';
        case 'tokenSacrifice': return e.type === 'sacrifice' && e.player === p && !!ec?.token;
        case 'goblinCounters': return e.type === 'counterPlaced' && e.controller === p && (e.actor ?? p) === p && !!ec && matches(g, { sub: ['Goblin', 'Orc', 'Army'] }, ec, p);
        case 'treasureCast': return e.type === 'cast' && e.player === p && !!ec?.frontierMarks?.webTreasureCast;
    }
    if (key.startsWith('namedCombat:'))
        return e.type === 'combatDamage' && g.cards[e.source].def.name === decodeURIComponent(key.slice(12));
    return campusTrigger(g, c, { ...a, frontierEvent: a.frontierEvent!.split(':')[0] + ':' + key }, e);
}
export function webEntry(g: GameState, c: Card, p: PID, origin: Zone) {
    if (c.def.meadow?.webShire)
        g.webActive = true;
    if (c.def.abilities?.some(a => a.kind === 'static' && /^(spm|hob):/.test(a.frontier ?? '')))
        g.webGlobals = true;
    const m = c.frontierMarks ??= {};
    c.counters += m.webRiotCounters ?? 0;
    if (m.webRiotHaste)
        c.permanentGrants = [...(c.permanentGrants ?? []), { p: 0, t: 0, kw: ['haste'] }];
    delete m.webRiotCounters;
    delete m.webRiotHaste;
    m.webEnteredGrave = Number(origin === 'graveyard');
    delete m.webHarnessed;
    delete m.webHarnessedVersion;
    if (origin === 'stack' && m.webCast && c.def.meadow?.webReturnCounters)
        c.counters += m.webReturnMv ?? 0;
    if (c.def.meadow?.webFilm)
        (c.eclCounters ??= {}).film = Number(c.def.meadow.webFilm);
    if (g.webGlobals && (isCreature(c) || c.def.types.includes('Artifact')) && webStatic(g, other(p), 'opponentEnterTapped').length)
        c.tapped = true;
}
export function webRestore(g: GameState) { if (!g.webActive)
    return; for (const id of g.battlefield) {
    const c = g.cards[id];
    if (c.webTypeDef) {
        if (c.def === c.webAppliedDef)
            c.def = c.webTypeDef;
        c.webTypeDef = undefined;
        c.webAppliedDef = undefined;
    }
} }
export function webRefresh(g: GameState) {
    if (!g.webActive)
        return;
    webRestore(g);
    for (const id of g.battlefield) {
        const c = g.cards[id], m = c.frontierMarks;
        if (m?.webHydroUntil && g.active === c.controller && g.turn >= m.webHydroUntil && c.baseDef) {
            c.def = c.baseDef;
            c.baseDef = undefined;
            delete m.webHydroUntil;
            delete m.animationUntilTurn;
        }
    }
    for (const p of [0, 1] as PID[]) {
        const us = own(g, p);
        if (!webStory(g, p) && us.some(c => c.def.meadow?.webStoried && !abilitiesSuppressed(g, c)) && us.filter(c => c.def.types.includes('Artifact') || c.def.supertypes?.includes('Legendary') || c.def.subtypes?.includes('Saga')).length >= 3)
            (g.webStories ??= [false, false])[p] = true;
    }
    if (!g.webGlobals && g.battlefield.some(id => g.cards[id].def.abilities?.some(a => a.kind === 'static' && /^(spm|hob):/.test(a.frontier ?? ''))))
        g.webGlobals = true;
    if (!g.webGlobals)
        return;
    for (const c of g.battlefield.map(id => g.cards[id])) {
        const auras = g.battlefield.map(id => g.cards[id]).filter(a => a.attachedTo === c.id && !abilitiesSuppressed(g, a)), citizen = auras.some(a => has(a, 'citizenAura')), symbiote = auras.some(a => has(a, 'symbioteAura')), spider = auras.some(a => has(a, 'spiderHeroEquipment'));
        if (citizen || symbiote || spider) {
            c.webTypeDef = c.def;
            c.def = { ...c.def, subtypes: citizen ? ['Citizen'] : [...new Set([...(c.def.subtypes ?? []), ...(symbiote ? ['Symbiote'] : []), ...(spider ? ['Spider', 'Hero'] : [])])] };
            c.webAppliedDef = c.def;
        }
    }
}
export function webBaseStats(g: GameState, c: Card, st: import('./state').Stats) {
    if (g.webGlobals && g.battlefield.some(id => { const a = g.cards[id]; return a.attachedTo === c.id && has(a, 'citizenAura') && !abilitiesSuppressed(g, a); })) {
        st.p = st.t = 1;
        return;
    }
    if (!c.def.meadow?.webShire && !c.def.abilities?.some(a => a.kind === 'static' && /^(spm|hob):/.test(a.frontier ?? '')))
        return;
    if (abilitiesSuppressed(g, c))
        return;
    const p = c.controller;
    if (has(c, 'landsBody'))
        st.p = st.t = own(g, p).filter(isLand).length;
    if (has(c, 'mountainsBody'))
        st.p = st.t = own(g, p).filter(c => c.def.subtypes?.includes('Mountain')).length;
    if (has(c, 'octopusBase') && g.players[p].graveyard.length >= 8)
        st.p = st.t = 8;
    if (has(c, 'greatestMvBody'))
        st.p = Math.max(0, ...own(g, p).map(c => manaValue(c.def)));
    if (has(c, 'creatureCountPower'))
        st.p = own(g, p).filter(isCreature).length;
}
export function webStats(g: GameState, c: Card, st: import('./state').Stats) {
    if (!g.webActive)
        return;
    const m = c.frontierMarks;
    if (m?.webCantBlockTurn === g.turn)
        st.cantBlock = true;
    if (linkedLive(g, c, 'webHexproof'))
        st.kw.add('hexproof');
    if (!abilitiesSuppressed(g, c)) {
        if (has(c, 'mountainPower2'))
            st.p += 2 * own(g, c.controller).filter(c => c.def.subtypes?.includes('Mountain')).length;
        if (has(c, 'thresholdGravePower'))
            st.p += 2 * g.players.filter(p => p.graveyard.length >= 7).length;
        if (has(c, 'storyUntap') && !webStory(g, c.controller))
            st.noUntap = true;
        if (has(c, 'twoOtherWolvesAttack') && own(g, c.controller).filter(x => x.id !== c.id && x.def.subtypes?.includes('Wolf')).length < 2)
            st.cantAttack = true;
    }
    if (!g.webGlobals) {
        st.p += g.battlefield.reduce((n, id) => n + (g.cards[id].attachedTo === c.id && g.cards[id].def.subtypes?.includes('Equipment') ? (g.cards[id].eclCounters?.hone ?? 0) : 0), 0);
        return;
    }
    for (const id of g.battlefield) {
        const a = g.cards[id];
        if (a.attachedTo !== c.id)
            continue;
        if (a.def.subtypes?.includes('Equipment'))
            st.p += a.eclCounters?.hone ?? 0;
        if (abilitiesSuppressed(g, a))
            continue;
        if (has(a, 'greatPower')) {
            const n = g.battlefield.filter(id => g.cards[id].attachedTo === c.id && g.cards[id].def.subtypes?.some(s => s === 'Aura' || s === 'Equipment')).length;
            st.p += 2 * n;
            st.t += 2 * n;
        }
    }
    for (const s of webStatic(g, c.controller, 'chosenAnthem2'))
        if (s.eclType && c.def.subtypes?.includes(s.eclType)) {
            st.p += 2;
            st.t += 2;
        }
}
export function webCanBlock(g: GameState, b: Card, a: Card) { if (!g.webActive)
    return true; if (!abilitiesSuppressed(g, a)) {
    if (has(a, 'smallCantBlock') && stats(g, b).p <= 2)
        return false;
    if (has(a, 'tokensCantBlock') && b.token)
        return false;
} if (g.webGlobals && a.def.subtypes?.includes('Spider') && stats(g, b).kw.has('defender') && webStatic(g, a.controller, 'spiderNoDefenderBlock').length)
    return false; return true; }
export function webExtraTriggers(g: GameState, c: Card) { if (!g.webGlobals)
    return 0; let n = webStory(g, c.controller) && c.def.subtypes?.includes('Dwarf') ? webStatic(g, c.controller, 'storyDwarfDouble').length : 0; for (const id of g.battlefield) {
    const eq = g.cards[id];
    if (eq.attachedTo === c.id && has(eq, 'equippedTriggerDouble') && !abilitiesSuppressed(g, eq))
        n++;
} return n; }
export function webObserve(g: GameState, e: GameEvent) {
    if (e.type === 'step' && e.step === 'draw')
        frontierFlags(g, e.player).webDrawStepSeen = 0;
    if (e.type === 'draw' && g.phase === 'draw' && g.active === e.player)
        frontierFlags(g, e.player).webDrawStepSeen = 1;
    if (e.type === 'leaves' || e.type === 'fin' && e.action === 'controlChange')
        for (const id of g.players.flatMap(pl => pl.exile)) {
            const c = g.cards[id], m = c.frontierMarks;
            if (m?.webGwenSource === e.card) {
                const source = g.cards[e.card];
                if (e.type === 'leaves' || !source || source.controller !== c.playableBy) {
                    c.playableTurn = undefined;
                    c.playableUntil = undefined;
                    c.eclCast = undefined;
                    delete m.webGwenSource;
                }
            }
        }
    if (e.type === 'fin' && e.action === 'zoneMove' && e.from === 'exile' && g.cards[e.card].frontierMarks?.webAnyMana) {
        delete g.cards[e.card].finMarks?.anyMana;
        delete g.cards[e.card].frontierMarks?.webAnyMana;
    }
    if (e.type === 'cast') {
        const c = g.cards[e.card], f = frontierFlags(g, e.player), def = c.castFace ?? c.def;
        if (manaValue(def) + (parseCost(def.cost).x ?? 0) * (c.castX ?? 0) >= 4)
            f.webCast4 = 1;
        if (c.castOrigin !== 'hand')
            f.webOutsidePlayed = 1;
        if (f.webNextCreatureCopy && def.types.includes('Creature')) {
            f.webNextCreatureCopy--;
            g.pending.push({ source: c.id, controller: e.player, abilityIndex: -400, ev: e, ability: { kind: 'trigger', on: 'castAny', effects: [{ e: 'frontier', action: 'spm:final:copyNonlegend' }] } });
        }
    }
    if (e.type === 'etb' && isCreature(g.cards[e.card])) {
        const f = frontierFlags(g, e.controller);
        f.webCreatureEntries = (f.webCreatureEntries ?? 0) + 1;
    }
    if (e.type === 'frontier' && e.action === 'webLandPlayed' && e.amount !== 0)
        frontierFlags(g, e.player).webOutsidePlayed = 1;
    if (e.type === 'fin' && e.action === 'zoneMove' && e.from === 'battlefield' && e.to === 'graveyard' && g.cards[e.card].frontierMarks?.bdWasCreature)
        (g.cards[e.card].frontierMarks ??= {}).webDiedTurn = g.turn;
    webRefresh(g);
}
export function webGranted(g: GameState, c: Card): ActivatedAbility[] {
    if (!g.webGlobals || c.zone !== 'battlefield')
        return [];
    const out: ActivatedAbility[] = [];
    for (const id of g.battlefield) {
        const a = g.cards[id];
        if (a.attachedTo === c.id && has(a, 'neighborhood') && !abilitiesSuppressed(g, a))
            out.push({ kind: 'activated', cost: { mana: '{1}', tap: true }, sorcery: true, targets: [{ kind: 'creature' }], effects: [{ e: 'pump', what: 'T0', p: { count: { ctrl: 'you', type: 'Creature' } }, t: { count: { ctrl: 'you', type: 'Creature' } } }], label: '依己方生物數強化' });
    }
    if (has(c, 'graveElfAbilities') && !abilitiesSuppressed(g, c))
        for (const id of g.players[c.controller].graveyard) {
            const elf = g.cards[id];
            if (elf.def.subtypes?.includes('Elf'))
                out.push(...(elf.def.abilities ?? []).filter((a): a is ActivatedAbility => a.kind === 'activated'));
        }
    return out;
}
export function webPermission(g: GameState, p: PID, c: Card) {
    if (!g.webActive && !c.def.meadow?.webShire)
        return false;
    const f = frontierFlags(g, p), m = c.frontierMarks;
    if (c.zone === 'graveyard' && c.owner === p && isLand(c) && c.def.meadow?.webMayhemLand && c.discardedTurn === g.turn)
        return true;
    if (c.zone === 'library' && c.owner === p && g.players[p].library[0] === c.id && (f.webTopLife || webStatic(g, p, 'spiderTop').length && (c.def.subtypes?.includes('Spider') || !c.def.types.includes('Creature'))))
        return true;
    if (c.zone === 'exile' && m?.webWizardPermission === p + 1 && own(g, p).some(c => c.def.subtypes?.includes('Wizard')))
        return true;
    return false;
}
export function webCastBlocked(g: GameState, p: PID, c?: Card) { if (frontierFlags(g, p).webNoCast)
    return true; if (c && has(c, 'futureRestriction') && g.active === p && (g.players[p].webOwnTurns ?? Math.ceil(g.turn / 2)) <= 3)
    return true; return false; }
export function webCost(g: GameState, p: PID, c: Card, def: CardDef, cost: import('./mana').ManaCost, targets?: (TargetRef | null)[]) {
    if (!g.webGlobals && !c.def.meadow?.webShire)
        return;
    const meta = c.def.meadow, us = own(g, p);
    if (meta?.webSpiderDiscount && targets?.[0] && 'c' in targets[0] && g.cards[targets[0].c].def.subtypes?.includes('Spider'))
        cost.generic = Math.max(0, cost.generic - Number(meta.webSpiderDiscount));
    if (meta?.webTappedDiscount && targets?.[0] && 'c' in targets[0] && g.cards[targets[0].c].tapped)
        cost.generic = Math.max(0, cost.generic - Number(meta.webTappedDiscount));
    if (meta?.webAttackingNontokenDiscount && targets?.[0] && 'c' in targets[0]) {
        const t = g.cards[targets[0].c];
        if (t.attacking && !t.token)
            cost.generic = Math.max(0, cost.generic - Number(meta.webAttackingNontokenDiscount));
    }
    if (meta?.webFlyingDiscount)
        cost.generic = Math.max(0, cost.generic - us.filter(c => isCreature(c) && stats(g, c).kw.has('flying')).reduce((n, c) => n + Math.max(0, stats(g, c).p), 0));
    if (meta?.webAffinityElf)
        cost.generic = Math.max(0, cost.generic - us.filter(c => c.def.subtypes?.includes('Elf')).length);
    if (!g.webGlobals)
        return;
    if (c.castOrigin === 'graveyard' || c.zone === 'graveyard')
        cost.generic = Math.max(0, cost.generic - 2 * webStatic(g, p, 'graveDiscount2').length);
    if (c.zone !== 'hand')
        cost.generic = Math.max(0, cost.generic - webStatic(g, p, 'outsideDiscount').length);
    if (def.types.includes('Creature') && (g.players[p].spellsThisTurn - (g.players[p].noncreatureThisTurn ?? 0) === 0))
        cost.generic = Math.max(0, cost.generic - 2 * webStatic(g, p, 'firstCreatureDiscountFlash').length);
    if (def.types.some(t => t === 'Instant' || t === 'Sorcery'))
        for (const eq of webStatic(g, p, 'equippedSpellDiscount')) {
            const host = g.cards[eq.attachedTo ?? -1];
            if (host)
                cost.generic = Math.max(0, cost.generic - Math.max(0, stats(g, host).p));
        }
    for (const source of [...webStatic(g, 0, 'chosenSpellTax'), ...webStatic(g, 1, 'chosenSpellTax')])
        if (source.eclType && def.types.includes(source.eclType as any))
            cost.generic++;
}
export function webAbilityCost(g: GameState, c: Card, a: ActivatedAbility, cost: import('./mana').ManaCost, targets?: (TargetRef | null)[]) { if (a.webEquipmentDiscount)
    cost.generic = Math.max(0, cost.generic - own(g, c.controller).filter(c => c.def.subtypes?.includes('Equipment')).length); if (!a.isEquip || !g.webGlobals)
    return; const ref = targets?.[0], body = ref && 'c' in ref ? g.cards[ref.c] : undefined; if (body && has(body, 'equipMeLess2') && !abilitiesSuppressed(g, body))
    cost.generic = Math.max(0, cost.generic - 2); if (webStory(g, c.controller) && !frontierFlags(g, c.controller).webEquipUsed && webStatic(g, c.controller, 'firstEquipFree').length) {
    for (const color of ['generic', 'W', 'U', 'B', 'R', 'G', 'C'] as const)
        cost[color] = 0;
    cost.hyb = [];
} }
export function webFlash(g: GameState, p: PID, def: CardDef) { return def.types.includes('Creature') && (g.players[p].spellsThisTurn - (g.players[p].noncreatureThisTurn ?? 0) === 0) && webStatic(g, p, 'firstCreatureDiscountFlash').length > 0; }
export function webWard(g: GameState, c: Card) { if (!g.webGlobals)
    return 0; let n = webStory(g, c.controller) && (isCreature(c) || c.def.types.includes('Artifact')) ? webStatic(g, c.controller, 'storyWard1').length : 0; for (const id of g.battlefield) {
    const a = g.cards[id];
    if (a.attachedTo === c.id && has(a, 'equippedWard1') && !abilitiesSuppressed(g, a))
        n++;
} return n; }
export function webNoCounter(g: GameState) { return !!(g.webGlobals && (webStatic(g, 0, 'uncounterableAll').length || webStatic(g, 1, 'uncounterableAll').length)); }
export function webNoPrevent(g: GameState) { return !!(g.webGlobals && (webStatic(g, 0, 'noPrevent').length || webStatic(g, 1, 'noPrevent').length)); }
export function webPrevent(g: GameState, source: Card | null, victim: Card | undefined, n: number) { if (source && linkedLive(g, source, 'webFog'))
    return true; if (victim && has(victim, 'antivenom') && !abilitiesSuppressed(g, victim)) {
    return true;
} return false; }
export function webRedirect(g: GameState, p: PID) { if (!g.webGlobals)
    return; for (const a of webStatic(g, p, 'greatPower')) {
    const c = g.cards[a.attachedTo ?? -1];
    if (c?.zone === 'battlefield')
        return c;
} }
export function webDeathSource(g: GameState, c: Card) { if (!g.webGlobals || !isCreature(c) || c.zone !== 'battlefield')
    return; return webStatic(g, other(c.controller), 'opponentDeathWolf')[0]; }
export function webLegendExempt(g: GameState, c: Card) { return !!(c.def.subtypes?.includes('Spider') && webStatic(g, c.controller, 'spiderLegend').length); }
export function webForced(g: GameState, c: Card) { return !!((c.frontierMarks?.webForceAttack ?? 0) > g.turn || has(c, 'mustAttack') && !abilitiesSuppressed(g, c)); }
export function webLifeEligible(g: GameState, p: PID, c: Card) { return !!(c.zone === 'exile' && c.frontierMarks?.webLifePermission === p + 1 && (c.playableUntil ?? c.playableTurn ?? -1) >= g.turn || c.zone === 'library' && c.owner === p && g.players[p].library[0] === c.id && frontierFlags(g, p).webTopLife); }
export function webLifeOnly(g: GameState, p: PID, c: Card) { return webLifeEligible(g, p, c) && (c.zone === 'exile' || !(webStatic(g, p, 'spiderTop').length && (c.def.subtypes?.includes('Spider') || !c.def.types.includes('Creature')))); }
export function webVariableMax(g: GameState, p: PID, c: Card, def: CardDef) { switch (def.meadow?.webVariable) {
    case 'sixNames': return Math.min(6, new Set(g.players[p].graveyard.filter(id => isCreature(g.cards[id])).map(id => g.cards[id].def.name)).size);
    case 'artifactCreatureX': return g.battlefield.filter(id => g.cards[id].def.types.some(t => t === 'Artifact' || t === 'Creature')).length;
    case 'eagles': return g.battlefield.filter(id => g.cards[id].owner === p && isCreature(g.cards[id])).length;
    default: return 0;
} }
export function webTargets(g: GameState, p: PID, c: Card, def: CardDef, specs: TargetSpec[], mode?: number): TargetSpec[] { const kind = def.meadow?.webVariable; if (!kind)
    return specs; if (kind === 'sixNames')
    return Array.from({ length: mode ?? 0 }, () => ({ kind: 'gyCard', filter: { ctrl: 'you', type: 'Creature' }, webDifferentNames: true })); if (kind === 'artifactCreatureX')
    return Array.from({ length: mode ?? 0 }, () => ({ kind: 'permanent', filter: { type: ['Artifact', 'Creature'] } })); if (kind === 'eagles')
    return Array.from({ length: def.ecl?.variableTargets ? mode ?? 0 : 1 }, () => ({ kind: 'creature', filter: { owner: 'you' } })); return specs; }
const activationCreatures = (g: GameState, c: Card) => g.battlefield.filter(id => g.cards[id].controller === c.controller && isCreature(g.cards[id]));
function webCounterDefaults(g: GameState, c: Card, n: number) { const out: number[] = []; for (const id of g.battlefield) {
    const a = g.cards[id];
    if (a.controller === c.controller && a.def.types.includes('Artifact'))
        for (let i = 0; i < a.counters && out.length < n; i++)
            out.push(id);
} return out; }
export function webActivationCosts(g: GameState, c: Card, a: ActivatedAbility, action?: Extract<import('./types').PriorityAction, {
    type: 'activate';
}>) {
    if (a.webRemoveKind && (c.eclCounters?.[a.webRemoveKind] ?? 0) < 1)
        return false;
    if (a.webExileCreature) {
        const ids = activationCreatures(g, c), chosen = action?.costCards ?? ids.slice(0, 1);
        if (chosen.length !== 1 || !ids.includes(chosen[0]))
            return false;
    }
    if (a.webReturnTapped) {
        const ids = activationCreatures(g, c).filter(id => g.cards[id].tapped), chosen = action?.costCards ?? ids.slice(0, 1);
        if (chosen.length !== 1 || !ids.includes(chosen[0]))
            return false;
    }
    if (a.webRemoveCounters) {
        const chosen = action?.webCounterCards ?? webCounterDefaults(g, c, a.webRemoveCounters), counts: Record<number, number> = {};
        for (const id of chosen)
            counts[id] = (counts[id] ?? 0) + 1;
        if (chosen.length !== a.webRemoveCounters || Object.entries(counts).some(([id, n]) => { const card = g.cards[Number(id)]; return !card || card.zone !== 'battlefield' || card.controller !== c.controller || !card.def.types.includes('Artifact') || card.counters < n; }))
            return false;
    }
    return true;
}
export function webPayActivationCosts(g: GameState, c: Card, a: ActivatedAbility, action: Extract<import('./types').PriorityAction, {
    type: 'activate';
}>) {
    if (a.webRemoveKind)
        c.eclCounters![a.webRemoveKind]--;
    if (a.webExileCreature) {
        const id = action.costCards?.[0] ?? activationCreatures(g, c)[0];
        if (id !== undefined)
            webMove(g, g.cards[id], 'exile');
    }
    if (a.webReturnTapped) {
        const id = action.costCards?.[0] ?? activationCreatures(g, c).find(id => g.cards[id].tapped);
        if (id !== undefined)
            webMove(g, g.cards[id], 'hand');
    }
    if (a.webRemoveCounters)
        for (const id of action.webCounterCards ?? webCounterDefaults(g, c, a.webRemoveCounters))
            g.cards[id].counters--;
}
// Importing zone functions is safe: these helpers run only after registry initialization.
import { moveCard as webMove } from './zones';
export function webNeedsRiot(g: GameState, c: Card, p: PID, def = c.def) { return Number(!!def.meadow?.webRiot) + (def.subtypes?.includes('Spider') ? webStatic(g, p, 'riotSpiders').filter(s => s.id !== c.id).length : 0); }
export function* webChooseRiot(g: GameState, c: Card, p: PID, def?: CardDef): SubFlow { const n = webNeedsRiot(g, c, p, def), m = c.frontierMarks ??= {}; m.webRiotCounters = 0; m.webRiotHaste = 0; for (let i = 0; i < n; i++) {
    const r: Response = yield { type: 'mode', player: p, prompt: '起事：選擇進場指示物或敏捷', options: ['一個+1/+1指示物', '敏捷'], count: 1, purpose: 'trigger' };
    if (r.type === 'modes' && r.picks[0] === 1)
        m.webRiotHaste = 1;
    else
        m.webRiotCounters++;
} }
export function* webTriggerAbility(g: GameState, c: Card, a: TriggeredAbility): SubFlow<TriggeredAbility> {
    if (!a.webDistribution)
        return a;
    const p = c.controller, kind = a.webDistribution;
    if (kind === 'equipmentAttach') {
        const max = own(g, p).filter(c => c.def.subtypes?.includes('Equipment')).length, r: Response = yield { type: 'mode', player: p, prompt: '選擇武具目標數量', options: Array.from({ length: max + 1 }, (_, i) => String(i)), count: 1, purpose: 'count' }, n = r.type === 'modes' ? r.picks[0] ?? 0 : 0;
        return { ...a, targets: [{ kind: 'creature', filter: { ctrl: 'you' } }, ...Array.from({ length: n }, (): TargetSpec => ({ kind: 'permanent', filter: { ctrl: 'you', sub: 'Equipment' } }))] };
    }
    const template: TargetSpec = { kind: kind === 'players' ? 'player' : 'any' }, max = kind === 'players' ? Math.min(2, legalTargets(g, template, p, c.id).length) : Math.min(3, legalTargets(g, template, p, c.id).length), min = kind === 'players' ? 0 : 1;
    if (max < min)
        return { ...a, effects: [], targets: [] };
    const r: Response = yield { type: 'mode', player: p, prompt: '選擇目標數量', options: Array.from({ length: max - min + 1 }, (_, i) => String(i + min)), count: 1, purpose: 'count' }, n = min + (r.type === 'modes' ? r.picks[0] ?? 0 : 0), targets = Array.from({ length: n }, () => template);
    if (kind === 'players')
        return { ...a, targets };
    let left = 3;
    const effects: Effect[] = [];
    for (let i = 0; i < n; i++) {
        const max = left - (n - i - 1);
        let v = max;
        if (i < n - 1) {
            const answer: Response = yield { type: 'mode', player: p, prompt: '分給第' + (i + 1) + '個目標的傷害', options: Array.from({ length: max }, (_, j) => String(j + 1)), count: 1, purpose: 'count' };
            v = 1 + (answer.type === 'modes' ? answer.picks[0] ?? 0 : 0);
        }
        left -= v;
        effects.push({ e: 'damage', to: 'T' + i as 'T0', n: v });
    }
    return { ...a, targets, effects };
}
export function webPrepareEntry(c: Card) {
    if(c.webArtifactEntry){delete c.webArtifactEntry;c.baseDef??=c.def;c.def={...c.def,types:['Artifact']};(c.frontierMarks??={}).permanentAnimation=1;} if (!c.webFoodEntry)
    return; delete c.webFoodEntry; c.baseDef ??= c.def; c.def = { ...c.def, types: ['Artifact'], subtypes: ['Food'], abilities: [...(c.def.abilities ?? []), { kind: 'activated', cost: { mana: '{2}', tap: true, sacSelf: true }, effects: [{ e: 'gain', n: 3 }], label: '犧牲食物' }] }; (c.frontierMarks ??= {}).permanentAnimation = 1; }
