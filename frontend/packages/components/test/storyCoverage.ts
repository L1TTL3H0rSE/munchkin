import {storyNameFromExport, toId} from "storybook/internal/csf";
import {figmaStateDescriptors, type FigmaDesktopStateName} from "../../../test/browser/figmaStateMatrix.ts";

export const stateFamilies = {
  ActiveTurn: "Table", HandExpanded: "Table", HandFastEquip: "Table",
  EquipmentSlotOpen: "Table", CharacterOpen: "Table", StrengthOpen: "Table",
  OpponentOpen: "Table", DoorReady: "Table", PostDoorChoice: "Table",
  RunAwayChoice: "Table", RewardReceived: "Table", Preparation: "Table",
  CurseEffect: "Table", HelpAccepted: "Table", RunAwaySuccess: "Table",
  RunAwayFailure: "Table", RunAwayNextMonster: "Table", EndTurnReady: "Table",
  EmptyHand: "Table",
  RequiredResponse: "Interactions", Charity: "Interactions", CharityDiscard: "Interactions",
  HelpOffer: "Interactions", HelpIncoming: "Interactions", RunAwayPending: "Interactions",
  DeathLoot: "Interactions", Trade: "Interactions", Gift: "Interactions",
  TheftResponse: "Interactions", PrivateChoice: "Interactions", ExpiredChoice: "Interactions",
  Waiting: "System", Reconnecting: "System", ConnectionFailed: "System",
  TurnPassed: "System", Death: "System", DeathRecovery: "System", StaleChoice: "System",
  InitialLoading: "System", SessionLost: "System", GameUnavailable: "System",
  Victory: "System", GameFinished: "System",
} satisfies Record<FigmaDesktopStateName, string>;

export const lobbyStates = [
  "Create", "Join", "Empty", "EmptyRoom", "Pending", "JoinPending", "KeyboardModes",
  "Offline", "RoomNotFound", "ServerError", "Success", "JoinSuccess", "LongValues",
] as const;

export const screenCoverage = [
  ...figmaStateDescriptors.map((state) => ({
    state: state.name,
    figmaNode: state.nodeId,
    component: "GameScreen",
    fixtureID: state.fixtureID,
    props: "required routeState, connectionState, errors and busy state",
    emits: "execute / submit-interaction / submit-economy / retry",
    actions: state.serverActions,
    behavior: state.semanticCheck,
    visualEvidence: `figma-state-owners.spec.ts + visual.spec.ts (${state.visualFamily})`,
    stories: [
      {id: toId(`Screens/${stateFamilies[state.name]}`, storyNameFromExport(state.name)), viewport: "1440x900"},
      {id: toId(`Screens/${stateFamilies[state.name]}`, storyNameFromExport(`${state.name}Compact`)), viewport: "360x640"},
    ],
  })),
  ...lobbyStates.map((state) => ({
    state: `Lobby${state}`,
    figmaNode: "240:53 / 228:14",
    component: "LobbyScreen",
    fixtureID: null,
    props: "required independent create/join form submission states",
    emits: "submit(mode, displayName, gameID?)",
    actions: ["create", "join"],
    behavior: "validation, focus, Enter, mode switching, independent pending and safe errors",
    visualEvidence: "lobby.spec.ts + visual.spec.ts (lobby)",
    stories: [
      {id: toId("Screens/Lobby", storyNameFromExport(state)), viewport: "1440x900"},
      {id: toId("Screens/Lobby", storyNameFromExport(`${state}Compact`)), viewport: "360x640"},
    ],
  })),
];

export function assertScreenCoverage(
  coverage: typeof screenCoverage,
  storyIDs: ReadonlySet<string>,
): void {
  if (coverage.length === 0 || storyIDs.size === 0 || figmaStateDescriptors.length !== 43) {
    throw new Error("Screen coverage/catalog is empty or the 43-state baseline changed");
  }
  for (const state of [...figmaStateDescriptors.map((entry) => entry.name), ...lobbyStates.map((name) => `Lobby${name}`)]) {
    const entries = coverage.filter((entry) => entry.state === state);
    if (entries.length !== 1) {
      throw new Error(`Required state missing or duplicated: ${state}`);
    }
    const entry = entries[0]!;
    for (const viewport of ["1440x900", "360x640"]) {
      const story = entry.stories.find((item) => item.viewport === viewport);
      if (!story || !storyIDs.has(story.id)) {
        throw new Error(`Required story missing: ${state} at ${viewport}`);
      }
    }
  }
}
