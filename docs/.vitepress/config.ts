import { defineConfig } from 'vitepress';

export default defineConfig({
  title: 'Immich Frame Controller',
  description:
    'Control Immich-powered digital photo frames from Home Assistant while immich-kiosk keeps rendering the photos',

  cleanUrls: true,
  lastUpdated: true,

  srcExclude: ['internal/**'],

  head: [['meta', { name: 'theme-color', content: '#0284c7' }]],

  themeConfig: {
    socialLinks: [
      { icon: 'github', link: 'https://github.com/hyungyunlim/immich-ha-sa' },
    ],

    search: {
      provider: 'local',
      options: {
        detailedView: true,
      },
    },

    footer: {
      copyright: 'Copyright © 2026-present Hyungyun Lim',
    },
  },

  locales: {
    root: {
      label: 'English',
      lang: 'en',
      link: '/en/',
      themeConfig: {
        nav: [{ text: 'Guide', link: '/en/guide/', activeMatch: '/en/guide/' }],

        sidebar: {
          '/en/guide/': [
            {
              text: 'Introduction',
              collapsed: false,
              items: [
                { text: 'What is Immich Frame Controller?', link: '/en/guide/' },
                { text: 'Getting Started', link: '/en/guide/getting-started' },
              ],
            },
            {
              text: 'Installation',
              collapsed: false,
              items: [
                { text: 'Add-on (Home Assistant OS)', link: '/en/guide/addon-install' },
                { text: 'Integration (HACS)', link: '/en/guide/integration-install' },
                { text: 'Standalone Docker', link: '/en/guide/standalone-docker' },
              ],
            },
            {
              text: 'Setup',
              collapsed: false,
              items: [
                { text: 'Pairing', link: '/en/guide/pairing' },
                { text: 'Controller Console', link: '/en/guide/controller-setup' },
                { text: 'FreeKiosk Remote Control', link: '/en/guide/freekiosk' },
              ],
            },
            {
              text: 'Guides',
              collapsed: false,
              items: [
                { text: 'Entities & Services', link: '/en/guide/automations' },
                { text: 'Remote Frames (Tunnel)', link: '/en/guide/remote-frames' },
                { text: 'Troubleshooting', link: '/en/guide/troubleshooting' },
              ],
            },
          ],
        },

        outline: {
          level: [2, 3],
          label: 'On this page',
        },
      },
    },

    ko: {
      label: '한국어',
      lang: 'ko',
      link: '/ko/',
      themeConfig: {
        nav: [{ text: '가이드', link: '/ko/guide/', activeMatch: '/ko/guide/' }],

        sidebar: {
          '/ko/guide/': [
            {
              text: '소개',
              collapsed: false,
              items: [
                { text: 'Immich Frame Controller란?', link: '/ko/guide/' },
                { text: '시작하기', link: '/ko/guide/getting-started' },
              ],
            },
            {
              text: '설치',
              collapsed: false,
              items: [
                { text: '애드온 (Home Assistant OS)', link: '/ko/guide/addon-install' },
                { text: '통합 (HACS)', link: '/ko/guide/integration-install' },
                { text: '독립 Docker', link: '/ko/guide/standalone-docker' },
              ],
            },
            {
              text: '설정',
              collapsed: false,
              items: [
                { text: '페어링', link: '/ko/guide/pairing' },
                { text: '컨트롤러 콘솔', link: '/ko/guide/controller-setup' },
                { text: 'FreeKiosk 원격 제어', link: '/ko/guide/freekiosk' },
              ],
            },
            {
              text: '가이드',
              collapsed: false,
              items: [
                { text: '엔티티와 서비스', link: '/ko/guide/automations' },
                { text: '원격 프레임 (터널)', link: '/ko/guide/remote-frames' },
                { text: '문제 해결', link: '/ko/guide/troubleshooting' },
              ],
            },
          ],
        },

        outline: {
          level: [2, 3],
          label: '이 페이지에서',
        },

        docFooter: {
          prev: '이전',
          next: '다음',
        },

        lastUpdatedText: '마지막 업데이트',
        returnToTopLabel: '맨 위로',
        sidebarMenuLabel: '메뉴',
        darkModeSwitchLabel: '다크 모드',
      },
    },
  },
});
