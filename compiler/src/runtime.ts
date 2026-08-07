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

export function mount(root: Element, componentFn: () => Node): void {
  root.appendChild(componentFn());
}
