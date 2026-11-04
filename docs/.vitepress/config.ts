import { defineConfig } from "vitepress";

export default defineConfig({
  title: "Wiremint",
  description: "TypeScript-first API mocking and network simulation toolkit. Build without waiting for your backend.",
  lastUpdated: true,
  cleanUrls: true,

  themeConfig: {
    siteTitle: "Wiremint",
    logo: "/logo.svg",

    nav: [
      { text: "Getting Started", link: "/getting-started/quick-start" },
      { text: "Guides", link: "/guides/routing" },
      { text: "CLI", link: "/cli/overview" },
      { text: "Testing", link: "/guides/testing" },
      { text: "API", link: "/api/sdk" },
      { text: "Examples", link: "/examples/" },
      {
        text: "v0.1.0",
        items: [
          { text: "Changelog", link: "https://github.com/NareshBaruaIsHere/wiremint/blob/main/CHANGELOG.md" },
          { text: "Contributing", link: "https://github.com/NareshBaruaIsHere/wiremint/blob/main/CONTRIBUTING.md" },
          { text: "Security", link: "/security" },
        ],
      },
    ],

    sidebar: [
      {
        text: "Getting Started",
        items: [
          { text: "Installation", link: "/getting-started/installation" },
          { text: "Quick Start", link: "/getting-started/quick-start" },
          { text: "Your First Mock API", link: "/getting-started/first-mock-api" },
        ],
      },
      {
        text: "Guides",
        items: [
          { text: "Routing Engine", link: "/guides/routing" },
          { text: "Network Simulation", link: "/guides/network-simulation" },
          { text: "Scenario Engine", link: "/guides/scenarios" },
          { text: "Stateful Mocking", link: "/guides/stateful-mocking" },
          { text: "Middleware Pipeline", link: "/guides/middleware" },
          { text: "Request Inspector", link: "/guides/request-inspector" },
          { text: "Configuration Files", link: "/guides/configuration" },
          { text: "Testing Toolkit", link: "/guides/testing" },
        ],
      },
      {
        text: "Developer CLI",
        items: [
          { text: "Overview", link: "/cli/overview" },
          { text: "Commands", link: "/cli/commands" },
          { text: "Local Control Plane", link: "/cli/control-plane" },
        ],
      },
      {
        text: "API Reference",
        items: [
          { text: "Core SDK (`wiremint`)", link: "/api/sdk" },
          { text: "Config Engine (`wiremint/config`)", link: "/api/config" },
          { text: "Testing Toolkit (`wiremint/testing`)", link: "/api/testing" },
        ],
      },
      {
        text: "Resources",
        items: [
          { text: "Runnable Examples", link: "/examples/" },
          { text: "Security Policy", link: "/security" },
          { text: "Troubleshooting", link: "/troubleshooting" },
          { text: "FAQ", link: "/faq" },
        ],
      },
    ],

    socialLinks: [
      { icon: "github", link: "https://github.com/NareshBaruaIsHere/wiremint" },
    ],

    footer: {
      message: "Released under the MIT License.",
      copyright: "Copyright © 2026 Wiremint Maintainers",
    },

    search: {
      provider: "local",
    },
  },
});

