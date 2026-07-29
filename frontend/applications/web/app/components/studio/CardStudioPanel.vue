<script setup lang="ts">
import type {
  CardView,
  StudioArtBrief,
  StudioCardsResult,
  StudioJob,
} from "@munchkin/contracts";
import StudioCardList from "./StudioCardList.vue";
import StudioJobHistory from "./StudioJobHistory.vue";
import {createCardStudioAPI} from "./useCardStudioApi";

const token = ref("");
const connected = ref(false);
const cardsResult = ref<StudioCardsResult>();
const selectedID = ref("");
const search = ref("");
const deckFilter = ref<"all" | "door" | "treasure">("all");
const statusFilter = ref<"all" | "missing" | "generated" | "approved">("all");
const quality = ref<"low" | "medium" | "high">("low");
const compiledPrompt = ref("");
const promptHash = ref("");
const history = ref<StudioJob[]>([]);
const currentJob = ref<StudioJob>();
const previewURL = ref("");
const altText = ref("");
const busy = ref(false);
const polling = ref(false);
const errorMessage = ref("");
const successMessage = ref("");
const costConfirmed = ref(false);

const brief = reactive<StudioArtBrief>(defaultBrief());
const api = createCardStudioAPI(() => token.value);

const selectedCard = computed(() =>
  cardsResult.value?.cards.find((card) => card.id === selectedID.value),
);

const filteredCards = computed(() => {
  const needle = search.value.trim().toLocaleLowerCase("ru-RU");
  return (cardsResult.value?.cards ?? []).filter((card) => {
    const searchMatches = !needle ||
      card.name.toLocaleLowerCase("ru-RU").includes(needle) ||
      card.id.includes(needle);
    const deckMatches = deckFilter.value === "all" ||
      card.deck === deckFilter.value;
    const statusMatches = statusFilter.value === "all" ||
      card.art_status === statusFilter.value;
    return searchMatches && deckMatches && statusMatches;
  });
});

const previewCard = computed<CardView | undefined>(() => {
  const card = selectedCard.value;
  if (!card) {
    return undefined;
  }
  return {
    instance_id: `studio-${card.id}`,
    definition_id: card.id,
    name: card.name,
    deck: card.deck,
    kind: card.kind,
    image: card.image,
    alt_text: altText.value || card.alt_text,
  };
});

watch(
  [
    () => brief.subject,
    () => brief.setting,
    () => brief.action,
    () => brief.composition,
    () => brief.palette,
    () => brief.mood,
    () => brief.exclusions,
    quality,
  ],
  () => {
    compiledPrompt.value = "";
    promptHash.value = "";
    successMessage.value = "";
  },
);

onBeforeUnmount(() => {
  polling.value = false;
  revokePreview();
});

async function connect() {
  await run(async () => {
    if (token.value.trim().length < 32) {
      throw new Error("Введите отдельный Card Studio token.");
    }
    cardsResult.value = await api.cards();
    connected.value = true;
    selectedID.value ||= cardsResult.value.cards[0]?.id ?? "";
    await selectCard(selectedID.value);
  });
}

async function selectCard(cardID: string) {
  selectedID.value = cardID;
  const card = selectedCard.value;
  Object.assign(brief, defaultBrief(card?.name));
  altText.value = card ? `Иллюстрация к карте «${card.name}»` : "";
  currentJob.value = undefined;
  revokePreview();
  await loadHistory();
}

async function loadHistory() {
  if (!selectedID.value) {
    history.value = [];
    return;
  }
  history.value = (await api.jobs(selectedID.value)).jobs;
}

async function previewCompiledPrompt() {
  await run(async () => {
    const result = await api.compile(requestWithoutID());
    compiledPrompt.value = result.prompt;
    promptHash.value = result.prompt_hash;
  });
}

async function generate() {
  await run(async () => {
    const provider = cardsResult.value?.provider;
    if (provider?.real_generation && !costConfirmed.value) {
      throw new Error(
        "Подтвердите стоимость именно этого real-provider запроса.",
      );
    }
    const compiled = await api.compile(requestWithoutID());
    compiledPrompt.value = compiled.prompt;
    promptHash.value = compiled.prompt_hash;
    currentJob.value = await api.generate({
      ...requestWithoutID(),
      request_id: crypto.randomUUID(),
    });
    costConfirmed.value = false;
    await loadHistory();
    await pollCurrentJob();
  });
}

async function pollCurrentJob() {
  const jobID = currentJob.value?.id;
  if (!jobID) {
    return;
  }
  polling.value = true;
  for (let attempt = 0; attempt < 190 && polling.value; attempt++) {
    const job = await api.job(jobID);
    currentJob.value = job;
    if (!["queued", "running"].includes(job.status)) {
      polling.value = false;
      await loadHistory();
      if (job.status === "succeeded" || job.status === "approved") {
        await showPreview(job);
      }
      if (job.error) {
        throw new Error(job.error.message);
      }
      return;
    }
    await delay(800);
  }
  polling.value = false;
  throw new Error("Polling timeout: проверьте job history и повторите вручную.");
}

async function showPreview(job: StudioJob) {
  currentJob.value = job;
  if (job.status !== "succeeded" && job.status !== "approved") {
    revokePreview();
    return;
  }
  const nextURL = await api.candidateURL(job.id);
  revokePreview();
  previewURL.value = nextURL;
}

async function approve() {
  const job = currentJob.value;
  if (!job) {
    return;
  }
  await run(async () => {
    const approval = await api.approve(job.id, {alt_text: altText.value});
    successMessage.value = approval.idempotent
      ? "Этот candidate уже был одобрен; возвращён прежний результат."
      : `Одобрено: ${approval.asset_path}, digest ${approval.content_digest}.`;
    cardsResult.value = await api.cards();
    currentJob.value = await api.job(job.id);
    await loadHistory();
  }, false);
}

function requestWithoutID() {
  return {
    card_id: selectedID.value,
    brief: {...brief},
    settings: {
      quality: quality.value,
      size: "1024x1536" as const,
    },
  };
}

async function run(callback: () => Promise<void>, clearSuccess = true) {
  busy.value = true;
  errorMessage.value = "";
  if (clearSuccess) {
    successMessage.value = "";
  }
  try {
    await callback();
  } catch (error) {
    errorMessage.value = error instanceof Error
      ? error.message
      : "Card Studio request failed.";
  } finally {
    busy.value = false;
  }
}

function revokePreview() {
  if (previewURL.value) {
    URL.revokeObjectURL(previewURL.value);
    previewURL.value = "";
  }
}

function defaultBrief(cardName = "городской объект") {
  return {
    subject: cardName,
    setting: "Самостоятельная московская городская fantasy-сцена",
    action: "Один главный объект участвует в ясном преувеличенном действии",
    composition: "Крупный читаемый силуэт, низкая точка, crop-safe края",
    palette: "Графит, тёплый бумажный, сигнальный лайм и кирпичный акцент",
    mood: "Доброжелательный городской абсурд и энергичное движение",
    exclusions: "Без текста, букв, цифр, логотипов, рамки и водяных знаков",
  };
}

function delay(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
</script>

<template>
  <section class="studio">
    <header class="studio-hero">
      <div>
        <p class="eyebrow">LOCAL AUTHORING · MOSCOW CORE</p>
        <h1>Card <em>Studio</em></h1>
        <p class="lede">
          Генерируется только illustration viewport. Рамка, имя, stats и
          длинный текст остаются доступным HTML/CSS/SVG.
        </p>
      </div>
      <div v-if="cardsResult" class="studio-provider">
        <span :data-real="cardsResult.provider.real_generation">
          {{ cardsResult.provider.provider }}
        </span>
        <strong>{{ cardsResult.provider.model }}</strong>
        <small>
          {{ cardsResult.provider.size }} · default
          {{ cardsResult.provider.default_quality }}
        </small>
      </div>
    </header>

    <form v-if="!connected" class="studio-auth panel" @submit.prevent="connect">
      <div>
        <h2>Authoring access</h2>
        <p>
          Token вводится вручную и отправляется только в bearer header. Он не
          хранится в URL, public runtime config или repository.
        </p>
      </div>
      <label>
        Card Studio token
        <input
          v-model="token"
          type="password"
          autocomplete="off"
          spellcheck="false"
          required
        >
      </label>
      <button type="submit" :disabled="busy">Открыть Studio</button>
    </form>

    <div v-else class="studio-workspace">
      <aside class="studio-library">
        <div class="studio-library__filters">
          <label>
            Поиск
            <input v-model="search" type="search" placeholder="Название или ID">
          </label>
          <div class="studio-filter-row">
            <label>
              Deck
              <select v-model="deckFilter">
                <option value="all">Все</option>
                <option value="door">Door</option>
                <option value="treasure">Treasure</option>
              </select>
            </label>
            <label>
              Status
              <select v-model="statusFilter">
                <option value="all">Все</option>
                <option value="missing">Missing</option>
                <option value="generated">Generated</option>
                <option value="approved">Approved</option>
              </select>
            </label>
          </div>
          <small>
            {{ filteredCards.length }} / {{ cardsResult?.cards.length ?? 0 }}
            definitions
          </small>
        </div>
        <StudioCardList
          :cards="filteredCards"
          :selected-i-d="selectedID"
          @select="selectCard"
        />
      </aside>

      <main v-if="selectedCard" class="studio-editor">
        <section class="studio-editor__brief panel">
          <div class="studio-section-title">
            <span>01</span>
            <div>
              <h2>{{ selectedCard.name }}</h2>
              <code>{{ selectedCard.id }}</code>
            </div>
          </div>

          <div class="studio-brief-grid">
            <label>
              Subject
              <textarea v-model="brief.subject" rows="2" maxlength="240" />
            </label>
            <label>
              Setting
              <textarea v-model="brief.setting" rows="2" maxlength="240" />
            </label>
            <label>
              Action
              <textarea v-model="brief.action" rows="2" maxlength="240" />
            </label>
            <label>
              Composition
              <textarea v-model="brief.composition" rows="2" maxlength="240" />
            </label>
            <label>
              Palette
              <textarea v-model="brief.palette" rows="2" maxlength="240" />
            </label>
            <label>
              Mood
              <textarea v-model="brief.mood" rows="2" maxlength="240" />
            </label>
            <label class="studio-brief-grid__wide">
              Exclusions
              <textarea v-model="brief.exclusions" rows="2" maxlength="400" />
            </label>
          </div>

          <div class="studio-settings">
            <label>
              Quality
              <select v-model="quality">
                <option value="low">Low · draft</option>
                <option value="medium">Medium · final review</option>
                <option value="high">High · final review</option>
              </select>
            </label>
            <label>
              Size
              <input value="1024x1536" disabled>
            </label>
          </div>

          <div class="studio-actions">
            <button
              type="button"
              class="studio-button--ghost"
              :disabled="busy"
              @click="previewCompiledPrompt"
            >
              Compile prompt
            </button>
            <label
              v-if="cardsResult?.provider.real_generation"
              class="studio-cost-confirm"
            >
              <input v-model="costConfirmed" type="checkbox">
              Подтверждаю стоимость одного запроса
            </label>
            <button
              type="button"
              :disabled="busy || polling"
              @click="generate"
            >
              {{ currentJob ? "Regenerate" : "Generate" }}
            </button>
          </div>
          <p class="studio-cost-warning">
            {{ cardsResult?.provider.cost_warning }} Автоматического bulk нет.
          </p>
        </section>

        <section class="studio-editor__prompt panel">
          <div class="studio-section-title">
            <span>02</span>
            <h2>Compiled prompt</h2>
          </div>
          <pre v-if="compiledPrompt">{{ compiledPrompt }}</pre>
          <p v-else class="studio-empty">
            Нажмите Compile prompt. Full rules text в request не входит.
          </p>
          <code v-if="promptHash">{{ promptHash }}</code>
        </section>

        <section class="studio-editor__preview panel">
          <div class="studio-section-title">
            <span>03</span>
            <h2>Preview & approve</h2>
          </div>
          <div class="studio-preview-grid">
            <GameCard
              v-if="previewCard"
              :card="previewCard"
              content-set-id="moscow-core"
              :image-url="previewURL"
            />
            <div class="studio-preview-meta">
              <dl v-if="currentJob">
                <div><dt>Status</dt><dd>{{ currentJob.status }}</dd></div>
                <div><dt>Provider</dt><dd>{{ currentJob.provider }}</dd></div>
                <div><dt>Model</dt><dd>{{ currentJob.model }}</dd></div>
                <div><dt>Quality</dt><dd>{{ currentJob.quality }}</dd></div>
                <div><dt>Size</dt><dd>{{ currentJob.size }}</dd></div>
              </dl>
              <label>
                Alt text
                <textarea v-model="altText" rows="3" maxlength="200" />
              </label>
              <button
                type="button"
                :disabled="busy || currentJob?.status !== 'succeeded'"
                @click="approve"
              >
                Approve to Moscow v2
              </button>
            </div>
          </div>
        </section>

        <section class="studio-editor__history panel">
          <div class="studio-section-title">
            <span>04</span>
            <h2>Generation history</h2>
          </div>
          <StudioJobHistory
            :jobs="history"
            :selected-i-d="currentJob?.id"
            @select="showPreview"
          />
        </section>

        <p v-if="errorMessage" class="error-banner">{{ errorMessage }}</p>
        <p v-if="successMessage" class="studio-success">
          {{ successMessage }}
        </p>
      </main>
    </div>
  </section>
</template>
