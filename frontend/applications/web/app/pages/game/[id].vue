<script setup lang="ts">
import type {
  ActionDescriptor,
  CardView,
  CommandPayload,
} from "@munchkin/contracts";

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

function runAction(
  action: ActionDescriptor,
  payload: CommandPayload,
): void {
  void controller.submitAction(action, payload);
}
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

    <div class="action-bar">
      <ActionPanel
        v-if="projection.turn.available_actions.length"
        :actions="projection.turn.available_actions"
        :cards="visibleCards"
        :busy="actionBusy"
        @execute="runAction"
      />
      <span v-else-if="projection.status === 'active'">
        Ждём {{ currentPlayerName }}
      </span>
      <strong v-if="projection.status === 'finished'">
        Победитель: {{ projection.winner_player_id }}
      </strong>
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
        />
        <p v-if="!projection.you.hand.length">Карт нет.</p>
      </div>
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
