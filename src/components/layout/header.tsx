'use client';

import { Search } from 'lucide-react';
import { SearchBar } from '@/components/ui/search-bar';
import { useAuth } from '@/hooks/use-auth';
import { useUserRole } from '@/lib/use-user-role';
import { canManageBranches } from '@/lib/authz';
import { SimpleSelect } from '@/components/ui/select';
import { useBranchOptions, useBranchSelection } from '@/hooks/use-branch-selection';

export function Header() {
  const { user } = useAuth();
  const userRole = useUserRole();
  const canSwitchBranch = canManageBranches(userRole as any);
  const { selectedBranchId, setSelectedBranchId } = useBranchSelection();
  const { options: branchOptions } = useBranchOptions(canSwitchBranch);

  const displayName = user?.email?.charAt(0).toUpperCase() || 'U';

  return (
    <header className="flex h-16 items-center justify-between border-b bg-background px-6">
      <div className="flex items-center gap-4">
        <h2 className="text-lg font-semibold text-foreground">
          Service Manager
        </h2>
      </div>

      <div className="flex items-center gap-4">
        <SearchBar className="w-64 hidden md:block" placeholder="Search customers, services..." />

        {canSwitchBranch && (
          <SimpleSelect
            className="w-56"
            value={selectedBranchId}
            onChange={(value) => setSelectedBranchId(value)}
            options={branchOptions}
            placeholder="Select branch"
          />
        )}

        {user && (
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-medium">
              {displayName}
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
