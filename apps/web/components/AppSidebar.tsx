'use client';

import Link from 'next/link';
import {
  BookOpen,
  LayoutDashboard,
  Lightbulb,
  Lock,
  ShieldAlert,
  User,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

type SidebarItem = {
  icon: LucideIcon;
  label: string;
  href?: string;
};

const NAV_ITEMS: SidebarItem[] = [
  { icon: LayoutDashboard, label: 'Dashboard' },
  { icon: ShieldAlert, label: 'Analyze Message', href: '/' },
  { icon: BookOpen, label: 'Document Q&A', href: '/qna' },
  { icon: Lock, label: 'Scam Vault' },
  { icon: Lightbulb, label: 'AI Advisor' },
];

type AppSidebarProps = {
  activeHref: '/' | '/qna';
};

const AppSidebar = ({ activeHref }: AppSidebarProps) => {
  return (
    <aside className="fixed z-10 flex h-full w-64 flex-col border-r border-[#E6E8EF] bg-white">
      <div className="p-8">
        <Link href="/" className="block">
          <h1 className="text-2xl font-bold text-[#2E347E]">Scam Shield</h1>
          <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-[#575C6B]">
            Your Digital Sanctuary
          </p>
        </Link>
      </div>

      <nav className="flex-1 space-y-1 px-4">
        {NAV_ITEMS.map((item) => {
          const isActive = item.href === activeHref;
          const className = `flex w-full items-center gap-3 rounded-xl px-4 py-3 transition-all duration-200 ${
            isActive
              ? 'bg-[#F3F4FD] font-bold text-[#2E347E] shadow-sm'
              : 'text-[#575C6B] hover:bg-[#F8F9FC] hover:text-[#15171E]'
          }`;

          if (item.href) {
            return (
              <Link key={item.label} href={item.href} className={className}>
                <item.icon size={20} />
                <span>{item.label}</span>
              </Link>
            );
          }

          return (
            <button
              key={item.label}
              type="button"
              disabled
              className={`${className} cursor-not-allowed opacity-50`}
            >
              <item.icon size={20} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="mt-auto border-t border-[#E6E8EF] p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#F3F4FD] text-[#2E347E]">
            <User size={20} />
          </div>
          <div>
            <p className="text-sm font-bold text-[#15171E]">Demo User</p>
            <p className="text-xs text-[#575C6B]">Profile</p>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default AppSidebar;
