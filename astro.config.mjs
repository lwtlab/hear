import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";
import starlightImageZoom from "starlight-image-zoom";

// https://astro.build/config
export default defineConfig({
  integrations: [
    starlight({
      site: "https://lwtlab.github.io",
      base: "hear",
      plugins: [starlightImageZoom()],
      //   components: {
      //     Header: './src/components/Header.astro',
      //   },
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
          translations: {
            "zh-CN": "教程",
          },
          items: [
            {
              label: "Quick Start",
              translations: {
                "zh-CN": "快速开始",
              },
              link: "/guides/quickstart/",
            },
          ],
        },
        {
          label: "User Stories",
          translations: {
            "zh-CN": "用户故事",
          },
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
