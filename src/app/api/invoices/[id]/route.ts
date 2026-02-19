import { NextResponse } from 'next/server';

export async function DELETE() {
  return NextResponse.json(
    { success: false, error: { code: 'FORBIDDEN', message: 'Deleting invoices is disabled.' } },
    { status: 403 }
  );
}
