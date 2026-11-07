// Polyfill browser globals before any modules are loaded in Node.js
const dummyElement = {
  appendChild: () => {},
  removeChild: () => {},
  addEventListener: () => {},
  removeEventListener: () => {},
  setAttribute: () => {},
  getAttribute: () => null,
  style: {},
  classList: { add: () => {}, remove: () => {} }
};

const win = {
  devicePixelRatio: 1,
  screen: { deviceXDPI: 96, logicalXDPI: 96 },
  location: { hostname: 'localhost', href: 'http://localhost' },
  addEventListener: () => {},
  removeEventListener: () => {},
  dispatchEvent: () => true,
  requestAnimationFrame: (cb) => setTimeout(cb, 16),
  cancelAnimationFrame: (id) => clearTimeout(id),
  document: {
    createElement: () => dummyElement,
    getElementById: () => null,
    querySelector: () => null,
    querySelectorAll: () => [],
    body: dummyElement,
    documentElement: dummyElement,
    addEventListener: () => {},
    removeEventListener: () => {}
  },
  navigator: {
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    platform: 'Win32',
    appName: 'Netscape',
    appVersion: '5.0',
    vendor: 'Google Inc.',
    onLine: true
  },
  localStorage: {
    _store: {},
    getItem(k) { return this._store[k] || null; },
    setItem(k, v) { this._store[k] = String(v); },
    removeItem(k) { delete this._store[k]; },
    clear() { this._store = {}; }
  }
};

try {
  (globalThis).window = win;
  (globalThis).document = win.document;
  (globalThis).localStorage = win.localStorage;
  Object.defineProperty(globalThis, 'navigator', { value: win.navigator, writable: true, configurable: true });
} catch {}

try {
  (global).window = win;
  (global).document = win.document;
  (global).localStorage = win.localStorage;
  Object.defineProperty(global, 'navigator', { value: win.navigator, writable: true, configurable: true });
} catch {}
