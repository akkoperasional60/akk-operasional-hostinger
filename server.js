import 'tsx';

import('./server.ts').catch((error) => {
  console.error('Gagal menjalankan server.ts:', error);
  process.exit(1);
});
