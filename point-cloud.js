import { initApp } from './src/app.js';

initApp().catch((error) => {
  console.error('Failed to initialize Chromaticity Clouds', error);
});
