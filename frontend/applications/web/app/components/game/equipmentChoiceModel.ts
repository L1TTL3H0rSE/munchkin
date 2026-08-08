import type {CardView, Projection} from "@munchkin/contracts";

import type {ActionEntry} from "../actionModel";
import type {EquipmentSlot} from "./gameSheetModel";

export function projectedActionEntries(projection: Projection): ActionEntry[] {
  return projection.turn.available_actions.map((action, index) => ({action, index}));
}

export function exactEquipCandidates(
  projection: Projection,
  slot: EquipmentSlot,
): CardView[] {
  const permitted = new Set(projection.turn.available_actions
    .filter((action) => action.type === "equip_item")
    .map((action) => action.source_instance_id)
    .filter((instanceID): instanceID is string => Boolean(instanceID)));
  return [...projection.you.hand, ...projection.you.carried].filter((card) =>
    permitted.has(card.instance_id) && card.kind === "item" && card.item_slot === slot,
  );
}

export function equipEntryFor(
  projection: Projection,
  instanceID: string | undefined,
): ActionEntry | undefined {
  if (!instanceID) return undefined;
  return projectedActionEntries(projection).find(({action}) =>
    action.type === "equip_item" && action.source_instance_id === instanceID,
  );
}

export function unequipEntryFor(
  projection: Projection,
  instanceID: string | undefined,
): ActionEntry | undefined {
  if (!instanceID) return undefined;
  return projectedActionEntries(projection).find(({action}) =>
    action.type === "unequip_item" && action.source_instance_id === instanceID,
  );
}
