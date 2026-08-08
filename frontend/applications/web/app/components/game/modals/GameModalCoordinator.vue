<script setup lang="ts">
import type {
  CommandPayload,
  Projection,
} from "@munchkin/contracts";
import type {GameConnectionState} from "../../../composables/useGameSessionController";
import {
  isEconomyAction,
  type EconomyAction,
  type EconomySubmission,
} from "../../interaction/economyModel";
import type {InteractionActionView} from "../../interaction/interactionModel";
import InteractionSurface from "../../interaction/InteractionSurface.vue";
import type {ActionEntry} from "../../actionModel";
import type {GameSheetRequest} from "../gameSheetModel";
import CardChoiceSheet from "./CardChoiceSheet.vue";
import CharacterEquipmentSheet from "./CharacterEquipmentSheet.vue";
import CharitySheet from "./CharitySheet.vue";
import StrengthSheet from "./StrengthSheet.vue";
import TurnActionSheet from "./TurnActionSheet.vue";
import OpponentDetailsSheet from "./OpponentDetailsSheet.vue";

const props = defineProps<{
  projection: Projection;
  request?: GameSheetRequest;
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

const charityAction = computed<EconomyAction | undefined>(() => {
  const candidate = props.projection.turn.available_actions.find((action) =>
    action.type === "resolve_charity",
  );
  return candidate && isEconomyAction(candidate) ? candidate : undefined;
});
const charityMandatory = computed(() => Boolean(
  props.projection.interaction?.charity_transfer || charityAction.value,
));
const otherInteractionMandatory = computed(() => Boolean(
  props.projection.interaction && !props.projection.interaction.charity_transfer,
));
const optionalRequest = computed(() =>
  charityMandatory.value || otherInteractionMandatory.value
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
    v-if="!charityMandatory"
    :projection="projection"
    :connection-state="connectionState"
    :busy="busy"
    :error-message="errorMessage"
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
    v-else-if="optionalRequest?.kind === 'hand' || optionalRequest?.kind === 'equip-slot'"
    :projection="projection"
    :request="optionalRequest"
    :busy="busy"
    @close="emit('close')"
    @execute="forwardExecute"
    @open-action="emit('open-sheet', {kind: 'actions', actionIndex: $event})"
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
