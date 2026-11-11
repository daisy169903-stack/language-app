import { defineConfig } from "vite";
import { assertPublicAssets } from "./scripts/public-assets";

export default defineConfig({
  plugins: [
    {
      name: "private-audio-guard",
      buildStart() {
        assertPublicAssets(process.cwd());
      },
      resolveId(source) {
        if (/(^|[\\/])private-audio[\\/]/.test(source))
          throw new Error(
            "Privát hangforrás nem importálható az alkalmazás buildjébe.",
          );
        return null;
      },
    },
  ],
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
    watch: {
      // Downloads can be briefly locked by Edge on Windows. They are not source.
      ignored: ["**/qa/**", "**/.pnpm-store/**", "**/private-audio/**"],
    },
  },
});
