<script setup lang="ts">
import {computed, ref, watch} from "vue";
import type {
  ActionDescriptor,
  CommandPayload,
  Projection,
} from "@munchkin/contracts";
import type {GameConnectionState} from "@munchkin/shared";
import type {GameApiErrorKind} from "@munchkin/shared";
import GameConnectionStatus from "../GameConnectionStatus.vue";
import {
  buildCommandPayload,
  type ActionEntry,
} from "../actionModel";
import CardPresentation from "./primitives/CardPresentation.vue";
import DeckBack from "./primitives/DeckBack.vue";
import DesktopGameHeader from "./desktop/DesktopGameHeader.vue";
import MobileGameHeader from "./mobile/MobileGameHeader.vue";
import RunAwaySurface from "./modals/RunAwaySurface.vue";
import DeathLootSurface from "../interaction/DeathLootSurface.vue";
import {useCompactGameViewport} from "./useCompactGameViewport";
import {
  buildGamePresentationModel,
  opponentStatus,
} from "./gamePresentationModel";
import type {GameSheetRequest} from "./gameSheetModel";
import {isDeathLootInteraction} from "../interaction/deathLootModel";
import {
  actionIsSelectable,
  type InteractionActionView,
} from "../interaction/interactionModel";
import {isRunAwayInteraction} from "../interaction/targetRunAwayModel";
import {
  acceptedCombatHelper,
  helperOfferActions,
  isCombatantHelperOffer,
  isInvitedHelperOffer,
  projectedPlayerName,
} from "../interaction/helperOfferModel";

const props = defineProps<{
  projection: Projection;
  connectionState: GameConnectionState;
  errorKind: GameApiErrorKind | null;
  errorMessage: string;
  actionBusy: boolean;
  isBusy: boolean;
}>();

const emit = defineEmits<{
  retry: [];
  execute: [entry: ActionEntry, payload: CommandPayload];
  "submit-interaction": [action: InteractionActionView];
  "open-sheet": [request: GameSheetRequest];
}>();

const presentation = computed(() => buildGamePresentationModel(props.projection));
const compactViewport = useCompactGameViewport();
const isFinished = computed(() => props.projection.status === "finished");
const viewerWon = computed(() => isFinished.value &&
  props.projection.winner_player_id === props.projection.you.player_id);
const winner = computed(() => props.projection.winner_player_id === props.projection.you.player_id
  ? props.projection.you
  : props.projection.players.find((player) =>
    player.player_id === props.projection.winner_player_id,
  ));
const winnerName = computed(() => winner.value?.name ?? "Победитель");
const winnerLevel = computed(() => winner.value?.level ?? 10);
const finalWinnerLevel = computed(() => viewerWon.value
  ? Math.max(props.projection.you.level, 10)
  : winnerLevel.value);
const finalWinnerStrength = computed(() => viewerWon.value
  ? props.projection.you.combat_strength
  : winner.value?.combat_strength ?? 0);
const resultsExpanded = ref(false);
const finalPlayers = computed(() => [
  props.projection.you,
  ...props.projection.players.filter((player) =>
    player.player_id !== props.projection.you.player_id,
  ),
].sort((left, right) => {
  if (left.player_id === props.projection.winner_player_id) return -1;
  if (right.player_id === props.projection.winner_player_id) return 1;
  return right.level - left.level ||
    (right.combat_strength ?? 0) - (left.combat_strength ?? 0);
}));
const isActorTurn = computed(() => presentation.value.isActorTurn);
const opponents = computed(() => props.projection.players.filter((player) =>
  player.player_id !== props.projection.you.player_id,
));
const actionDescriptors = computed(() => presentation.value.turnActions);
const actionEntries = computed<ActionEntry[]>(() =>
  actionDescriptors.value.map((action, index) => ({action, index})),
);
const encounterCard = computed(() => {
  const cards = presentation.value.encounterCards;
  return cards[presentation.value.activeEncounterIndex] ??
    props.projection.turn.resolving[0];
});
const previousEncounterCard = computed(() => {
  const index = presentation.value.activeEncounterIndex - 1;
  return index >= 0 ? presentation.value.encounterCards[index] : undefined;
});
const nextEncounterCard = computed(() =>
  presentation.value.encounterCards[presentation.value.activeEncounterIndex + 1],
);
const currentPlayerName = computed(() => presentation.value.currentPlayerName);
const roomIDVisible = ref(false);
const runAwayInteraction = computed(() => isRunAwayInteraction(props.projection.interaction)
  ? props.projection.interaction
  : undefined);
const actorRunAwayInteraction = computed(() => runAwayInteraction.value?.response_required_for_you
  ? runAwayInteraction.value
  : undefined);
const runAwayPendingInteraction = computed(() => {
  const candidate = runAwayInteraction.value;
  if (!candidate || candidate.response_required_for_you) return undefined;
  return candidate.my_response_state && candidate.my_response_state !== "pending"
    ? candidate
    : undefined;
});
const runAwayChoiceInteraction = computed(() =>
  props.projection.turn.pending_decision?.type === "run_away_monster" &&
  props.projection.interaction?.public_kind === "private_choice" &&
  props.projection.interaction.response_required_for_you
    ? props.projection.interaction
    : undefined,
);
const runAwayMonsters = computed(() => [...new Map([
  ...(props.projection.turn.combat?.monsters ?? []),
  ...props.projection.turn.resolving,
  ...(props.projection.turn.encounter ? [props.projection.turn.encounter] : []),
].filter((card) => card.kind === "monster").map((card) => [card.instance_id, card])).values()]);
const currentRunAwayMonsterID = computed(() => props.projection.turn.run_away?.current_monster_instance_id);
const currentRunAwayMonster = computed(() => runAwayMonsters.value.find((card) =>
  card.instance_id === currentRunAwayMonsterID.value,
) ?? runAwayMonsters.value[0]);
const currentRunAwayIndex = computed(() => Math.max(0, runAwayMonsters.value.findIndex((card) =>
  card.instance_id === currentRunAwayMonsterID.value,
)));
const attemptedRunAwayMonsterIDs = computed(() => new Set(
  props.projection.turn.run_away?.attempts
    .filter((attempt) => attempt.player_id === props.projection.you.player_id)
    .map((attempt) => attempt.monster_instance_id) ?? [],
));
const attemptedRunAwayMonsterNames = computed(() => runAwayMonsters.value
  .filter((card) => attemptedRunAwayMonsterIDs.value.has(card.instance_id))
  .map((card) => card.name));
const runAwayEscapeBonus = computed(() => props.projection.you.escape_bonus);
const runAwayAttemptCopy = computed(() =>
  `${currentRunAwayIndex.value + 1} из ${Math.max(1, runAwayMonsters.value.length)}`,
);
const deathLootInteraction = computed(() => isDeathLootInteraction(props.projection.interaction)
  ? props.projection.interaction
  : undefined);
const actorDeathLootInteraction = computed(() => deathLootInteraction.value?.response_required_for_you
  ? deathLootInteraction.value
  : undefined);
const desktopDecisionActive = computed(() => !compactViewport.value && Boolean(
  actorRunAwayInteraction.value || runAwayChoiceInteraction.value || actorDeathLootInteraction.value,
));

const handActionSourceIDs = computed(() => new Set(
  actionDescriptors.value
    .map((action) => action.source_instance_id)
    .filter((instanceID): instanceID is string => Boolean(instanceID)),
));
const availableHandCardCount = computed(() => props.projection.you.hand.filter((card) =>
  handActionSourceIDs.value.has(card.instance_id),
).length);
const availableHandCardCopy = computed(() => availableCardsCopy(isFinished.value
  ? Math.min(2, props.projection.you.hand.length)
  : availableHandCardCount.value));
const monsterBaseStrength = computed(() => (props.projection.turn.combat?.monsters ?? [])
  .reduce((total, card) => total + (card.combat_strength ?? 0), 0));
const monsterModifier = computed(() =>
  (props.projection.turn.combat?.monster_strength ?? 0) - monsterBaseStrength.value,
);
const helperName = computed(() => {
  const helperID = props.projection.turn.combat?.helper_player_id;
  if (!helperID) return "нет";
  if (helperID === props.projection.you.player_id) return props.projection.you.name;
  return props.projection.players.find((player) => player.player_id === helperID)?.name ?? "есть";
});
const helperReward = computed(() => props.projection.turn.combat?.helper_reward_treasures);
const helpOfferInteraction = computed(() => {
  const candidate = props.projection.interaction;
  return candidate?.response_required_for_you && isCombatantHelperOffer(candidate)
    ? candidate
    : undefined;
});
const helpInviteInteraction = computed(() => {
  const candidate = props.projection.interaction;
  return candidate?.response_required_for_you &&
    isInvitedHelperOffer(candidate) &&
    candidate.combat_help_offer?.helper_player_id === props.projection.you.player_id
    ? candidate
    : undefined;
});
const acceptedHelper = computed(() => !helpOfferInteraction.value && !helpInviteInteraction.value
  ? acceptedCombatHelper(props.projection)
  : undefined);
const helpActions = computed<InteractionActionView[]>(() => {
  if (helpOfferInteraction.value) return helperOfferActions(helpOfferInteraction.value.actions);
  return helpInviteInteraction.value?.actions.filter(actionIsSelectable) ?? [];
});
const selectedHelpActionID = ref<string>();
const selectedHelpAction = computed(() => helpActions.value.find((action) =>
  action.action_id === selectedHelpActionID.value,
));
const helpCandidatePlayers = computed(() => [...new Set(helpActions.value
  .map((action) => action.helper_player_id)
  .filter((playerID): playerID is string => Boolean(playerID)))]
  .map((playerID) => props.projection.players.find((player) => player.player_id === playerID))
  .filter((player): player is Projection["players"][number] => Boolean(player)));
const selectedHelpPlayerID = computed(() => selectedHelpAction.value?.helper_player_id);
const helpRewardOptions = computed(() => [...new Set(helpActions.value
  .map((action) => action.reward_treasures)
  .filter((reward): reward is number => reward !== undefined))].sort((left, right) => left - right));
const selectedHelpReward = computed(() => selectedHelpAction.value?.reward_treasures ?? 0);
const helpState = computed<"offer" | "invite" | "accepted" | undefined>(() =>
  helpOfferInteraction.value ? "offer"
    : helpInviteInteraction.value ? "invite"
      : acceptedHelper.value ? "accepted" : undefined,
);
const helpNodeID = computed(() => helpState.value === "offer" ? "293:1780"
  : helpState.value === "invite" ? "293:1866"
    : helpState.value === "accepted" ? "293:1952" : undefined);
const helpCombatantName = computed(() => projectedPlayerName(
  props.projection,
  props.projection.turn.player_id,
));
const selectedHelpPlayer = computed(() => helpCandidatePlayers.value.find((player) =>
  player.player_id === selectedHelpPlayerID.value,
));
const runAwayResult = computed(() => presentation.value.primary.kind === "result" &&
  presentation.value.primary.source === "run-away"
  ? presentation.value.primary
  : undefined);
const runAwayResultMonster = computed(() => {
  const attempt = props.projection.turn.run_away?.attempts.at(-1);
  return runAwayMonsters.value.find((card) => card.instance_id === attempt?.monster_instance_id);
});
const runAwayBadStuffCopy = computed(() => runAwayResultMonster.value?.bad_stuff_text ??
  "Последствия подтверждены сервером.");
const endTurnReady = computed(() => props.projection.turn.phase === "end_turn" &&
  isActorTurn.value && actionDescriptors.value.some((action) => action.type === "end_turn") &&
  !props.projection.recent_combat_result);
const confirmedCurse = computed(() => {
  const card = props.projection.turn.resolving.find((candidate) => candidate.kind === "curse");
  return card && !props.projection.turn.pending_decision && !props.projection.interaction &&
    !actionDescriptors.value.some((action) => action.type === "choose_effect")
    ? card
    : undefined;
});
const hasDedicatedStage = computed(() => Boolean(
  confirmedCurse.value || helpState.value || runAwayPendingInteraction.value ||
  runAwayResult.value || endTurnReady.value,
));
const desktopAvailableHandCardCopy = computed(() => hasDedicatedStage.value
  ? availableCardsCopy(Math.min(2, props.projection.you.hand.length))
  : availableHandCardCopy.value);
const nextPlayerName = computed(() => opponents.value[0]?.name ?? "следующему игроку");
const desktopPhaseOverride = computed(() => {
  if (helpState.value === "offer" || helpState.value === "invite") return "ПОМОЩЬ";
  if (helpState.value === "accepted") return "БОЙ";
  if (runAwayPendingInteraction.value || runAwayResult.value) return "ПОБЕГ";
  if (endTurnReady.value) return "КОНЕЦ";
  return undefined;
});
const desktopTitleOverride = computed(() => {
  if (helpState.value === "offer") return "ВЫБЕРИ";
  if (helpState.value === "invite") return "НУЖЕН ОТВЕТ";
  if (helpState.value === "accepted") return "ПОМОЩНИК В БОЮ";
  if (runAwayPendingInteraction.value) return "ОЖИДАНИЕ";
  if (runAwayResult.value) return runAwayResult.value.escaped ? "УСПЕХ" : "ПРОВАЛ";
  if (endTurnReady.value) return "ТВОЙ ХОД";
  return undefined;
});
const characterTraitLine = computed(() => traitNames(props.projection.you.traits));
const encounterPagerCopy = computed(() => encounterCard.value
  ? `${presentation.value.encounterPage} / ${presentation.value.encounterPageCount} · ${encounterCard.value.name}`
  : `${presentation.value.encounterPage} / ${presentation.value.encounterPageCount}`);

function opponentStrength(player: Projection["players"][number]): number | string {
  return player.combat_strength ?? player.strength_breakdown?.total_strength ?? "—";
}

function traitNames(cards: Projection["you"]["traits"]): string {
  const names = cards
    .filter((card) => card.trait_group === "class" || card.trait_group === "race")
    .map((card) => card.name);
  return names.join(" · ");
}

function opponentTrait(player: Projection["players"][number]): string {
  return player.traits.find((card) => card.trait_group === "class")?.name
    ?? player.traits.find((card) => card.trait_group === "race")?.name
    ?? "";
}

function opponentAriaLabel(player: Projection["players"][number]): string {
  const status = opponentStatus(props.projection, player);
  const statusCopy = status === "active"
    ? "ходит"
    : status === "dead" ? "выбыл" : status === "ready" ? "готов" : "ожидает";
  return `${player.name}, ${player.level} уровень, сила ${opponentStrength(player)}, ${player.hand_count} карт в руке, ${statusCopy}`;
}

function signed(value: number): string {
  return value > 0 ? `+${value}` : String(value);
}

function availableCardsCopy(count: number): string {
  const mod100 = count % 100;
  const mod10 = count % 10;
  if (mod10 === 1 && mod100 !== 11) return `${count} карта доступна сейчас`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return `${count} карты доступны сейчас`;
  }
  return `${count} карт доступно сейчас`;
}

function playerCountCopy(count: number): string {
  const mod100 = count % 100;
  const mod10 = count % 10;
  if (mod10 === 1 && mod100 !== 11) return `${count} игрок`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${count} игрока`;
  return `${count} игроков`;
}

const primaryAction = computed<ActionEntry | undefined>(() => {
  const priority: ActionDescriptor["type"][] = [
    "request_combat_resolution",
    "run_away",
    "open_door",
    "loot_room",
    "finish_setup",
    "end_turn",
    "start",
  ];
  for (const type of priority) {
    const entry = actionEntries.value.find((candidate) =>
      candidate.action.type === type &&
      !candidate.action.source_instance_id &&
      !(candidate.action.instance_ids?.length),
    );
    if (entry) {
      return entry;
    }
  }
  return undefined;
});

const primaryActionLabel = computed(() => {
  switch (primaryAction.value?.action.type) {
    case "request_combat_resolution": return "Завершить бой";
    case "run_away": return "Бросить на смывку";
    case "open_door": return "Открыть дверь";
    case "loot_room": return "Обчистить комнату";
    case "finish_setup": return "Закончить подготовку";
    case "end_turn": return "Закончить ход";
    case "start": return "Начать игру";
    default: return "";
  }
});
const compactPrimaryActionLabel = computed(() => {
  switch (primaryAction.value?.action.type) {
    case "request_combat_resolution": return "Завершить";
    case "run_away": return "Смывка";
    case "open_door": return "Открыть";
    case "loot_room": return "Обчистить";
    case "finish_setup": return "Готово";
    case "end_turn": return "Завершить";
    case "start": return "Старт";
    default: return "";
  }
});
const primaryActionTitle = computed(() => {
  switch (primaryAction.value?.action.type) {
    case "request_combat_resolution": return "Можно завершить бой";
    case "run_away": return "Пора бросить на смывку";
    case "open_door": return "Дверь";
    case "loot_room": return "Что дальше?";
    case "finish_setup": return "Можно завершить подготовку";
    case "end_turn": return "Можно закончить ход";
    case "start": return "Можно начать игру";
    default: return "";
  }
});
const primaryActionDescription = computed(() => {
  switch (primaryAction.value?.action.type) {
    case "request_combat_resolution": return "Подтверди победу и забери награду.";
    case "run_away": return "Бросок и модификаторы рассчитает сервер.";
    case "open_door": return "Открой верхнюю карту колоды дверей.";
    case "loot_room": return "Возьми закрытую карту двери в руку.";
    case "finish_setup": return "Подтверди выбранные карты персонажа.";
    case "end_turn": return "Передай ход следующему игроку.";
    case "start": return "Запусти подготовку всех игроков.";
    default: return "";
  }
});
const stageTitle = computed(() => {
  if (props.projection.recent_combat_result?.outcome === "victory") {
    return "Награда получена";
  }
  if (!isActorTurn.value) {
    return `Ходит ${currentPlayerName.value}`;
  }
  switch (props.projection.turn.phase) {
    case "setup": return "Подготовь персонажа";
    case "preparation": return "Подготовка к ходу";
    case "door_choice": return "Что дальше?";
    case "charity": return "Приведи руку к лимиту";
    case "end_turn": return "Ход можно завершить";
    default: return "Игровой стол";
  }
});
const rewardCards = computed(() =>
  props.projection.recent_combat_result?.viewer_reward?.treasures ?? [],
);

watch(helpActions, (actions) => {
  if (!actions.some((action) => action.action_id === selectedHelpActionID.value)) {
    if (!helpOfferInteraction.value) {
      selectedHelpActionID.value = undefined;
      return;
    }
    selectedHelpActionID.value = [...actions].sort((left, right) => {
      const leftStrength = props.projection.players.find((player) =>
        player.player_id === left.helper_player_id,
      )?.combat_strength ?? 0;
      const rightStrength = props.projection.players.find((player) =>
        player.player_id === right.helper_player_id,
      )?.combat_strength ?? 0;
      return rightStrength - leftStrength ||
        (left.reward_treasures ?? 0) - (right.reward_treasures ?? 0);
    })[0]?.action_id;
  }
}, {immediate: true});

function selectHelpPlayer(playerID: string): void {
  const action = helpActions.value.find((candidate) =>
    candidate.helper_player_id === playerID &&
    candidate.reward_treasures === selectedHelpReward.value,
  ) ?? helpActions.value.find((candidate) => candidate.helper_player_id === playerID);
  selectedHelpActionID.value = action?.action_id;
}

function selectHelpReward(reward: number): void {
  const action = helpActions.value.find((candidate) =>
    candidate.helper_player_id === selectedHelpPlayerID.value &&
    candidate.reward_treasures === reward,
  ) ?? helpActions.value.find((candidate) => candidate.reward_treasures === reward);
  selectedHelpActionID.value = action?.action_id;
}

function runPrimaryAction(): void {
  const entry = primaryAction.value;
  if (!entry || props.actionBusy) {
    return;
  }
  emit("execute", entry, buildCommandPayload(entry.action));
}

function openHand(cardID?: string): void {
  const fastEquip = cardID !== undefined && actionDescriptors.value.some((action) =>
    action.type === "equip_item" && action.source_instance_id === cardID,
  );
  emit("open-sheet", {
    kind: "hand",
    mode: fastEquip ? "fast-equip" : "expanded",
    ...(cardID ? {cardID} : {}),
  });
}

function submitHelp(): void {
  if (!selectedHelpAction.value || props.actionBusy) return;
  emit("submit-interaction", selectedHelpAction.value);
}
</script>

<template>
  <section
    class="game-table"
    tabindex="-1"
    :aria-busy="isBusy"
    :data-state="projection.status"
    :data-phase="projection.turn.phase"
    :data-figma-desktop-node="presentation.desktopNodeID"
    :data-figma-compact-node="presentation.mobileNodeID"
  >
    <DesktopGameHeader
      class="game-table__desktop-header"
      :projection="projection"
      :presentation-model="presentation"
      :connection-state="connectionState"
      :finished="isFinished"
      :victory="viewerWon"
      :phase-badge-override="desktopPhaseOverride"
      :header-title-override="desktopTitleOverride"
    />
    <MobileGameHeader
      class="game-table__compact-header"
      :projection="projection"
      :presentation-model="presentation"
      :strength-open="false"
      @open-strength="emit('open-sheet', {kind: 'strength'})"
    />

    <GameConnectionStatus
      :state="connectionState"
      :error-kind="errorKind"
      :error-message="errorMessage"
      :has-projection="true"
      @retry="emit('retry')"
    />

    <div class="game-table__layout">
      <aside class="game-table__opponents" aria-label="Соперники">
        <h2>Соперники · {{ opponents.length }}</h2>
        <div
          class="game-table__opponent-list"
          :data-count="Math.max(1, Math.min(3, opponents.length))"
        >
          <button
            v-for="player in opponents"
            :key="player.player_id"
            class="opponent-tile"
            type="button"
            :aria-label="opponentAriaLabel(player)"
            :data-status="opponentStatus(projection, player)"
            @click="emit('open-sheet', {kind: 'opponent', playerID: player.player_id})"
          >
            <div>
              <strong>{{ player.name }}</strong>
              <span>
                {{ player.level }} уровень<template v-if="opponentTrait(player)"> · {{ opponentTrait(player) }}</template>
              </span>
            </div>
            <div class="opponent-tile__desktop-strength">
              <span>СИЛА</span>
              <strong>{{ opponentStrength(player) }}</strong>
            </div>
            <strong class="opponent-tile__compact-hand" aria-hidden="true">{{ player.hand_count }}</strong>
          </button>
        </div>

        <section class="game-table__room" aria-label="Комната">
          <span>КОМНАТА</span>
          <strong>{{ playerCountCopy(projection.players.length) }}</strong>
          <p>Стол готов</p>
          <button type="button" @click="roomIDVisible = !roomIDVisible">
            {{ roomIDVisible ? projection.game_id : "Показать ID комнаты" }}
          </button>
        </section>
      </aside>

      <RunAwaySurface
        v-if="!compactViewport && (runAwayChoiceInteraction || actorRunAwayInteraction)"
        variant="desktop"
        :projection="projection"
        :interaction="runAwayChoiceInteraction ?? actorRunAwayInteraction!"
        :busy="actionBusy"
        @submit="emit('submit-interaction', $event)"
        @open-character="emit('open-sheet', {kind: 'character'})"
      />

      <DeathLootSurface
        v-else-if="!compactViewport && actorDeathLootInteraction"
        variant="desktop"
        :interaction="actorDeathLootInteraction"
        :busy="actionBusy"
        @submit="emit('submit-interaction', $event)"
        @open-character="emit('open-sheet', {kind: 'character'})"
      />

      <main
        v-else
        class="game-table__stage"
        :class="{'game-table__stage--observer': !isActorTurn}"
        aria-label="Игровая область"
      >
        <section
          v-if="isFinished"
          class="game-table__finished"
          :data-figma-owner="viewerWon ? 'game-board:victory' : 'game-board:finished'"
          :data-figma-desktop-node="viewerWon ? '295:2518' : '297:3177'"
          aria-labelledby="desktop-finished-title"
        >
          <header>
            <h2 id="desktop-finished-title">{{ viewerWon ? "Победа!" : "Партия завершена" }}</h2>
            <p>{{ viewerWon ? `${winnerName} достиг победного уровня.` : "Ты открыл уже завершённую игру." }}</p>
          </header>
          <div class="game-table__finished-card">
            <span>{{ viewerWon ? "ПОБЕДИТЕЛЬ" : "ЗАВЕРШЕНО" }}</span>
            <strong>{{ viewerWon ? `${winnerName} · ${finalWinnerLevel} уровень` : `Победитель: ${winnerName}` }}</strong>
            <p>{{ viewerWon ? "Победитель подтверждён сервером." : `Итоговый уровень ${finalWinnerLevel}.` }}</p>
            <small>Финальная версия {{ projection.version }}</small>
          </div>
          <footer>{{ viewerWon ? "ИТОГ ПАРТИИ ЗАФИКСИРОВАН СЕРВЕРОМ" : "ИСТОРИЯ И ФИНАЛЬНЫЕ РЕЗУЛЬТАТЫ ДОСТУПНЫ ТОЛЬКО ДЛЯ ЧТЕНИЯ" }}</footer>
        </section>

        <section
          v-else-if="confirmedCurse"
          class="game-table__state-panel"
          data-figma-owner="game-board:curse-confirmed"
          data-figma-desktop-node="293:1706"
          data-figma-compact-node="unverified"
          aria-labelledby="desktop-curse-result-title"
        >
          <header>
            <h2 id="desktop-curse-result-title">Проклятие!</h2>
            <p>Эффект карты уже подтверждён сервером.</p>
          </header>
          <div class="game-table__state-card">
            <span>ПРИМЕНЕНО</span>
            <strong>{{ confirmedCurse.name }}</strong>
            <p>{{ confirmedCurse.rules_text }}</p>
            <small>Состояние персонажа обновлено в текущей проекции.</small>
          </div>
          <footer>ЭФФЕКТ УЖЕ ПОДТВЕРЖДЁН СЕРВЕРОМ</footer>
        </section>

        <section
          v-else-if="helpState"
          class="game-table__state-panel game-table__help-state"
          :data-figma-owner="`game-board:help-${helpState}`"
          :data-figma-desktop-node="helpNodeID"
          data-figma-compact-node="unverified"
          aria-labelledby="desktop-help-state-title"
        >
          <header>
            <h2 id="desktop-help-state-title">
              {{ helpState === "offer" ? "Позвать на помощь"
                : helpState === "invite" ? `${helpCombatantName} просит помощи`
                  : "Помощник присоединился" }}
            </h2>
            <p v-if="helpState === 'offer'">Выбери одного доступного игрока и предложи ему часть сокровищ.</p>
            <p v-else-if="helpState === 'invite'">Вступить в бой против {{ projection.turn.combat?.monsters.length ?? 0 }} монстров за предложенную награду?</p>
            <p v-else>{{ projectedPlayerName(projection, acceptedHelper?.helperPlayerID ?? "") }} принял предложение и теперь участвует в бою.</p>
          </header>
          <div v-if="helpState === 'offer'" class="game-table__state-options game-table__state-options--help-offer" role="listbox" aria-label="Варианты помощи">
            <button
              v-for="player in helpCandidatePlayers"
              :key="player.player_id"
              type="button"
              role="option"
              :aria-selected="player.player_id === selectedHelpPlayerID"
              @click="selectHelpPlayer(player.player_id)"
            >
              <span class="game-table__state-option-art">ИЛЛЮСТРАЦИЯ</span>
              <strong>{{ player.name }}</strong>
              <small>Сила {{ opponentStrength(player) }} · {{ player.player_id === selectedHelpPlayerID ? "выбран" : "доступна" }}</small>
              <p>{{ player.player_id === selectedHelpPlayerID ? "Самый сильный возможный помощник." : "Может вывести вашу сторону вперёд." }}</p>
              <b v-if="player.player_id === selectedHelpPlayerID">ВЫБРАНО</b>
            </button>
            <button
              v-for="reward in helpRewardOptions"
              :key="`reward-${reward}`"
              class="game-table__state-option-reward"
              type="button"
              role="option"
              :aria-selected="reward === selectedHelpReward"
              @click="selectHelpReward(reward)"
            >
              <span>ПРЕДЛОЖЕНИЕ</span>
              <strong>{{ reward }} сокровище</strong>
              <p>Помощник получит одну случайную карту из награды после победы.</p>
            </button>
          </div>
          <div v-else-if="helpState === 'invite'" class="game-table__state-options game-table__state-options--help-invite" role="listbox" aria-label="Ответ на просьбу о помощи">
            <button
              v-for="action in helpActions"
              :key="action.action_id"
              type="button"
              role="option"
              :aria-selected="action.action_id === selectedHelpActionID"
              @click="selectedHelpActionID = action.action_id"
            >
              <span class="game-table__state-option-art">ИЛЛЮСТРАЦИЯ</span>
              <strong>{{ action.type === "accept" ? "Принять" : "Отказаться" }}</strong>
              <small>{{ action.type === "accept" ? `Общая сила ${projection.you.combat_strength + (projection.turn.combat?.player_strength ?? 0)} : ${projection.turn.combat?.monster_strength ?? 0}` : "Без последствий" }}</small>
              <p>{{ action.type === "accept" ? `Вступить в бой и получить ${helpInviteInteraction?.combat_help_offer?.reward_treasures ?? 0} сокровище.` : `${helpCombatantName} продолжит бой без твоей помощи.` }}</p>
            </button>
            <article
              class="game-table__state-option-reward"
              role="option"
              aria-disabled="true"
              tabindex="-1"
            >
              <span>НАГРАДА</span>
              <strong>{{ helpInviteInteraction?.combat_help_offer?.reward_treasures ?? 0 }} сокровище</strong>
              <p>Выдаётся только при победе и наличии награды.</p>
            </article>
          </div>
          <div v-else class="game-table__state-card game-table__state-card--confirmed">
            <span>ПРИНЯТО</span>
            <strong>{{ projectedPlayerName(projection, acceptedHelper?.helperPlayerID ?? "") }} помогает в бою</strong>
            <p>Общая сила стороны: {{ projection.turn.combat?.player_strength ?? projection.you.combat_strength }}. Помощнику обещано {{ acceptedHelper?.rewardTreasures ?? 0 }} сокровище.</p>
            <small>Договор действует до окончания боя</small>
          </div>
          <footer>{{ helpState === "accepted" ? "СИЛА И НАГРАДА УЖЕ ОБНОВЛЕНЫ" : "НАГРАДА БУДЕТ ВЫДАНА СЕРВЕРОМ ТОЛЬКО ПОСЛЕ ПОБЕДЫ" }}</footer>
        </section>

        <section
          v-else-if="runAwayPendingInteraction"
          class="game-table__state-panel"
          data-figma-owner="game-board:run-away-pending"
          data-figma-desktop-node="293:2026"
          data-figma-compact-node="unverified"
          aria-labelledby="desktop-run-away-pending-title"
        >
          <header>
            <h2 id="desktop-run-away-pending-title">Бросок отправлен</h2>
            <p>Сервер определяет результат попытки побега.</p>
          </header>
          <div class="game-table__state-card">
            <span>ОЖИДАНИЕ</span>
            <strong>Бросаем кубик…</strong>
            <p>Бонус к побегу {{ signed(runAwayEscapeBonus) }} уже учтён. Результат появится автоматически.</p>
            <small>Цель: 5+</small>
          </div>
          <footer>НЕ ОБНОВЛЯЙТЕ СТРАНИЦУ</footer>
        </section>

        <section
          v-else-if="runAwayResult"
          class="game-table__state-panel"
          :class="`game-table__state-panel--${runAwayResult.escaped ? 'success' : 'failure'}`"
          :data-figma-owner="`game-board:run-away-${runAwayResult.escaped ? 'success' : 'failure'}`"
          :data-figma-desktop-node="runAwayResult.escaped ? '294:1998' : '294:2072'"
          data-figma-compact-node="unverified"
          aria-labelledby="desktop-run-away-result-title"
        >
          <header>
            <h2 id="desktop-run-away-result-title">{{ runAwayResult.escaped ? "Ты смылся" : "Побег не удался" }}</h2>
            <p>{{ runAwayResult.escaped ? "Попытка побега завершилась успешно." : "Сервер применил последствия неудачного побега." }}</p>
          </header>
          <div class="game-table__state-card game-table__state-card--result">
            <span>{{ runAwayResult.escaped ? "УСПЕХ" : "ПРОВАЛ" }}</span>
            <strong>{{ runAwayResult.roll === null ? "Автоматический результат" : `Бросок ${runAwayResult.roll} ${signed(runAwayResult.modifier)}` }}</strong>
            <p v-if="runAwayResult.escaped">{{ runAwayResult.total === null ? "Итог определён эффектом" : `Итог ${runAwayResult.total}` }} — побег успешен. Непотребство не применяется.</p>
            <p v-else>{{ runAwayResult.total === null ? "Итог определён эффектом" : `Итог ${runAwayResult.total}` }}. {{ runAwayBadStuffCopy }}</p>
            <small>{{ runAwayResult.escaped ? `${runAwayResult.monsterName} пройдена` : "Переходим к следующему монстру" }}</small>
          </div>
          <footer>{{ runAwayResult.escaped ? "ЭТОТ МОНСТР БОЛЬШЕ НЕ ПРЕСЛЕДУЕТ ТЕБЯ" : "НЕПОТРЕБСТВО УЖЕ ПРИМЕНЕНО СЕРВЕРОМ" }}</footer>
        </section>

        <section
          v-else-if="endTurnReady"
          class="game-table__state-panel"
          data-figma-owner="game-board:end-turn-ready"
          data-figma-desktop-node="294:2235"
          data-figma-compact-node="unverified"
          aria-labelledby="desktop-end-turn-title"
        >
          <header>
            <h2 id="desktop-end-turn-title">Ход можно завершить</h2>
            <p>Все обязательные действия выполнены.</p>
          </header>
          <div class="game-table__state-card">
            <span>ГОТОВО</span>
            <strong>Обязательных действий нет</strong>
            <p>Рука {{ projection.you.hand.length }} / {{ projection.you.hand_limit }}. Активных эффектов и решений не осталось.</p>
            <small>Следующий игрок: {{ nextPlayerName }}</small>
          </div>
          <footer>ПОСЛЕ ПОДТВЕРЖДЕНИЯ ХОД ПЕРЕЙДЁТ К СЛЕДУЮЩЕМУ ИГРОКУ</footer>
        </section>

        <div v-if="!isFinished && !actorDeathLootInteraction && !actorRunAwayInteraction && !runAwayChoiceInteraction && !hasDedicatedStage && presentation.encounterPageCount > 1" class="game-table__pager">
          {{ encounterPagerCopy }}
        </div>

        <div
          v-if="!isFinished && !actorDeathLootInteraction && !actorRunAwayInteraction && !runAwayChoiceInteraction && !hasDedicatedStage && encounterCard"
          class="game-table__encounter-rail"
          :class="{
            'game-table__encounter-rail--behind-death-loot': actorDeathLootInteraction,
            'game-table__encounter-rail--observer': !isActorTurn,
          }"
        >
          <CardPresentation
            v-if="previousEncounterCard"
            class="game-table__encounter-side game-table__encounter-side--previous"
            :card="previousEncounterCard"
            variant="encounter"
          />
          <div class="game-table__selected-encounter">
            <CardPresentation
              class="game-table__encounter-card"
              :card="encounterCard"
              variant="encounter"
            />
          </div>
          <CardPresentation
            v-if="nextEncounterCard"
            class="game-table__encounter-side game-table__encounter-side--next"
            :card="nextEncounterCard"
            variant="encounter"
          />
        </div>

        <section
          v-else-if="!isFinished && !actorDeathLootInteraction && !actorRunAwayInteraction && !runAwayChoiceInteraction && !hasDedicatedStage && rewardCards.length"
          class="game-table__reward"
          aria-labelledby="game-reward-title"
        >
          <h2 id="game-reward-title">Награда</h2>
          <p>
            +{{ projection.recent_combat_result?.viewer_reward?.levels_gained ?? 0 }} уровень ·
            {{ rewardCards.length }} сокровища
          </p>
          <div class="game-table__reward-cards">
            <CardPresentation
              v-for="card in rewardCards"
              :key="card.instance_id"
              :card="card"
              variant="choice"
            />
          </div>
        </section>

        <section v-else-if="!isFinished && !actorDeathLootInteraction && !actorRunAwayInteraction && !runAwayChoiceInteraction && !hasDedicatedStage" class="game-table__empty-stage">
          <DeckBack v-if="isActorTurn && projection.turn.phase === 'preparation'" deck="door" />
          <h2>{{ stageTitle }}</h2>
          <p v-if="!isActorTurn">Действие принадлежит текущему игроку.</p>
          <p v-else-if="projection.turn.phase === 'setup'">
            Надень разрешённые предметы или сыграй доступные карты, затем подтверди подготовку.
          </p>
        </section>

      </main>

      <aside
        v-if="!desktopDecisionActive"
        class="game-table__sidebar"
        :class="{'game-table__sidebar--finished': isFinished}"
        aria-label="Твой персонаж"
      >
        <section v-if="isFinished" class="game-table__finished-summary">
          <span>{{ viewerWon ? "ИТОГ ПАРТИИ" : "АРХИВ ПАРТИИ" }}</span>
          <div>
            <span>{{ viewerWon ? "ИТОГ ПАРТИИ" : "АРХИВ ПАРТИИ" }}</span>
            <strong>{{ viewerWon ? `1 место · ${winnerName}` : "Итоги сохранены" }}</strong>
            <p>
              {{ finalWinnerLevel }} уровень<br>
              Сила {{ finalWinnerStrength }}<br>
              Финальная версия {{ projection.version }}
            </p>
          </div>
        </section>
        <section v-else-if="confirmedCurse" class="game-table__state-priority">
          <span>ЭФФЕКТ</span>
          <div>
            <span>ПРИМЕНЕНО</span>
            <strong>{{ confirmedCurse.name }}</strong>
            <p>Состояние уже обновлено сервером.</p>
          </div>
        </section>
        <section v-else-if="helpState" class="game-table__state-priority">
          <span>{{ helpState === "accepted" ? "СОЮЗНИК" : helpState === "invite" ? "ВХОДЯЩИЙ ЗАПРОС" : "ПРЕДЛОЖЕНИЕ" }}</span>
          <div>
            <span>{{ helpState === "accepted" ? "СОЮЗНИК" : helpState === "invite" ? "ВХОДЯЩИЙ ЗАПРОС" : "ПОМОЩЬ" }}</span>
            <strong>{{ helpState === "accepted" ? `${helpCombatantName} + ${projectedPlayerName(projection, acceptedHelper?.helperPlayerID ?? "")}` : helpState === "invite" ? `Помочь ${helpCombatantName}?` : `Выбран: ${selectedHelpPlayer?.name ?? "—"}` }}</strong>
            <p v-if="helpState === 'accepted'">
              Сила стороны: {{ projection.turn.combat?.player_strength ?? projection.you.combat_strength }}<br>
              Сила монстров: {{ projection.turn.combat?.monster_strength ?? 0 }}<br>
              Награда помощнику: {{ acceptedHelper?.rewardTreasures ?? 0 }}
            </p>
            <p v-else-if="helpState === 'invite'">Твоя сила: {{ projection.you.combat_strength }}<br>Сила стороны после входа: {{ projection.you.combat_strength + (projection.turn.combat?.player_strength ?? 0) }}</p>
            <p v-else>Общая сила станет {{ (projection.turn.combat?.player_strength ?? 0) + (selectedHelpPlayer?.combat_strength ?? 0) }}.<br>Награда помощнику: {{ selectedHelpReward }} сокровище.</p>
          </div>
        </section>
        <section v-else-if="runAwayPendingInteraction" class="game-table__state-priority">
          <span>ПОБЕГ</span>
          <div>
            <span>ПОБЕГ</span>
            <strong>{{ currentRunAwayMonster?.name ?? "Текущий монстр" }}</strong>
            <p>Попытка {{ (projection.turn.run_away?.attempts.length ?? 0) + 1 }} из {{ runAwayMonsters.length }}<br>Бонус: {{ signed(runAwayEscapeBonus) }}<br>Цель: 5+</p>
          </div>
        </section>
        <section v-else-if="runAwayResult" class="game-table__state-priority">
          <span>{{ runAwayResult.escaped ? "РЕЗУЛЬТАТ" : "НЕПОТРЕБСТВО" }}</span>
          <div>
            <span>{{ runAwayResult.escaped ? "РЕЗУЛЬТАТ" : "НЕПОТРЕБСТВО" }}</span>
            <strong>{{ runAwayResult.escaped ? "Успешный побег" : runAwayBadStuffCopy }}</strong>
            <p>
              Бросок: {{ runAwayResult.roll ?? "авто" }}<br>
              Бонус: {{ signed(runAwayResult.modifier) }}<br>
              Итог: {{ runAwayResult.total ?? "авто" }}
            </p>
          </div>
        </section>
        <section v-else-if="endTurnReady" class="game-table__state-priority">
          <span>КОНЕЦ ХОДА</span>
          <div>
            <span>КОНЕЦ ХОДА</span>
            <strong>Всё готово</strong>
            <p>Рука: {{ projection.you.hand.length }} / {{ projection.you.hand_limit }}<br>Ожидающих выборов: 0<br>Следующая: {{ nextPlayerName }}</p>
          </div>
        </section>
        <section v-else-if="runAwayChoiceInteraction" class="game-table__run-away-priority">
          <span>ПОБЕГ</span>
          <div>
            <span>ПОБЕГ</span>
            <strong>Осталось {{ projection.turn.pending_decision?.options.length ?? 0 }}</strong>
            <p>
              Пройдено: {{ attemptedRunAwayMonsterNames.join(", ") || "—" }}<br>
              Бонус к побегу: {{ signed(runAwayEscapeBonus) }}
            </p>
          </div>
        </section>
        <section v-else-if="actorRunAwayInteraction" class="game-table__run-away-priority">
          <span>ПОБЕГ</span>
          <div>
            <span>ПОПЫТКА {{ runAwayAttemptCopy }}</span>
            <strong>{{ currentRunAwayMonster?.name ?? "Монстр" }}</strong>
            <p>
              Твой бонус к побегу: {{ signed(runAwayEscapeBonus) }}<br>
              Цель броска: 5+<br>
              При провале сработает непотребство.
            </p>
          </div>
        </section>
        <section v-else-if="actorDeathLootInteraction" class="game-table__death-priority">
          <span>ДОБЫЧА</span>
          <div>
            <span>ДОБЫЧА</span>
            <strong>Твой приоритет</strong>
            <p>
              Пул: {{ actorDeathLootInteraction.death_loot.remaining_count }} карт<br>
              Можно выбрать: 1<br>
              Уже выбрано: {{ actorDeathLootInteraction.death_loot.picked_count }}
            </p>
          </div>
        </section>
        <button
          v-else
          class="game-table__strength"
          type="button"
          @click="emit('open-sheet', {kind: 'strength'})"
        >
          <span class="game-table__strength-eyebrow">Расчёт боя</span>
          <span class="game-table__strength-score">
            <strong>
              {{ projection.turn.combat?.player_strength ?? projection.you.strength_breakdown.total_strength }}
              <template v-if="projection.turn.combat"> : {{ projection.turn.combat.monster_strength }}</template>
            </strong>
            <small>Открыть расчёт</small>
          </span>
          <span class="game-table__strength-breakdown">
            <span class="game-table__strength-group">
              <span><b>ВЫ</b><strong>{{ projection.turn.combat?.player_strength ?? projection.you.strength_breakdown.total_strength }}</strong></span>
              <span><small>Уровень {{ projection.you.level }}</small></span>
              <span><small>Экипировка {{ signed(projection.you.strength_breakdown.equipment_bonus) }}</small></span>
              <span><small>Временный бонус {{ signed(projection.you.strength_breakdown.temporary_bonus) }}</small></span>
            </span>
            <span v-if="projection.turn.combat" class="game-table__strength-group game-table__strength-group--monsters">
              <span><b>МОНСТРЫ</b><strong>{{ projection.turn.combat.monster_strength }}</strong></span>
              <span><small>Уровни {{ projection.turn.combat.monsters.map((card) => card.combat_strength ?? 0).join(" + ") }}</small></span>
              <span><small>Модификатор {{ signed(monsterModifier) }}</small></span>
              <span>
                <small>
                  Помощник: {{ helperName }}<template v-if="helperReward"> · награда {{ helperReward }} сокр.</template>
                </small>
              </span>
            </span>
          </span>
        </button>
        <button
          class="game-table__character"
          type="button"
          @click="emit('open-sheet', {kind: 'character'})"
        >
          <span>Твой персонаж</span>
          <b>Персонаж</b>
          <strong>{{ projection.you.name }} · {{ projection.you.level }} уровень</strong>
          <small v-if="characterTraitLine">{{ characterTraitLine }}</small>
          <em>Экипировка, класс и раса открываются отдельно.</em>
        </button>
        <section v-if="isFinished || isActorTurn || projection.interaction || confirmedCurse || helpState || runAwayResult || endTurnReady" class="game-table__action-panel" aria-live="polite">
          <template v-if="isFinished">
            <span>ИТОГИ</span>
            <strong>{{ viewerWon ? "Посмотреть результаты" : "Посмотреть таблицу" }}</strong>
            <p>{{ viewerWon ? "Таблица игроков и история партии." : "Или вернуться в лобби." }}</p>
            <button
              class="game-primary-action game-table__desktop-action"
              type="button"
              :aria-expanded="resultsExpanded"
              aria-controls="desktop-final-results"
              @click="resultsExpanded = !resultsExpanded"
            >
              {{ resultsExpanded ? "Скрыть итоги" : "Открыть итоги" }}
            </button>
            <ul
              v-if="resultsExpanded"
              id="desktop-final-results"
              class="game-table__final-results"
              aria-label="Финальные результаты игроков"
            >
              <li v-for="player in finalPlayers" :key="player.player_id">
                <strong>{{ player.name }}</strong>
                <span>{{ player.level }} ур. · сила {{ player.combat_strength ?? "—" }}</span>
                <em v-if="player.player_id === projection.winner_player_id">Победитель</em>
              </li>
            </ul>
          </template>
          <template v-else>
          <span>{{ actorDeathLootInteraction || runAwayChoiceInteraction || helpState === "offer" || helpState === "invite" ? "ТРЕБУЕТСЯ ВЫБОР" : runAwayPendingInteraction ? "ОЖИДАНИЕ СЕРВЕРА" : runAwayResult ? "СЛЕДУЮЩИЙ МОНСТР" : "ДОСТУПНОЕ ДЕЙСТВИЕ" }}</span>
          <template v-if="confirmedCurse">
            <strong>Эффект применён</strong>
            <p>Следующее доступное действие придёт в новой проекции.</p>
          </template>
          <template v-else-if="helpState === 'offer' || helpState === 'invite'">
            <strong>{{ helpState === "offer" ? "Отправить предложение" : "Подтверди решение" }}</strong>
            <p>{{ helpState === "offer" ? "Выбранный игрок сможет принять или отказаться." : "Сначала выбери один вариант." }}</p>
            <button
              class="game-primary-action game-table__desktop-action"
              type="button"
              :disabled="actionBusy || !selectedHelpAction"
              @click="submitHelp"
            >
              {{ actionBusy ? "Подтверждаем…" : helpState === "offer" ? "Предложить помощь" : "Подтвердить" }}
            </button>
          </template>
          <template v-else-if="runAwayPendingInteraction">
            <strong>Действия временно недоступны</strong>
            <p>Результат будет показан автоматически.</p>
            <button class="game-primary-action game-table__desktop-action" type="button" disabled>Ожидание</button>
          </template>
          <template v-else-if="runAwayResult">
            <strong>Продолжить побег</strong>
            <p>{{ runAwayMonsters.length > 1 ? `Осталось ${Math.max(0, runAwayMonsters.length - (projection.turn.run_away?.attempts.length ?? 0))} монстра.` : "Все попытки завершены." }}</p>
            <button
              v-if="primaryAction"
              class="game-primary-action game-table__desktop-action"
              type="button"
              :disabled="actionBusy"
              @click="runPrimaryAction"
            >
              {{ actionBusy ? "Подтверждаем…" : "Продолжить" }}
            </button>
          </template>
          <template v-else-if="runAwayChoiceInteraction || actorRunAwayInteraction || actorDeathLootInteraction">
            <strong>{{ actorDeathLootInteraction ? "Подтверди карту" : runAwayChoiceInteraction ? "Выбери следующего монстра" : "Можно бросить кубик" }}</strong>
            <p>{{ actorDeathLootInteraction ? "Выбор окончательный." : runAwayChoiceInteraction ? "После выбора станет доступен бросок." : "Сервер определит бросок и последствия." }}</p>
          </template>
          <template v-else-if="endTurnReady && primaryAction">
            <strong>Завершить текущий ход</strong>
            <p>Передать управление {{ nextPlayerName }}.</p>
            <button
              class="game-primary-action game-table__desktop-action"
              type="button"
              :disabled="actionBusy"
              @click="runPrimaryAction"
            >
              {{ actionBusy ? "Подтверждаем…" : "Завершить ход" }}
            </button>
          </template>
          <template v-else-if="primaryAction">
            <strong>{{ primaryActionTitle }}</strong>
            <p>{{ primaryActionDescription }}</p>
            <button
              class="game-primary-action game-table__desktop-action"
              type="button"
              :disabled="actionBusy"
              @click="runPrimaryAction"
            >
              {{ actionBusy ? "Подтверждаем…" : primaryActionLabel }}
            </button>
          </template>
          <template v-else-if="projection.interaction">
            <strong>Ожидается решение</strong>
            <p class="game-table__window-status">
              {{ projection.interaction.response_required_for_you
                ? "Требуется твоё решение."
                : `Ожидаем ответ: ${currentPlayerName}.` }}
            </p>
          </template>
          <template v-else>
            <strong>Сейчас без действия</strong>
            <p>Стол обновится после подтверждённого хода.</p>
          </template>
          </template>
        </section>
      </aside>

      <section v-if="isActorTurn || isFinished || helpState === 'invite'" class="game-table__hand" aria-label="Рука">
        <header>
          <strong>Рука · {{ projection.you.hand.length }}</strong>
          <button type="button" aria-label="Открыть руку" @click="openHand()">
            {{ desktopAvailableHandCardCopy }}
          </button>
        </header>
        <div class="game-table__hand-rail">
          <button
            v-for="card in projection.you.hand"
            :key="card.instance_id"
            type="button"
            @click="openHand(card.instance_id)"
          >
            <CardPresentation :card="card" variant="choice" />
          </button>
        </div>
      </section>
    </div>

    <nav
      class="mobile-game-table__dock mobile-game-table__dock--compact"
      :class="{'mobile-game-table__dock--with-action': primaryAction}"
      aria-label="Игровые действия"
    >
      <button class="mobile-game-table__dock-character" type="button" @click="emit('open-sheet', {kind: 'character'})">
        Персонаж
      </button>
      <button
        class="mobile-game-table__dock-hand"
        type="button"
        @click="openHand()"
      >
        <span aria-hidden="true"><i /><i /><i /></span>
        <strong>Рука · {{ projection.you.hand.length }}</strong>
      </button>
      <button
        v-if="primaryAction"
        class="mobile-game-table__dock-primary"
        type="button"
        :aria-label="primaryActionLabel"
        :disabled="actionBusy"
        @click="runPrimaryAction"
      >
        {{ compactPrimaryActionLabel }}
      </button>
      <span v-else class="mobile-game-table__dock-spacer" aria-hidden="true" />
    </nav>

  </section>
</template>

<style scoped lang="scss">
.game-table {
  --game-gutter: 16px;
  --encounter-scale: 1;
  width: min(100%, 1440px);
  min-width: 0;
  min-height: 100dvh;
  margin-inline: auto;
  box-sizing: border-box;
  padding: var(--game-gutter);
  color: var(--color-text-primary);
}

.game-table__compact-header,
.mobile-game-table__dock { display: none; }

.game-table__layout {
  display: grid;
  grid-template-columns: minmax(190px, 248px) minmax(360px, 1fr) minmax(260px, 360px);
  grid-template-rows: minmax(502px, 1fr) 278px;
  gap: 16px;
  min-width: 0;
  margin-top: 16px;
  min-height: calc(100dvh - 104px);
}

.game-table__opponents,
.game-table__stage,
.game-table__sidebar {
  min-width: 0;
  border: 1px solid var(--color-line);
  border-radius: var(--radius-panel);
  background: var(--color-surface);
}

.game-table__opponents {
  grid-row: 1 / span 2;
  display: flex;
  flex-direction: column;
  padding: 16px;
}

.game-table__opponents h2 {
  margin: 0;
  font-size: 11px;
  letter-spacing: .08em;
  text-transform: uppercase;
}

.game-table__opponent-list { display: grid; gap: 16px; margin-top: 20px; }
.opponent-tile {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-width: 0;
  min-height: 82px;
  box-sizing: border-box;
  border: 1px solid var(--color-line);
  border-radius: 14px;
  padding: 12px;
  color: inherit;
  background: transparent;
  font: inherit;
  text-align: left;
  cursor: pointer;
}
.opponent-tile[data-status="active"] { box-shadow: inset 4px 0 var(--color-accent-strong); }
.opponent-tile > div { min-width: 0; display: grid; gap: 4px; }
.opponent-tile strong,
.opponent-tile span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.opponent-tile span { color: var(--color-text-muted); font-size: 10px; }
.opponent-tile__desktop-strength { flex: 0 0 auto; justify-items: end; }
.opponent-tile__desktop-strength span { font-size: 9px; letter-spacing: .08em; }
.opponent-tile__desktop-strength strong { font-size: 20px; }
.opponent-tile__compact-hand { display: none; }

.game-table__room {
  min-height: 142px;
  display: grid;
  align-content: start;
  gap: 8px;
  box-sizing: border-box;
  margin-top: auto;
  border: 1px solid var(--color-line);
  border-radius: 14px;
  padding: 14px;
}
.game-table__room > span { color: var(--color-text-muted); font-size: 9px; font-weight: 800; letter-spacing: .08em; }
.game-table__room > strong { font-size: 14px; }
.game-table__room p { margin: 0; color: var(--color-text-muted); font-size: 10px; }
.game-table__room button {
  max-width: 100%;
  margin-top: 4px;
  overflow: hidden;
  border: 0;
  padding: 0;
  color: var(--color-accent-strong);
  background: transparent;
  font: inherit;
  font-size: 10px;
  font-weight: 700;
  text-align: left;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: pointer;
}

.game-table__stage {
  position: relative;
  display: grid;
  place-items: center;
  overflow: hidden;
  padding: 0;
}
.game-table__pager {
  position: absolute;
  z-index: 4;
  top: 14px;
  left: 50%;
  transform: translateX(-50%);
  border: 1px solid var(--color-line);
  border-radius: 999px;
  padding: 6px 12px;
  color: var(--color-text-muted);
  background: var(--color-surface);
  font-size: 10px;
  white-space: nowrap;
}
.game-table__encounter-rail {
  position: relative;
  align-self: end;
  justify-self: stretch;
  width: 100%;
  min-width: 0;
  height: 416px;
  display: grid;
  place-items: center;
  margin-bottom: 10px;
}
.game-table__selected-encounter {
  z-index: 2;
  width: 256px;
  height: 416px;
  display: grid;
  place-items: center;
  box-sizing: border-box;
  border-radius: 20px;
  padding: 8px;
  background: var(--color-border-card);
  transform: scale(var(--encounter-scale));
  transform-origin: center top;
}
.game-table__encounter-card { margin-inline: auto; }
.game-table__encounter-side {
  position: absolute;
  top: 8px;
  z-index: 1;
  display: block;
  transform-origin: center top;
}
.game-table__encounter-side--previous { left: 50%; transform: translateX(-384px) scale(var(--encounter-scale)); }
.game-table__encounter-side--next { left: 50%; transform: translateX(144px) scale(var(--encounter-scale)); }
.game-table__empty-stage { max-width: 34rem; display: grid; justify-items: center; gap: 12px; text-align: center; }
.game-table__empty-stage h2,
.game-table__empty-stage p { margin: 0; }
.game-table__empty-stage p { color: var(--color-text-muted); line-height: 1.45; }
.game-table__stage--observer { grid-row: 1 / span 2; }

.game-table__finished {
  width: 100%;
  height: 100%;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  gap: 16px;
  box-sizing: border-box;
  padding: 18px 24px 44px;
}
.game-table__finished h2,
.game-table__finished header p,
.game-table__finished footer,
.game-table__finished-card p { margin: 0; }
.game-table__finished h2 { font-size: 20px; line-height: 24px; }
.game-table__finished header p { margin-top: 6px; color: var(--color-text-muted); font-size: 12px; }
.game-table__finished-card {
  align-self: center;
  justify-self: center;
  width: min(560px, calc(100% - 32px));
  min-height: 250px;
  display: grid;
  place-content: center;
  justify-items: center;
  gap: 12px;
  box-sizing: border-box;
  border: 1px solid var(--color-line);
  border-radius: 20px;
  padding: 28px 32px 24px;
  text-align: center;
}
.game-table__finished-card > span { min-width: 132px; height: 28px; display: inline-flex; align-items: center; justify-content: center; box-sizing: border-box; border-radius: 14px; padding: 0 14px; color: var(--color-surface); background: var(--color-accent-strong); font-size: 11px; }
.game-table__finished-card strong { font-size: 28px; line-height: 34px; }
.game-table__finished-card p { color: var(--color-text-muted); font-size: 14px; }
.game-table__finished-card small { color: var(--color-accent-strong); font-size: 12px; }
.game-table__finished footer { color: var(--color-text-muted); font-size: 10px; font-weight: 700; }

.game-table__state-panel {
  width: 100%;
  height: 100%;
  min-width: 0;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  gap: 16px;
  box-sizing: border-box;
  padding: 18px 24px 20px;
}
.game-table__state-panel header h2,
.game-table__state-panel header p,
.game-table__state-panel footer,
.game-table__state-card p { margin: 0; }
.game-table__state-panel header h2 { font-size: 20px; line-height: 24px; }
.game-table__state-panel header p { margin-top: 6px; color: var(--color-text-muted); font-size: 12px; }
.game-table__state-panel footer { color: var(--color-text-muted); font-size: 9px; font-weight: 800; letter-spacing: .04em; }
.game-table__state-card {
  align-self: center;
  justify-self: center;
  width: min(560px, calc(100% - 32px));
  min-height: 250px;
  display: grid;
  place-content: center;
  justify-items: center;
  gap: 12px;
  box-sizing: border-box;
  border: 1px solid var(--color-line);
  border-radius: 18px;
  padding: 28px;
  background: var(--color-surface-card);
  text-align: center;
}
.game-table__state-card > span { width: 132px; min-height: 28px; display: grid; place-items: center; border-radius: 14px; color: var(--color-surface); background: var(--color-accent-strong); font-size: 10px; font-weight: 700; letter-spacing: .04em; }
.game-table__state-card > strong { font-family: inherit; font-size: 28px; }
.game-table__state-card p { color: var(--color-text-primary); font-size: 14px; line-height: 1.5; }
.game-table__state-card small { color: var(--color-text-muted); font-size: 12px; }
.game-table__state-options {
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: safe center;
  gap: clamp(18px, 5vw, 58px);
  overflow-x: auto;
  padding: 6px;
}
.game-table__state-options > button {
  position: relative;
  flex: 0 0 180px;
  height: 218px;
  display: grid;
  grid-template-rows: 92px auto auto minmax(0, 1fr);
  align-content: stretch;
  justify-items: start;
  gap: 6px;
  overflow: hidden;
  box-sizing: border-box;
  border: 1px solid var(--color-line);
  border-radius: 14px;
  padding: 0 10px 10px;
  color: inherit;
  background: var(--color-surface-card);
  box-shadow: 0 7px 18px rgb(59 46 40 / 14%);
  font: inherit;
  text-align: start;
}
.game-table__state-options > button[aria-selected="true"] { border-color: var(--color-accent-strong); }
.game-table__state-options span { color: var(--color-accent-strong); font-size: 9px; font-weight: 800; letter-spacing: .08em; }
.game-table__state-options small { color: var(--color-text-muted); line-height: 1.4; }
.game-table__state-options strong { padding-top: 4px; font-size: 11px; font-weight: 500; }
.game-table__state-options p { margin: 0; font-size: 10px; line-height: 14px; }
.game-table__state-options b { position: absolute; left: 10px; bottom: 8px; color: var(--color-accent-strong); font-size: 8px; letter-spacing: .08em; }
.game-table__state-options .game-table__state-option-art { width: calc(100% + 20px); height: 92px; display: grid; place-items: center; margin-left: -10px; color: var(--color-text-primary); background: color-mix(in srgb, var(--color-accent) 30%, var(--color-surface)); }
.game-table__state-options--help-offer > button:not(.game-table__state-option-reward),
.game-table__state-options--help-invite > button { flex-basis: 150px; }
.game-table__state-options > .game-table__state-option-reward { flex: 0 0 200px; grid-template-rows: auto auto minmax(0, 1fr); align-content: start; gap: 14px; padding: 16px; box-shadow: none; }
.game-table__state-option-reward > strong { font-size: 18px; font-weight: 700; }
.game-table__state-options article.game-table__state-option-reward { height: 218px; box-sizing: border-box; border: 1px solid var(--color-line); border-radius: 14px; color: inherit; background: var(--color-surface-card); }

.game-table__hand-rail > button {
  border: 0;
  padding: 0;
  background: transparent;
  cursor: pointer;
}

.game-table__reward { min-width: 0; text-align: center; }
.game-table__reward h2,
.game-table__reward p { margin: 0 0 8px; }
.game-table__reward-cards { display: flex; gap: 12px; max-width: 100%; overflow-x: auto; }

.game-table__sidebar {
  grid-column: 3;
  grid-row: 1 / span 2;
  display: grid;
  grid-template-rows: 332px 188px minmax(194px, 1fr);
  gap: 24px;
  padding: 16px;
}
.game-table__sidebar--finished { grid-template-rows: 323px 188px 204px; }
.game-table__strength {
  min-width: 0;
  display: grid;
  grid-template-rows: auto 48px minmax(0, 1fr);
  gap: 12px;
  border: 0;
  padding: 0;
  color: inherit;
  background: transparent;
  text-align: left;
  cursor: pointer;
}
.game-table__death-priority,
.game-table__run-away-priority,
.game-table__state-priority,
.game-table__finished-summary {
  min-width: 0;
  display: grid;
  grid-template-rows: auto 1fr;
  gap: 76px;
}
.game-table__finished-summary { gap: 78px; }
.game-table__death-priority > span,
.game-table__death-priority > div > span,
.game-table__run-away-priority > span,
.game-table__run-away-priority > div > span,
.game-table__state-priority > span,
.game-table__state-priority > div > span,
.game-table__finished-summary > span,
.game-table__finished-summary > div > span { color: var(--color-text-muted); font-size: 9px; font-weight: 800; letter-spacing: .08em; }
.game-table__death-priority > div,
.game-table__run-away-priority > div,
.game-table__state-priority > div,
.game-table__finished-summary > div { display: grid; align-content: start; gap: 18px; border: 1px solid var(--color-line); border-radius: 16px; padding: 16px; background: var(--color-surface-card); }
.game-table__death-priority strong,
.game-table__run-away-priority strong,
.game-table__state-priority strong,
.game-table__finished-summary strong { font-size: 20px; }
.game-table__death-priority p,
.game-table__run-away-priority p,
.game-table__state-priority p,
.game-table__finished-summary p { margin: 0; color: var(--color-text-muted); font-size: 12px; line-height: 1.45; }
.game-table__run-away-priority { gap: 76px; }
.game-table__strength-eyebrow,
.game-table__character > span,
.game-table__action-panel > span {
  color: var(--color-text-muted);
  font-size: 9px;
  font-weight: 800;
  letter-spacing: .08em;
  text-transform: uppercase;
}
.game-table__character > span { color: color-mix(in srgb, var(--color-surface) 75%, var(--color-surface-inverse)); }
.game-table__strength-score {
  width: 160px;
  min-height: 48px;
  display: grid;
  place-content: center;
  justify-self: center;
  border-radius: 999px;
  color: var(--color-surface);
  background: var(--color-info);
  box-shadow: 0 3px 5px rgb(46 43 41 / 24%);
  text-align: center;
}
.game-table__strength-score strong { font-size: 22px; line-height: 1; }
.game-table__strength-score small { margin-top: 4px; font-size: 8px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; }
.game-table__strength-breakdown {
  min-width: 0;
  display: grid;
  align-content: start;
  gap: 12px;
  border: 1px solid var(--color-line);
  border-radius: 16px;
  padding: 14px;
  background: var(--color-surface-card);
}
.game-table__strength-group { min-width: 0; display: grid; gap: 8px; }
.game-table__strength-group--monsters { border-top: 1px solid var(--color-line); padding-top: 12px; }
.game-table__strength-group > span { min-width: 0; display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.game-table__strength-group b { color: var(--color-accent-strong); font-size: 9px; letter-spacing: .08em; }
.game-table__strength-group strong { color: var(--color-accent-strong); font-size: 18px; }
.game-table__strength-group small { overflow: hidden; color: var(--color-text-muted); font-size: 10px; text-overflow: ellipsis; white-space: nowrap; }

.game-table__character {
  position: relative;
  min-width: 0;
  display: grid;
  align-content: start;
  gap: 10px;
  color: inherit;
  border: 0;
  border-radius: 16px;
  padding: 16px;
  color: var(--color-surface);
  background: var(--color-ink);
  text-align: left;
  cursor: pointer;
}
.game-table__character > b {
  position: absolute;
  top: 16px;
  right: 16px;
  min-height: 40px;
  display: inline-flex;
  align-items: center;
  border: 1px solid var(--color-border-card);
  border-radius: 12px;
  padding: 0 10px;
  font-size: 9px;
  letter-spacing: .08em;
  text-transform: uppercase;
}
.game-table__character strong { margin-top: 12px; font-family: var(--font-card); font-size: 19px; }
.game-table__character small { color: color-mix(in srgb, var(--color-surface) 75%, var(--color-surface-inverse)); }
.game-table__character em { margin-top: auto; color: color-mix(in srgb, var(--color-surface) 75%, var(--color-surface-inverse)); font-size: 10px; font-style: normal; line-height: 1.4; }

.game-table__action-panel {
  min-width: 0;
  display: grid;
  grid-template-rows: auto auto minmax(0, 1fr) auto;
  align-content: start;
  gap: 12px;
  border: 1px solid var(--color-line);
  border-radius: 16px;
  padding: 14px;
}
.game-table__action-panel > strong { font-size: 14px; }
.game-table__action-panel p { margin: 0; color: var(--color-text-muted); font-size: 10px; line-height: 1.45; }
.game-table__final-results { max-height: 86px; display: grid; gap: 5px; overflow-y: auto; margin: 0; padding: 0; list-style: none; }
.game-table__final-results li { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: baseline; column-gap: 8px; color: var(--color-text-muted); font-size: 9px; }
.game-table__final-results strong { overflow: hidden; color: var(--color-text-primary); text-overflow: ellipsis; white-space: nowrap; }
.game-table__final-results em { grid-column: 1 / -1; color: var(--color-accent-strong); font-style: normal; font-weight: 800; letter-spacing: .06em; }
.game-primary-action {
  width: 100%;
  min-height: 52px;
  border: 0;
  border-radius: 14px;
  padding: 0 18px;
  color: var(--color-surface);
  background: var(--color-accent-strong);
  font: inherit;
  font-weight: 800;
  cursor: pointer;
}
.game-primary-action:disabled { opacity: .55; cursor: wait; }
.game-table__action-panel .game-primary-action:disabled { color: var(--color-text-primary); background: var(--color-surface-control); opacity: 1; cursor: default; }
.game-table__window-status { margin: 0; color: var(--color-text-muted); line-height: 1.4; }

.game-table__hand {
  grid-column: 2;
  min-width: 0;
  border-radius: 16px;
  padding: 16px 20px;
  color: var(--color-surface);
  background: var(--color-ink);
  box-shadow: 0 4px 12px rgb(23 62 67 / 14%);
}
.game-table__hand header { min-height: 14px; display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 15px; font-size: 9px; line-height: 14px; font-weight: 600; letter-spacing: .08em; }
.game-table__hand header strong { text-transform: uppercase; }
.game-table__hand header button { min-width: 0; min-height: 14px; height: 14px; border: 0; padding: 0; color: color-mix(in srgb, var(--color-surface) 75%, var(--color-surface-inverse)); background: transparent; font: inherit; line-height: 14px; cursor: pointer; }
.game-table__hand-rail { display: flex; justify-content: safe center; gap: 16px; min-width: 0; overflow-x: auto; padding-bottom: 4px; }

@media (width < 1024px) {
  .game-table { --game-gutter: 14px; padding: 12px var(--game-gutter) calc(98px + env(safe-area-inset-bottom, 0px)); }
  .game-table__desktop-header { display: none; }
  .game-table__compact-header { display: grid; }
  .game-table__layout {
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: 38px minmax(416px, 1fr);
    gap: 8px;
    min-height: max(470px, calc(100dvh - 150px));
    margin-top: 8px;
  }
  .game-table__opponents { grid-row: auto; padding: 0; border: 0; background: transparent; }
  .game-table__opponents h2 { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
  .game-table__opponent-list { display: flex; gap: 8px; min-width: 0; margin: 0; overflow-x: auto; }
  .opponent-tile {
    flex: 0 0 calc(33.333333% - 5.333333px);
    min-height: 38px;
    justify-content: center;
    box-sizing: border-box;
    border-radius: 8px;
    padding: 8px 10px;
    background: var(--color-surface);
  }
  .game-table__opponent-list[data-count="1"] .opponent-tile { flex-basis: 100%; }
  .game-table__opponent-list[data-count="2"] .opponent-tile { flex-basis: calc(50% - 4px); }
  .opponent-tile > div { display: block; }
  .opponent-tile > div > span,
  .game-table__room { display: none; }
  .opponent-tile > .opponent-tile__desktop-strength { display: none; }
  .opponent-tile > div > strong,
  .opponent-tile__compact-hand { font-size: 11px; font-weight: 500; }
  .opponent-tile__compact-hand { display: inline; }
  .opponent-tile__compact-hand::before { content: "·"; margin-right: 4px; color: var(--color-text-muted); }
  .game-table__stage {
    min-height: 416px;
    border: 0;
    padding: 0;
    background: transparent;
    overflow: hidden;
  }
  .game-table__stage--observer { grid-row: auto; }
  .game-table__state-panel {
    min-height: 416px;
    padding: 18px 14px 14px;
    border: 1px solid var(--color-line);
    border-radius: 14px;
    background: var(--color-surface);
  }
  .game-table__state-card { width: min(100%, 420px); min-height: 220px; padding: 20px; }
  .game-table__state-card > strong { font-size: clamp(22px, 7vw, 28px); }
  .game-table__state-options { justify-content: safe start; gap: 12px; }
  .game-table__state-options > button { flex-basis: min(72vw, 220px); min-height: 232px; }
  .game-table__encounter-rail--behind-death-loot { display: grid; }
  .game-table__pager { display: none; }
  .game-table__encounter-rail {
    position: relative;
    align-self: center;
    justify-self: center;
    width: calc(100% + var(--game-gutter) + var(--game-gutter));
    max-width: none;
    height: 416px;
    min-height: 416px;
    margin: 0;
    overflow: hidden;
  }
  .game-table__encounter-side { top: 8px; }
  .game-table__encounter-rail--observer .game-table__encounter-side { display: none; }
  .game-table__encounter-side--previous { left: 50%; transform: translateX(-376px) scale(var(--encounter-scale)); }
  .game-table__encounter-side--next { left: 50%; transform: translateX(136px) scale(var(--encounter-scale)); }
  .game-table__sidebar,
  .game-table__hand { display: none; }
  .mobile-game-table__dock {
    position: fixed;
    z-index: 40;
    right: max(16px, env(safe-area-inset-right, 0px));
    bottom: calc(16px + env(safe-area-inset-bottom, 0px));
    left: max(16px, env(safe-area-inset-left, 0px));
    width: auto;
    max-width: 560px;
    margin-inline: auto;
    height: 62px;
    min-height: 62px;
    display: grid;
    grid-template-columns: minmax(70px, 1fr) minmax(132px, 156px) minmax(70px, 1fr);
    align-items: center;
    gap: 8px;
    box-sizing: border-box;
    border-radius: 24px;
    padding: 8px;
    background: var(--color-ink);
    box-shadow: 0 10px 28px rgb(46 43 41 / 22%);
  }
  .mobile-game-table__dock > button {
    min-width: 0;
    min-height: 46px;
    overflow: hidden;
    border: 1px solid var(--color-border-card);
    border-radius: 16px;
    padding: 0 10px;
    color: var(--color-surface);
    background: transparent;
    font: inherit;
    font-size: 11px;
    font-weight: 800;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .mobile-game-table__dock > .mobile-game-table__dock-hand {
    position: relative;
    z-index: 1;
    min-height: 70px;
    display: grid;
    place-content: center;
    gap: 8px;
    border-color: var(--color-line);
    border-radius: 24px;
    color: var(--color-ink);
    background: var(--color-surface-control);
    box-shadow: 0 4px 9px rgb(46 43 41 / 18%);
    transform: translateY(-12px);
  }
  .mobile-game-table__dock-hand > span { display: flex; justify-content: center; gap: 4px; }
  .mobile-game-table__dock-hand i { width: 8px; height: 12px; display: block; border-radius: 3px; background: var(--color-action-response); }
  .mobile-game-table__dock-hand strong { font-size: 14px; }
  .mobile-game-table__dock > .mobile-game-table__dock-primary { border-color: transparent; color: var(--color-surface); background: var(--color-accent-strong); text-transform: uppercase; }
  .mobile-game-table__dock-character,
  .mobile-game-table__dock > .mobile-game-table__dock-primary { padding-inline: 4px; font-size: 9px; text-transform: uppercase; }
  .mobile-game-table__dock-spacer { min-width: 0; }
}

@media (width < 600px) {
  .game-table__layout { min-height: max(462px, calc(100dvh - 178px)); }
  .mobile-game-table__dock { bottom: calc(24px + env(safe-area-inset-bottom, 0px)); }
}

@media (width < 1024px) and (height < 600px) {
  .game-table { --encounter-scale: .75; }
  .game-table__layout {
    min-height: 0;
    grid-template-rows: 38px max(180px, calc(100dvh - 180px));
  }
  .game-table__stage {
    height: max(180px, calc(100dvh - 180px));
    min-height: 0;
  }
  .game-table__encounter-rail {
    top: 0;
    height: 100%;
    min-height: 0;
    transform: none;
  }
}

@media (width < 1024px) and (height < 480px) {
  .game-table { --encounter-scale: .58; }
}

@media (width < 1024px) and (height < 430px) {
  .game-table { --encounter-scale: .45; }
}
</style>
