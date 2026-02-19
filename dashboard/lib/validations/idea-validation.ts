import { z } from 'zod';

export const paginationSchema = z.object({
  page: z.coerce
    .number()
    .default(1)
    .transform((v) => Math.max(1, v)),
  pageSize: z.coerce
    .number()
    .default(10)
    .transform((v) => Math.max(1, Math.min(v, 50))),
});

export const createIdeaSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(5000),
  industry: z.string().min(1).max(100),
  targetMarket: z.string().min(1).max(100),
  technologies: z.array(z.string().max(50)).max(20).optional(),
  features: z
    .array(
      z.object({
        name: z.string().min(1).max(200),
        description: z.string().max(1000).optional(),
        priority: z.enum(['high', 'medium', 'low']).optional(),
      })
    )
    .max(50)
    .optional(),
});

export type CreateIdeaInput = z.infer<typeof createIdeaSchema>;
export type PaginationInput = z.infer<typeof paginationSchema>;
