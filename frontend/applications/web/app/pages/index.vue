<script setup lang="ts">
import {reactive} from "vue";
import {LobbyScreen} from "@munchkin/components/screens";
import type {LobbyFormInput, LobbyFormMode, LobbySubmissionState} from "@munchkin/components";
import {lobbyFormError} from "../composables/lobbyError";
const api = useGameApi();
const session = useGameSession();
const router = useRouter();
const forms = reactive<Record<LobbyFormMode, LobbySubmissionState>>({
  create: {busy: false, error: null, successful: false},
  join: {busy: false, error: null, successful: false},
});
async function openLobby(input: LobbyFormInput): Promise<void> {
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


async function submitLobby(input: LobbyFormInput): Promise<void> {
  const state = forms[input.mode];
  if (state.busy) { return; }
  state.busy = true;
  state.error = null;
  state.successful = false;
  try {
    await openLobby(input);
    state.successful = true;
  } catch (error) {
    state.error = lobbyFormError(error);
  } finally {
    state.busy = false;
  }
}
</script>

<template>
  <LobbyScreen :forms="forms" @submit="submitLobby" />
</template>
