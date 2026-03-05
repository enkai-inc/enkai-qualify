import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireInternalAuth } from '@/lib/internal-auth';
import { createIdeaSchema } from '@/lib/validations/idea-validation';
import { createIdea } from '@/lib/services/idea-service';
import { v4 as uuidv4 } from 'uuid';

const internalCreateIdeaSchema = createIdeaSchema.extend({
  email: z.string().email(),
});

/**
 * Find or create a user by email for internal idea creation.
 * Uses a synthetic cognitoId (prefixed with "internal-") since there's no Cognito context.
 */
async function findOrCreateUser(email: string) {
  let user = await prisma.user.findUnique({
    where: { email },
  });

  if (user) return user;

  try {
    user = await prisma.user.create({
      data: {
        cognitoId: `internal-${uuidv4()}`,
        email,
        name: email.split('@')[0],
        subscription: {
          create: {
            tier: 'FREE',
            periodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          },
        },
      },
    });
    return user;
  } catch (error) {
    // Handle race condition
    if (
      error instanceof Error &&
      'code' in error &&
      (error as any).code === 'P2002'
    ) {
      return await prisma.user.findUnique({ where: { email } });
    }
    throw error;
  }
}

export async function POST(request: NextRequest) {
  try {
    requireInternalAuth(request);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = internalCreateIdeaSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const user = await findOrCreateUser(parsed.data.email);
    if (!user) {
      return NextResponse.json(
        { error: 'Failed to resolve user' },
        { status: 500 }
      );
    }

    const features = (parsed.data.features ?? []).map((f) => ({
      id: uuidv4(),
      name: f.name,
      description: f.description ?? '',
      priority: f.priority ?? ('medium' as const),
    }));

    const idea = await createIdea({
      userId: user.id,
      title: parsed.data.title,
      description: parsed.data.description,
      industry: parsed.data.industry,
      targetMarket: parsed.data.targetMarket,
      technologies: parsed.data.technologies ?? [],
      features,
    });

    return NextResponse.json(idea, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request body', details: error.issues },
        { status: 400 }
      );
    }
    console.error('Error creating idea via internal API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
