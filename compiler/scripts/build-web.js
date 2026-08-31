const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

const genDir = path.join(__dirname, '..', 'dist', 'gen');
const outDir = path.join(__dirname, '..', 'web');
fs.mkdirSync(outDir, { recursive: true });

const targets = [
  { file: 'counter.js', globalName: 'CrescentCounter', mountFn: 'Counter', rootId: 'counter-root' },
  { file: 'day_picker.js', globalName: 'CrescentDayPicker', mountFn: 'DayPicker', rootId: 'day-picker-root' },
  { file: 'theme_toggle.js', globalName: 'CrescentThemeToggle', mountFn: 'ThemeToggle', rootId: 'theme-toggle-root' },
  { file: 'composition.js', globalName: 'CrescentComposition', mountFn: 'App', rootId: 'composition-root' },
  { file: 'reactive_list.js', globalName: 'CrescentReactiveList', mountFn: 'TaskBoard', rootId: 'reactive-list-root' },
  { file: 'derived_and_lifecycle.js', globalName: 'CrescentDerivedLifecycle', mountFn: 'Cart', rootId: 'derived-lifecycle-root' },
  { file: path.join('modules', 'main.js'), globalName: 'CrescentModules', mountFn: 'App', rootId: 'modules-root' },
  { file: 'keyed_list.js', globalName: 'CrescentKeyedList', mountFn: 'TodoList', rootId: 'keyed-list-root' },
  { file: 'array_mutators.js', globalName: 'CrescentArrayMutators', mountFn: 'TaskList', rootId: 'array-mutators-root' },
  { file: 'array_mutators_native.js', globalName: 'CrescentArrayMutatorsNative', mountFn: 'NumberList', rootId: 'array-mutators-native-root' },
  { file: 'provide_inject.js', globalName: 'CrescentProvideInject', mountFn: 'App', rootId: 'provide-inject-root' },
];

async function main() {
  const bundles = [];
  for (const target of targets) {
    const entryPoint = path.join(genDir, target.file);
    if (!fs.existsSync(entryPoint)) {
      console.log(`Skipping ${target.file} — not found in dist/gen (did codegen run?)`);
      continue;
    }
    const result = await esbuild.build({
      entryPoints: [entryPoint],
      bundle: true,
      format: 'iife',
      globalName: target.globalName,
      platform: 'browser',
      write: false,
    });
    bundles.push({ ...target, code: result.outputFiles[0].text });
  }

  const scripts = bundles.map((b) => `<script>\n${b.code}\n</script>`).join('\n');
  const roots = bundles.map((b) => `    <section>\n      <h2>${b.mountFn}</h2>\n      <div id="${b.rootId}"></div>\n    </section>`).join('\n');
  const mounts = bundles
    .map((b) => `        document.getElementById('${b.rootId}').appendChild(${b.globalName}.${b.mountFn}());`)
    .join('\n');

  const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Crescent — Compiled Examples</title>
  </head>
  <body>
    <h1>Crescent compiled output</h1>
${roots}
${scripts}
    <script>
      window.addEventListener('DOMContentLoaded', function () {
${mounts}
      });
    </script>
  </body>
</html>
`;

  const outFile = path.join(outDir, 'index.html');
  fs.writeFileSync(outFile, html, 'utf-8');
  console.log(`Wrote ${path.relative(process.cwd(), outFile)} (${bundles.length} component(s) bundled)`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
