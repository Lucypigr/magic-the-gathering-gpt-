import { add, defs, slug } from "../dsl";
import { REPRINTS } from "../reprints";
import type {
  Ability,
  CardDef,
  Effect,
  Filter,
  Ref,
  TargetSpec,
  TriggeredAbility,
  Amt,
  Mode,
} from "../../engine/types";
export function setBuilder(code: "WOE" | "OTJ" | "FDN" | "DSK" | "LCI" | "SOS" | "EOE" | "TDM", catalog: any[], auto: object) {
  const patches = new Map<number, Partial<CardDef>>(
    Object.entries(auto).map(([n, p]) => [Number(n), p]),
  );
  const d = (n: number, p: Partial<CardDef> = {}) =>
    patches.set(n, { ...patches.get(n), ...p });
  const a = (n: number, abilities: Ability[]) => d(n, { abilities });
  const s = (n: number, effects: Effect[], targets?: TargetSpec[]) =>
    d(n, { spell: { effects, targets } });
  const adv = (n: number, effects: Effect[], targets?: TargetSpec[]) =>
    d(n, {
      adventure: {
        ...catalog.find((c) => c.number === n).adventure,
        spell: { effects, targets },
      },
    });
  const modes = (n: number, modes: Mode[]) => d(n, { spell: { modes } });
  const saga = (
    n: number,
    chapters: NonNullable<CardDef["saga"]>["chapters"],
  ) => d(n, { saga: { chapters } });
  const E = (
    action: number | string,
    what: Ref = "T0",
    n?: number,
  ): Effect => ({
    e: "frontier",
    action: code.toLowerCase() + ":" + action,
    what,
    n,
  });
  const C = (action: string) => ({ c: "frontier" as const, action });
  const N = (action: string): Amt => ({ frontier: action });
  const F = (frontier: string): Ability => ({ kind: "static", frontier });
  const event = (
    frontierEvent: string,
    effects: Effect[],
    extra: Partial<TriggeredAbility> = {},
  ): TriggeredAbility => ({
    kind: "trigger",
    on: "frontierEvent",
    frontierEvent,
    effects,
    ...(["selfToGrave", "enchantEtbFromGrave"].includes(frontierEvent)
      ? { fromGraveyard: true }
      : {}),
    ...extra,
  });
  const complete = (partial = false) => {
    for (const row of catalog) {
      const old = defs.find((c) => c.id === slug(row.name));
      const patch = patches.get(row.number);
      if (!patch) { if(old&&(code==='EOE'||code==='TDM')){const list=(REPRINTS[code]??=[]);if(!list.some(([id])=>id===old.id))list.push([old.id,row.rarity]);continue;} if(partial) continue; throw Error(code + " missing " + row.number + " " + row.name); }
      // Partial batches must preserve the established definition of shared reprints.
      if((partial||code==='EOE'||code==='TDM')&&old&&old.set!==code){
        const list=(REPRINTS[code]??=[]);
        if(!list.some(([id])=>id===old.id))list.push([old.id,row.rarity]);
        continue;
      }
      const c = {
        ...row,
        ...patch,
        id: slug(row.name),
        text: row.text,
      } as unknown as CardDef;
      if(code==='LCI'||code==='SOS'){
       const ward=row.text.match(/Ward \{(\d+)\}/);if(ward)c.ward=Number(ward[1]);
       const fb=row.text.match(/Flashback ((?:\{[^}]+\})+)/);if(fb)c.flashback=fb[1];
       if(/(?:This creature|[A-Z][^\n]+) enters prepared[.\n]/.test(row.text))c.etbPrepared=true;
       for(const key of ['back','prepare','adventure']as const)if(row[key]){c[key]={...row[key],...c[key],text:row[key].text}as any;if(key==='back'){c.back!.id=slug(row.name)+'-back';c.back!.set=code;}}
       if(row.text.includes('Increment ('))c.abilities=[...(c.abilities??[]),{kind:'trigger',on:'frontierEvent',frontierEvent:'sos:increment',effects:[{e:'counters',what:'self',n:1}]}];
       if(row.text.includes('Paradigm (')){c.meadow={...c.meadow,paradigm:true};if(c.spell?.effects)c.spell.effects=[...c.spell.effects,{e:'frontier',action:'sos:paradigm'}];if(c.spell?.modes)c.spell.modes=c.spell.modes.map(m=>({...m,effects:[...m.effects,{e:'frontier',action:'sos:paradigm'}]}));}
       for(const ab of c.abilities??[])if(ab.kind==='activated'&&ab.cost.craft)ab.effects=ab.effects.map(e=>e.e==='returnTransformed'?{e:'frontier',action:'lci:craftReturn'}:e);
       if(c.meadow?.campusWardLife)c.wardLife=Number(c.meadow.campusWardLife);
       if(c.meadow?.campusVariable)c.ecl={...c.ecl,variableTargets:'creature'};
       const fixGrave=(value:any):any=>Array.isArray(value)?value.map(fixGrave):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).map(([k,v])=>[k,k==='what'&&v==='self'?'selfAny':fixGrave(v)])):value;
       for(const ab of c.abilities??[])if(ab.kind==='activated'&&ab.fromGraveyard)ab.effects=fixGrave(ab.effects);

     }
      if(code==='EOE'||code==='TDM'){
       const ward=row.text.match(/Ward \{(\d+)\}/);if(ward)c.ward=Number(ward[1]);
       const warp=row.text.match(/^Warp ((?:\{[^}]+\})+)/m);if(warp)c.warp=warp[1];
       const harmonize=row.text.match(/^Harmonize ((?:\{[^}]+\})+)/m);if(harmonize)c.harmonize=harmonize[1];
       if(row.adventure)c.meadow={...c.meadow,orbitOmen:true};
      }
      if(row.text.includes("This spell can't be countered."))c.uncounterable=true;
      const impending=row.text.match(/Impending (\d+)—((?:\{[^}]+\})+)/);if(impending)c.impending={n:Number(impending[1]),cost:impending[2]};
      if(code==='FDN'||code==='DSK')for(const ab of c.abilities??[]){if(ab.kind!=='trigger')continue;const lines=row.text.split('\n').filter((line:string)=>/^Whenever /.test(line));if(ab.on==='allyDies'&&lines.some((line:string)=>/you control dies/.test(line)&&(!/\b(?:another|other)\b/.test(line)||/(?:this creature|this permanent|another creature) or another/.test(line))))ab.includeSelf=true;}
      const plot = row.text.match(/^Plot ((?:\{[^}]+\})+)/m);
      if (plot) c.plot = plot[1];
      const saddle = row.text.match(/^Saddle (\d+)/m);
      if (
        saddle &&
        !c.abilities?.some(
          (a) =>
            a.kind === "activated" && a.effects.some((e) => e.e === "saddle"),
        )
      )
        c.abilities = [
          ...(c.abilities ?? []),
          {
            kind: "activated",
            cost: { crew: Number(saddle[1]) },
            sorcery: true,
            label: "騎乘" + saddle[1],
            effects: [{ e: "saddle" }],
          },
        ];
      if (
        row.text.startsWith("Bargain") &&
        !row.types.some((t: string) => t === "Instant" || t === "Sorcery")
      )
        c.frontier = { ...c.frontier, bargain: true };
      if (row.adventure) c.imageName = row.name + " // " + row.adventure.name;
      if (row.adventure)
        c.adventure = {
          ...row.adventure,
          ...c.adventure,
          text: row.adventure.text,
        };
      if (old && old.set !== code) {
        c.set = old.set;
        if(old.boosterExcluded)c.boosterExcluded=true;
        const list = (REPRINTS[code] ??= []);
        if (!list.some(([id]) => id === c.id)) list.push([c.id, c.rarity]);
      }
      if (old) {
        for (const k of Object.keys(old)) delete (old as any)[k];
        Object.assign(old, c);
      } else add(c);
    }
    const ids = new Set(catalog.map((r) => slug(r.name)));
    for (const c of defs)
      if (c.set === code && !ids.has(c.id)) c.boosterExcluded = true;
    REPRINTS[code] = [
      ...new Map(
        (REPRINTS[code] ?? [])
          .filter(
            ([id]) =>
              ids.has(id) && defs.find((c) => c.id === id)?.set !== code,
          )
          .map((entry) => [entry[0], entry]),
      ).values(),
    ];
  };
  return { d, a, s, adv, modes, saga, E, C, N, F, event, complete, patches };
}
export const spec = (
  kind: TargetSpec["kind"],
  filter?: Filter,
  optional = false,
): TargetSpec => ({ kind, filter, optional });
export const gy = (filter: Filter = {}, optional = false) =>
  spec("gyCard", { ctrl: "you", ...filter }, optional);
export const mine: Ref = { all: { ctrl: "you", type: "Creature" } },
  opp: Ref = { all: { ctrl: "opp", type: "Creature" } };
export const draw: Effect = { e: "draw", n: 1 },
  food: Effect = { e: "token", token: "tok-food" },
  treasure: Effect = { e: "token", token: "tok-treasure" };
export const token = (token: string, n: Amt = 1): Extract<Effect,{e:"token"}> => ({
  e: "token",
  token,
  n,
});
export const pump = (
  what: Ref,
  p: Amt = 0,
  t: Amt = 0,
  kw: import("../../engine/types").Keyword[] = [],
): Effect => ({ e: "pump", what, p, t, kw });
export const cnt = (what: Ref, n: Amt = 1): Effect => ({
  e: "counters",
  what,
  n,
});
export const dmg = (n: Amt, to: Ref = "T0", from?: Ref): Effect => ({
  e: "damage",
  n,
  to,
  from,
});
export const destroy: Effect = { e: "destroy", what: "T0" },
  exile: Effect = { e: "exile", what: "T0" };
export const gain = (n: Amt): Effect => ({ e: "gain", n }),
  lose = (n: Amt, who: Ref = "opp"): Effect => ({ e: "lose", n, who });
export const role = (kind: string, what: Ref = "T0"): Effect => ({
  e: "role",
  what,
  token: "tok-" + kind + "-role",
});
export const rolePay = (
  mana: string,
  kind: string,
  targets: TargetSpec[],
): Effect => ({
  e: "costThen",
  prompt: "支付" + mana + "派出角色？",
  cost: { mana },
  then: [{ e: "reflexive", targets, effects: [role(kind)] }],
});
export const barFilter: Filter = {
  or: [{ type: "Artifact" }, { type: "Enchantment" }, { token: true }],
};
export const chapter = (effects: Effect[], targets?: TargetSpec[]) => ({
  effects,
  targets,
});
export function subsets(options: Mode[], count?: number): Mode[] {
  const out: Mode[] = [];
  for (let mask = 1; mask < 1 << options.length; mask++) {
    const picked = options.filter((_, i) => mask & (1 << i));
    if (count && picked.length !== count) continue;
    let offset = 0;
    const shift = (v: any): any =>
      typeof v === "string" && /^T[0-2]$/.test(v)
        ? "T" + (Number(v[1]) + offset)
        : Array.isArray(v)
          ? v.map(shift)
          : v && typeof v === "object"
            ? Object.fromEntries(
                Object.entries(v).map(([k, x]) => [k, shift(x)]),
              )
            : v;
    const effects: Effect[] = [],
      targets: TargetSpec[] = [];
    for (const m of picked) {
      effects.push(...m.effects.map(shift));
      targets.push(
        ...(m.targets ?? []).map((t) => ({
          ...t,
          allowRepeat: true,
          ...(t.differentFrom !== undefined
            ? { differentFrom: t.differentFrom + offset }
            : {}),
        })),
      );
      offset = targets.length;
    }
    out.push({
      text: picked.map((m) => m.text).join("＋"),
      effects,
      targets,
      frontierChoices: picked.length,
      frontierStackTargets: picked.flatMap((m) => m.frontierStackTargets ?? []),
      cost: picked.some((m) => m.cost)
        ? picked.map((m) => m.cost ?? "").join("")
        : undefined,
    });
  }
  return out;
}
