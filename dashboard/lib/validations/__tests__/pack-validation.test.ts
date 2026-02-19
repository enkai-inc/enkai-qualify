import { createPackSchema } from '../pack-validation';

describe('createPackSchema', () => {
  const validPack = {
    ideaId: 'idea-123',
    modules: ['module-1', 'module-2'],
    complexity: 'MVP',
  };

  it('accepts a valid pack', () => {
    const result = createPackSchema.safeParse(validPack);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.ideaId).toBe('idea-123');
      expect(result.data.modules).toEqual(['module-1', 'module-2']);
      expect(result.data.complexity).toBe('MVP');
    }
  });

  it('accepts STANDARD complexity', () => {
    const result = createPackSchema.safeParse({
      ...validPack,
      complexity: 'STANDARD',
    });
    expect(result.success).toBe(true);
  });

  it('accepts FULL complexity', () => {
    const result = createPackSchema.safeParse({
      ...validPack,
      complexity: 'FULL',
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing ideaId', () => {
    const { ideaId, ...rest } = validPack;
    const result = createPackSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it('rejects empty ideaId', () => {
    const result = createPackSchema.safeParse({ ...validPack, ideaId: '' });
    expect(result.success).toBe(false);
  });

  it('rejects missing modules', () => {
    const { modules, ...rest } = validPack;
    const result = createPackSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it('rejects empty modules array', () => {
    const result = createPackSchema.safeParse({ ...validPack, modules: [] });
    expect(result.success).toBe(false);
  });

  it('rejects missing complexity', () => {
    const { complexity, ...rest } = validPack;
    const result = createPackSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it('rejects invalid complexity value', () => {
    const result = createPackSchema.safeParse({
      ...validPack,
      complexity: 'INVALID',
    });
    expect(result.success).toBe(false);
  });

  it('rejects non-string ideaId', () => {
    const result = createPackSchema.safeParse({ ...validPack, ideaId: 123 });
    expect(result.success).toBe(false);
  });

  it('provides flattened error details on failure', () => {
    const result = createPackSchema.safeParse({});
    expect(result.success).toBe(false);
    if (!result.success) {
      const flattened = result.error.flatten();
      expect(flattened.fieldErrors).toBeDefined();
      expect(flattened.fieldErrors.ideaId).toBeDefined();
      expect(flattened.fieldErrors.modules).toBeDefined();
      expect(flattened.fieldErrors.complexity).toBeDefined();
    }
  });
});
