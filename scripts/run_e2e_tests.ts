// Node.js DOM & Browser Environment Polyfills for CLI / GitHub Actions CI Test Runner
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
  location: { hostname: 'localhost', href: 'http://localhost' },
  addEventListener: () => {},
  removeEventListener: () => {},
  dispatchEvent: () => true,
  requestAnimationFrame: (cb: any) => setTimeout(cb, 16),
  cancelAnimationFrame: (id: any) => clearTimeout(id),
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
  navigator: { userAgent: 'Node.js Test Runner', onLine: true },
  localStorage: {
    _store: {} as Record<string, string>,
    getItem(k: string) { return this._store[k] || null; },
    setItem(k: string, v: string) { this._store[k] = String(v); },
    removeItem(k: string) { delete this._store[k]; },
    clear() { this._store = {}; }
  }
};

(globalThis as any).window = win;
(globalThis as any).document = win.document;
(globalThis as any).navigator = win.navigator;
(globalThis as any).localStorage = win.localStorage;

(global as any).window = win;
(global as any).document = win.document;
(global as any).navigator = win.navigator;
(global as any).localStorage = win.localStorage;

import { E2ETestRunner } from '../src/services/e2eTestRunner';

async function main() {
  console.log('================================================================');
  console.log('🚀 PT ANUGRAH KEMASAN KREATIF - AUTOMATED E2E WORKFLOW TEST RUNNER');
  console.log('================================================================');
  console.log('Menguji akun Super Admin, SPV Logistik, Driver, Helper, & Security...');
  console.log('');

  const summary = await E2ETestRunner.runAllTests((percent, title) => {
    process.stdout.write(`\r[${percent}%] ${title}...`);
  });

  console.log('\n\n----------------------------------------------------------------');
  console.log(`HASIL AKHIR PENGUJIAN: ${summary.passed}/${summary.total} Lolos (${summary.successRate}%)`);
  console.log(`DURASI: ${summary.durationMs} ms`);
  console.log('----------------------------------------------------------------\n');

  summary.results.forEach((r, idx) => {
    const icon = r.status === 'passed' ? '✅' : '❌';
    console.log(`${icon} [${idx + 1}] ${r.title} (${r.targetAccountRole}) - ${r.durationMs}ms`);
    r.assertions.forEach(a => {
      const aIcon = a.passed ? '  ✓' : '  ✗';
      console.log(`   ${aIcon} ${a.description}`);
      if (!a.passed && a.error) {
        console.log(`     Error: ${a.error}`);
      }
    });
    console.log('');
  });

  if (summary.failed > 0) {
    console.error(`❌ Terdeteksi ${summary.failed} skenario uji E2E yang gagal!`);
    process.exit(1);
  } else {
    console.log('🎉 Seluruh skenario pengujian E2E & sanitasi keamanan dinyatakan LOLOS (PASSED).');
    process.exit(0);
  }
}

main().catch(err => {
  console.error('Fatal Test Runner Error:', err);
  process.exit(1);
});
