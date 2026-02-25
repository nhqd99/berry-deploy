"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  LayoutDashboard,
  Plus,
  LogOut,
  Bot,
  Menu,
  Settings,
  Shield,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/claw/new", label: "Deploy New", icon: Plus },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

function SidebarContent({
  pathname,
  onSignOut,
  onNavigate,
  isAdmin,
}: {
  pathname: string;
  onSignOut: () => void;
  onNavigate?: () => void;
  isAdmin?: boolean;
}) {
  const allItems = isAdmin
    ? [...navItems, { href: "/dashboard/admin", label: "Admin", icon: Shield }]
    : navItems;

  return (
    <>
      <nav className="flex-1 space-y-1 p-3">
        {allItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-300",
              pathname === item.href
                ? "bg-gradient-to-r from-indigo-500/15 to-violet-500/10 text-indigo-300 shadow-sm shadow-indigo-500/5"
                : "text-muted-foreground hover:bg-white/[0.06] hover:text-foreground",
            )}
          >
            <item.icon className={cn(
              "h-4 w-4 transition-colors duration-300",
              pathname === item.href ? "text-indigo-400" : "group-hover:text-indigo-400/60",
            )} />
            {item.label}
            {pathname === item.href && (
              <div className="ml-auto h-1.5 w-1.5 rounded-full bg-indigo-400" />
            )}
          </Link>
        ))}
      </nav>
      <div className="divider-gradient mx-3" />
      <div className="p-3">
        <Button
          variant="ghost"
          className="w-full justify-start gap-3 rounded-xl text-muted-foreground hover:bg-white/[0.06] hover:text-foreground transition-all duration-300"
          onClick={() => {
            onSignOut();
            onNavigate?.();
          }}
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </Button>
      </div>
    </>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const { signOut } = useAuthActions();
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const isAdmin = useQuery(api.admin.isAdmin, isAuthenticated ? {} : "skip");

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace("/login");
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen">
        <aside className="hidden md:flex w-64 flex-col border-r border-white/[0.10] bg-sidebar">
          <div className="flex h-16 items-center gap-3 px-5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500/20 to-violet-500/15 ring-1 ring-white/[0.08]">
              <Bot className="h-4.5 w-4.5 text-indigo-400" />
            </div>
            <span className="text-lg font-semibold tracking-tight">Berry Claw</span>
          </div>
          <div className="divider-gradient mx-3" />
          <nav className="flex-1 space-y-2 p-3">
            <Skeleton className="h-10 w-full rounded-xl shimmer bg-white/[0.06]" />
            <Skeleton className="h-10 w-full rounded-xl shimmer bg-white/[0.06]" />
            <Skeleton className="h-10 w-full rounded-xl shimmer bg-white/[0.06]" />
          </nav>
        </aside>
        <div className="flex-1">
          <div className="md:hidden flex h-16 items-center gap-3 border-b border-white/[0.10] px-4 bg-background/80 backdrop-blur-xl">
            <Skeleton className="h-9 w-9 rounded-xl bg-white/[0.06]" />
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500/20 to-violet-500/15 ring-1 ring-white/[0.08]">
              <Bot className="h-4 w-4 text-indigo-400" />
            </div>
            <span className="text-lg font-semibold tracking-tight">Berry Claw</span>
          </div>
          <main className="p-4 md:p-8">
            <div className="space-y-6">
              <Skeleton className="h-8 w-48 rounded-lg shimmer bg-white/[0.06]" />
              <Skeleton className="h-4 w-64 rounded-lg shimmer bg-white/[0.06]" />
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Skeleton className="h-36 rounded-xl shimmer bg-white/[0.06]" />
                <Skeleton className="h-36 rounded-xl shimmer bg-white/[0.06]" />
                <Skeleton className="h-36 rounded-xl shimmer bg-white/[0.06]" />
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="flex min-h-screen">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 flex-col border-r border-white/[0.10] bg-sidebar">
        <div className="flex h-16 items-center gap-3 px-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500/20 to-violet-500/15 ring-1 ring-white/[0.08]">
            <Bot className="h-4.5 w-4.5 text-indigo-400" />
          </div>
          <span className="text-lg font-semibold tracking-tight">Berry Claw</span>
        </div>
        <div className="divider-gradient mx-3" />
        <SidebarContent pathname={pathname} onSignOut={() => signOut()} isAdmin={isAdmin === true} />
      </aside>

      {/* Mobile Header + Sheet */}
      <div className="flex flex-1 flex-col">
        <div className="md:hidden flex h-16 items-center gap-3 border-b border-white/[0.10] px-4 bg-background/80 backdrop-blur-xl sticky top-0 z-40">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl hover:bg-white/[0.06]">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0 bg-sidebar border-white/[0.10]">
              <SheetHeader className="px-5 py-4">
                <SheetTitle className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500/20 to-violet-500/15 ring-1 ring-white/[0.08]">
                    <Bot className="h-4 w-4 text-indigo-400" />
                  </div>
                  Berry Claw
                </SheetTitle>
              </SheetHeader>
              <div className="divider-gradient mx-3" />
              <SidebarContent
                pathname={pathname}
                onSignOut={() => signOut()}
                onNavigate={() => setMobileOpen(false)}
                isAdmin={isAdmin === true}
              />
            </SheetContent>
          </Sheet>
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500/20 to-violet-500/15 ring-1 ring-white/[0.08]">
            <Bot className="h-4 w-4 text-indigo-400" />
          </div>
          <span className="font-semibold tracking-tight">Berry Claw</span>
        </div>

        {/* Main content */}
        <main className="flex-1 overflow-auto">
          <div className="p-4 md:p-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
