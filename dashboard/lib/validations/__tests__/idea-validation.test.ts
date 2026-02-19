import { createIdeaSchema, paginationSchema } from '../idea-validation';

describe('paginationSchema', () => {
  it('returns defaults for missing values', () => {
    const result = paginationSchema.parse({});
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(10);
  });

  it('clamps page to minimum of 1', () => {
    const result = paginationSchema.parse({ page: 0 });
    expect(result.page).toBe(1);
  });

  it('clamps page to minimum of 1 for negative values', () => {
    const result = paginationSchema.parse({ page: -5 });
    expect(result.page).toBe(1);
  });

  it('clamps pageSize to minimum of 1', () => {
    const result = paginationSchema.parse({ pageSize: 0 });
    expect(result.pageSize).toBe(1);
  });

  it('clamps pageSize to maximum of 50', () => {
    const result = paginationSchema.parse({ pageSize: 100 });
    expect(result.pageSize).toBe(50);
  });

  it('accepts valid page and pageSize', () => {
    const result = paginationSchema.parse({ page: 3, pageSize: 25 });
    expect(result.page).toBe(3);
    expect(result.pageSize).toBe(25);
  });

  it('coerces string page to number', () => {
    const result = paginationSchema.parse({ page: '3', pageSize: '25' });
    expect(result.page).toBe(3);
    expect(result.pageSize).toBe(25);
  });
});

describe('createIdeaSchema', () => {
  const validIdea = {
    title: 'Test Idea',
    description: 'A description of the test idea',
    industry: 'technology',
    targetMarket: 'enterprise',
  };

  it('accepts a valid idea with required fields only', () => {
    const result = createIdeaSchema.safeParse(validIdea);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.title).toBe('Test Idea');
      expect(result.data.description).toBe('A description of the test idea');
      expect(result.data.industry).toBe('technology');
      expect(result.data.targetMarket).toBe('enterprise');
    }
  });

  it('accepts a valid idea with optional technologies', () => {
    const result = createIdeaSchema.safeParse({
      ...validIdea,
      technologies: ['React', 'Node.js'],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.technologies).toEqual(['React', 'Node.js']);
    }
  });

  it('accepts a valid idea with optional features', () => {
    const result = createIdeaSchema.safeParse({
      ...validIdea,
      features: [
        { name: 'Feature 1', description: 'Desc', priority: 'high' },
        { name: 'Feature 2' },
      ],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.features).toHaveLength(2);
    }
  });

  it('rejects an idea with empty title', () => {
    const result = createIdeaSchema.safeParse({ ...validIdea, title: '' });
    expect(result.success).toBe(false);
  });

  it('rejects an idea with title exceeding 200 characters', () => {
    const result = createIdeaSchema.safeParse({
      ...validIdea,
      title: 'a'.repeat(201),
    });
    expect(result.success).toBe(false);
  });

  it('rejects an idea with empty description', () => {
    const result = createIdeaSchema.safeParse({
      ...validIdea,
      description: '',
    });
    expect(result.success).toBe(false);
  });

  it('rejects an idea with description exceeding 5000 characters', () => {
    const result = createIdeaSchema.safeParse({
      ...validIdea,
      description: 'a'.repeat(5001),
    });
    expect(result.success).toBe(false);
  });

  it('rejects an idea with missing required fields', () => {
    const result = createIdeaSchema.safeParse({ title: 'Only Title' });
    expect(result.success).toBe(false);
  });

  it('rejects technologies array exceeding 20 items', () => {
    const result = createIdeaSchema.safeParse({
      ...validIdea,
      technologies: Array.from({ length: 21 }, (_, i) => `tech-${i}`),
    });
    expect(result.success).toBe(false);
  });

  it('rejects a technology string exceeding 50 characters', () => {
    const result = createIdeaSchema.safeParse({
      ...validIdea,
      technologies: ['a'.repeat(51)],
    });
    expect(result.success).toBe(false);
  });

  it('rejects features array exceeding 50 items', () => {
    const result = createIdeaSchema.safeParse({
      ...validIdea,
      features: Array.from({ length: 51 }, (_, i) => ({
        name: `Feature ${i}`,
      })),
    });
    expect(result.success).toBe(false);
  });

  it('rejects a feature with invalid priority', () => {
    const result = createIdeaSchema.safeParse({
      ...validIdea,
      features: [{ name: 'Feature', priority: 'critical' }],
    });
    expect(result.success).toBe(false);
  });

  it('accepts features with valid priority values', () => {
    for (const priority of ['high', 'medium', 'low']) {
      const result = createIdeaSchema.safeParse({
        ...validIdea,
        features: [{ name: 'Feature', priority }],
      });
      expect(result.success).toBe(true);
    }
  });

  it('rejects a feature with empty name', () => {
    const result = createIdeaSchema.safeParse({
      ...validIdea,
      features: [{ name: '' }],
    });
    expect(result.success).toBe(false);
  });

  it('rejects a feature with name exceeding 200 characters', () => {
    const result = createIdeaSchema.safeParse({
      ...validIdea,
      features: [{ name: 'a'.repeat(201) }],
    });
    expect(result.success).toBe(false);
  });

  it('rejects a feature with description exceeding 1000 characters', () => {
    const result = createIdeaSchema.safeParse({
      ...validIdea,
      features: [{ name: 'Feature', description: 'a'.repeat(1001) }],
    });
    expect(result.success).toBe(false);
  });

  it('provides flattened error details on failure', () => {
    const result = createIdeaSchema.safeParse({});
    expect(result.success).toBe(false);
    if (!result.success) {
      const flattened = result.error.flatten();
      expect(flattened.fieldErrors).toBeDefined();
      expect(flattened.fieldErrors.title).toBeDefined();
      expect(flattened.fieldErrors.description).toBeDefined();
    }
  });
});
