'use client';

import { useEffect, useState } from 'react';
import { Save, Loader2, Settings as SettingsIcon } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Breadcrumb } from '@/components/layout/breadcrumb';
import { Loading } from '@/components/ui/loading';

interface CompanySettings {
  company_name: string;
  location: string;
  address_line1: string;
  address_line2: string;
  city: string;
  state: string;
  pincode: string;
  phone: string;
  email: string;
  gst_number: string;
  bank_name: string;
  bank_account: string;
  bank_ifsc: string;
  reminder_days_ahead: number;
  reminder_send_time: string;
}

const DEFAULT_SETTINGS: CompanySettings = {
  company_name: 'Base Water Chemicals',
  location: '',
  address_line1: '',
  address_line2: '',
  city: '',
  state: 'Kerala',
  pincode: '',
  phone: '',
  email: '',
  gst_number: '',
  bank_name: '',
  bank_account: '',
  bank_ifsc: '',
  reminder_days_ahead: 4,
  reminder_send_time: '10:00',
};

export default function SettingsPage() {
  const [settings, setSettings] = useState<CompanySettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/settings')
      .then((r) => r.json())
      .then((data) => {
        setSettings({ ...DEFAULT_SETTINGS, ...data });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to save');
      }
      toast.success('Settings saved successfully!');
    } catch (error: any) {
      toast.error(error.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const update = (field: keyof CompanySettings, value: string) => {
    setSettings((s) => ({
      ...s,
      [field]: field === 'reminder_days_ahead' ? Number(value || 0) : value,
    }));
  };

  if (loading) return <Loading />;

  return (
    <div className="space-y-6">
      <Breadcrumb />
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <SettingsIcon className="h-6 w-6 text-muted-foreground" />
          <div>
            <h1 className="text-2xl font-bold">Company Settings</h1>
            <p className="text-muted-foreground">Manage your company details for invoices and notifications</p>
          </div>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Save Settings
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2 max-w-4xl">
        {/* Company Info */}
        <Card>
          <CardHeader><CardTitle className="text-base">Company Information</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Shop / Company Name *</Label>
              <Input value={settings.company_name} onChange={(e) => update('company_name', e.target.value)} placeholder="Your Company Name" />
            </div>
            <div className="space-y-2">
              <Label>Location</Label>
              <Input value={settings.location} onChange={(e) => update('location', e.target.value)} placeholder="Area or Location" />
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input value={settings.phone} onChange={(e) => update('phone', e.target.value)} placeholder="+91 9876543210" />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={settings.email} onChange={(e) => update('email', e.target.value)} placeholder="info@company.com" />
            </div>
            <div className="space-y-2">
              <Label>GST Number</Label>
              <Input value={settings.gst_number} onChange={(e) => update('gst_number', e.target.value)} placeholder="22AAAAA0000A1Z5" />
            </div>
          </CardContent>
        </Card>

        {/* Address */}
        <Card>
          <CardHeader><CardTitle className="text-base">Address</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Address Line 1</Label>
              <Input value={settings.address_line1} onChange={(e) => update('address_line1', e.target.value)} placeholder="Building, Street" />
            </div>
            <div className="space-y-2">
              <Label>Address Line 2</Label>
              <Input value={settings.address_line2} onChange={(e) => update('address_line2', e.target.value)} placeholder="Area, Landmark" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>City</Label>
                <Input value={settings.city} onChange={(e) => update('city', e.target.value)} placeholder="City" />
              </div>
              <div className="space-y-2">
                <Label>State</Label>
                <Input value={settings.state} onChange={(e) => update('state', e.target.value)} placeholder="State" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Pincode</Label>
              <Input value={settings.pincode} onChange={(e) => update('pincode', e.target.value)} placeholder="670001" />
            </div>
          </CardContent>
        </Card>

        {/* Bank Details */}
        <Card className="md:col-span-2">
          <CardHeader><CardTitle className="text-base">Bank Details (for Invoice)</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Bank Name</Label>
                <Input value={settings.bank_name} onChange={(e) => update('bank_name', e.target.value)} placeholder="State Bank of India" />
              </div>
              <div className="space-y-2">
                <Label>Account Number</Label>
                <Input value={settings.bank_account} onChange={(e) => update('bank_account', e.target.value)} placeholder="1234567890" />
              </div>
              <div className="space-y-2">
                <Label>IFSC Code</Label>
                <Input value={settings.bank_ifsc} onChange={(e) => update('bank_ifsc', e.target.value)} placeholder="SBIN0001234" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader><CardTitle className="text-base">WhatsApp Reminder Settings</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Reminder Time</Label>
                <Input
                  type="time"
                  value={settings.reminder_send_time}
                  onChange={(e) => update('reminder_send_time', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Days Ahead</Label>
                <Input
                  type="number"
                  min={1}
                  max={30}
                  value={settings.reminder_days_ahead}
                  onChange={(e) => update('reminder_days_ahead', e.target.value)}
                />
              </div>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Default reminder configuration is 10:00 AM for services scheduled 4 days ahead.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
