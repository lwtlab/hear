import starlight from "@astrojs/starlight";
import { defineConfig } from "astro/config";
import starlightImageZoom from "starlight-image-zoom";

// https://astro.build/config
export default defineConfig({
  site: "https://hear.thucydides.net",
  integrations: [
    starlight({
      favicon: "/favicon.ico",
      plugins: [starlightImageZoom()],
      components: {
        Header: "./src/components/LwtHeader.astro",
      },
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
        email: "mailto:help@thucydides.net",
        // github: "https://github.com/withastro/starlight",
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
            {
              label: "Pricing",
              translations: {
                "zh-CN": "价格",
              },
              link: "/guides/pricing/",
            },
            {
              label: "Download",
              translations: {
                "zh-CN": "下载",
              },
              link: "/guides/download/",
            },
            {
              label: "Feedback",
              translations: {
                "zh-CN": "反馈",
              },
              link: "/guides/feedback/",
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
          translations: {
            "zh-CN": "参考",
          },
          autogenerate: { directory: "reference" },
        },
      ],
    }),
  ],
});
