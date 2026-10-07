import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.shaikibrahim.locat",
  appName: "Locat",
  webDir: "dist/public",
  server: {
    androidScheme: "https",
  },
};

export default config;
