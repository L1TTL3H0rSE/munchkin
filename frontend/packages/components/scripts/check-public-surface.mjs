import fs from "node:fs";
import path from "node:path";
import {fileURLToPath, pathToFileURL} from "node:url";
import ts from "typescript";

const normalize = (value) => value.replaceAll("\\", "/");
const forbidden = /(?:^|\/)(?:test|tests|_fixtures|fixtures|stories|canon|design-only)(?:\/|$)|\.(?:stories|test)\.[cm]?[jt]s/;

export function assertProductionModules(modules) {
  if (modules.length === 0) {
    throw new Error("Production module graph is empty");
  }
  for (const file of modules) {
    if (forbidden.test(normalize(file))) {
      throw new Error(`Test/design data is reachable from production: ${file}`);
    }
  }
}

function imports(source, file) {
  const script = file.endsWith(".vue")
    ? [...source.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map((match) => match[1]).join("\n")
    : source;
  const ast = ts.createSourceFile(file, script, ts.ScriptTarget.Latest, true);
  const result = [];
  function visit(node) {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier) {
      if (ts.isStringLiteral(node.moduleSpecifier)) {
        result.push(node.moduleSpecifier.text);
      }
    }
    if (ts.isCallExpression(node)) {
      const isImport = node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(node.expression) && node.expression.text === "require");
      if (isImport) {
        const argument = node.arguments[0];
        if (!argument || !ts.isStringLiteral(argument)) {
          throw new Error(`Uncheckable dynamic import in product source: ${file}`);
        }
        result.push(argument.text);
      }
      if (normalize(file).includes("/packages/components/src/") &&
        ts.isIdentifier(node.expression) &&
        ["fetch", "$fetch", "useRoute", "useRouter", "useRuntimeConfig", "useFetch"].includes(node.expression.text)) {
        throw new Error(`Application dependency in presentation: ${file}`);
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
  return result;
}

function resolveImport(specifier, importer, frontendRoot) {
  let target;
  if (specifier.startsWith(".")) {
    target = path.resolve(path.dirname(importer), specifier);
  } else if (specifier.startsWith("@munchkin/")) {
    const [name, subpath] = specifier.slice("@munchkin/".length).split("/");
    if (subpath === "styles" || subpath === "scss") {
      return;
    }
    target = path.join(frontendRoot, "packages", name, "src", subpath ?? "index");
  } else if (specifier.startsWith("~/")) {
    target = path.join(frontendRoot, "applications/web/app", specifier.slice(2));
  } else {
    if (normalize(importer).includes("/packages/components/src/") &&
      /(?:^#|nuxt|@munchkin\/api)/.test(specifier)) {
      throw new Error(`Application dependency in presentation: ${specifier}`);
    }
    return;
  }
  if (/\.(?:s?css|png|svg|webp|jpg)$/.test(target)) {
    return;
  }
  const candidates = [target, `${target}.ts`, `${target}.vue`, path.join(target, "index.ts")];
  if (target.endsWith(".js")) {
    candidates.push(target.slice(0, -3) + ".ts");
  }
  const resolved = candidates.find((candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile());
  if (!resolved) {
    throw new Error(`Unresolved product import ${specifier} from ${importer}`);
  }
  if (normalize(importer).includes("/packages/components/src/") &&
    /\/applications\/|\/packages\/api\//.test(normalize(resolved))) {
    throw new Error(`Application dependency in presentation: ${resolved}`);
  }
  return resolved;
}

export function productEntries(frontendRoot) {
  const entries = [
    "packages/components/src/index.ts",
    "packages/components/src/screens/index.ts",
  ].map((file) => path.join(frontendRoot, file));
  for (const directory of ["applications/web/app", "applications/web/server"]) {
    const root = path.join(frontendRoot, directory);
    for (const file of fs.readdirSync(root, {recursive: true})) {
      if (/\.(?:ts|vue)$/.test(file) && !forbidden.test(normalize(file))) {
        entries.push(path.join(root, file));
      }
    }
  }
  return entries;
}

export function checkProductGraph(entries, frontendRoot, read = (file) => fs.readFileSync(file, "utf8")) {
  assertProductionModules(entries);
  const visited = new Set();
  const pending = [...entries];
  while (pending.length > 0) {
    const file = pending.pop();
    if (visited.has(file)) {
      continue;
    }
    assertProductionModules([file]);
    visited.add(file);
    for (const specifier of imports(read(file), file)) {
      const imported = resolveImport(specifier, file, frontendRoot);
      if (imported) {
        pending.push(imported);
      }
    }
  }
  return [...visited];
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const root = fileURLToPath(new URL("../../../", import.meta.url));
  const modules = checkProductGraph(productEntries(root), root);
  console.log(`Product boundary: ${modules.length} reachable source modules checked`);
}
