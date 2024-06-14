import starlight from "@astrojs/starlight";
import { defineConfig } from "astro/config";
import starlightImageZoom from "starlight-image-zoom";

// https://astro.build/config
export default defineConfig({
  site: "https://hear.thucydides.net",
  integrations: [
    starlight({
      favicon: "/favicon.ico",
      head:[
        {
          // https://clarity.microsoft.com/projects/view/mrq0ce2b1x/gettingstarted
          tag:"script",
          content:'(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})(window, document, "clarity", "script", "mrq0ce2b1x");'
        }
      ],
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
            "zh-CN": "手册",
          },
          items: [
            {
              label: "Quick Start",
              translations: {
                "zh-CN": "产品",
              },
              link: "/guides/quickstart/",
            },
            {
              label: "Pricing",
              translations: {
                "zh-CN": "定价",
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
            "zh-CN": "用途",
          },
          autogenerate: { directory: "userstories" },
        },
        {
          label: "Reference",
          translations: {
            "zh-CN": "资讯",
          },
          autogenerate: { directory: "reference" },
        },
      ],
    }),
  ],
});
