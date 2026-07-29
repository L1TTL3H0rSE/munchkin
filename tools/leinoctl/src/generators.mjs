import { EXIT_CODES, LeinoError } from "./errors.mjs";

export function buildGeneratorCommands(generators, requestedTargets = [], {
  check = false,
} = {}) {
  if (!requestedTargets.length) {
    return generators.map((generator) => ({
      id: generator.id,
      cwd: generator.cwd,
      argv: [
        ...generator.argv,
        ...(check ? generator.checkArgs : []),
      ],
    }));
  }

  const targets = [...new Set(requestedTargets)];
  const ownersByTarget = new Map();
  for (const generator of generators) {
    for (const target of generator.targets) {
      ownersByTarget.set(target, [
        ...(ownersByTarget.get(target) ?? []),
        generator,
      ]);
    }
  }

  const groupedTargets = new Map();
  for (const target of targets) {
    const owners = ownersByTarget.get(target) ?? [];
    if (!owners.length) {
      throw new LeinoError(
        "generator-target-unknown",
        `no generator owns target ${target}`,
        { exitCode: EXIT_CODES.usage },
      );
    }
    if (owners.length > 1) {
      throw new LeinoError(
        "generator-target-ambiguous",
        `target ${target} is owned by multiple generators: ${owners.map((entry) => entry.id).join(", ")}`,
      );
    }
    const owner = owners[0];
    groupedTargets.set(owner.id, [
      ...(groupedTargets.get(owner.id) ?? []),
      target,
    ]);
  }

  return generators
    .filter((generator) => groupedTargets.has(generator.id))
    .map((generator) => {
      const selectedTargets = groupedTargets.get(generator.id);
      return {
        id: `${generator.id}:${selectedTargets.join(",")}`,
        cwd: generator.cwd,
        argv: [
          ...generator.argv,
          ...(check ? generator.checkArgs : []),
          ...selectedTargets,
        ],
      };
    });
}
