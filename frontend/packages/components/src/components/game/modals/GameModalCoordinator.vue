<script setup lang="ts">
import {computed} from "vue";
import type {
  CommandPayload,
  Projection,
} from "@munchkin/contracts";
import type {GameConnectionState} from "@munchkin/shared";
import {
  isEconomyAction,
  type EconomyAction,
  type EconomySubmission,
} from "../../interaction/economyModel";
import type {InteractionActionView} from "../../interaction/interactionModel";
import {
  acceptedCombatHelper,
  isCombatantHelperOffer,
  isInvitedHelperOffer,
} from "../../interaction/helperOfferModel";
import InteractionSurface from "../../interaction/InteractionSurface.vue";
import type {ActionEntry} from "../../actionModel";
import type {GameSheetRequest} from "../gameSheetModel";
import CardChoiceSheet from "./CardChoiceSheet.vue";
import CharacterEquipmentSheet from "./CharacterEquipmentSheet.vue";
import CharitySheet from "./CharitySheet.vue";
import DeathLootDialog from "./DeathLootDialog.vue";
import ExactEquipSheet from "./ExactEquipSheet.vue";
import FastEquipSheet from "./FastEquipSheet.vue";
import RunAwaySurface from "./RunAwaySurface.vue";
import StrengthSheet from "./StrengthSheet.vue";
import TurnActionSheet from "./TurnActionSheet.vue";
import OpponentDetailsSheet from "./OpponentDetailsSheet.vue";
import {useCompactGameViewport} from "../useCompactGameViewport";

const props = defineProps<{
  projection: Projection;
  request?: GameSheetRequest | undefined;
  connectionState: GameConnectionState;
  busy: boolean;
  errorMessage: string;
}>();
const emit = defineEmits<{
  close: [];
  "open-sheet": [request: GameSheetRequest];
  execute: [entry: ActionEntry, payload: CommandPayload];
  "submit-economy": [request: EconomySubmission];
  "submit-interaction": [action: InteractionActionView];
}>();
const compactViewport = useCompactGameViewport();
const charityAction = computed<EconomyAction | undefined>(() => {
  const candidate = props.projection.turn.available_actions.find((action) =>
    action.type === "resolve_charity",
  );
  return candidate && isEconomyAction(candidate) ? candidate : undefined;
});
const charityMandatory = computed(() => Boolean(
  props.projection.interaction?.charity_transfer || charityAction.value,
));
const runAwayInteraction = computed(() =>
  props.projection.interaction?.public_kind === "run_away_response"
    ? props.projection.interaction
    : undefined,
);
const runAwayChoiceInteraction = computed(() =>
  props.projection.turn.pending_decision?.type === "run_away_monster" &&
  props.projection.interaction?.public_kind === "private_choice"
    ? props.projection.interaction
    : undefined,
);
const deathLootInteraction = computed(() =>
  props.projection.interaction?.public_kind === "death_loot_priority"
    ? props.projection.interaction
    : undefined,
);
const wideHelpInteraction = computed(() => {
  const candidate = props.projection.interaction;
  return candidate?.response_required_for_you &&
    (isCombatantHelperOffer(candidate) ||
      (isInvitedHelperOffer(candidate) &&
        candidate.combat_help_offer?.helper_player_id === props.projection.you.player_id))
    ? candidate
    : undefined;
});
const acceptedHelper = computed(() => acceptedCombatHelper(props.projection));
const requiredEffectEntry = computed<ActionEntry | undefined>(() => {
  const index = props.projection.turn.available_actions.findIndex((action) =>
    action.type === "choose_effect",
  );
  return index >= 0
    ? {action: props.projection.turn.available_actions[index]!, index}
    : undefined;
});
const requiredEffectRequest = computed<Extract<GameSheetRequest, {kind: "actions"}> | undefined>(() =>
  requiredEffectEntry.value ? {kind: "actions", actionIndex: requiredEffectEntry.value.index} : undefined,
);
const genericInteractionMandatory = computed(() => Boolean(
  props.projection.interaction &&
  !props.projection.interaction.charity_transfer &&
  !runAwayInteraction.value &&
  !runAwayChoiceInteraction.value &&
  !deathLootInteraction.value,
));
const anyInteractionMandatory = computed(() => Boolean(
  charityMandatory.value ||
  requiredEffectEntry.value ||
  runAwayInteraction.value ||
  runAwayChoiceInteraction.value ||
  deathLootInteraction.value ||
  genericInteractionMandatory.value,
));
const optionalRequest = computed(() =>
  anyInteractionMandatory.value
    ? undefined
    : props.request,
);

function forwardExecute(entry: ActionEntry, payload: CommandPayload): void {
  emit("execute", entry, payload);
}
</script>

<template>
  <CharitySheet
    v-if="charityMandatory"
    :projection="projection"
    :action="charityAction"
    :busy="busy"
    @submit="emit('submit-economy', $event)"
  />

  <InteractionSurface
    v-if="!charityMandatory && !requiredEffectEntry && !runAwayInteraction && !runAwayChoiceInteraction && !deathLootInteraction && !acceptedHelper && (compactViewport || !wideHelpInteraction)"
    :projection="projection"
    :connection-state="connectionState"
    :busy="busy"
    :error-message="errorMessage"
    @submit="emit('submit-interaction', $event)"
  />

  <TurnActionSheet
    v-if="!charityMandatory && requiredEffectRequest"
    :projection="projection"
    :request="requiredEffectRequest"
    :busy="busy"
    :mandatory="true"
    @execute="forwardExecute"
    @submit-economy="emit('submit-economy', $event)"
  />

  <RunAwaySurface
    v-if="!charityMandatory && !requiredEffectEntry && (runAwayInteraction || runAwayChoiceInteraction) && compactViewport"
    :projection="projection"
    :interaction="runAwayChoiceInteraction ?? runAwayInteraction!"
    :busy="busy"
    @submit="emit('submit-interaction', $event)"
  />

  <DeathLootDialog
    v-if="!charityMandatory && !requiredEffectEntry && deathLootInteraction && compactViewport"
    :interaction="deathLootInteraction"
    :busy="busy"
    @submit="emit('submit-interaction', $event)"
  />

  <CharacterEquipmentSheet
    v-if="optionalRequest?.kind === 'character'"
    :projection="projection"
    @close="emit('close')"
    @open-slot="emit('open-sheet', {kind: 'equip-slot', slot: $event})"
    @open-actions="emit('open-sheet', {kind: 'actions'})"
  />

  <CardChoiceSheet
    v-else-if="optionalRequest?.kind === 'hand' && optionalRequest.mode === 'expanded'"
    :projection="projection"
    :request="optionalRequest"
    :busy="busy"
    @close="emit('close')"
    @execute="forwardExecute"
    @open-action="emit('open-sheet', {kind: 'actions', actionIndex: $event})"
    @open-fast-equip="emit('open-sheet', {kind: 'hand', mode: 'fast-equip', cardID: $event})"
  />

  <FastEquipSheet
    v-else-if="optionalRequest?.kind === 'hand' && optionalRequest.mode === 'fast-equip'"
    :projection="projection"
    :request="optionalRequest"
    :busy="busy"
    @close="emit('close')"
    @execute="forwardExecute"
  />

  <ExactEquipSheet
    v-else-if="optionalRequest?.kind === 'equip-slot'"
    :projection="projection"
    :request="optionalRequest"
    :busy="busy"
    @close="emit('close')"
    @execute="forwardExecute"
  />

  <TurnActionSheet
    v-else-if="optionalRequest?.kind === 'actions'"
    :projection="projection"
    :request="optionalRequest"
    :busy="busy"
    @close="emit('close')"
    @execute="forwardExecute"
    @submit-economy="emit('submit-economy', $event)"
  />

  <StrengthSheet
    v-else-if="optionalRequest?.kind === 'strength'"
    :projection="projection"
    @close="emit('close')"
  />

  <OpponentDetailsSheet
    v-else-if="optionalRequest?.kind === 'opponent'"
    :projection="projection"
    :player-id="optionalRequest.playerID"
    @close="emit('close')"
  />
</template>
