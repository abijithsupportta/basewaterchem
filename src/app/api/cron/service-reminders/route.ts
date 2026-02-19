import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';

// This endpoint can be called by a cron job to generate upcoming AMC services
// and create reminder notifications
export async function POST(request: NextRequest) {
  // Verify cron secret for security
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = await createServiceRoleClient();

  try {
    // Generate upcoming services from AMC contracts
    const { error: genError } = await supabase.rpc('generate_all_upcoming_services');
    if (genError) throw genError;

    // Find services scheduled for tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    const { data: upcomingServices } = await supabase
      .from('services')
      .select('id, customer_id, customers(name)')
      .eq('scheduled_date', tomorrowStr)
      .eq('status', 'scheduled');

    // Create notifications for tomorrow's services
    if (upcomingServices?.length) {
      const notifications = upcomingServices.map((s: any) => ({
        type: 'service_reminder' as const,
        title: 'Service Tomorrow',
        message: `Service scheduled tomorrow for ${s.customers?.name || 'customer'}`,
        related_id: s.id,
        related_type: 'service',
      }));

      await supabase.from('notifications').insert(notifications);
    }

    // Find overdue services
    const today = new Date().toISOString().split('T')[0];
    const { data: overdueServices } = await supabase
      .from('services')
      .select('id, customer_id, customers(name)')
      .lt('scheduled_date', today)
      .eq('status', 'scheduled');

    if (overdueServices?.length) {
      const notifications = overdueServices.map((s: any) => ({
        type: 'service_overdue' as const,
        title: 'Service Overdue',
        message: `Overdue service for ${s.customers?.name || 'customer'}`,
        related_id: s.id,
        related_type: 'service',
      }));

      await supabase.from('notifications').insert(notifications);
    }

    return NextResponse.json({
      success: true,
      generated: upcomingServices?.length || 0,
      overdue: overdueServices?.length || 0,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
