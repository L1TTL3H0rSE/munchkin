export function outputEnvelope(command, data, {
  ok = true,
  warnings = [],
  errors = [],
} = {}) {
  return {
    schemaVersion: 1,
    tool: {
      name: "leinoctl",
      version: "0.1.0",
    },
    command,
    ok,
    data,
    warnings,
    errors,
  };
}

export function writeOutput(envelope, { json = false, stream = process.stdout } = {}) {
  if (json) {
    stream.write(`${JSON.stringify(envelope, null, 2)}\n`);
    return;
  }
  stream.write(`leinoctl ${envelope.command}: ${envelope.ok ? "ok" : "failed"}\n`);
  if (typeof envelope.data === "string") {
    stream.write(`${envelope.data}\n`);
  } else if (Array.isArray(envelope.data)) {
    for (const entry of envelope.data) {
      stream.write(`${typeof entry === "string" ? entry : JSON.stringify(entry)}\n`);
    }
  } else if (envelope.data && typeof envelope.data === "object") {
    for (const [key, value] of Object.entries(envelope.data)) {
      stream.write(`${key}: ${typeof value === "string" ? value : JSON.stringify(value)}\n`);
    }
  }
  for (const warning of envelope.warnings) {
    stream.write(`warning: ${warning}\n`);
  }
  for (const error of envelope.errors) {
    stream.write(`error: ${error}\n`);
  }
}
