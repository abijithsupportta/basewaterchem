'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Plus, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { SearchBar } from '@/components/ui/search-bar';
import { Loading } from '@/components/ui/loading';
import { Breadcrumb } from '@/components/layout/breadcrumb';
import { useStaff } from '@/hooks/use-staff';
import { ROLE_LABELS } from '@/lib/constants';
import { formatPhone } from '@/lib/utils';

export default function StaffPage() {
  const { staff, loading } = useStaff();
  const [search, setSearch] = useState('');

  const filtered = staff.filter((s: any) =>
    !search || s.full_name?.toLowerCase().includes(search.toLowerCase()) || s.phone?.includes(search)
  );

  return (
    <div className="space-y-6">
      <Breadcrumb />
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">Staff</h1><p className="text-muted-foreground">{staff.length} team members</p></div>
        <Link href="/dashboard/staff/new"><Button><Plus className="mr-2 h-4 w-4" /> Add Staff</Button></Link>
      </div>

      <SearchBar value={search} onChange={setSearch} placeholder="Search staff..." />

      {loading ? <Loading /> : filtered.length === 0 ? (
        <Card><CardContent className="flex flex-col items-center justify-center py-12">
          <Users className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No staff found</p>
        </CardContent></Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((member: any) => (
            <Link key={member.id} href={`/dashboard/staff/${member.id}`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium">{member.full_name}</p>
                      <p className="text-sm text-muted-foreground">{formatPhone(member.phone)}</p>
                      {member.email && <p className="text-sm text-muted-foreground">{member.email}</p>}
                    </div>
                    <Badge variant="outline">{ROLE_LABELS[member.role as keyof typeof ROLE_LABELS] || member.role}</Badge>
                  </div>
                  <Badge className="mt-3" variant={member.is_active ? 'default' : 'secondary'}>{member.is_active ? 'Active' : 'Inactive'}</Badge>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
