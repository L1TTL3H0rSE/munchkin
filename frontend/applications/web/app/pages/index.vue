<script setup lang="ts">
import {onMounted, ref} from "vue";

import LobbyForm from "~/components/lobby/LobbyForm.vue";
import LobbyRecoveryHint from "~/components/lobby/LobbyRecoveryHint.vue";
import type {LobbyFormInput} from "~/components/lobby/lobbyModel";

const api = useGameApi();
const session = useGameSession();
const router = useRouter();
const hydrated = ref(false);

onMounted(() => {
  hydrated.value = true;
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
    :data-hydrated="hydrated ? 'true' : undefined"
  >
    <div class="lobby-page__hero">
      <p class="lobby-page__eyebrow">ДЕТЕРМИНИРОВАННО • ПРИВАТНО • ПОВТОРЯЕМО</p>
      <h1 id="lobby-page-title">Вышиби дверь.<br><em>Не показывай руку.</em></h1>
      <p class="lobby-page__lede">
        Полный собственный ход в обычном лобби без вмешательства других игроков.
        Комнату можно запустить одному для preview. Все карты demo-набора оригинальные.
      </p>
    </div>

    <div class="lobby-page__forms">
      <LobbyForm
        mode="create"
        number="01"
        title="Создать комнату"
        description="Запустите preview-комнату и сохраните гостевой доступ в этой вкладке."
        :submit="submitLobby"
      />
      <LobbyForm
        mode="join"
        number="02"
        title="Войти в комнату"
        description="Введите ID комнаты; после проверки версии сервер выдаст новый гостевой доступ."
        :submit="submitLobby"
      />
    </div>

    <LobbyRecoveryHint />
  </section>
</template>

<style scoped>
.lobby-page {
  width: min(1180px, calc(100% - 2rem));
  min-width: 0;
  margin: 0 auto;
  padding: 7vh 0 5rem;
}
.lobby-page__hero { max-width: 850px; }
.lobby-page__eyebrow { color: var(--acid); letter-spacing: .18em; font-size: .7rem; font-weight: 800; }
.lobby-page h1 { margin: 1.5rem 0; font-size: clamp(3rem, 8vw, 7rem); line-height: .9; letter-spacing: -.06em; }
.lobby-page h1 em { color: var(--orange); font-style: normal; }
.lobby-page__lede { max-width: 60ch; color: var(--muted); font-size: 1.1rem; }
.lobby-page__forms { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1rem; margin-top: 5rem; }

@media (max-width: 767px) {
  .lobby-page { padding-top: 3rem; }
  .lobby-page__forms { grid-template-columns: 1fr; margin-top: 3rem; }
}

@media (max-width: 374px) {
  .lobby-page { width: min(100% - 1rem, 1180px); }
  .lobby-page h1 { font-size: clamp(2.55rem, 15vw, 4rem); }
  .lobby-page__lede { font-size: 1rem; }
}
</style>
