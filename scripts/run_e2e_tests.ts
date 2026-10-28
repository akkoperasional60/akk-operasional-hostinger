/**
 * PT ANUGRAH KEMASAN KREATIF (AKK) - CLI E2E TEST RUNNER
 * Dapat dijalankan via terminal atau GitHub Actions CI:
 * npx tsx scripts/run_e2e_tests.ts
 */

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
