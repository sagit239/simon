import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config';

// Run with `npm run icons`; the generated PNGs are committed to public/.
export default defineConfig({
  preset: {
    ...minimal2023Preset,
    maskable: {
      ...minimal2023Preset.maskable,
      resizeOptions: { background: '#181A1B' },
    },
    apple: {
      ...minimal2023Preset.apple,
      resizeOptions: { background: '#181A1B' },
    },
  },
  images: ['public/icon.svg'],
});
