import { z } from 'zod';

export const createPackSchema = z.object({
  ideaId: z.string().min(1),
  modules: z.array(z.string()).min(1),
  complexity: z.enum(['MVP', 'STANDARD', 'FULL']),
});

export type CreatePackInput = z.infer<typeof createPackSchema>;
