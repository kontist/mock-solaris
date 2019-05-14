import { serve } from './app';

const PORT = 2091;

process.on('uncaughtException', (err) => {
  console.error('Uncaught exception occurred. Mock server will stop', err);
  setTimeout(() => process.exit(1), 500);
});

serve(PORT);
