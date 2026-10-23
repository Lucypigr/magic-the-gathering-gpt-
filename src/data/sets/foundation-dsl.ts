import { setBuilder } from "./frontier-dsl";
import type {
  Ability,
  Amt,
  CardDef,
  Effect,
  TriggeredAbility,
} from "../../engine/types";
export function foundationBuilder(
  code: "FDN" | "DSK",
  catalog: any[],
  auto: object,
) {
  const base = setBuilder(code, catalog, auto),
    prefix = code.toLowerCase() + ":";
  const C = (action: string) => ({
    c: "frontier" as const,
    action: prefix + action,
  });
  const N = (action: string): Amt => ({ frontier: prefix + action });
  const F = (action: string): Ability => ({
    kind: "static",
    frontier: prefix + action,
  });
  const event = (
    action: string,
    effects: Effect[],
    extra: Partial<TriggeredAbility> = {},
  ): TriggeredAbility => ({
    kind: "trigger",
    on: "frontierEvent",
    frontierEvent: prefix + action,
    effects,
    ...extra,
  });
  const room = (n: number, left: Ability[], right: Ability[]) =>
    base.d(n, {
      room: {
        left: {
          ...catalog.find((c) => c.number === n).room.left,
          abilities: left,
        },
        right: {
          ...catalog.find((c) => c.number === n).room.right,
          abilities: right,
        },
      },
    } as Partial<CardDef>);
  return { ...base, C, N, F, event, room };
}
