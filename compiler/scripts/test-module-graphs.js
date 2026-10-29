const { JSDOM } = require('jsdom');
const fs = require('fs');
const os = require('os');
const path = require('path');

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>');
global.document = dom.window.document;
global.Node = dom.window.Node;

const { checkProject, buildProject } = require(path.join(__dirname, '..', 'dist', 'project.js'));

function assert(cond, message) {
  if (!cond) {
    console.error('FAIL:', message);
    process.exitCode = 1;
  } else {
    console.log('PASS:', message);
  }
}

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'crescent-graphs-'));
let counter = 0;

function makeProject(files) {
  const dir = path.join(tmpRoot, `project-${counter++}`);
  for (const [rel, text] of Object.entries(files)) {
    const abs = path.join(dir, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, text);
  }
  return dir;
}

function component(name, body, uses = []) {
  const header = uses.length ? uses.map((u) => `use ${u};\n`).join('') + '\n' : '';
  return `${header}component ${name} {\n    view {\n${body}    }\n}\n`;
}

function chainFiles(n, closeCycle) {
  const files = {};
  for (let i = 0; i < n; i++) {
    const next = i + 1 < n ? i + 1 : closeCycle ? 0 : -1;
    files[`c${i}.crs`] = component(
      `C${i}`,
      `        <p>"${i}"</p>\n${next >= 0 ? `        <C${next} />\n` : ''}`,
      next >= 0 ? [`c${next}::C${next}`] : []
    );
  }
  return files;
}

function buildAndLoad(files) {
  const root = makeProject(files);
  const outDir = path.join(tmpRoot, `out-${counter++}`);
  const build = buildProject(root, outDir);
  const generated = fs.existsSync(build.genDir) ? fs.readdirSync(build.genDir, { recursive: true }).filter((f) => f.endsWith('.js')) : [];
  return { build, outDir, genDir: build.genDir, generated };
}

function render(genDir, relJs, exportName) {
  const host = document.createElement('div');
  host.appendChild(require(path.join(genDir, relJs))[exportName]());
  return host;
}

const chain = buildAndLoad(chainFiles(200, false));
assert(
  chain.build.check.ok && chain.build.builds.length === 200 && chain.build.builds.every((b) => b.outFile),
  `chain of 200: every file in a 200-deep import chain checks and builds, got ok=${chain.build.check.ok} built=${chain.build.builds.length}`
);
const chainHost = render(chain.genDir, 'c0.js', 'C0');
const chainTexts = Array.from(chainHost.querySelectorAll('p')).map((p) => p.textContent);
assert(
  chainTexts.length === 200 && chainTexts.every((t, i) => t === String(i)),
  `chain of 200: the root component renders all 200 nested components in order, got ${chainTexts.length} paragraphs`
);

const fanFiles = {};
const fanUses = [];
const fanBody = [];
for (let i = 0; i < 150; i++) {
  fanFiles[`leaf${i}.crs`] = component(`Leaf${i}`, `        <span class="leaf">"${i}"</span>\n`);
  fanUses.push(`leaf${i}::Leaf${i}`);
  fanBody.push(`        <Leaf${i} />\n`);
}
fanFiles['hub.crs'] = component('Hub', fanBody.join(''), fanUses);
const fan = buildAndLoad(fanFiles);
assert(fan.build.check.ok && fan.build.builds.every((b) => b.outFile), `fan-out of 150: a file importing 150 modules checks and builds, got ok=${fan.build.check.ok}`);
const fanSpans = Array.from(render(fan.genDir, 'hub.js', 'Hub').querySelectorAll('.leaf')).map((s) => s.textContent);
assert(
  fanSpans.length === 150 && fanSpans.every((t, i) => t === String(i)),
  `fan-out of 150: the hub renders every imported component, got ${fanSpans.length} leaves`
);
const fanDiagnostics = Array.from(fan.build.check.diagnosticsByFile.values()).flat();
assert(fanDiagnostics.length === 0, `fan-out of 150: no diagnostics, in particular no false unused or conflicting imports, got ${JSON.stringify(fanDiagnostics.slice(0, 2))}`);

const diamond = buildAndLoad({
  'base.crs': component('Base', '        <i class="base">"b"</i>\n'),
  'left.crs': component('Left', '        <Base />\n', ['base::Base']),
  'right.crs': component('Right', '        <Foundation />\n', ['base::{Base as Foundation}']),
  'top.crs': component('Top', '        <Left />\n        <Right />\n', ['left::Left', 'right::Right']),
});
assert(diamond.build.check.ok && diamond.generated.length === 4, `diamond: a shared dependency is built once and the graph checks, got ok=${diamond.build.check.ok} files=${JSON.stringify(diamond.generated)}`);
assert(
  render(diamond.genDir, 'top.js', 'Top').querySelectorAll('.base').length === 2,
  'diamond: the shared component renders once through each path, including through an alias'
);

const nested = buildAndLoad({
  'shared/util.crs': component('Util', '        <b class="util">"u"</b>\n'),
  'app/ui/buttons/button.crs': component('Button', '        <button>"go"</button>\n        <Util />\n', ['super::super::super::shared::util::Util']),
  'app/ui/panel.crs': component('Panel', '        <Button />\n        <Util />\n', ['buttons::button::Button', 'super::super::shared::util::Util']),
  'app/main.crs': component('App', '        <Panel />\n', ['ui::panel::Panel']),
});
assert(nested.build.check.ok && nested.generated.length === 4, `nested directories: imports climbing several levels with super resolve, got ok=${nested.build.check.ok} fatal=${JSON.stringify(nested.build.check.fatal)}`);
const nestedHost = render(nested.genDir, path.join('app', 'main.js'), 'App');
assert(
  nestedHost.querySelectorAll('button').length === 1 && nestedHost.querySelectorAll('.util').length === 2,
  `nested directories: the built modules require each other correctly across directories, got ${nestedHost.querySelectorAll('button').length} buttons and ${nestedHost.querySelectorAll('.util').length} utils`
);

const longCycle = checkProject(makeProject(chainFiles(500, true)));
const longCycleChain = longCycle.fatal ? longCycle.fatal.message.replace(/^Circular import: /, '').split(' -> ') : [];
assert(
  !longCycle.ok &&
    longCycle.fatal.stage === 'module' &&
    longCycleChain.length === 501 &&
    longCycleChain[0] === longCycleChain[500] &&
    longCycle.fatal.file === longCycleChain[499] &&
    longCycle.fatal.line === 1,
  `cycle of 500: a cycle spanning 500 files is reported with its full chain on the use that closes it, got ${longCycle.fatal && JSON.stringify({ file: longCycle.fatal.file, line: longCycle.fatal.line, chain: longCycleChain.length })}`
);

let deepChain = null;
let deepError = null;
try {
  deepChain = checkProject(makeProject(chainFiles(12000, false)));
} catch (e) {
  deepError = e;
}
assert(
  deepError === null && deepChain.ok && deepChain.files.size === 12000,
  `chain of 12000: checking a 12000-file import chain does not overflow the stack, got ${deepError ? deepError.constructor.name + ': ' + deepError.message : 'ok=' + deepChain.ok}`
);

let deepCycle = null;
let deepCycleError = null;
try {
  deepCycle = checkProject(makeProject(chainFiles(12000, true)));
} catch (e) {
  deepCycleError = e;
}
assert(
  deepCycleError === null && !deepCycle.ok && deepCycle.fatal.message.split(' -> ').length === 12001,
  `cycle of 12000: a 12000-file cycle is reported instead of overflowing the stack, got ${deepCycleError ? deepCycleError.constructor.name : 'ok=' + deepCycle.ok}`
);

fs.rmSync(tmpRoot, { recursive: true, force: true });
