<script setup lang="ts">
import type {Projection} from "@munchkin/contracts";

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
let refreshInFlight: Promise<void> | undefined;
let disposed = false;

const credential = computed(() => session.read(gameID.value));
const currentPlayerName = computed(() => projection.value?.players
  .find((player) => player.player_id === projection.value?.turn.player_id)?.name ?? "another player");

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

async function runAction(action: string) {
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
      action.replaceAll("_", "-") as Parameters<typeof api.command>[2],
      current.version,
    );
    projection.value = result.projection;
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "Command failed";
    realtimeState.value = "resyncing";
    await refresh();
  } finally {
    actionBusy.value = false;
  }
}

function resync() {
  if (!refreshInFlight) {
    realtimeState.value = "resyncing";
    refreshInFlight = refresh().finally(() => {
      refreshInFlight = undefined;
    });
  }
  return refreshInFlight;
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
        void resync().then(() => {
          realtimeState.value = "connected";
        });
      }
    },
    () => {
      realtimeState.value = "offline";
      void resync()
        .catch(() => undefined)
        .finally(() => {
          if (!disposed) {
            reconnectTimer = setTimeout(() => void connect(), 1000);
          }
        });
    },
  );
  realtimeState.value = "connected";
}

onMounted(async () => {
  try {
    await refresh();
    await connect();
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "Unable to load game";
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
  <section v-if="loading" class="center-state">Loading authoritative state…</section>
  <section v-else-if="projection" class="game-table">
    <div class="game-meta">
      <div>
        <p class="eyebrow">ROOM</p>
        <code>{{ projection.game_id }}</code>
      </div>
      <div class="meta-badges">
        <span>v{{ projection.version }}</span>
        <span>{{ projection.status }}</span>
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
        <span>LEVEL {{ player.level }}</span>
        <span>{{ player.hand_count }} hidden cards</span>
      </article>
    </div>

    <div class="table-center">
      <div class="deck door">
        <span>DOOR</span>
        <strong>{{ projection.door_deck_count }}</strong>
      </div>

      <article v-if="projection.turn.encounter" class="encounter-card">
        <small>ENCOUNTER</small>
        <img
          v-if="projection.turn.encounter.image"
          class="card-image"
          :src="api.contentAssetURL(projection.content_set_id, projection.turn.encounter.image)"
          :alt="projection.turn.encounter.alt_text || projection.turn.encounter.name"
        >
        <h2>{{ projection.turn.encounter.name }}</h2>
        <p v-if="projection.turn.encounter.combat_strength">
          Strength {{ projection.turn.encounter.combat_strength }}
        </p>
        <p v-if="projection.turn.encounter.rules_text" class="card-rules">
          {{ projection.turn.encounter.rules_text }}
        </p>
      </article>
      <div v-else class="phase-display">
        <small>CURRENT PHASE</small>
        <h2>{{ projection.turn.phase || "finished" }}</h2>
      </div>

      <div class="deck treasure">
        <span>TREASURE</span>
        <strong>{{ projection.treasure_deck_count }}</strong>
      </div>
    </div>

    <div class="action-bar">
      <button
        v-if="projection.status === 'lobby' && projection.is_owner"
        :disabled="actionBusy"
        @click="runAction('start')"
      >
        Start game
      </button>
      <button
        v-for="action in projection.turn.available_actions"
        :key="action"
        :disabled="actionBusy"
        @click="runAction(action)"
      >
        {{ action.replaceAll("_", " ") }}
      </button>
      <span v-if="projection.status === 'active' && !projection.turn.available_actions.length">
        Waiting for {{ currentPlayerName }}
      </span>
      <strong v-if="projection.status === 'finished'">Winner: {{ projection.winner_player_id }}</strong>
    </div>

    <section class="your-zone">
      <div>
        <p class="eyebrow">YOUR HAND — {{ projection.you.name }}</p>
        <h2>Level {{ projection.you.level }}</h2>
      </div>
      <div class="hand">
        <article v-for="card in projection.you.hand" :key="card.id" class="hand-card">
          <small>{{ card.kind }}</small>
          <img
            v-if="card.image"
            class="card-image"
            :src="api.contentAssetURL(projection.content_set_id, card.image)"
            :alt="card.alt_text || card.name"
          >
          <strong>{{ card.name }}</strong>
          <span v-if="card.rules_text" class="card-rules">{{ card.rules_text }}</span>
        </article>
        <p v-if="!projection.you.hand.length">No cards yet.</p>
      </div>
    </section>

    <p v-if="errorMessage" class="error-banner">{{ errorMessage }}</p>
  </section>
  <section v-else class="center-state">
    <p>{{ errorMessage || "Game state is unavailable." }}</p>
    <NuxtLink to="/">Return to lobby</NuxtLink>
  </section>
</template>
