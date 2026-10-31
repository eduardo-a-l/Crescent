const lines = (count, make) => Array.from({ length: count }, (_, i) => make(i)).join('');

const single = {
  statements: (n) =>
    `component C {\n    state<int> n = 0;\n    void f() {\n${lines(n, (i) => `        n = n + ${i};\n`)}    }\n    view {\n        <p>{n}</p>\n    }\n}\n`,
  members: (n) => `component C {\n${lines(n, (i) => `    state<int> s${i} = ${i};\n`)}    view {\n        <p>{s0}</p>\n    }\n}\n`,
  components: (n) => lines(n, (i) => `component C${i} {\n    state<int> n = ${i};\n    view {\n        <p>{n}</p>\n    }\n}\n\n`),
  viewNodes: (n) => `component C {\n    state<int> n = 0;\n    view {\n${lines(n, (i) => `        <p class="c${i}">{n + ${i}}</p>\n`)}    }\n}\n`,
  guards: (n) =>
    `component C {\n    state<string?> s = "x";\n    void f() {\n${lines(n, () => `        if (s != null) {\n            console.log(s.length);\n        }\n`)}    }\n    view {\n        <p>"x"</p>\n    }\n}\n`,
  functions: (n) =>
    `component C {\n    state<int> n = 0;\n${lines(n, (i) => `    void f${i}() {\n        n = n + ${i};\n${i > 0 ? `        f${i - 1}();\n` : ''}    }\n`)}    view {\n        <p>{n}</p>\n    }\n}\n`,
};

const linearShapes = ['statements', 'members', 'components', 'viewNodes', 'guards'];

function projectFiles(count) {
  const files = {};
  for (let i = 0; i < count; i++) {
    const uses = [];
    const tags = [];
    for (const back of [1, 2, 3]) {
      const j = i - back;
      if (j >= 0) {
        uses.push(`use f${j}::A${j};`);
        tags.push(`        <A${j} />\n`);
      }
    }
    files[`f${i}.crs`] =
      `${uses.join('\n')}${uses.length ? '\n\n' : ''}component A${i} {\n    state<int> n = ${i};\n    derived<int> doubled = n * 2;\n    void bump() {\n        n = n + 1;\n    }\n    view {\n        <p>{doubled}</p>\n${tags.join('')}    }\n}\n\ncomponent B${i} {\n    view {\n        <A${i} />\n    }\n}\n`;
  }
  return files;
}

module.exports = { single, linearShapes, projectFiles };
