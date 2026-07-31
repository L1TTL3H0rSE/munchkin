<script setup lang="ts">
import type {
  ActionDescriptor,
  CardView,
  CommandPayload,
} from "@munchkin/contracts";
import {
  buildCommandPayload,
  cardActionState,
  mapCardActions,
  type ActionEntry,
  type CardActionBinding,
} from "../../components/actionModel";

const route = useRoute();
const router = useRouter();
const api = useGameApi();
const session = useGameSession();
const gameID = computed(() => String(route.params.id));
const controller = useGameSessionController({
  gameID,
  api,
  credentials: session,
  navigateToLobby: async () => {
    await router.replace("/");
  },
});
const {
  projection,
  loading,
  actionBusy,
  errorMessage,
  connectionState,
  isBusy,
} = controller;

const selectedCardID = ref<string | null>(null);
const pendingCardIDs = ref<Set<string>>(new Set());
const confirmedCardIDs = ref<Set<string>>(new Set());
let confirmedMotionTimer: ReturnType<typeof setTimeout> | undefined;

const currentPlayerName = computed(() => projection.value?.players
  .find((player) => player.player_id === projection.value?.turn.player_id)?.name ?? "другого игрока");
const visibleCards = computed(() => {
  const current = projection.value;
  if (!current) {
    return [];
  }
  const cards: CardView[] = [
    ...current.you.hand,
    ...current.you.carried,
    ...current.you.equipped,
    ...current.you.traits,
    ...current.you.attachments,
    ...current.you.persistent_curses,
    ...current.turn.resolving,
  ];
  if (current.turn.encounter) {
    cards.push(current.turn.encounter);
  }
  for (const player of current.players) {
    cards.push(
      ...player.carried,
      ...player.equipped,
      ...player.traits,
      ...player.attachments,
      ...player.persistent_curses,
    );
  }
  return [...new Map(cards.map((card) => [card.instance_id, card])).values()];
});

const ownCards = computed<CardView[]>(() => {
  const current = projection.value;
  if (!current) {
    return [];
  }
  return [...new Map([
    ...current.you.hand,
    ...current.you.carried,
    ...current.you.equipped,
    ...current.you.traits,
    ...current.you.attachments,
    ...current.you.persistent_curses,
  ].map((card) => [card.instance_id, card])).values()];
});

const actionEntries = computed<ActionEntry[]>(() => {
  return projection.value?.turn.available_actions.map((action, index) => ({
    action,
    index,
  })) ?? [];
});

const cardActionMap = computed(() =>
  mapCardActions(ownCards.value, actionEntries.value),
);

const globalActionEntries = computed(() =>
  actionEntries.value.filter((entry) =>
    !cardActionMap.value.cardBoundActionIndexes.has(entry.index),
  ),
);

const selectedCard = computed(() => {
  const cardID = selectedCardID.value;
  return ownCards.value.find((card) => card.instance_id === cardID);
});

const selectedCardEntries = computed<ActionEntry[]>(() => {
  if (!selectedCardID.value) {
    return [];
  }
  return cardActionMap.value.byCard.get(selectedCardID.value)
    ?.map((binding) => binding)
    ?? [];
});

const actionPanelEntries = computed(() =>
  selectedCard.value ? selectedCardEntries.value : globalActionEntries.value,
);

const playerNames = computed<Record<string, string>>(() => {
  const current = projection.value;
  if (!current) {
    return {};
  }
  return Object.fromEntries([
    [current.you.player_id, current.you.name],
    ...current.players.map((player) => [player.player_id, player.name]),
  ]);
});

function cardBindings(cardID: string): CardActionBinding[] {
  return cardActionMap.value.byCard.get(cardID) ?? [];
}

function cardState(cardID: string) {
  return cardActionState(
    cardBindings(cardID),
    {
      busy: actionBusy.value,
      selected: selectedCardID.value === cardID,
      pending: pendingCardIDs.value.has(cardID),
      confirmed: confirmedCardIDs.value.has(cardID),
    },
  );
}

function markPendingCard(action: ActionDescriptor, payload: CommandPayload) {
  const ids = new Set<string>();
  if (action.source_instance_id) {
    ids.add(action.source_instance_id);
  }
  if (payload.instance_id) {
    ids.add(payload.instance_id);
  }
  for (const instanceID of payload.instance_ids ?? []) {
    ids.add(instanceID);
  }
  if (ids.size > 0) {
    pendingCardIDs.value = new Set(ids);
  }
}

function runAction(
  entry: ActionEntry,
  payload: CommandPayload,
): void {
  markPendingCard(entry.action, payload);
  void controller.submitAction(entry.action, payload);
}

function activateCard(binding: CardActionBinding) {
  if (binding.mode === "direct") {
    runAction(binding, buildCommandPayload(binding.action));
    return;
  }
  selectedCardID.value = binding.cardInstanceID;
}

function closeCardActions() {
  selectedCardID.value = null;
}

watch(
  () => projection.value?.version,
  (version, previousVersion) => {
    if (
      version === undefined ||
      previousVersion === undefined ||
      version <= previousVersion ||
      pendingCardIDs.value.size === 0
    ) {
      return;
    }
    confirmedCardIDs.value = new Set(pendingCardIDs.value);
    pendingCardIDs.value = new Set();
    if (confirmedMotionTimer) {
      clearTimeout(confirmedMotionTimer);
    }
    confirmedMotionTimer = setTimeout(() => {
      confirmedCardIDs.value = new Set();
      confirmedMotionTimer = undefined;
    }, 260);
  },
);

watch(actionBusy, (busy) => {
  if (!busy) {
    pendingCardIDs.value = new Set();
  }
});

watch(
  () => selectedCardID.value,
  (cardID) => {
    if (cardID && !cardActionMap.value.byCard.has(cardID)) {
      selectedCardID.value = null;
    }
  },
);

onBeforeUnmount(() => {
  if (confirmedMotionTimer) {
    clearTimeout(confirmedMotionTimer);
  }
});
</script>

<template>
  <section v-if="loading" class="center-state" aria-busy="true">
    <p role="status">Загружаем состояние игры…</p>
    <GameConnectionStatus
      :state="connectionState"
      :error-message="errorMessage"
      @retry="controller.retry"
    />
  </section>
  <section
    v-else-if="projection"
    class="game-table"
    :aria-busy="isBusy"
    :data-state="projection.status"
  >
    <div class="game-meta">
      <div>
        <p class="eyebrow">КОМНАТА</p>
        <code>{{ projection.game_id }}</code>
      </div>
      <div class="meta-badges">
        <span>v{{ projection.version }}</span>
        <span>{{ projection.status }}</span>
        <span>{{ projection.rules_profile_id }}</span>
      </div>
    </div>

    <GameConnectionStatus
      :state="connectionState"
      :error-message="errorMessage"
      @retry="controller.retry"
    />

    <div class="opponents">
      <article
        v-for="player in projection.players"
        :key="player.player_id"
        class="player-strip"
        :class="{active: projection.turn.player_id === player.player_id}"
      >
        <strong>{{ player.name }}</strong>
        <span>УРОВЕНЬ {{ player.level }}</span>
        <span>{{ player.hand_count }} карт в руке</span>
        <span v-if="player.dead">Мёртв — ждёт следующего хода</span>
        <span v-else-if="!player.setup_done && projection.status === 'active'">
          Готовит стартовую руку
        </span>
        <div v-if="player.equipped.length" class="public-cards">
          <GameCard
            v-for="card in player.equipped"
            :key="card.instance_id"
            :card="card"
            :content-set-id="projection.content_set_id"
            compact
          />
        </div>
      </article>
    </div>

    <div class="table-center">
      <div class="deck door">
        <span>ДВЕРИ</span>
        <strong>{{ projection.door_deck_count }}</strong>
        <small>сброс {{ projection.door_discard_count }}</small>
      </div>

      <div class="encounter-area">
        <GameCard
          v-if="projection.turn.encounter"
          :card="projection.turn.encounter"
          :content-set-id="projection.content_set_id"
        />
        <div v-else class="phase-display">
          <small>ТЕКУЩАЯ ФАЗА</small>
          <h2>{{ projection.turn.phase || "игра завершена" }}</h2>
        </div>
        <div v-if="projection.turn.combat" class="combat-score">
          <strong>{{ projection.turn.combat.player_strength }}</strong>
          <span>против</span>
          <strong>{{ projection.turn.combat.monster_strength }}</strong>
          <span>
            {{ projection.turn.combat.player_winning ? "побеждаешь" : "проигрываешь" }}
          </span>
        </div>
        <div v-if="projection.turn.resolving.length" class="resolving-cards">
          <GameCard
            v-for="card in projection.turn.resolving"
            :key="card.instance_id"
            :card="card"
            :content-set-id="projection.content_set_id"
            compact
          />
        </div>
      </div>

      <div class="deck treasure">
        <span>СОКРОВИЩА</span>
        <strong>{{ projection.treasure_deck_count }}</strong>
        <small>сброс {{ projection.treasure_discard_count }}</small>
      </div>
    </div>

    <section class="your-zone">
      <div class="character-summary">
        <div>
          <p class="eyebrow">ТВОЙ ПЕРСОНАЖ — {{ projection.you.name }}</p>
          <h2>Уровень {{ projection.you.level }}</h2>
        </div>
        <div class="character-stats">
          <span>Сила {{ projection.you.combat_strength }}</span>
          <span>Побег {{ projection.you.escape_bonus >= 0 ? "+" : "" }}{{ projection.you.escape_bonus }}</span>
          <span>Лимит руки {{ projection.you.hand_limit }}</span>
        </div>
        <div v-if="projection.you.character_tags.length" class="tag-list">
          <span v-for="tag in projection.you.character_tags" :key="tag">{{ tag }}</span>
        </div>
      </div>

      <h3>Экипировано</h3>
      <div class="hand">
        <GameCard
          v-for="card in projection.you.equipped"
          :key="card.instance_id"
          :card="card"
          :content-set-id="projection.content_set_id"
          compact
          :action-bindings="cardBindings(card.instance_id)"
          :action-state="cardState(card.instance_id)"
          :motion-state="confirmedCardIDs.has(card.instance_id) ? 'confirmed' : undefined"
          @activate="activateCard"
        />
        <p v-if="!projection.you.equipped.length">Пока ничего.</p>
      </div>

      <h3>Несёшь и черты</h3>
      <div class="hand">
        <GameCard
          v-for="card in [
            ...projection.you.carried,
            ...projection.you.traits,
            ...projection.you.attachments,
            ...projection.you.persistent_curses,
          ]"
          :key="card.instance_id"
          :card="card"
          :content-set-id="projection.content_set_id"
          compact
          :action-bindings="cardBindings(card.instance_id)"
          :action-state="cardState(card.instance_id)"
          :motion-state="confirmedCardIDs.has(card.instance_id) ? 'confirmed' : undefined"
          @activate="activateCard"
        />
      </div>

      <h3>Рука — {{ projection.you.hand.length }} карт</h3>
      <div class="hand">
        <GameCard
          v-for="card in projection.you.hand"
          :key="card.instance_id"
          :card="card"
          :content-set-id="projection.content_set_id"
          compact
          :action-bindings="cardBindings(card.instance_id)"
          :action-state="cardState(card.instance_id)"
          :motion-state="confirmedCardIDs.has(card.instance_id) ? 'confirmed' : undefined"
          @activate="activateCard"
        />
        <p v-if="!projection.you.hand.length">Карт нет.</p>
      </div>

      <section class="action-bar" aria-label="Действия текущей проекции">
        <ActionPanel
          :entries="actionPanelEntries"
          :cards="visibleCards"
          :player-names="playerNames"
          :busy="actionBusy"
          :context-card-name="selectedCard?.name"
          @close="closeCardActions"
          @execute="runAction"
        />
        <p
          v-if="projection.status === 'active' && !projection.turn.available_actions.length"
          class="action-bar__waiting"
          role="status"
        >
          Ждём {{ currentPlayerName }}. Последнее подтверждённое состояние остаётся доступным.
        </p>
        <strong v-if="projection.status === 'finished'" class="action-bar__result">
          Победитель: {{ playerNames[projection.winner_player_id ?? ''] ?? "игра завершена" }}
        </strong>
      </section>
    </section>

  </section>
  <section v-else class="center-state" :aria-busy="isBusy">
    <GameConnectionStatus
      :state="connectionState"
      :error-message="errorMessage"
      @retry="controller.retry"
    />
    <p v-if="!errorMessage">Состояние игры недоступно.</p>
    <NuxtLink to="/">Вернуться в лобби</NuxtLink>
  </section>
</template>
