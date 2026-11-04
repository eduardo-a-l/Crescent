export interface Signal<T> {
  get(): T;
  set(value: T): void;
}

type EffectFn = () => void;
type Dispose = () => void;

interface EffectContext {
  run: EffectFn;
  deps: Set<Set<EffectFn>>;
}

let currentContext: EffectContext | null = null;
const disposalStack: Dispose[][] = [];

function registerDisposal(dispose: Dispose): void {
  if (disposalStack.length > 0) {
    disposalStack[disposalStack.length - 1].push(dispose);
  }
}

function withDisposalScope<T>(fn: () => T): [T, Dispose] {
  const scope: Dispose[] = [];
  disposalStack.push(scope);
  let result: T;
  try {
    result = fn();
  } finally {
    disposalStack.pop();
  }
  return [result, () => { for (const dispose of scope) dispose(); }];
}

export function state<T>(initial: T): Signal<T> {
  let value = initial;
  const subscribers = new Set<EffectFn>();
  return {
    get(): T {
      if (currentContext) {
        subscribers.add(currentContext.run);
        currentContext.deps.add(subscribers);
      }
      return value;
    },
    set(next: T): void {
      value = next;
      for (const fn of Array.from(subscribers)) fn();
    },
  };
}

export function effect(fn: EffectFn): Dispose {
  const ctx: EffectContext = { run: () => {}, deps: new Set() };
  ctx.run = () => {
    for (const depSet of ctx.deps) depSet.delete(ctx.run);
    ctx.deps.clear();
    const prevContext = currentContext;
    currentContext = ctx;
    try {
      fn();
    } finally {
      currentContext = prevContext;
    }
  };
  ctx.run();

  const dispose: Dispose = () => {
    for (const depSet of ctx.deps) depSet.delete(ctx.run);
    ctx.deps.clear();
  };
  registerDisposal(dispose);
  return dispose;
}

type Attrs = Record<string, unknown>;
type Child = Node | string | number | null | undefined;

export function h(tag: string, attrs: Attrs, ...children: Child[]): HTMLElement {
  const el = document.createElement(tag);
  for (const key of Object.keys(attrs || {})) {
    const value = attrs[key];
    if (key.startsWith('on') && typeof value === 'function') {
      el.addEventListener(key.slice(2).toLowerCase(), value as EventListener);
    } else if (key === 'class') {
      el.className = String(value);
    } else if (value !== null && value !== undefined) {
      el.setAttribute(key, String(value));
    }
  }
  appendChildren(el, children);
  return el;
}

function appendChildren(el: HTMLElement, children: Child[]): void {
  for (const child of children) {
    if (child === null || child === undefined) continue;
    if (child instanceof Node) {
      el.appendChild(child);
    } else {
      el.appendChild(document.createTextNode(String(child)));
    }
  }
}

export function text(fn: () => unknown): Text {
  const node = document.createTextNode('');
  effect(() => {
    node.data = String(fn());
  });
  return node;
}

export function derived<T>(compute: () => T): Signal<T> {
  let value: T;
  let dirty = true;
  const subscribers = new Set<EffectFn>();
  const ctx: EffectContext = { run: () => {}, deps: new Set() };
  ctx.run = () => {
    if (!dirty) {
      dirty = true;
      for (const fn of Array.from(subscribers)) fn();
    }
  };

  const dispose: Dispose = () => {
    for (const depSet of ctx.deps) depSet.delete(ctx.run);
    ctx.deps.clear();
  };
  registerDisposal(dispose);

  return {
    get(): T {
      if (dirty) {
        for (const depSet of ctx.deps) depSet.delete(ctx.run);
        ctx.deps.clear();
        const prevContext = currentContext;
        currentContext = ctx;
        try {
          value = compute();
        } finally {
          currentContext = prevContext;
        }
        dirty = false;
      }
      if (currentContext) {
        subscribers.add(currentContext.run);
        currentContext.deps.add(subscribers);
      }
      return value;
    },
    set(): void {
      throw new Error('Cannot assign to a derived value; reassign one of its dependencies instead');
    },
  };
}

export function watch(readDeps: () => void, fn: EffectFn): Dispose {
  let isFirstRun = true;
  return effect(() => {
    readDeps();
    if (isFirstRun) {
      isFirstRun = false;
      return;
    }
    fn();
  });
}

export function ifBlock(
  test: () => boolean,
  renderTrue: () => Node,
  renderFalse?: () => Node
): HTMLElement {
  const container = document.createElement('span');
  container.style.display = 'contents';
  let disposeCurrent: Dispose | null = null;

  const disposeEffect = effect(() => {
    if (disposeCurrent) {
      disposeCurrent();
      disposeCurrent = null;
    }
    container.innerHTML = '';
    const [node, disposeAll] = withDisposalScope(() => (test() ? renderTrue() : renderFalse ? renderFalse() : null));
    disposeCurrent = disposeAll;
    if (node) container.appendChild(node);
  });

  registerDisposal(() => {
    disposeEffect();
    if (disposeCurrent) disposeCurrent();
  });

  return container;
}

interface ForEachEntry<T> {
  key: unknown;
  item: T;
  node: Node;
  dispose: Dispose;
}

export function forEach<T>(
  items: () => T[],
  renderItem: (item: T) => Node,
  keyFn?: (item: T) => unknown
): HTMLElement {
  const container = document.createElement('span');
  container.style.display = 'contents';
  let entries: ForEachEntry<T>[] = [];

  const disposeEffect = effect(() => {
    const newItems = items();

    if (!keyFn) {
      for (const entry of entries) entry.dispose();
      container.innerHTML = '';
      entries = [];
      for (const item of newItems) {
        const [node, dispose] = withDisposalScope(() => renderItem(item));
        entries.push({ key: undefined, item, node, dispose });
        container.appendChild(node);
      }
      return;
    }

    const oldByKey = new Map<unknown, ForEachEntry<T>>();
    for (const entry of entries) oldByKey.set(entry.key, entry);

    const newEntries: ForEachEntry<T>[] = newItems.map((item) => {
      const key = keyFn(item);
      const existing = oldByKey.get(key);
      if (existing && existing.item === item) return existing;
      const [node, dispose] = withDisposalScope(() => renderItem(item));
      return { key, item, node, dispose };
    });

    const reusedNodes = new Set(newEntries.map((e) => e.node));
    for (const entry of entries) {
      if (!reusedNodes.has(entry.node)) {
        entry.node.parentNode?.removeChild(entry.node);
        entry.dispose();
      }
    }

    let cursor: ChildNode | null = container.firstChild;
    for (const entry of newEntries) {
      if (cursor === entry.node) {
        cursor = cursor.nextSibling;
      } else {
        container.insertBefore(entry.node, cursor);
      }
    }

    entries = newEntries;
  });

  registerDisposal(() => {
    disposeEffect();
    for (const entry of entries) entry.dispose();
  });

  return container;
}

export function slot(children: Child[]): HTMLElement {
  const container = document.createElement('span');
  container.style.display = 'contents';
  appendChildren(container, children);
  return container;
}

export function fragment(...children: Child[]): HTMLElement {
  const container = document.createElement('span');
  container.style.display = 'contents';
  appendChildren(container, children);
  return container;
}

export function mount(root: Element, componentFn: () => Node): void {
  root.appendChild(componentFn());
}

const injectedStyleIds = new Set<string>();

export function injectStyle(css: string, styleId: string): void {
  if (injectedStyleIds.has(styleId)) return;
  injectedStyleIds.add(styleId);
  const styleEl = document.createElement('style');
  styleEl.setAttribute('data-crs-style', styleId);
  styleEl.textContent = css;
  document.head.appendChild(styleEl);
}
