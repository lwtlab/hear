import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";
import starlightImageZoom from "starlight-image-zoom";

// https://astro.build/config
export default defineConfig({
  integrations: [
    starlight({
      plugins: [starlightImageZoom()],
      title: "AI Hear",
      // Set English as the default language for this site.
      defaultLocale: "root", // optional
      locales: {
        // English docs in `src/content/docs/`
        root: {
          label: "English",
          lang: "en", // lang is required for root locales
        },
        // Simplified Chinese docs in `src/content/docs/zh-cn/`
        "zh-cn": {
          label: "简体中文",
          lang: "zh-CN",
        },
      },
      social: {
        github: "https://github.com/withastro/starlight",
      },
      sidebar: [
        {
          label: "Guides",
          items: [
            // Each item here is one entry in the navigation menu.
            { label: "Example Guide", link: "/guides/example/" },
          ],
        },
        {
          label: "User Stories",
          autogenerate: { directory: "userstories" },
        },
        {
          label: "Reference",
          autogenerate: { directory: "reference" },
        },
      ],
    }),
  ],
});
