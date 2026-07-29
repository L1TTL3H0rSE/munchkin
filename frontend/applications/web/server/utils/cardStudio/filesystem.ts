import {createHash, randomUUID} from "node:crypto";
import {createServer, type Server} from "node:net";
import {
  lstat,
  mkdir,
  open,
  readFile,
  readdir,
  realpath,
  rename,
  unlink,
} from "node:fs/promises";
import path from "node:path";
import {StudioError} from "./errors";

const STUDIO_LOCK_RETRY_COUNT = 200;
const STUDIO_LOCK_RETRY_DELAY_MS = 20;
const STUDIO_LOCK_PORT_BASE = 20_000;
const STUDIO_LOCK_PORT_COUNT = 20_000;

export async function ensureSafeRoot(rootPath: string) {
  await mkdir(rootPath, {recursive: true});
  return realpath(rootPath);
}

export async function atomicWriteFile(
  rootPath: string,
  relativePath: string,
  data: string | Buffer,
) {
  const root = await ensureSafeRoot(rootPath);
  const target = resolveRelative(root, relativePath);
  const parent = path.dirname(target);
  await mkdir(parent, {recursive: true});
  const realParent = await realpath(parent);
  assertInside(root, realParent);
  await rejectUnsafeExistingTarget(target);
  const temporary = path.join(
    realParent,
    `.${path.basename(target)}.${randomUUID()}.tmp`,
  );
  assertInside(root, temporary);
  const handle = await open(temporary, "wx", 0o600);
  try {
    await handle.writeFile(data);
    await handle.sync();
  } finally {
    await handle.close();
  }
  try {
    await rename(temporary, target);
  } catch (error) {
    await unlink(temporary).catch(() => undefined);
    throw error;
  }
}

export async function readSafeFile(rootPath: string, relativePath: string) {
  const root = await ensureSafeRoot(rootPath);
  const target = resolveRelative(root, relativePath);
  const parent = await realpath(path.dirname(target));
  assertInside(root, parent);
  const stat = await lstat(target);
  if (stat.isSymbolicLink() || !stat.isFile()) {
    throw unsafePath();
  }
  const resolved = await realpath(target);
  assertInside(root, resolved);
  return readFile(resolved);
}

export async function listSafeFiles(
  rootPath: string,
  relativeDirectory: string,
) {
  const root = await ensureSafeRoot(rootPath);
  const directory = resolveRelative(root, relativeDirectory);
  await mkdir(directory, {recursive: true});
  const resolved = await realpath(directory);
  assertInside(root, resolved);
  const entries = await readdir(resolved, {withFileTypes: true});
  return entries
    .filter((entry) => entry.isFile() && !entry.isSymbolicLink())
    .map((entry) => entry.name);
}

export async function withStudioLock<T>(
  rootPath: string,
  name: string,
  callback: () => Promise<T>,
) {
  if (!/^[a-z0-9-]{1,120}$/.test(name)) {
    throw unsafePath();
  }
  const root = await ensureSafeRoot(rootPath);
  const port = studioLockPort(root, name);
  let server;
  for (let attempt = 0; attempt < STUDIO_LOCK_RETRY_COUNT; attempt++) {
    server = await tryAcquireStudioLock(port);
    if (server) {
      break;
    }
    if (attempt + 1 < STUDIO_LOCK_RETRY_COUNT) {
      await new Promise((resolve) =>
        setTimeout(resolve, STUDIO_LOCK_RETRY_DELAY_MS));
    }
  }
  if (!server) {
    throw new StudioError(
      "CONFLICT",
      "Card Studio занята другой операцией.",
      409,
    );
  }
  try {
    return await callback();
  } finally {
    await closeStudioLock(server);
  }
}

export function resolveRelative(root: string, relativePath: string) {
  if (
    path.isAbsolute(relativePath) ||
    relativePath.includes("\0") ||
    relativePath.split(/[\\/]/u).some(
      (segment) => segment === "" || segment === "." || segment === "..",
    )
  ) {
    throw unsafePath();
  }
  const target = path.resolve(root, relativePath);
  assertInside(root, target);
  return target;
}

export function assertInside(root: string, candidate: string) {
  const relative = path.relative(root, candidate);
  if (
    relative === ".." ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  ) {
    throw unsafePath();
  }
}

export function isNodeError(error: unknown, code: string) {
  return error instanceof Error &&
    "code" in error &&
    (error as NodeJS.ErrnoException).code === code;
}

async function rejectUnsafeExistingTarget(target: string) {
  try {
    const stat = await lstat(target);
    if (stat.isSymbolicLink() || !stat.isFile()) {
      throw unsafePath();
    }
  } catch (error) {
    if (!isNodeError(error, "ENOENT")) {
      throw error;
    }
  }
}

function studioLockPort(root: string, name: string) {
  const digest = createHash("sha256")
    .update(`${root}\0${name}`)
    .digest();
  return STUDIO_LOCK_PORT_BASE +
    digest.readUInt32BE(0) % STUDIO_LOCK_PORT_COUNT;
}

async function tryAcquireStudioLock(port: number) {
  return new Promise<Server | undefined>((resolve, reject) => {
    const server = createServer((socket) => socket.destroy());
    server.once("error", onError);
    server.listen({
      host: "127.0.0.1",
      port,
      exclusive: true,
    }, () => {
      server.off("error", onError);
      server.on("error", () => undefined);
      resolve(server);
    });

    function onError(error: NodeJS.ErrnoException) {
      server.removeAllListeners();
      if (error.code === "EADDRINUSE") {
        resolve(undefined);
        return;
      }
      reject(error);
    }
  });
}

async function closeStudioLock(server: Server) {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

function unsafePath() {
  return new StudioError(
    "INVALID_REQUEST",
    "Card Studio отклонила небезопасный filesystem path.",
    400,
  );
}
