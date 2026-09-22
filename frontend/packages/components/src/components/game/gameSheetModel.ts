import type {CardView} from "@munchkin/contracts";

export type EquipmentSlot = Exclude<
  NonNullable<CardView["item_slot"]>,
  "none"
>;

export type GameSheetRequest =
  | {kind: "character"}
  | {kind: "hand"; mode: "expanded" | "fast-equip"; cardID?: string}
  | {kind: "equip-slot"; slot: EquipmentSlot; cardID?: string}
  | {kind: "actions"; actionIndex?: number}
  | {kind: "opponent"; playerID: string}
  | {kind: "strength"};
