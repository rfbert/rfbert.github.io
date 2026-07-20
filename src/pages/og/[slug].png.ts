import type { APIRoute, GetStaticPaths } from 'astro';
import { renderOg } from '../../lib/og';

const PAGES: Record<string, string> = {
  home: 'Portfolio',
  research: 'Research',
  projects: 'Projects',
  experience: 'Experience',
  about: 'About',
};

export const getStaticPaths: GetStaticPaths = () =>
  Object.keys(PAGES).map((slug) => ({ params: { slug } }));

export const GET: APIRoute = async ({ params }) => {
  const label = PAGES[params.slug as string] ?? 'Portfolio';
  const png = await renderOg(label);
  return new Response(new Uint8Array(png), {
    headers: { 'Content-Type': 'image/png' },
  });
};
