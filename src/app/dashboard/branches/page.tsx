'use client';

import { useState, useEffect } from 'react';
import { Plus, Building2, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SearchBar } from '@/components/ui/search-bar';
import { Loading } from '@/components/ui/loading';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { createBrowserClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import type { Branch } from '@/types/branch';
import { useUserRole } from '@/lib/use-user-role';
import { canManageBranches, canDelete } from '@/lib/authz';

export default function BranchesPage() {
  const userRole = useUserRole();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);

  useEffect(() => {
    if (!canManageBranches(userRole)) {
      return;
    }
    fetchBranches();
  }, [userRole]);

  const fetchBranches = async () => {
    try {
      const supabase = createBrowserClient();
      const { data, error } = await supabase
        .from('branches')
        .select('*')
        .order('branch_name');

      if (error) throw error;

      const branchRows = (data || []) as Branch[];
      const managerIds = Array.from(
        new Set(branchRows.map((branch) => branch.manager_id).filter(Boolean))
      ) as string[];

      if (managerIds.length === 0) {
        setBranches(branchRows);
        return;
      }

      const { data: managerRows, error: managerError } = await supabase
        .from('staff')
        .select('id, full_name, email')
        .in('id', managerIds);

      if (managerError) throw managerError;

      const managerMap = new Map(
        (managerRows || []).map((manager) => [manager.id, manager])
      );

      setBranches(
        branchRows.map((branch) => ({
          ...branch,
          manager: branch.manager_id ? managerMap.get(branch.manager_id) : undefined,
        }))
      );
    } catch (error) {
      console.error('Error fetching branches:', error);
      const errorMessage =
        typeof error === 'object' && error && 'message' in error
          ? String((error as { message?: string }).message)
          : 'Failed to load branches';
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    const target = branches.find((branch) => branch.id === id);
    if (target?.branch_code === 'HO') {
      toast.error('Head Office branch cannot be deleted');
      return;
    }
    const confirmed = window.confirm(
      `Delete "${target?.branch_name}"? All customers, invoices, services, and other data from this branch will be reassigned to Head Office branch.`
    );
    if (!confirmed) return;

    try {
      const supabase = createBrowserClient();
      const { error } = await supabase.from('branches').delete().eq('id', id);

      if (error) throw error;
      toast.success(`Branch "${target?.branch_name}" deleted. All data reassigned to Head Office.`);
      setBranches(branches.filter((b) => b.id !== id));
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete branch');
    }
  };

  const filtered = branches.filter((b) =>
    !search ||
    b.branch_name.toLowerCase().includes(search.toLowerCase()) ||
    b.branch_code.toLowerCase().includes(search.toLowerCase()) ||
    b.city?.toLowerCase().includes(search.toLowerCase())
  );

  if (!canManageBranches(userRole)) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-muted-foreground">You don't have permission to access this page</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Branches</h1>
        <Button onClick={() => { setEditingBranch(null); setShowForm(true); }}>
          <Plus className="mr-2 h-4 w-4" /> Add Branch
        </Button>
      </div>

      <SearchBar value={search} onChange={setSearch} placeholder="Search branches..." />

      {loading ? (
        <Loading />
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No branches found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((branch) => (
            <Card key={branch.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold">{branch.branch_name}</h3>
                    <p className="text-sm text-muted-foreground">{branch.branch_code}</p>
                  </div>
                  <Badge variant={branch.is_active ? 'default' : 'secondary'}>
                    {branch.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                </div>

                {(branch.address || branch.city) && (
                  <div className="text-sm text-muted-foreground">
                    {branch.address && <p>{branch.address}</p>}
                    {branch.city && <p>{branch.city}, {branch.state} {branch.pincode}</p>}
                  </div>
                )}

                {branch.phone && (
                  <p className="text-sm">📞 {branch.phone}</p>
                )}

                {branch.email && (
                  <p className="text-sm">✉️ {branch.email}</p>
                )}

                <div className="flex gap-2 pt-2 border-t">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      setEditingBranch(branch);
                      setShowForm(true);
                    }}
                  >
                    <Pencil className="h-3 w-3 mr-1" /> Edit
                  </Button>
                  {canDelete(userRole) && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={branch.branch_code === 'HO'}
                      onClick={() => handleDelete(branch.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {showForm && (
        <Dialog open={showForm} onOpenChange={setShowForm}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingBranch ? 'Edit' : 'Add'} Branch</DialogTitle>
            </DialogHeader>
            <BranchForm
              branch={editingBranch}
              onClose={() => {
                setShowForm(false);
                setEditingBranch(null);
              }}
              onSave={() => {
                fetchBranches();
                setShowForm(false);
                setEditingBranch(null);
              }}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function BranchForm({ branch, onClose, onSave }: { branch: Branch | null; onClose: () => void; onSave: () => void }) {
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    branch_code: branch?.branch_code || '',
    branch_name: branch?.branch_name || '',
    address: branch?.address || '',
    city: branch?.city || '',
    state: branch?.state || 'Kerala',
    pincode: branch?.pincode || '',
    phone: branch?.phone || '',
    email: branch?.email || '',
    is_active: branch?.is_active ?? true,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const supabase = createBrowserClient();

      if (branch) {
        const { error } = await supabase
          .from('branches')
          .update(formData)
          .eq('id', branch.id);
        if (error) throw error;
        toast.success('Branch updated');
      } else {
        const { error } = await supabase.from('branches').insert(formData);
        if (error) throw error;
        toast.success('Branch created');
      }

      onSave();
    } catch (error: any) {
      toast.error(error.message || 'Failed to save branch');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Branch Code *</Label>
          <Input
            value={formData.branch_code}
            onChange={(e) => setFormData({ ...formData, branch_code: e.target.value })}
            placeholder="BR001"
            required
          />
        </div>
        <div className="space-y-2">
          <Label>Branch Name *</Label>
          <Input
            value={formData.branch_name}
            onChange={(e) => setFormData({ ...formData, branch_name: e.target.value })}
            placeholder="Main Branch"
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Address</Label>
        <Input
          value={formData.address}
          onChange={(e) => setFormData({ ...formData, address: e.target.value })}
          placeholder="Street address"
        />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label>City</Label>
          <Input
            value={formData.city}
            onChange={(e) => setFormData({ ...formData, city: e.target.value })}
            placeholder="City"
          />
        </div>
        <div className="space-y-2">
          <Label>State</Label>
          <Input
            value={formData.state}
            onChange={(e) => setFormData({ ...formData, state: e.target.value })}
            placeholder="State"
          />
        </div>
        <div className="space-y-2">
          <Label>Pincode</Label>
          <Input
            value={formData.pincode}
            onChange={(e) => setFormData({ ...formData, pincode: e.target.value })}
            placeholder="686001"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Phone</Label>
          <Input
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            placeholder="+91 9876543210"
          />
        </div>
        <div className="space-y-2">
          <Label>Email</Label>
          <Input
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            placeholder="branch@example.com"
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={formData.is_active}
          onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
          className="h-4 w-4"
        />
        <Label>Active</Label>
      </div>

      <div className="flex gap-4 pt-4 border-t">
        <Button type="submit" disabled={saving}>
          {saving ? 'Saving...' : 'Save'}
        </Button>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
