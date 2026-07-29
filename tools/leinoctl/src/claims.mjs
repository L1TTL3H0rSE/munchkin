import { LeinoError } from "./errors.mjs";
import { toPosix } from "./fs.mjs";

function expandFirstBrace(value) {
  const match = value.match(/\{([^{}]+)\}/);
  if (!match) {
    return [value];
  }
  return match[1].split(",").flatMap((part) => expandFirstBrace(
    `${value.slice(0, match.index)}${part.trim()}${value.slice(match.index + match[0].length)}`,
  ));
}

function globToRegex(glob) {
  let source = "^";
  for (let index = 0; index < glob.length; index += 1) {
    const char = glob[index];
    if (char === "*" && glob[index + 1] === "*") {
      source += ".*";
      index += 1;
    } else if (char === "*") {
      source += "[^/]*";
    } else if (char === "?") {
      source += "[^/]";
    } else {
      source += char.replace(/[\\^$.[\]()+|]/g, "\\$&");
    }
  }
  return new RegExp(`${source}$`, process.platform === "win32" ? "i" : "");
}

export function normalizeClaim(claim) {
  const normalized = toPosix(String(claim ?? "").trim().replaceAll("`", "")).replace(/^\.\//, "");
  if (
    !normalized
    || normalized.startsWith("/")
    || /^[A-Za-z]:\//.test(normalized)
    || normalized.split("/").includes("..")
  ) {
    throw new LeinoError("invalid-write-claim", `invalid write-set claim: ${claim}`);
  }
  return normalized;
}

export function claimMatchesPath(claim, repoPath) {
  const target = toPosix(repoPath).replace(/^\.\//, "");
  return expandFirstBrace(normalizeClaim(claim)).some(
    (expanded) => globToRegex(expanded).test(target),
  );
}

export function claimIntersectsPath(claim, repoPath) {
  const normalizedClaim = normalizeClaim(claim);
  const target = toPosix(repoPath).replace(/^\.\//, "");
  if (claimMatchesPath(normalizedClaim, target)) {
    return true;
  }
  const staticPrefix = normalizedClaim.split(/[*?{]/, 1)[0].replace(/\/$/, "");
  return Boolean(staticPrefix)
    && (staticPrefix === target || staticPrefix.startsWith(`${target}/`));
}
