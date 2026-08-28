import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { resolve } from 'path'
import { writeFileSync } from 'fs'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const rootEnv = loadEnv(mode, resolve(__dirname, '..'), '');
  const appEnv = loadEnv(mode, process.cwd(), '');
  // 合并 process.env，确保 Vercel 注入的环境变量能够被打包工具读取
  const env = { ...rootEnv, ...appEnv, ...process.env };

  const finalApiKey = env.API_KEY || process.env.API_KEY || '';
  const finalBaseUrl = env.BASE_URL || process.env.BASE_URL || 'https://generativelanguage.googleapis.com/v1beta/openai/';
  const finalModel = env.MODEL || process.env.MODEL || 'gemini-2.5-flash';

  return {
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.svg', 'icons.svg'],
        manifest: {
          name: '小卦摊',
          short_name: '小卦摊',
          description: '周易六爻、梅花易数与紫微斗数排盘占卜工具',
          theme_color: '#F8F4ED',
          background_color: '#F8F4ED',
          display: 'standalone',
          orientation: 'portrait-primary',
          icons: [
            {
              src: 'pwa-192.png',
              sizes: '192x192',
              type: 'image/png'
            },
            {
              src: 'pwa-512.png',
              sizes: '512x512',
              type: 'image/png'
            },
            {
              src: 'pwa-maskable-192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'maskable'
            },
            {
              src: 'pwa-maskable-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable'
            }
          ]
        }
      }),
      {
        name: 'html-env-replacement',
        transformIndexHtml(html) {
          return html
            .replace(/%VITE_REDIRECT_DOMAIN%/g, env.VITE_REDIRECT_DOMAIN || '')
            .replace(/%VITE_GA_ID%/g, env.VITE_GA_ID || '')
            .replace(/%VITE_CLARITY_ID%/g, env.VITE_CLARITY_ID || '');
        }
      },
      {
        name: 'generate-seo-files',
        closeBundle() {
          const siteUrl = (env.VITE_SITE_URL || 'https://xgt.algieba12.cn').replace(/\/$/, '');
          const distDir = resolve(__dirname, 'dist');
          
          // Generate robots.txt
          const robotsTxt = `User-agent: *\nAllow: /\n\nSitemap: ${siteUrl}/sitemap.xml\n`;
          try {
            writeFileSync(resolve(distDir, 'robots.txt'), robotsTxt, 'utf-8');
            console.log('✓ robots.txt generated successfully.');
          } catch (e) {
            console.error('Failed to write robots.txt:', e);
          }

          // Generate sitemap.xml
          const today = new Date().toISOString().split('T')[0];
          const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${siteUrl}/</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>${siteUrl}/liuyao</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>${siteUrl}/meihua</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>${siteUrl}/ziwei</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>${siteUrl}/shaker</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>${siteUrl}/history</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.5</priority>
  </url>
</urlset>
`;
          try {
            writeFileSync(resolve(distDir, 'sitemap.xml'), sitemapXml, 'utf-8');
            console.log('✓ sitemap.xml generated successfully.');
          } catch (e) {
            console.error('Failed to write sitemap.xml:', e);
          }
        }
      }
    ],
    define: {
      'process.env.API_KEY': JSON.stringify(finalApiKey),
      'process.env.BASE_URL': JSON.stringify(finalBaseUrl),
      'process.env.MODEL': JSON.stringify(finalModel),
    }
  }
})
