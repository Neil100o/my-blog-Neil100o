import { defineCollection, z } from 'astro:content';

const blog = defineCollection({
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    heroImage: z.string().optional(),
    hidden: z.boolean().optional(),  // ← 关键：声明 hidden 字段
    tags: z.array(z.string()).optional(),
  }),
});

export const collections = { blog };