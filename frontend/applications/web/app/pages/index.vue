<script setup lang="ts">
import {onMounted, ref} from "vue";

import heroDoorArt from "~/assets/lobby/hero-door.png";
import heroTreasureArt from "~/assets/lobby/hero-treasure.png";
import LobbyForm from "~/components/lobby/LobbyForm.vue";
import type {
  LobbyFormInput,
  LobbyFormMode,
} from "~/components/lobby/lobbyModel";

const api = useGameApi();
const session = useGameSession();
const router = useRouter();
const interactive = ref(false);
const selectedMode = ref<LobbyFormMode>("create");

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

function selectMode(mode: LobbyFormMode): void {
  selectedMode.value = mode;
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
      <section
        class="lobby-page__hero"
        aria-labelledby="lobby-page-title"
      >
        <div class="lobby-page__brand-row">
          <NuxtLink class="lobby-page__brand" to="/" aria-label="Munchkin, на главную">
            MUNCHKIN
          </NuxtLink>
          <span class="lobby-page__mode-pill">ОНЛАЙН</span>
        </div>
        <div class="lobby-page__hero-copy">
          <p class="lobby-page__eyebrow">ИГРА НАЧИНАЕТСЯ ЗА СТОЛОМ</p>
          <h1 id="lobby-page-title">Собери друзей.<br><em>Начни игру.</em></h1>
          <p class="lobby-page__lede">
            Создай комнату или войди по приглашению — без лишних экранов и настроек.
          </p>
        </div>
        <div class="lobby-page__hero-cards" aria-hidden="true">
          <div class="lobby-page__hero-card lobby-page__hero-card--door">
            <img :src="heroDoorArt" alt="">
          </div>
          <div class="lobby-page__hero-card lobby-page__hero-card--treasure">
            <img :src="heroTreasureArt" alt="">
          </div>
        </div>
      </section>

      <section
        class="lobby-entry"
        aria-labelledby="lobby-entry-title"
        :data-mode="selectedMode"
      >
        <header class="lobby-entry__header">
          <h2 id="lobby-entry-title">Войти в игру</h2>
          <p>
            <template v-if="selectedMode === 'create'">
              <span class="lobby-entry__description--desktop">
                Создай новую комнату или войди по приглашению.
              </span>
              <span class="lobby-entry__description--mobile">
                Одна короткая форма — выбери, что хочешь сделать.
              </span>
            </template>
            <span v-else>Введи ID комнаты и имя — и можно начинать.</span>
          </p>
        </header>

        <div class="lobby-entry__mode-switch" role="group" aria-label="Режим входа в игру">
          <button
            type="button"
            :aria-pressed="selectedMode === 'create'"
            :class="{'is-selected': selectedMode === 'create'}"
            @click="selectMode('create')"
          >
            Создать
          </button>
          <button
            type="button"
            :aria-pressed="selectedMode === 'join'"
            :class="{'is-selected': selectedMode === 'join'}"
            @click="selectMode('join')"
          >
            Войти
          </button>
        </div>

        <div class="lobby-page__forms" aria-label="Форма комнаты">
        <LobbyForm
          v-show="selectedMode === 'create'"
          mode="create"
          number="01"
          title="Создать комнату"
          description="Откройте новый стол и пригласите друзей по коду."
          compact
          labelled-by="lobby-entry-title"
          :submit="submitLobby"
        />
        <LobbyForm
          v-show="selectedMode === 'join'"
          mode="join"
          number="02"
          title="Войти в комнату"
          description="Введите код комнаты, который вам прислали."
          compact
          labelled-by="lobby-entry-title"
          :submit="submitLobby"
        />
        </div>

        <p class="lobby-entry__note">
          {{ selectedMode === 'create'
            ? "После создания ты сразу окажешься за столом."
            : "Для входа нужен код комнаты и имя игрока." }}
        </p>
        <p class="lobby-entry__footer-note">
          {{ selectedMode === 'create'
            ? "Для входа по приглашению переключи вкладку «Войти»."
            : "Нет ID? Попроси создателя прислать его ещё раз." }}
        </p>
      </section>
    </div>
  </section>
</template>

<style lang="scss">
@use "../assets/scss/pages/lobby";
</style>
