<script setup lang="ts">
import {onMounted, ref} from "vue";

import LobbyForm from "~/components/lobby/LobbyForm.vue";
import LobbyRecoveryHint from "~/components/lobby/LobbyRecoveryHint.vue";
import type {LobbyFormInput} from "~/components/lobby/lobbyModel";

const api = useGameApi();
const session = useGameSession();
const router = useRouter();
const interactive = ref(false);

onMounted(() => {
  interactive.value = true;
});

async function submitLobby(input: LobbyFormInput): Promise<void> {
  if (input.mode === "create") {
    const result = await api.createLobby(input.displayName.trim());
    session.save(result.game_id, result.credential);
    await router.push(`/game/${encodeURIComponent(result.game_id)}`);
    return;
  }

  const gameID = input.gameID.trim();
  const lobby = await api.getLobby(gameID);
  const result = await api.joinLobby(
    gameID,
    input.displayName.trim(),
    lobby.version,
  );
  session.save(result.game_id, result.credential);
  await router.push(`/game/${encodeURIComponent(result.game_id)}`);
}
</script>

<template>
  <section
    class="lobby-page"
    aria-labelledby="lobby-page-title"
    data-hydrated="true"
    :data-interactive="interactive ? 'true' : undefined"
  >
    <div class="lobby-page__inner">
      <header class="lobby-page__intro">
        <NuxtLink class="lobby-page__brand" to="/" aria-label="Munchkin, на главную">
          <span aria-hidden="true">M</span>
          MUNCHKIN
        </NuxtLink>
        <p class="lobby-page__eyebrow">ИГРА НАЧИНАЕТСЯ ЗА СТОЛОМ</p>
        <h1 id="lobby-page-title">Соберите стол.<br><em>Играйте своей рукой.</em></h1>
        <p class="lobby-page__lede">
          Создайте комнату для своей компании или присоединитесь к игре по коду.
        </p>
      </header>

      <div class="lobby-page__forms" aria-label="Вход в игру">
        <LobbyForm
          mode="create"
          number="01"
          title="Создать комнату"
          description="Откройте новый стол и пригласите друзей по коду."
          :submit="submitLobby"
        />
        <LobbyForm
          mode="join"
          number="02"
          title="Войти в комнату"
          description="Введите код комнаты, который вам прислали."
          :submit="submitLobby"
        />
      </div>

      <LobbyRecoveryHint />
    </div>
  </section>
</template>

<style lang="scss">
@use "../assets/scss/pages/lobby";
</style>
