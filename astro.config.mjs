// @ts-check

import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import { defineConfig, fontProviders } from 'astro/config';

function rehypeLazyImages() {
	return function addLazyImageAttributes(tree) {
		function visit(node) {
			if (node && node.type === 'element' && node.tagName === 'img') {
				node.properties = {
					...node.properties,
					loading: node.properties?.loading || 'lazy',
					decoding: node.properties?.decoding || 'async',
				};
			}

			if (Array.isArray(node?.children)) node.children.forEach(visit);
		}

		visit(tree);
	};
}

// https://astro.build/config
export default defineConfig({
	site: 'https://blog.moskavis.top/',
	integrations: [
		mdx(),
		sitemap({
			filter: (page) => !new URL(page).pathname.startsWith('/whispers'),
		}),
	],
	markdown: {
		rehypePlugins: [rehypeLazyImages],
	},
	fonts: [
		{
			provider: fontProviders.local(),
			name: 'Atkinson',
			cssVariable: '--font-atkinson',
			fallbacks: ['sans-serif'],
			options: {
				variants: [
					{
						src: ['./src/assets/fonts/atkinson-regular.woff'],
						weight: 400,
						style: 'normal',
						display: 'swap',
					},
					{
						src: ['./src/assets/fonts/atkinson-bold.woff'],
						weight: 700,
						style: 'normal',
						display: 'swap',
					},
				],
			},
		},
	],
});
