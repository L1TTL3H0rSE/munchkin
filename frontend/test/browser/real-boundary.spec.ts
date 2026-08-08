import {expect, test, type Page} from "@playwright/test";

import {
  commandResultSchema,
  lobbyResultSchema,
  projectionSchema,
} from "../../packages/contracts/src/index.ts";

test.skip(
  process.env.MUNCHKIN_REAL_E2E !== "1",
  "real-boundary smoke is opt-in because it starts Go and Nuxt servers",
);

type Actor = {
  player_id: string;
  credential: string;
};

type Projection = ReturnType<typeof projectionSchema.parse>;
type CommandResult = ReturnType<typeof commandResultSchema.parse>;

type RealGame = {
  game_id: string;
  owner: Actor;
  actors: Actor[];
};

test("two browser actors complete one authoritative turn through the Figma UI", async ({
  page,
  browser,
  request,
}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "real browser lifecycle is canonical Chromium only");
  testInfo.setTimeout(240_000);

  const apiBase = process.env.PLAYWRIGHT_API_BASE ??
    `http://127.0.0.1:${process.env.PLAYWRIGHT_API_PORT ?? "18080"}`;
  await page.goto("/");
  const origin = new URL(page.url()).origin;
  const secondContext = await browser.newContext({
    locale: "ru-RU",
    colorScheme: "dark",
    viewport: {width: 1280, height: 720},
  });
  const secondPage = await secondContext.newPage();

  async function projectionFor(actorPage: Page, gameID: string): Promise<Projection> {
    const credential = await actorPage.evaluate((id) =>
      sessionStorage.getItem(`munchkin:credential:${id}`), gameID);
    if (!credential) throw new Error("browser actor credential is missing from session storage");
    const response = await request.get(
      `${apiBase}/api/v1/games/${encodeURIComponent(gameID)}`,
      {headers: {Authorization: `Bearer ${credential}`}},
    );
    if (!response.ok()) {
      throw new Error(`browser projection failed: ${response.status()} ${await response.text()}`);
    }
    return projectionSchema.parse(await response.json());
  }

  async function waitForProjection(
    actorPage: Page,
    gameID: string,
    predicate: (projection: Projection) => boolean,
    message: string,
  ): Promise<Projection> {
    await expect.poll(async () => predicate(await projectionFor(actorPage, gameID)), {
      message,
      timeout: 20_000,
      intervals: [100, 200, 400, 800],
    }).toBe(true);
    return projectionFor(actorPage, gameID);
  }

  async function clickAndWait(
    actorPage: Page,
    gameID: string,
    click: () => Promise<void>,
  ): Promise<Projection> {
    const before = await projectionFor(actorPage, gameID);
    await click();
    return waitForProjection(
      actorPage,
      gameID,
      (projection) => projection.version > before.version,
      `projection did not advance after browser action at version ${before.version}`,
    );
  }

  async function actorPageFor(
    pages: readonly Page[],
    gameID: string,
    playerID: string,
  ): Promise<Page> {
    for (const actorPage of pages) {
      if ((await projectionFor(actorPage, gameID)).you.player_id === playerID) return actorPage;
    }
    throw new Error(`no browser page owns projected actor ${playerID}`);
  }

  async function resolveCharitySheet(actorPage: Page, gameID: string): Promise<void> {
    const projection = await projectionFor(actorPage, gameID);
    const transfer = projection.interaction?.charity_transfer;
    const action = projection.turn.available_actions.find((candidate) =>
      candidate.type === "resolve_charity");
    const instanceIDs = transfer?.instance_ids ?? action?.instance_ids ?? [];
    const excess = transfer?.excess ?? action?.minimum ?? 0;
    const recipientIDs = transfer?.eligible_recipient_ids ?? action?.target_player_ids ?? [];
    const selected = projection.you.hand
      .filter((card) => instanceIDs.includes(card.instance_id))
      .sort((left, right) => Number(left.kind === "monster") - Number(right.kind === "monster"))
      .slice(0, excess);
    const dialog = actorPage.locator("dialog[open]");
    await expect(dialog).toHaveAttribute("data-figma-desktop-node", "256:316");
    const railButtons = dialog.locator(".charity-sheet__rail > button");
    for (const card of selected) {
      const handIndex = projection.you.hand.findIndex((candidate) =>
        candidate.instance_id === card.instance_id);
      const visibleIndex = projection.you.hand
        .slice(0, handIndex)
        .filter((candidate) => instanceIDs.includes(candidate.instance_id)).length;
      await railButtons.nth(visibleIndex).click();
    }
    if (recipientIDs.length) {
      await dialog.getByRole("button", {name: "Назначить получателей", exact: true}).click();
      const recipientName = projection.players.find((candidate) =>
        candidate.player_id === recipientIDs[0])?.name;
      if (!recipientName) throw new Error("eligible charity recipient is absent from public roster");
      const groups = dialog.locator(".charity-sheet__recipients > div");
      for (let index = 0; index < excess; index += 1) {
        await groups.nth(index).getByRole("button", {name: recipientName, exact: true}).click();
      }
    }
    await clickAndWait(actorPage, gameID, async () => {
      await dialog.getByRole("button", {
        name: recipientIDs.length ? "Передать карты" : "Сбросить карты",
        exact: true,
      }).click();
    });
  }

  async function resolveRequiredInteraction(actorPage: Page, gameID: string): Promise<boolean> {
    const projection = await projectionFor(actorPage, gameID);
    const interaction = projection.interaction;
    if (!interaction?.response_required_for_you) return false;
    if (interaction.public_kind === "charity_transfer") {
      await resolveCharitySheet(actorPage, gameID);
      return true;
    }
    if (interaction.public_kind === "death_loot_priority") {
      const pass = interaction.actions.find((action) => action.type === "pass");
      if (!pass) throw new Error("death-loot actor has no projected pass action");
      const dialog = actorPage.locator("dialog[open]");
      await expect(dialog).toBeVisible();
      await clickAndWait(actorPage, gameID, async () => {
        await dialog.getByRole("button", {name: /ПРОПУСТИТЬ/}).click();
      });
      return true;
    }

    const pass = interaction.actions.find((action) => action.type === "pass");
    const choice = pass ?? interaction.actions.find((action) =>
      action.type === "respond" || action.type === "accept" || action.type === "decline");
    if (!choice) throw new Error(`${interaction.public_kind}: required actor has no executable response`);
    const dialog = actorPage.locator("dialog[open]");
    await expect(dialog).toBeVisible();
    const option = dialog.locator(".interaction-action").filter({
      hasText: pass
        ? /Пасовать|Бросить на смывку/
        : interaction.public_kind === "private_choice"
          ? projection.you.hand.find((card) => choice.choice_ids?.includes(card.instance_id))?.name ?? /Ответить/
          : /Ответить|Принять|Отклонить/,
    }).first();
    await expect(option).toBeVisible();
    await option.click();
    await clickAndWait(actorPage, gameID, async () => {
      await dialog.locator(".interaction-submit").click();
    });
    return true;
  }

  async function drainRequiredInteractions(pages: readonly Page[], gameID: string): Promise<void> {
    for (let round = 0; round < 24; round += 1) {
      let progressed = false;
      for (const actorPage of pages) {
        if (await resolveRequiredInteraction(actorPage, gameID)) progressed = true;
      }
      const stillRequired = (await Promise.all(pages.map((actorPage) =>
        projectionFor(actorPage, gameID))))
        .some((projection) => projection.interaction?.response_required_for_you);
      if (!stillRequired) return;
      if (!progressed) throw new Error("required interaction remained without a browser response");
    }
    throw new Error("required browser interactions did not drain in bounded rounds");
  }

  async function advanceCompletedTurn(
    pages: readonly Page[],
    gameID: string,
    actorPage: Page,
    actorID: string,
  ): Promise<Projection> {
    for (let step = 0; step < 24; step += 1) {
      await drainRequiredInteractions(pages, gameID);
      const projection = await projectionFor(actorPage, gameID);
      if (projection.turn.phase === "preparation" && projection.turn.player_id !== actorID) {
        return projection;
      }
      if (projection.turn.phase === "charity" && !projection.interaction) {
        const version = projection.version;
        await waitForProjection(actorPage, gameID, (next) => next.version > version,
          "frontend did not open or resolve the charity phase");
        continue;
      }
      if (projection.turn.phase === "end_turn") {
        await clickAndWait(actorPage, gameID, async () => {
          await actorPage.getByRole("button", {name: "Закончить ход", exact: true}).click();
        });
        continue;
      }
      if (projection.turn.phase === "run_away" || projection.interaction) continue;
      throw new Error(`browser turn stopped in ${projection.turn.phase}`);
    }
    throw new Error("browser turn did not advance in bounded steps");
  }

  try {
    await expect(page.locator("[data-interactive='true']")).toBeVisible();
    const createForm = page.locator(".lobby-form--create");
    await createForm.locator("input[autocomplete='nickname']").fill("Алиса UI");
    await createForm.getByRole("button", {name: "Создать комнату", exact: true}).click();
    await expect(page).toHaveURL(/\/game\/[^/]+$/, {timeout: 20_000});
    const gameID = decodeURIComponent(new URL(page.url()).pathname.split("/").at(-1) ?? "");
    expect(gameID).not.toBe("");

    await secondPage.goto(`${origin}/`);
    await expect(secondPage.locator("[data-interactive='true']")).toBeVisible();
    await secondPage.locator(".lobby-entry__mode-switch")
      .getByRole("button", {name: "Войти", exact: true}).click();
    const joinForm = secondPage.locator(".lobby-form--join");
    await joinForm.locator("input[autocomplete='nickname']").fill("Борис UI");
    await joinForm.locator("input[inputmode='text']").fill(gameID);
    await joinForm.getByRole("button", {name: "Войти в комнату", exact: true}).click();
    await expect(secondPage).toHaveURL(new RegExp(`/game/${gameID}$`), {timeout: 20_000});

    const pages = [page, secondPage] as const;
    await waitForProjection(page, gameID, (projection) => projection.players.length === 2,
      "owner did not receive the joined public roster");
    await clickAndWait(page, gameID, async () => {
      await page.getByRole("button", {name: "Начать игру", exact: true}).click();
    });

    for (let step = 0; step < 8; step += 1) {
      const ownerProjection = await projectionFor(page, gameID);
      if (ownerProjection.turn.phase !== "setup") break;
      const actorPage = await actorPageFor(pages, gameID, ownerProjection.turn.player_id);
      const actorProjection = await projectionFor(actorPage, gameID);
      expect(actorProjection.you.hand).toHaveLength(8);
      const discard = actorProjection.turn.available_actions.find((action) =>
        action.type === "resolve_charity");
      if (discard) {
        await resolveCharitySheet(actorPage, gameID);
      } else {
        await clickAndWait(actorPage, gameID, async () => {
          await actorPage.getByRole("button", {name: "Закончить подготовку", exact: true}).click();
        });
      }
    }

    let activeProjection = await waitForProjection(
      page,
      gameID,
      (projection) => projection.turn.phase === "preparation",
      "setup did not advance to preparation",
    );
    let activePage: Page | undefined;
    let initialActorID = "";
    for (let turnAttempt = 0; turnAttempt < 8; turnAttempt += 1) {
      activeProjection = await projectionFor(page, gameID);
      initialActorID = activeProjection.turn.player_id;
      activePage = await actorPageFor(pages, gameID, initialActorID);
      activeProjection = await projectionFor(activePage, gameID);
      await clickAndWait(activePage, gameID, async () => {
        await activePage!.getByRole("button", {name: "Вышибить дверь", exact: true}).click();
      });
      await drainRequiredInteractions(pages, gameID);

      activeProjection = await projectionFor(activePage, gameID);
      if (activeProjection.turn.phase === "door_choice") {
        const trouble = activeProjection.turn.available_actions.find((action) =>
          action.type === "look_for_trouble" && action.source_instance_id);
        if (trouble?.source_instance_id) {
          const monster = activeProjection.you.hand.find((card) =>
            card.instance_id === trouble.source_instance_id);
          if (!monster) throw new Error("projected Look for Trouble monster is absent from hand");
          await activePage.getByRole("button", {name: "Открыть руку", exact: true}).click();
          const hand = activePage.locator("dialog[open]");
          await hand.getByRole("option").filter({hasText: monster.name}).click();
          await clickAndWait(activePage, gameID, async () => {
            await hand.getByRole("button", {name: "Искать неприятности", exact: true}).click();
          });
        } else {
          await clickAndWait(activePage, gameID, async () => {
            await activePage!.getByRole("button", {name: "Обыскать комнату", exact: true}).click();
          });
        }
      }
      activeProjection = await projectionFor(activePage, gameID);
      if (activeProjection.turn.phase === "combat") break;
      await advanceCompletedTurn(pages, gameID, activePage, initialActorID);
    }
    if (!activePage) throw new Error("browser flow has no active actor page");
    activeProjection = await waitForProjection(activePage, gameID,
      (projection) => projection.turn.phase === "combat",
      "browser flow did not reach combat in bounded turns");
    expect(activeProjection.turn.combat?.resolution_action?.type)
      .toBe("request_combat_resolution");
    await clickAndWait(activePage, gameID, async () => {
      await activePage.getByRole("button", {name: "Завершить бой", exact: true}).click();
    });
    await drainRequiredInteractions(pages, gameID);

    await advanceCompletedTurn(pages, gameID, activePage, initialActorID);

    const nextProjection = await waitForProjection(
      page,
      gameID,
      (projection) => projection.turn.phase === "preparation" &&
        projection.turn.player_id !== initialActorID,
      "end turn did not transfer preparation to the next actor",
    );
    const nextPage = await actorPageFor(pages, gameID, nextProjection.turn.player_id);
    await expect(nextPage.getByRole("button", {name: "Вышибить дверь", exact: true})).toBeVisible();
    await expect(activePage.getByRole("button", {name: "Вышибить дверь", exact: true})).toHaveCount(0);
  } finally {
    await secondContext.close();
  }
});

const deathMonsterIDs = new Set([
  "renovation-drill",
  "night-bus-ghost",
  "commuter-centipede",
  "last-train-no-transfer",
]);

test("real browser covers multiplayer state and interaction boundaries", async ({
  page,
  request,
}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "real boundary smoke is canonical Chromium only");
  testInfo.setTimeout(240_000);

  const apiBase = process.env.PLAYWRIGHT_API_BASE ??
    `http://127.0.0.1:${process.env.PLAYWRIGHT_API_PORT ?? "18080"}`;
  let sequence = 0;

  const key = (label: string) => `real-boundary-${label}-${++sequence}`;

  async function getProjection(game: RealGame, actor: Actor): Promise<Projection> {
    const response = await request.get(
      `${apiBase}/api/v1/games/${encodeURIComponent(game.game_id)}`,
      {headers: {Authorization: `Bearer ${actor.credential}`}},
    );
    if (!response.ok()) {
      throw new Error(`GET projection failed: ${response.status()} ${await response.text()}`);
    }
    return projectionSchema.parse(await response.json());
  }

  async function postResult(
    game: RealGame,
    actor: Actor,
    route: string,
    expectedVersion: number,
    body: Record<string, unknown> = {},
    label = route,
  ): Promise<CommandResult> {
    const path = route === "start"
      ? "/start"
      : `/commands/${route}`;
    const response = await request.post(
      `${apiBase}/api/v1/games/${encodeURIComponent(game.game_id)}${path}`,
      {
        headers: {
          Authorization: `Bearer ${actor.credential}`,
          "Idempotency-Key": key(label),
        },
        data: {expected_version: expectedVersion, ...body},
      },
    );
    if (!response.ok()) {
      throw new Error(`${label} failed: ${response.status()} ${await response.text()}`);
    }
    const payload = await response.json();
    if (
      route === "resolve-charity" &&
      payload.projection?.interaction?.charity_transfer?.eligible_recipient_ids === null
    ) {
      // Go serializes a nil slice as null when every possible recipient is dead;
      // keep the real response and adapt only this transport edge for discard.
      payload.projection.interaction.charity_transfer.eligible_recipient_ids = [];
    }
    return commandResultSchema.parse(payload);
  }

  async function createStartedGame(label: string, playerCount = 3): Promise<RealGame> {
    const createResponse = await request.post(`${apiBase}/api/v1/lobbies`, {
      data: {display_name: `Real ${label} owner`},
    });
    if (!createResponse.ok()) {
      throw new Error(`create lobby failed: ${createResponse.status()} ${await createResponse.text()}`);
    }
    const created = lobbyResultSchema.parse(await createResponse.json());
    const owner: Actor = {
      player_id: created.player_id,
      credential: created.credential,
    };
    const actors: Actor[] = [owner];
    let version = created.projection.version;

    for (let index = 1; index < playerCount; index += 1) {
      const credential = `${key(`${label}-join-${index}`)}-join-token-000000000000000000000000`;
      const joinResponse = await request.post(
        `${apiBase}/api/v1/games/${encodeURIComponent(created.game_id)}/players`,
        {
          headers: {
            Authorization: `Bearer ${credential}`,
            "Idempotency-Key": key(`${label}-join-command-${index}`),
          },
          data: {
            display_name: `Real ${label} player ${index + 1}`,
            expected_version: version,
          },
        },
      );
      if (!joinResponse.ok()) {
        throw new Error(`join player failed: ${joinResponse.status()} ${await joinResponse.text()}`);
      }
      const joined = lobbyResultSchema.parse(await joinResponse.json());
      actors.push({player_id: joined.player_id, credential});
      version = joined.projection.version;
    }

    const game: RealGame = {
      game_id: created.game_id,
      owner,
      actors,
    };
    let current = await postResult(game, owner, "start", version, {}, `${label}-start`);
    for (let step = 0; current.projection.turn.phase === "setup"; step += 1) {
      if (step >= actors.length + 1) {
        throw new Error(`${label}: setup did not finish after ${actors.length} actors`);
      }
      const actor = actors.find(
        (candidate) => candidate.player_id === current.projection.turn.player_id,
      );
      if (!actor) {
        throw new Error(`${label}: setup actor is not in the game`);
      }
      current = await postResult(
        game,
        actor,
        "finish-setup",
        current.version,
        {},
        `${label}-finish-setup-${step}`,
      );
    }
    expect(current.projection.turn.phase).toBe("preparation");
    return game;
  }

  async function respondToInteraction(
    game: RealGame,
    actor: Actor,
    projection: Projection,
    action: NonNullable<Projection["interaction"]>["actions"][number],
    intent: "accept" | "pass" | "respond",
  ): Promise<CommandResult> {
    const route = intent === "pass" ? "pass-interaction" : "respond-interaction";
    return postResult(
      game,
      actor,
      route,
      projection.version,
      {
        interaction_id: action.interaction_id,
        action_id: action.action_id,
        intent,
      },
      `${route}-${intent}`,
    );
  }

  async function passAll(
    game: RealGame,
    publicKind: NonNullable<Projection["interaction"]>["public_kind"],
    maxRounds = 36,
  ): Promise<Projection> {
    let sawWindow = false;
    for (let round = 0; round < maxRounds; round += 1) {
      let progressed = false;
      for (const actor of game.actors) {
        const projection = await getProjection(game, actor);
        const interaction = projection.interaction;
        if (interaction?.public_kind !== publicKind || !interaction.response_required_for_you) {
          continue;
        }
        const passAction = interaction.actions.find((action) => action.type === "pass");
        if (!passAction) {
          throw new Error(`${publicKind}: actor has no pass action`);
        }
        await respondToInteraction(game, actor, projection, passAction, "pass");
        sawWindow = true;
        progressed = true;
      }
      if (!progressed) {
        break;
      }
    }
    if (!sawWindow) {
      throw new Error(`${publicKind}: no actor response was accepted`);
    }
    return getProjection(game, game.owner);
  }

  async function resolvePrivateChoices(game: RealGame, actor: Actor): Promise<Projection> {
    for (let step = 0; step < 6; step += 1) {
      const projection = await getProjection(game, actor);
      const interaction = projection.interaction;
      if (interaction?.public_kind !== "private_choice" || !interaction.response_required_for_you) {
        return projection;
      }
      const action = interaction.actions.find((candidate) => candidate.type === "respond");
      if (!action) {
        throw new Error("private choice has no server-projected response action");
      }
      await respondToInteraction(game, actor, projection, action, "respond");
    }
    throw new Error("private choice did not resolve in bounded steps");
  }

  async function runCombatHelpScenario(): Promise<RealGame> {
    for (let attempt = 0; attempt < 12; attempt += 1) {
      const game = await createStartedGame(`combat-${attempt}`);
      const ownerProjection = await getProjection(game, game.owner);
      const monster = [...ownerProjection.you.hand]
        .filter((card) => card.kind === "monster")
        .sort((left, right) => (left.combat_strength ?? 0) - (right.combat_strength ?? 0))[0];
      if (!monster) {
        continue;
      }

      await postResult(
        game,
        game.owner,
        "open-door",
        ownerProjection.version,
        {},
        `combat-${attempt}-open-door`,
      );
      const afterOpen = await resolvePrivateChoices(game, game.owner);
      let combatProjection: Projection;
      if (afterOpen.turn.phase === "door_choice") {
        const fight = await postResult(
          game,
          game.owner,
          "look-for-trouble",
          afterOpen.version,
          {instance_id: monster.instance_id},
          `combat-${attempt}-look-for-trouble`,
        );
        combatProjection = fight.projection;
      } else if (afterOpen.turn.phase === "combat") {
        combatProjection = afterOpen;
      } else {
        continue;
      }
      if (combatProjection.turn.phase !== "combat") {
        continue;
      }

      const requested = await postResult(
        game,
        game.owner,
        "request-combat-resolution",
        combatProjection.version,
        {},
        `combat-${attempt}-request-resolution`,
      );
      const offer = requested.projection.interaction?.actions.find(
        (action) => action.type === "offer_help" &&
          action.helper_player_id === game.actors[1].player_id,
      );
      if (!offer) {
        continue;
      }
      const offered = await postResult(
        game,
        game.owner,
        "combat-help",
        requested.version,
        {action_id: offer.action_id},
        `combat-${attempt}-offer-help`,
      );
      expect(offered.projection.interaction?.public_kind).toBe("combat_help_offer");
      const helper = game.actors[1];
      const helperProjection = await getProjection(game, helper);
      const accept = helperProjection.interaction?.actions.find(
        (action) => action.type === "accept",
      );
      if (!accept) {
        continue;
      }
      const accepted = await respondToInteraction(
        game,
        helper,
        helperProjection,
        accept,
        "accept",
      );
      expect(accepted.projection.turn.combat?.helper_player_id).toBe(helper.player_id);
      await passAll(game, "combat_response");

      const runAwayWindow = await getProjection(game, game.owner);
      if (runAwayWindow.interaction?.public_kind !== "run_away_response") {
        continue;
      }
      expect(runAwayWindow.turn.run_away?.attempts).toHaveLength(0);
      expect(runAwayWindow.interaction.response_required_for_you).toBe(true);
      return game;
    }
    throw new Error("combat/help/Run Away scenario did not reach a real response window");
  }

  async function runEconomyScenario(): Promise<RealGame> {
    for (let attempt = 0; attempt < 12; attempt += 1) {
      const game = await createStartedGame(`economy-${attempt}`);
      const ownerProjection = await getProjection(game, game.owner);
      const item = ownerProjection.you.hand.find((card) => card.kind === "item");
      if (!item) {
        continue;
      }
      const played = await postResult(
        game,
        game.owner,
        "play-card",
        ownerProjection.version,
        {instance_id: item.instance_id},
        `economy-${attempt}-play-item`,
      );
      const carried = played.projection.you.carried.find(
        (card) => card.instance_id === item.instance_id,
      );
      if (!carried) {
        continue;
      }
      const offered = await postResult(
        game,
        game.owner,
        "propose-gift",
        played.version,
        {
          recipient_player_id: game.actors[1].player_id,
          offered_instance_ids: [carried.instance_id],
        },
        `economy-${attempt}-propose-gift`,
      );
      expect(offered.projection.interaction?.public_kind).toBe("economy_offer");
      const recipient = game.actors[1];
      const recipientProjection = await getProjection(game, recipient);
      const accept = recipientProjection.interaction?.actions.find(
        (action) => action.type === "accept",
      );
      if (!accept) {
        continue;
      }
      await respondToInteraction(game, recipient, recipientProjection, accept, "accept");
      const ownerAfter = await getProjection(game, game.owner);
      const recipientAfter = await getProjection(game, recipient);
      expect(ownerAfter.you.carried.some((card) => card.instance_id === carried.instance_id)).toBe(false);
      expect(recipientAfter.you.carried.some((card) => card.instance_id === carried.instance_id)).toBe(true);
      return game;
    }
    throw new Error("economy gift scenario did not reach a real offer and transfer");
  }

  async function runTheftScenario(): Promise<RealGame> {
    const maxAttempts = 48;
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const game = await createStartedGame(`theft-${attempt}`, 2);
      const ownerProjection = await getProjection(game, game.owner);
      const source = ownerProjection.you.hand.find(
        (card) => card.definition_id === "courtyard-sleight-class",
      );
      if (!source) {
        continue;
      }
      const played = await postResult(
        game,
        game.owner,
        "play-card",
        ownerProjection.version,
        {instance_id: source.instance_id},
        `theft-${attempt}-play-class`,
      );
      const cost = played.projection.you.hand[0];
      if (!cost) {
        continue;
      }
      const attempted = await postResult(
        game,
        game.owner,
        "attempt-theft",
        played.version,
        {
          source_instance_id: source.instance_id,
          ability_index: 0,
          cost_instance_ids: [cost.instance_id],
          victim_player_id: game.actors[1].player_id,
        },
        `theft-${attempt}-attempt`,
      );
      expect(attempted.projection.interaction?.public_kind).toBe("theft_response");
      const resolved = await passAll(game, "theft_response");
      expect(resolved.turn.phase).toBe("preparation");
      expect(resolved.interaction).toBeUndefined();
      return game;
    }
    throw new Error(`theft scenario did not deal the real theft capability in ${maxAttempts} games`);
  }

  async function drainDeathLoot(game: RealGame): Promise<void> {
    for (let round = 0; round < game.actors.length + 2; round += 1) {
      let progressed = false;
      for (const actor of game.actors) {
        const projection = await getProjection(game, actor);
        const interaction = projection.interaction;
        if (interaction?.public_kind !== "death_loot_priority" || !interaction.response_required_for_you) {
          continue;
        }
        const action = interaction.actions.find((candidate) => candidate.type === "pass");
        if (!action) {
          throw new Error("death loot priority has no pass action");
        }
        await respondToInteraction(
          game,
          actor,
          projection,
          action,
          "pass",
        );
        progressed = true;
      }
      if (!progressed) {
        return;
      }
    }
    throw new Error("death loot priority did not finish in bounded rounds");
  }

  async function finishTurn(game: RealGame, actor: Actor): Promise<CommandResult> {
    for (let step = 0; step < 4; step += 1) {
      const projection = await getProjection(game, actor);
      if (projection.interaction?.public_kind === "death_loot_priority") {
        await drainDeathLoot(game);
        continue;
      }
      if (projection.turn.phase === "end_turn") {
        return postResult(game, actor, "end-turn", projection.version, {}, "advance-end-turn");
      }
      if (projection.turn.phase !== "charity") {
        throw new Error(`expected charity/end_turn while advancing, got ${projection.turn.phase}`);
      }
      const resolved = await postResult(
        game,
        actor,
        "resolve-charity",
        projection.version,
        {},
        "resolve-charity-open",
      );
      const transfer = resolved.projection.interaction?.charity_transfer;
      if (!transfer) {
        if (resolved.projection.turn.phase !== "end_turn") {
          throw new Error("charity resolved without transfer or end_turn");
        }
        return postResult(game, actor, "end-turn", resolved.version, {}, "advance-end-turn");
      }
      const recipientID = transfer.eligible_recipient_ids[0];
      const allocations = transfer.instance_ids
        .slice(0, transfer.excess)
        .map((instance_id) => recipientID
          ? {instance_id, recipient_player_id: recipientID}
          : {instance_id});
      const allocated = await postResult(
        game,
        actor,
        "resolve-charity",
        resolved.version,
        {allocations},
        "resolve-charity-allocate",
      );
      if (allocated.projection.turn.phase !== "end_turn") {
        throw new Error("charity allocation did not reach end_turn");
      }
      return postResult(game, actor, "end-turn", allocated.version, {}, "advance-end-turn");
    }
    throw new Error("charity did not finish in bounded steps");
  }

  async function advanceActiveTurn(game: RealGame, actor: Actor): Promise<CommandResult> {
    for (let step = 0; step < 12; step += 1) {
      let projection = await getProjection(game, actor);
      if (projection.interaction?.public_kind === "death_loot_priority") {
        await drainDeathLoot(game);
        continue;
      }
      if (projection.turn.phase === "charity" || projection.turn.phase === "end_turn") {
        return finishTurn(game, actor);
      }
      if (projection.turn.phase === "preparation") {
        await postResult(
          game,
          actor,
          "open-door",
          projection.version,
          {},
          "advance-open-door",
        );
        projection = await resolvePrivateChoices(game, actor);
        if (projection.turn.phase === "resolve_effect" && !projection.interaction) {
          throw new Error("open door remained in resolve_effect without a private choice");
        }
        continue;
      }
      if (projection.turn.phase === "door_choice") {
        const looted = await postResult(
          game,
          actor,
          "loot-room",
          projection.version,
          {},
          "advance-loot-room",
        );
        projection = looted.projection;
        continue;
      }
      if (projection.turn.phase === "combat") {
        const requested = await postResult(
          game,
          actor,
          "request-combat-resolution",
          projection.version,
          {},
          "advance-request-resolution",
        );
        if (requested.projection.interaction?.public_kind === "combat_response") {
          await passAll(game, "combat_response");
          continue;
        }
        if (requested.projection.interaction?.public_kind === "private_choice" ||
          requested.projection.turn.phase === "run_away" ||
          requested.projection.turn.phase === "charity" ||
          requested.projection.turn.phase === "end_turn") {
          continue;
        }
        throw new Error(`active combat did not open a response window: ${requested.projection.interaction?.public_kind ?? "none"}`);
      }
      if (projection.turn.phase === "run_away") {
        if (projection.interaction?.public_kind === "private_choice") {
          await resolvePrivateChoices(game, actor);
          continue;
        }
        if (projection.interaction?.public_kind !== "run_away_response") {
          throw new Error(`active Run Away phase did not expose a response window: ${projection.interaction?.public_kind ?? "none"}`);
        }
        await passAll(game, "run_away_response");
        continue;
      }
      throw new Error(`cannot advance active turn from ${projection.turn.phase}`);
    }
    throw new Error("active turn did not reach charity/end_turn in bounded steps");
  }

  async function runDeathContinuationScenario(): Promise<RealGame> {
    for (let attempt = 0; attempt < 64; attempt += 1) {
      const game = await createStartedGame(`death-${attempt}`, 2);
      const ownerProjection = await getProjection(game, game.owner);
      const deathMonster = ownerProjection.you.hand.find((card) => deathMonsterIDs.has(card.definition_id));
      if (!deathMonster) {
        continue;
      }
      await postResult(
        game,
        game.owner,
        "open-door",
        ownerProjection.version,
        {},
        `death-${attempt}-open-door`,
      );
      const afterOpen = await resolvePrivateChoices(game, game.owner);
      if (afterOpen.turn.phase !== "door_choice") {
        continue;
      }
      const fight = await postResult(
        game,
        game.owner,
        "look-for-trouble",
        afterOpen.version,
        {instance_id: deathMonster.instance_id},
        `death-${attempt}-look-for-trouble`,
      );
      if (fight.projection.turn.phase !== "combat") {
        continue;
      }
      const requested = await postResult(
        game,
        game.owner,
        "request-combat-resolution",
        fight.version,
        {},
        `death-${attempt}-request-resolution`,
      );
      if (requested.projection.interaction?.public_kind !== "combat_response") {
        continue;
      }
      await passAll(game, "combat_response");
      const runAway = await getProjection(game, game.owner);
      if (runAway.interaction?.public_kind !== "run_away_response") {
        continue;
      }
      await passAll(game, "run_away_response");
      const deadOwner = await getProjection(game, game.owner);
      if (!deadOwner.you.dead) {
        continue;
      }

      let sawPrivateCurrentOptions = false;
      let sawHiddenOptions = false;
      for (const actor of game.actors) {
        const projection = await getProjection(game, actor);
        if (projection.interaction?.public_kind !== "death_loot_priority") {
          continue;
        }
        const options = projection.interaction.death_loot?.options ?? [];
        if (projection.interaction.response_required_for_you) {
          expect(options.length).toBeGreaterThan(0);
          sawPrivateCurrentOptions = true;
        } else {
          expect(options).toHaveLength(0);
          sawHiddenOptions = true;
        }
      }
      expect(sawPrivateCurrentOptions).toBe(true);
      expect(sawHiddenOptions).toBe(true);
      await drainDeathLoot(game);
      const afterLoot = await getProjection(game, game.owner);
      expect(afterLoot.you.dead).toBe(true);
      expect(afterLoot.interaction?.public_kind).not.toBe("death_loot_priority");

      for (let step = 0; step < game.actors.length; step += 1) {
        const turnProjection = await getProjection(game, game.owner);
        const actor = game.actors.find(
          (candidate) => candidate.player_id === turnProjection.turn.player_id,
        );
        if (!actor) {
          throw new Error("death continuation turn actor is not in the game");
        }
        await advanceActiveTurn(game, actor);
      }
      const redrawn = await getProjection(game, game.owner);
      expect(redrawn.you.dead).toBe(false);
      expect(redrawn.you.needs_redraw).toBe(false);
      expect(redrawn.you.hand.length).toBeGreaterThan(0);
      return game;
    }
    throw new Error("death loot and redraw scenario did not complete in 64 games");
  }

  await runEconomyScenario();
  await runTheftScenario();
  const deathGame = await runDeathContinuationScenario();

  await page.addInitScript(({gameID, credential}) => {
    sessionStorage.setItem(`munchkin:credential:${gameID}`, credential);
  }, {gameID: deathGame.game_id, credential: deathGame.owner.credential});
  await page.goto(`/game/${encodeURIComponent(deathGame.game_id)}`);
  await expect(page.locator(".game-table, .center-state")).toBeVisible();
  await expect(page.locator("code").first()).toContainText(deathGame.game_id);
  await runCombatHelpScenario();
});
