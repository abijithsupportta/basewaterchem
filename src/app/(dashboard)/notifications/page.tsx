'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Breadcrumb } from '@/components/layout/breadcrumb';
import { Loading } from '@/components/ui/loading';
import { createBrowserClient } from '@/lib/supabase/client';
import { Bell, Check, CheckCheck } from 'lucide-react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const supabase = createBrowserClient();

  const fetchNotifications = async () => {
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    setNotifications(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchNotifications(); }, []);

  const markAsRead = async (id: string) => {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
  };

  const markAllRead = async () => {
    await supabase.from('notifications').update({ is_read: true }).eq('is_read', false);
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    toast.success('All notifications marked as read');
  };

  const getLink = (n: any): string | null => {
    if (!n.related_id || !n.related_type) return null;
    const map: Record<string, string> = {
      service: '/services',
      complaint: '/complaints',
      amc: '/amc',
      invoice: '/invoices',
      quotation: '/quotations',
    };
    const base = map[n.related_type];
    return base ? `${base}/${n.related_id}` : null;
  };

  if (loading) return <Loading />;

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <div className="space-y-6">
      <Breadcrumb />
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">Notifications</h1>
          {unreadCount > 0 && <Badge variant="destructive">{unreadCount} unread</Badge>}
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" size="sm" onClick={markAllRead}>
            <CheckCheck className="mr-2 h-4 w-4" /> Mark All Read
          </Button>
        )}
      </div>

      {notifications.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground"><Bell className="mx-auto h-12 w-12 mb-4 opacity-30" /><p>No notifications yet</p></CardContent></Card>
      ) : (
        <div className="space-y-2">
          {notifications.map(n => {
            const link = getLink(n);
            const content = (
              <Card key={n.id} className={`cursor-pointer transition hover:shadow-md ${!n.is_read ? 'border-l-4 border-l-blue-500 bg-blue-50/50' : ''}`}>
                <CardContent className="py-4 flex items-center justify-between">
                  <div className="flex-1">
                    <p className={`text-sm ${!n.is_read ? 'font-semibold' : ''}`}>{n.title}</p>
                    <p className="text-sm text-muted-foreground">{n.message}</p>
                    <p className="text-xs text-muted-foreground mt-1">{formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}</p>
                  </div>
                  {!n.is_read && (
                    <Button variant="ghost" size="sm" onClick={(e) => { e.preventDefault(); e.stopPropagation(); markAsRead(n.id); }}>
                      <Check className="h-4 w-4" />
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
            return link ? <Link key={n.id} href={link} onClick={() => !n.is_read && markAsRead(n.id)}>{content}</Link> : <div key={n.id}>{content}</div>;
          })}
        </div>
      )}
    </div>
  );
}
