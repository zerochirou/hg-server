'use client';

import * as React from 'react';
import { NavMain } from '@/components/nav-main';
import { NavProjects } from '@/components/nav-projects';
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
  ActivityIcon,
  AlertTriangleIcon,
  CheckCircle2Icon,
  Database,
  DatabaseIcon,
  HelpCircleIcon,
  LayoutDashboardIcon,
  Settings2Icon,
  ShieldCheckIcon,
  Table2Icon,
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
  projects: [
    {
      name: 'Klaster Parah (Severe)',
      url: '/dashboard?severity=severe',
      icon: <ActivityIcon className="size-4 text-destructive" />,
    },
    {
      name: 'Klaster Sedang (Medium)',
      url: '/dashboard?severity=medium',
      icon: <AlertTriangleIcon className="size-4 text-amber-500" />,
    },
    {
      name: 'Klaster Ringan (Low)',
      url: '/dashboard?severity=low',
      icon: <CheckCircle2Icon className="size-4 text-emerald-500" />,
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
        {/*<NavProjects projects={data.projects} />*/}
        <NavSecondary items={data.navSecondary} className="mt-auto" />
      </SidebarContent>

      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
    </Sidebar>
  );
}
