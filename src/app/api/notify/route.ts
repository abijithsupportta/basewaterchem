import { NextRequest, NextResponse } from 'next/server';
import { sendServiceScheduledEmail, sendServiceCompletedEmail } from '@/lib/email';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, ...params } = body;

    switch (type) {
      case 'service_scheduled':
        await sendServiceScheduledEmail(params);
        break;
      case 'service_completed':
        await sendServiceCompletedEmail(params);
        break;
      default:
        return NextResponse.json({ error: 'Unknown notification type' }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[Notify API] Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to send notification' }, { status: 500 });
  }
}
