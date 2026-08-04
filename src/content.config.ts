import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

// A quick-scan spec strip (Problem / Built / Result) shown above the prose on
// the secondary pages. Optional so an entry can omit it. Stack comes from the
// existing `stack` field, so it is not duplicated here.
const summary = z
  .object({
    problem: z.string(),
    built: z.string(),
    result: z.string(),
  })
  .optional();

const projects = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/projects' }),
  schema: z.object({
    title: z.string(),
    tagline: z.string(),
    role: z.string(),
    start: z.coerce.date(),
    end: z.coerce.date().optional(),
    stack: z.array(z.string()),
    status: z.enum(['active', 'shipped', 'archived']),
    repo: z.string().url().optional(),
    repoNote: z.string().optional(),
    featured: z.boolean().default(false),
    summary,
    order: z.number().default(99),
  }),
});

const research = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/research' }),
  schema: z.object({
    title: z.string(),
    lab: z.string(),
    role: z.string(),
    start: z.coerce.date(),
    end: z.coerce.date().optional(),
    status: z.enum(['under-review', 'in-preparation', 'ongoing']),
    statusLabel: z.string(),
    area: z.string(),
    summary,
    order: z.number().default(99),
  }),
});

const experience = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/experience' }),
  schema: z.object({
    organization: z.string(),
    parent: z.string().optional(),
    role: z.string(),
    location: z.string(),
    start: z.coerce.date(),
    end: z.coerce.date().optional(),
    stack: z.array(z.string()).default([]),
    summary,
    order: z.number().default(99),
  }),
});

export const collections = { projects, research, experience };
