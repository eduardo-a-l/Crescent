const { JSDOM } = require('jsdom');
const path = require('path');

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>');
global.document = dom.window.document;
global.Node = dom.window.Node;

const { ThemeToggle } = require(path.join(__dirname, '..', 'dist', 'gen', 'theme_toggle.js'));

const root = document.getElementById('root');
root.appendChild(ThemeToggle());

function assert(cond, message) {
  if (!cond) {
    console.error('FAIL:', message);
    process.exitCode = 1;
  } else {
    console.log('PASS:', message);
  }
}

const box = root.querySelector('.box');
assert(box !== null, 'box element rendered');
assert(box.hasAttribute('data-crs-themetoggle'), 'box carries scope attribute');

const styleTag = document.head.querySelector('style[data-crs-style="data-crs-themetoggle"]');
assert(styleTag !== null, 'scoped stylesheet injected into <head>');
assert(styleTag.textContent.includes('.box[data-crs-themetoggle]'), 'stylesheet uses scoped selector');
assert(styleTag.textContent.includes('var(--crs-0)'), 'reactive declaration compiles to a CSS var');

assert(box.style.getPropertyValue('--crs-0') === '#18181B', `initial dark bg var is "${box.style.getPropertyValue('--crs-0')}"`);
assert(box.style.getPropertyValue('--crs-2') === '2px solid #8B5CF6', `initial border var is "${box.style.getPropertyValue('--crs-2')}"`);

const toggleButton = root.querySelector('button');
toggleButton.dispatchEvent(new dom.window.Event('click'));

assert(box.style.getPropertyValue('--crs-0') === '#F4F4F5', `after toggle bg var is "${box.style.getPropertyValue('--crs-0')}"`);
assert(box.style.getPropertyValue('--crs-1') === '#000000', `after toggle text var is "${box.style.getPropertyValue('--crs-1')}"`);

const injectedBefore = document.head.querySelectorAll('style[data-crs-style="data-crs-themetoggle"]').length;
root.appendChild(ThemeToggle());
const injectedAfter = document.head.querySelectorAll('style[data-crs-style="data-crs-themetoggle"]').length;
assert(injectedAfter === injectedBefore, 'stylesheet is only injected once across instances');
