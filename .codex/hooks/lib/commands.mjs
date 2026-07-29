function tokenizeShell(command) {
  const tokens = [];
  const segments = [];
  let token = "";
  let quote = null;
  let escaped = false;
  let ambiguous = false;

  const flushToken = () => {
    if (token) {
      tokens.push(token);
      token = "";
    }
  };
  const flushSegment = () => {
    flushToken();
    if (tokens.length) {
      segments.push(tokens.splice(0));
    }
  };

  for (let index = 0; index < command.length; index += 1) {
    const char = command[index];
    if (escaped) {
      token += char;
      escaped = false;
      continue;
    }
    if (char === "\\" && quote !== "'") {
      escaped = true;
      token += char;
      continue;
    }
    if (quote) {
      if (char === quote) {
        quote = null;
      } else {
        token += char;
      }
      continue;
    }
    if (char === "'" || char === '"') {
      quote = char;
      continue;
    }
    if (char === "`") {
      ambiguous = true;
      token += char;
      continue;
    }
    if (/\s/.test(char)) {
      flushToken();
      if (char === "\n" || char === "\r") {
        flushSegment();
      }
      continue;
    }
    if (char === ";" || char === "|" || char === "&") {
      flushSegment();
      while (command[index + 1] === char) {
        index += 1;
      }
      continue;
    }
    token += char;
  }
  if (quote || escaped || command.includes("$(")) {
    ambiguous = true;
  }
  flushSegment();
  return { segments, ambiguous };
}

function executableName(token) {
  return String(token ?? "").replaceAll("\\", "/").split("/").at(-1).toLowerCase();
}

function dockerInvocations(command) {
  const parsed = tokenizeShell(command);
  const invocations = [];

  for (const segment of parsed.segments) {
    for (let index = 0; index < segment.length; index += 1) {
      const executable = executableName(segment[index]);
      if (executable === "docker" || executable === "docker.exe") {
        if (String(segment[index + 1] ?? "").toLowerCase() === "compose") {
          invocations.push(segment.slice(index));
          break;
        }
      }
      if (executable === "docker-compose" || executable === "docker-compose.exe") {
        invocations.push(segment.slice(index));
        break;
      }
    }
  }

  return { ...parsed, invocations };
}

export function validateDockerComposeCommand(command, minimumParallel = 4) {
  const value = String(command ?? "");
  const parsed = dockerInvocations(value);
  const mentionsCompose = /(?:^|[\s;&|])(?:[^\s;&|/\\]+[/\\])?docker(?:\.exe)?\s+compose(?:\s|$)|(?:^|[\s;&|])(?:[^\s;&|/\\]+[/\\])?docker-compose(?:\.exe)?(?:\s|$)/i.test(value);
  const issues = [];

  if (mentionsCompose && parsed.invocations.length === 0) {
    issues.push({
      code: "docker-compose-unparsed",
      message: "docker compose command is ambiguous; split it into a direct invocation",
    });
    return issues;
  }
  if (parsed.invocations.length && parsed.ambiguous) {
    issues.push({
      code: "docker-compose-ambiguous",
      message: "docker compose command uses shell expansion or unbalanced quoting; use a direct command",
    });
    return issues;
  }

  for (const invocation of parsed.invocations) {
    const parallelValues = [];
    for (let index = 0; index < invocation.length; index += 1) {
      const token = String(invocation[index]);
      if (token === "--parallel") {
        parallelValues.push(invocation[index + 1]);
        index += 1;
      } else if (token.startsWith("--parallel=")) {
        parallelValues.push(token.slice("--parallel=".length));
      }
    }

    if (parallelValues.length === 0) {
      issues.push({
        code: "docker-parallel-missing",
        message: `docker compose requires --parallel ${minimumParallel} or greater`,
      });
      continue;
    }
    if (parallelValues.length !== 1) {
      issues.push({
        code: "docker-parallel-ambiguous",
        message: "docker compose must specify --parallel exactly once",
      });
      continue;
    }

    const numeric = Number(parallelValues[0]);
    if (!Number.isInteger(numeric) || numeric < minimumParallel) {
      issues.push({
        code: "docker-parallel-too-low",
        message: `docker compose --parallel must be an integer >= ${minimumParallel}`,
      });
    }
  }

  return issues;
}

function segmentHasUnsafeRead(segment, platform) {
  const joined = segment.join(" ");
  const first = executableName(segment[0] === "&" ? segment[1] : segment[0]);
  const nestedCommand = segment.find((token, index) => {
    const previous = String(segment[index - 1] ?? "").toLowerCase();
    return previous === "-command" || previous === "-c";
  });
  const hasGetContent = /(?:^|[\s;&|])(get-content|gc)(?:\s|$)/i.test(joined);
  const hasBareType = platform === "win32" && (
    first === "type"
    || first === "type.exe"
    || /^(?:type|type\.exe)\s+/i.test(String(nestedCommand ?? ""))
    || /\bcmd(?:\.exe)?\s+\/c\s+type(?:\.exe)?\s+/i.test(joined)
  );
  return hasGetContent || hasBareType;
}

function segmentHasExplicitSafeEncoding(segment) {
  const joined = segment.join(" ");
  return /-(?:encoding)(?::|=|\s+)(?:utf-?8|utf8nobom|byte)(?:\s|$)/i.test(joined)
    || /-asbytestream(?:\s|$)/i.test(joined);
}

export function validateTextReadCommand(command, platform = process.platform) {
  const parsed = tokenizeShell(String(command ?? ""));
  const issues = [];

  for (const segment of parsed.segments) {
    if (segmentHasUnsafeRead(segment, platform) && !segmentHasExplicitSafeEncoding(segment)) {
      issues.push({
        code: "unsafe-text-read-encoding",
        message: "repository text read must use rg, Get-Content -Raw -Encoding utf8, or a byte read with a fatal UTF-8 decoder",
      });
    }
  }

  return issues;
}

export { tokenizeShell };
