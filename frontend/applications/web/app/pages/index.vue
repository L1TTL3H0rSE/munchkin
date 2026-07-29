<script setup lang="ts">
const api = useGameApi();
const session = useGameSession();
const router = useRouter();

const createName = ref("");
const joinName = ref("");
const joinGameID = ref("");
const busy = ref(false);
const errorMessage = ref("");

async function createGame() {
  await run(async () => {
    const result = await api.createLobby(createName.value);
    session.save(result.game_id, result.credential);
    await router.push(`/game/${encodeURIComponent(result.game_id)}`);
  });
}

async function joinGame() {
  await run(async () => {
    const gameID = joinGameID.value.trim();
    const lobby = await api.getLobby(gameID);
    const result = await api.joinLobby(
      gameID, joinName.value, lobby.version,
    );
    session.save(result.game_id, result.credential);
    await router.push(`/game/${encodeURIComponent(result.game_id)}`);
  });
}

async function run(callback: () => Promise<void>) {
  busy.value = true;
  errorMessage.value = "";
  try {
    await callback();
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "Request failed";
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <section class="landing">
    <div class="hero-copy">
      <p class="eyebrow">ДЕТЕРМИНИРОВАННО • ПРИВАТНО • ПОВТОРЯЕМО</p>
      <h1>Вышиби дверь.<br><em>Не показывай руку.</em></h1>
      <p class="lede">
        Полный собственный ход в обычном лобби без вмешательства других игроков.
        Комнату можно запустить одному для preview. Все карты demo-набора оригинальные.
      </p>
    </div>

    <div class="lobby-grid">
      <form class="panel" @submit.prevent="createGame">
        <span class="panel-number">01</span>
        <h2>Создать комнату</h2>
        <label>
          Имя игрока
          <input v-model.trim="createName" required maxlength="40" placeholder="Алиса">
        </label>
        <button :disabled="busy || !createName">Создать</button>
      </form>

      <form class="panel" @submit.prevent="joinGame">
        <span class="panel-number">02</span>
        <h2>Войти в комнату</h2>
        <label>
          ID игры
          <input v-model.trim="joinGameID" required placeholder="game_…">
        </label>
        <label>
          Имя игрока
          <input v-model.trim="joinName" required maxlength="40" placeholder="Борис">
        </label>
        <button :disabled="busy || !joinName || !joinGameID">Войти</button>
      </form>
    </div>

    <p v-if="errorMessage" class="error-banner">{{ errorMessage }}</p>
  </section>
</template>
