const { JSDOM } = require('jsdom');
const path = require('path');

const dom = new JSDOM('<!doctype html><html><body></body></html>');
global.document = dom.window.document;
global.Node = dom.window.Node;

const { state, effect, ifBlock, forEach, derived } = require(path.join(__dirname, '..', 'dist', 'runtime.js'));

function assert(cond, message) {
  if (!cond) {
    console.error('FAIL:', message);
    process.exitCode = 1;
  } else {
    console.log('PASS:', message);
  }
}

{
  const dep = state(0);
  const show = state(true);
  const tracker = { calls: 0 };

  ifBlock(
    () => show.get(),
    () => {
      effect(() => {
        dep.get();
        tracker.calls++;
      });
      return document.createElement('span');
    }
  );

  assert(tracker.calls === 1, 'ifBlock: nested effect runs once on initial render');

  dep.set(1);
  assert(tracker.calls === 2, 'ifBlock: nested effect re-runs while its branch is visible');

  show.set(false);
  dep.set(2);
  assert(tracker.calls === 2, 'ifBlock: nested effect no longer runs after its branch is hidden (disposed)');

  show.set(true);
  const afterReshow = tracker.calls;
  dep.set(3);
  assert(tracker.calls === afterReshow + 1, 'ifBlock: re-showing creates exactly one fresh subscription, not a leaked duplicate');
}

{
  const dep = state(0);
  const items = state([{ id: 'a' }, { id: 'b' }]);
  const trackerA = { calls: 0 };
  const trackerB = { calls: 0 };

  forEach(
    () => items.get(),
    (item) => {
      const tracker = item.id === 'a' ? trackerA : trackerB;
      effect(() => {
        dep.get();
        tracker.calls++;
      });
      return document.createElement('span');
    },
    (item) => item.id
  );

  assert(trackerA.calls === 1 && trackerB.calls === 1, 'forEach: each keyed item renders its effect once initially');

  dep.set(1);
  assert(trackerA.calls === 2 && trackerB.calls === 2, 'forEach: both items react to a shared dependency change');

  items.set([items.get()[0]]);
  dep.set(2);
  assert(trackerA.calls === 3, 'forEach: the remaining item still reacts to dependency changes');
  assert(trackerB.calls === 2, 'forEach: the removed item no longer reacts (its effect was disposed)');
}

{
  const dep = state(1);
  const show = state(true);
  const computeTracker = { calls: 0 };
  let derivedRef = null;

  ifBlock(
    () => show.get(),
    () => {
      const total = derived(() => {
        computeTracker.calls++;
        return dep.get() * 2;
      });
      derivedRef = total;
      effect(() => {
        total.get();
      });
      return document.createElement('span');
    }
  );

  assert(computeTracker.calls === 1, 'derived(): computes once on initial render');

  dep.set(2);
  assert(computeTracker.calls === 2, 'derived(): recomputes when its dependency changes while visible');

  show.set(false);
  dep.set(3);
  assert(
    computeTracker.calls === 2,
    'derived(): no longer recomputes after its containing branch is hidden (its internal subscription was disposed)'
  );
  assert(derivedRef.get() === 4, 'derived(): a disposed derived still returns its last cached value rather than recomputing or throwing');
}

{
  const dep = state(0);
  const items = state([{ id: 'x', show: true }]);
  const tracker = { calls: 0 };

  forEach(
    () => items.get(),
    (item) =>
      ifBlock(
        () => item.show,
        () => {
          effect(() => {
            dep.get();
            tracker.calls++;
          });
          return document.createElement('span');
        }
      ),
    (item) => item.id
  );

  assert(tracker.calls === 1, 'nested ifBlock-inside-forEach: renders its effect once initially');

  items.set([]);
  dep.set(1);
  assert(
    tracker.calls === 1,
    "nested ifBlock-inside-forEach: removing the outer forEach item disposes the inner ifBlock's effect too (composable disposal)"
  );
}
