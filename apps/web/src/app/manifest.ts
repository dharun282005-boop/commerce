import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Chennai Universal Commerce',
    short_name: 'Chennai Compare',
    description: 'Compare total prices across apps in Chennai.',
    start_url: '/en',
    display: 'standalone',
    background_color: '#f6f6f4',
    theme_color: '#1c5cab',
    icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
  };
}
