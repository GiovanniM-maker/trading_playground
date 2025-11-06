import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { NextResponse } from 'next/server';

export async function getCurrentUser() {
  const session = await getServerSession(authOptions);
  return session?.user || null;
}

export async function requireAdmin() {
  const user = await getCurrentUser();
  
  if (!user) {
    return {
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
      user: null,
    };
  }
  
  if (user.role !== 'admin') {
    return {
      error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
      user: null,
    };
  }
  
  return {
    error: null,
    user,
  };
}

