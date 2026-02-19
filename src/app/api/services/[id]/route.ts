import { NextResponse } from 'next/server';

export async function DELETE() {
  return NextResponse.json(
    { success: false, error: { code: 'FORBIDDEN', message: 'Deleting services is disabled.' } },
    { status: 403 }
  );
}
