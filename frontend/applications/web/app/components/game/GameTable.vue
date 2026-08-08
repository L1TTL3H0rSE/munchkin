<script setup lang="ts">
import type {
  ActionDescriptor,
  CommandPayload,
  Projection,
} from "@munchkin/contracts";
import type {GameConnectionState} from "../../composables/useGameSessionController";
import type {GameApiErrorKind} from "../../composables/useGameApi";
import {
  buildCommandPayload,
  type ActionEntry,
} from "../actionModel";
import CardPresentation from "./primitives/CardPresentation.vue";
import DeckBack from "./primitives/DeckBack.vue";
import DesktopGameHeader from "./desktop/DesktopGameHeader.vue";
import MobileGameHeader from "./mobile/MobileGameHeader.vue";
import {
  buildGamePresentationModel,
  opponentStatus,
} from "./gamePresentationModel";
import type {GameSheetRequest} from "./gameSheetModel";

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
  "open-sheet": [request: GameSheetRequest];
}>();

const presentation = computed(() => buildGamePresentationModel(props.projection));
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

const handActionSourceIDs = computed(() => new Set(
  actionDescriptors.value
    .map((action) => action.source_instance_id)
    .filter((instanceID): instanceID is string => Boolean(instanceID)),
));
const availableHandCardCount = computed(() => props.projection.you.hand.filter((card) =>
  handActionSourceIDs.value.has(card.instance_id),
).length);
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
    case "open_door": return "Вышибить дверь";
    case "loot_room": return "Обыскать комнату";
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
    case "open_door": return "Дверь";
    case "loot_room": return "Обыскать";
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
    case "open_door": return "Можно вышибить дверь";
    case "loot_room": return "Можно обыскать комнату";
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
    case "door_choice": return "Выбери продолжение";
    case "charity": return "Приведи руку к лимиту";
    case "end_turn": return "Ход завершён";
    default: return "Игровой стол";
  }
});
const rewardCards = computed(() =>
  props.projection.recent_combat_result?.viewer_reward?.treasures ?? [],
);

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
    />
    <MobileGameHeader
      class="game-table__compact-header"
      :projection="projection"
      :presentation-model="presentation"
      :strength-open="false"
      @open-strength="emit('open-sheet', {kind: 'strength'})"
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

      <main class="game-table__stage" aria-label="Игровая область">
        <div v-if="presentation.encounterPageCount > 1" class="game-table__pager">
          {{ encounterPagerCopy }}
        </div>

        <div v-if="encounterCard" class="game-table__encounter-rail">
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
          v-else-if="rewardCards.length"
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

        <section v-else class="game-table__empty-stage">
          <DeckBack v-if="isActorTurn && projection.turn.phase === 'preparation'" deck="door" />
          <h2>{{ stageTitle }}</h2>
          <p v-if="!isActorTurn">Действие принадлежит текущему игроку.</p>
          <p v-else-if="projection.turn.phase === 'setup'">
            Надень разрешённые предметы или сыграй доступные карты, затем подтверди подготовку.
          </p>
        </section>

      </main>

      <aside class="game-table__sidebar" aria-label="Твой персонаж">
        <button
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
        <section class="game-table__action-panel" aria-live="polite">
          <span>Доступное действие</span>
          <template v-if="primaryAction">
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
        </section>
      </aside>

      <section class="game-table__hand" aria-label="Рука">
        <header>
          <strong>Рука · {{ projection.you.hand.length }}</strong>
          <button type="button" aria-label="Открыть руку" @click="openHand()">
            {{ availableCardsCopy(availableHandCardCount) }}
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

    <button
      v-if="errorKind && errorMessage"
      class="game-table__retry"
      type="button"
      @click="emit('retry')"
    >
      {{ errorMessage }} · Повторить
    </button>
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
.game-table__strength-eyebrow,
.game-table__character > span,
.game-table__action-panel > span {
  color: var(--color-text-muted);
  font-size: 9px;
  font-weight: 800;
  letter-spacing: .08em;
  text-transform: uppercase;
}
.game-table__character > span { color: #cfc5ba; }
.game-table__strength-score {
  width: 160px;
  min-height: 48px;
  display: grid;
  place-content: center;
  justify-self: center;
  border-radius: 999px;
  color: #fff9ef;
  background: #165a64;
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
  color: #fff9ef;
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
  border: 1px solid #6f6861;
  border-radius: 12px;
  padding: 0 10px;
  font-size: 9px;
  letter-spacing: .08em;
  text-transform: uppercase;
}
.game-table__character strong { margin-top: 12px; font-family: var(--font-card); font-size: 19px; }
.game-table__character small { color: #cfc5ba; }
.game-table__character em { margin-top: auto; color: #cfc5ba; font-size: 10px; font-style: normal; line-height: 1.4; }

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
.game-primary-action {
  width: 100%;
  min-height: 52px;
  border: 0;
  border-radius: 14px;
  padding: 0 18px;
  color: #fff9ef;
  background: var(--color-accent-strong);
  font: inherit;
  font-weight: 800;
  cursor: pointer;
}
.game-primary-action:disabled { opacity: .55; cursor: wait; }
.game-table__window-status { margin: 0; color: var(--color-text-muted); line-height: 1.4; }

.game-table__hand {
  grid-column: 2;
  min-width: 0;
  border-radius: 18px;
  padding: 16px;
  color: #fff9ef;
  background: var(--color-ink);
}
.game-table__hand header { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 12px; }
.game-table__hand header button { border: 0; color: #cfc5ba; background: transparent; cursor: pointer; }
.game-table__hand-rail { display: flex; justify-content: safe center; gap: 16px; min-width: 0; overflow-x: auto; padding-bottom: 4px; }
.game-table__retry { position: fixed; right: 16px; bottom: 16px; z-index: 50; max-width: min(28rem, calc(100% - 32px)); border: 1px solid var(--color-danger); border-radius: 12px; padding: 10px 14px; color: var(--color-danger); background: var(--color-surface); }

@media (width < 1024px) {
  .game-table { --game-gutter: 14px; padding: 12px var(--game-gutter) calc(98px + env(safe-area-inset-bottom, 0px)); }
  .game-table__desktop-header { display: none; }
  .game-table__retry {
    right: max(16px, env(safe-area-inset-right, 0px));
    bottom: calc(94px + env(safe-area-inset-bottom, 0px));
    left: max(16px, env(safe-area-inset-left, 0px));
    max-width: 560px;
    margin-inline: auto;
  }
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
  .game-table__encounter-side--previous { left: 50%; transform: translateX(-376px) scale(var(--encounter-scale)); }
  .game-table__encounter-side--next { left: 50%; transform: translateX(136px) scale(var(--encounter-scale)); }
  .game-table__sidebar,
  .game-table__hand { display: none; }
  .mobile-game-table__dock {
    position: fixed;
    z-index: 40;
    right: max(16px, env(safe-area-inset-right, 0px));
    bottom: max(16px, env(safe-area-inset-bottom, 0px));
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
    border: 1px solid #6f6861;
    border-radius: 16px;
    padding: 0 10px;
    color: #fff9ef;
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
  .mobile-game-table__dock > .mobile-game-table__dock-primary { border-color: transparent; color: #fff9ef; background: var(--color-accent-strong); text-transform: uppercase; }
  .mobile-game-table__dock-character,
  .mobile-game-table__dock-primary { padding-inline: 4px !important; font-size: 9px !important; text-transform: uppercase; }
  .mobile-game-table__dock-spacer { min-width: 0; }
}

@media (width < 600px) {
  .game-table__layout { min-height: max(462px, calc(100dvh - 178px)); }
  .mobile-game-table__dock { bottom: max(24px, env(safe-area-inset-bottom, 0px)); }
  .game-table__retry { bottom: calc(102px + env(safe-area-inset-bottom, 0px)); }
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
