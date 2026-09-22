export type GameApiErrorKind =
  | "aborted"
  | "auth"
  | "validation"
  | "conflict"
  | "stale_version"
  | "not_found"
  | "offline"
  | "transient"
  | "protocol"
  | "unexpected";

export type GameConnectionState =
  | "connecting"
  | "connected"
  | "resyncing"
  | "offline"
  | "failed";
