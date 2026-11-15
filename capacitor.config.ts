import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.flow.surfgame',
  appName: 'FLOW',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
  android: {
    allowMixedContent: false,
    backgroundColor: '#071726',
    webContentsDebuggingEnabled: false,
  },
};

export default config;
