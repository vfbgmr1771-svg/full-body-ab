import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.fullbodyab.tracker',
  appName: 'Full Body A/B',
  webDir: 'dist',
  android: {
    backgroundColor: '#f6f5fb',
  },
  plugins: {
    LocalNotifications: {
      smallIcon: 'ic_stat_rest',
      iconColor: '#343aa3',
    },
  },
};

export default config;
