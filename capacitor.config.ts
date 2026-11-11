import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'hu.vietlingo.app',
  appName: 'VietLingo HU',
  webDir: 'dist',
  android: {
    backgroundColor: '#102237',
    allowMixedContent: false,
  },
  plugins: {
    SystemBars: { insetsHandling: 'css', style: 'DARK' },
  },
};

export default config;
