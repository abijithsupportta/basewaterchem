'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Users, Wrench, FileCheck,
  Receipt, Droplets, LogOut, ChevronLeft, CalendarDays, Settings, Wallet, Package, Building2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/use-auth';
import { NAV_ITEMS } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { useUserRole } from '@/lib/use-user-role';

const iconMap: Record<string, React.ComponentType<any>> = {
  LayoutDashboard, Users, Wrench, FileCheck, Receipt, CalendarDays, Settings, Wallet, Package, Building2,
};

export function Sidebar() {
  const pathname = usePathname();
  const { user, signOut } = useAuth();
  const userRole = useUserRole();
  const [collapsed, setCollapsed] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const handleLogoutConfirm = async () => {
    setShowLogoutModal(false);
    await signOut();
  };

  const visibleNavItems = NAV_ITEMS.filter((item) => {
    // Filter by role-based permissions
    if (item.roles && !item.roles.includes(userRole)) {
      return false;
    }
    return true;
  });

  return (
    <div
      className={cn(
        'flex h-screen flex-col border-r bg-sidebar text-sidebar-foreground transition-all duration-300',
        collapsed ? 'w-[70px]' : 'w-[260px]'
      )}
    >
      {/* Logo */}
      <div className="flex h-16 items-center border-b px-4">
        <Link href="/dashboard" className="flex items-center gap-2">
          <Droplets className="h-8 w-8 text-blue-500 shrink-0" />
          {!collapsed && (
            <div className="flex flex-col">
              <span className="text-sm font-bold leading-tight">Base Water</span>
              <span className="text-xs text-muted-foreground leading-tight">Chemicals</span>
            </div>
          )}
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4">
        <ul className="space-y-1 px-2">
          {visibleNavItems.map((item) => {
            const Icon = iconMap[item.icon] || LayoutDashboard;
            const isActive =
              item.href === '/dashboard'
                ? pathname === '/dashboard'
                : item.href === '/dashboard/services'
                  ? pathname === '/dashboard/services' || (pathname.startsWith('/dashboard/services') && !pathname.startsWith('/dashboard/services/calendar'))
                  : pathname.startsWith(item.href);

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-sidebar-active text-primary'
                      : 'text-sidebar-foreground hover:bg-sidebar-hover'
                  )}
                  title={collapsed ? item.label : undefined}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  {!collapsed && <span>{item.label}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer */}
      <div className="border-t p-2">
        <Button
          variant="ghost"
          className="w-full justify-start gap-3"
          onClick={() => setCollapsed(!collapsed)}
        >
          <ChevronLeft className={cn('h-5 w-5 transition-transform', collapsed && 'rotate-180')} />
          {!collapsed && <span className="text-sm">Collapse</span>}
        </Button>
        {user && (
          <div className="mt-2">
            {!collapsed && (
              <div className="px-3 py-2">
                <p className="text-sm font-medium truncate">{user.email}</p>
                <p className="text-xs text-muted-foreground capitalize">{userRole}</p>
              </div>
            )}
            <Button
              variant="ghost"
              className="w-full justify-start gap-3 text-red-500 hover:text-red-600 hover:bg-red-50"
              onClick={() => setShowLogoutModal(true)}
            >
              <LogOut className="h-5 w-5 shrink-0" />
              {!collapsed && <span className="text-sm">Sign Out</span>}
            </Button>
          </div>
        )}
      </div>

      {/* Logout Confirmation Modal */}
      {showLogoutModal && (
        <>
          <div className="fixed inset-0 z-40 bg-black bg-opacity-50" onClick={() => setShowLogoutModal(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow-lg">
              <div className="space-y-4">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Sign Out</h2>
                  <p className="mt-2 text-sm text-gray-600">
                    Are you sure you want to sign out? You'll need to log in again to access the service manager.
                  </p>
                </div>

                <div className="flex gap-3 pt-4">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => setShowLogoutModal(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    className="flex-1"
                    onClick={handleLogoutConfirm}
                  >
                    Sign Out
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
