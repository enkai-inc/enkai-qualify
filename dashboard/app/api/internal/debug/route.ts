import { NextRequest, NextResponse } from 'next/server';
import { requireInternalAuth } from '@/lib/internal-auth';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    requireInternalAuth(request);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const users = await prisma.$queryRaw`
    SELECT u.id, u."cognitoId", u.email, u."createdAt"::text,
           (SELECT COUNT(*)::int FROM "Idea" i WHERE i."userId" = u.id) as idea_count
    FROM "User" u ORDER BY u."createdAt"
  ` as any[];

  const ideas = await prisma.$queryRaw`
    SELECT i.id, i.title, i."userId", i.status, i."createdAt"::text
    FROM "Idea" i ORDER BY i."createdAt"
  ` as any[];

  return NextResponse.json({ users, ideas });
}
