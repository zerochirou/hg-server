'use client';

import * as React from 'react';
import { NavMain } from '@/components/nav-main';
import { NavSecondary } from '@/components/nav-secondary';
import { NavUser } from '@/components/nav-user';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';
import {
  Database,
  DatabaseIcon,
  HelpCircleIcon,
  LayoutDashboardIcon,
  ShieldCheckIcon,
} from 'lucide-react';

const data = {
  navMain: [
    {
      title: 'Overview',
      url: '/dashboard',
      icon: <LayoutDashboardIcon className="size-4" />,
      isActive: true,
      items: [
        {
          title: 'Overview Ringkasan',
          url: '/dashboard',
        },
        {
          title: 'Full GIS Studio & Tools',
          url: '/dashboard/map',
        },
      ],
    },
    {
      title: 'Tabular data',
      url: '/dashboard/data',
      icon: <Database className="size-4" />,
      items: [
        {
          title: 'Tabel Klaster (PostGIS)',
          url: '/dashboard/data',
        },
        {
          title: 'Raw Data Telemetri IoT',
          url: '/dashboard/data',
        },
      ],
    },
  ],
  navSecondary: [
    {
      title: 'Dokumentasi PostGIS API',
      url: 'http://localhost:4000/api/health',
      icon: <DatabaseIcon className="size-4" />,
    },
    {
      title: 'Pusat Bantuan',
      url: '#',
      icon: <HelpCircleIcon className="size-4" />,
    },
  ],
};

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar variant="inset" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" render={<a href="/dashboard" />}>
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <ShieldCheckIcon className="size-5" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-bold tracking-wide">HyperGrid</span>
                <span className="truncate text-xs text-muted-foreground">
                  Pothole Analytics Engine
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <NavMain items={data.navMain} />
        <NavSecondary items={data.navSecondary} className="mt-auto" />
      </SidebarContent>

      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
    </Sidebar>
  );
}
