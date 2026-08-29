export interface Signal<T> {
  get(): T;
  set(value: T): void;
}

type EffectFn = () => void;

let currentEffect: EffectFn | null = null;

export function state<T>(initial: T): Signal<T> {
  let value = initial;
  const subscribers = new Set<EffectFn>();
  return {
    get(): T {
      if (currentEffect) subscribers.add(currentEffect);
      return value;
    },
    set(next: T): void {
      value = next;
      for (const fn of Array.from(subscribers)) fn();
    },
  };
}

export function effect(fn: EffectFn): void {
  const wrapped: EffectFn = () => {
    const prev = currentEffect;
    currentEffect = wrapped;
    try {
      fn();
    } finally {
      currentEffect = prev;
    }
  };
  wrapped();
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
  const markDirty: EffectFn = () => {
    if (!dirty) {
      dirty = true;
      for (const fn of Array.from(subscribers)) fn();
    }
  };
  return {
    get(): T {
      if (dirty) {
        const prevEffect = currentEffect;
        currentEffect = markDirty;
        try {
          value = compute();
        } finally {
          currentEffect = prevEffect;
        }
        dirty = false;
      }
      if (currentEffect) subscribers.add(currentEffect);
      return value;
    },
    set(): void {
      throw new Error('Cannot assign to a derived value; reassign one of its dependencies instead');
    },
  };
}

export function watch(readDeps: () => void, fn: EffectFn): void {
  let isFirstRun = true;
  effect(() => {
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
  effect(() => {
    container.innerHTML = '';
    const node = test() ? renderTrue() : renderFalse ? renderFalse() : null;
    if (node) container.appendChild(node);
  });
  return container;
}

interface ForEachEntry<T> {
  key: unknown;
  item: T;
  node: Node;
}

export function forEach<T>(
  items: () => T[],
  renderItem: (item: T) => Node,
  keyFn?: (item: T) => unknown
): HTMLElement {
  const container = document.createElement('span');
  container.style.display = 'contents';
  let entries: ForEachEntry<T>[] = [];

  effect(() => {
    const newItems = items();

    if (!keyFn) {
      container.innerHTML = '';
      entries = [];
      for (const item of newItems) {
        const node = renderItem(item);
        entries.push({ key: undefined, item, node });
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
      return { key, item, node: renderItem(item) };
    });

    const reusedNodes = new Set(newEntries.map((e) => e.node));
    for (const entry of entries) {
      if (!reusedNodes.has(entry.node)) {
        entry.node.parentNode?.removeChild(entry.node);
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

  return container;
}

export function slot(children: Child[]): HTMLElement {
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
