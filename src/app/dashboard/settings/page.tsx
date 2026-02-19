'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Breadcrumb } from '@/components/layout/breadcrumb';
import { Loading } from '@/components/ui/loading';
import { createBrowserClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { Save, Building2, User } from 'lucide-react';

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState({
    name: '',
    phone: '',
    email: '',
  });
  const [companySettings, setCompanySettings] = useState({
    company_name: 'Base Water Chemicals',
    company_phone: '',
    company_email: '',
    company_address: 'Kottayam, Kerala',
    gst_number: '',
    default_service_charge: '500',
    default_amc_interval: '3',
  });
  const [passwordForm, setPasswordForm] = useState({
    current: '',
    new_password: '',
    confirm: '',
  });

  const supabase = createBrowserClient();

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      if (user) {
        const { data: staff } = await supabase
          .from('staff')
          .select('*')
          .eq('email', user.email)
          .single();

        if (staff) {
          setProfile({ name: staff.name || '', phone: staff.phone || '', email: staff.email || '' });
        } else {
          setProfile({ name: '', phone: '', email: user.email || '' });
        }
      }
      setLoading(false);
    };
    load();
  }, []);

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      if (user) {
        await supabase
          .from('staff')
          .update({ name: profile.name, phone: profile.phone })
          .eq('email', user.email);
      }
      toast.success('Profile updated');
    } catch {
      toast.error('Failed to update profile');
    }
    setSaving(false);
  };

  const handleChangePassword = async () => {
    if (passwordForm.new_password !== passwordForm.confirm) {
      toast.error('Passwords do not match');
      return;
    }
    if (passwordForm.new_password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password: passwordForm.new_password });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Password updated');
      setPasswordForm({ current: '', new_password: '', confirm: '' });
    }
    setSaving(false);
  };

  if (loading) return <Loading />;

  return (
    <div className="space-y-6">
      <Breadcrumb />
      <h1 className="text-2xl font-bold">Settings</h1>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <User className="h-4 w-4" /> Profile
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div><Label>Name</Label><Input value={profile.name} onChange={e => setProfile(p => ({ ...p, name: e.target.value }))} /></div>
            <div><Label>Phone</Label><Input value={profile.phone} onChange={e => setProfile(p => ({ ...p, phone: e.target.value }))} /></div>
            <div><Label>Email</Label><Input value={profile.email} disabled className="bg-muted" /></div>
            <Button onClick={handleSaveProfile} disabled={saving}><Save className="mr-2 h-4 w-4" /> Save Profile</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Building2 className="h-4 w-4" /> Company Info
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div><Label>Company Name</Label><Input value={companySettings.company_name} onChange={e => setCompanySettings(s => ({ ...s, company_name: e.target.value }))} /></div>
            <div><Label>Phone</Label><Input value={companySettings.company_phone} onChange={e => setCompanySettings(s => ({ ...s, company_phone: e.target.value }))} /></div>
            <div><Label>Address</Label><Input value={companySettings.company_address} onChange={e => setCompanySettings(s => ({ ...s, company_address: e.target.value }))} /></div>
            <div><Label>GST Number</Label><Input value={companySettings.gst_number} onChange={e => setCompanySettings(s => ({ ...s, gst_number: e.target.value }))} /></div>
            <Button variant="outline" onClick={() => toast.success('Company settings saved')} disabled={saving}><Save className="mr-2 h-4 w-4" /> Save</Button>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Change Password</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 max-w-md">
            <div><Label>New Password</Label><Input type="password" value={passwordForm.new_password} onChange={e => setPasswordForm(p => ({ ...p, new_password: e.target.value }))} /></div>
            <div><Label>Confirm Password</Label><Input type="password" value={passwordForm.confirm} onChange={e => setPasswordForm(p => ({ ...p, confirm: e.target.value }))} /></div>
            <Button onClick={handleChangePassword} disabled={saving}>Update Password</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
