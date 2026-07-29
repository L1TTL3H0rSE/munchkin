<script setup lang="ts">
import type {
  ActionDescriptor,
  CardView,
  CommandPayload,
  Projection,
} from "@munchkin/contracts";

const route = useRoute();
const router = useRouter();
const api = useGameApi();
const session = useGameSession();
const gameID = computed(() => String(route.params.id));
const projection = ref<Projection | null>(null);
const loading = ref(true);
const actionBusy = ref(false);
const errorMessage = ref("");
const realtimeState = ref<"connecting" | "connected" | "resyncing" | "offline">("connecting");
let stopStream: (() => void) | undefined;
let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
let disposed = false;

const credential = computed(() => session.read(gameID.value));
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

async function refresh() {
  const token = credential.value;
  if (!token) {
    await router.replace("/");
    return;
  }
  const next = await api.getGame(gameID.value, token);
  if (!projection.value || next.version >= projection.value.version) {
    projection.value = next;
  }
}

const resyncController = createVersionedResync({
  getVersion: () => projection.value?.version,
  refresh,
});

async function runAction(
  action: ActionDescriptor,
  payload: CommandPayload,
) {
  const token = credential.value;
  const current = projection.value;
  if (!token || !current) {
    return;
  }
  actionBusy.value = true;
  errorMessage.value = "";
  try {
    const result = await api.command(
      gameID.value,
      token,
      action.type,
      current.version,
      payload,
    );
    if (!projection.value || result.projection.version >= projection.value.version) {
      projection.value = result.projection;
    }
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "Команда не выполнена";
    await resync().catch(() => scheduleRealtimeRecovery());
  } finally {
    actionBusy.value = false;
  }
}

function resync(requiredVersion?: number) {
  realtimeState.value = "resyncing";
  return resyncController.request(requiredVersion);
}

function scheduleRealtimeRecovery() {
  realtimeState.value = "offline";
  stopStream?.();
  stopStream = undefined;
  if (disposed || reconnectTimer) {
    return;
  }
  reconnectTimer = setTimeout(() => {
    reconnectTimer = undefined;
    void resync()
      .then(() => connect())
      .catch(() => scheduleRealtimeRecovery());
  }, 1000);
}

async function connect() {
  if (disposed) {
    return;
  }
  const token = credential.value;
  if (!token) {
    return;
  }
  stopStream?.();
  realtimeState.value = "connecting";
  stopStream = api.stream(
    gameID.value,
    token,
    (event) => {
      if (!projection.value || event.version > projection.value.version) {
        void resync(event.version).then(() => {
          realtimeState.value = "connected";
        }).catch(() => scheduleRealtimeRecovery());
      }
    },
    () => {
      scheduleRealtimeRecovery();
    },
  );
  realtimeState.value = "connected";
}

onMounted(async () => {
  try {
    await refresh();
    await connect();
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "Не удалось загрузить игру";
  } finally {
    loading.value = false;
  }
});

onBeforeUnmount(() => {
  disposed = true;
  stopStream?.();
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
  }
});
</script>

<template>
  <section v-if="loading" class="center-state">Загружаем состояние игры…</section>
  <section v-else-if="projection" class="game-table">
    <div class="game-meta">
      <div>
        <p class="eyebrow">КОМНАТА</p>
        <code>{{ projection.game_id }}</code>
      </div>
      <div class="meta-badges">
        <span>v{{ projection.version }}</span>
        <span>{{ projection.status }}</span>
        <span>{{ projection.rules_profile_id }}</span>
        <span :data-state="realtimeState">{{ realtimeState }}</span>
      </div>
    </div>

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

    <p v-if="errorMessage" class="error-banner">{{ errorMessage }}</p>
  </section>
  <section v-else class="center-state">
    <p>{{ errorMessage || "Состояние игры недоступно." }}</p>
    <NuxtLink to="/">Вернуться в лобби</NuxtLink>
  </section>
</template>
