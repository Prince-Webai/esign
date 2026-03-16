"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { FileText, Users, Settings, LogOut, LayoutDashboard, UserCheck } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Templates", href: "/templates", icon: FileText },
  { name: "Launch RAMS", href: "/rams/new", icon: Users },
  { name: "Signers", href: "/users", icon: UserCheck },
  { name: "Settings", href: "/settings", icon: Settings },
];

export function Navbar() {
  const pathname = usePathname();
  const [session, setSession] = useState<any>(null);

  useEffect(() => {
    const saved = localStorage.getItem("tre_user_session");
    if (saved) setSession(JSON.parse(saved));
  }, [pathname]);

  if (pathname === "/login") return null;

  const handleLogout = () => {
    localStorage.removeItem("tre_user_session");
    window.location.href = "/login";
  };

  const itemsToDisplay = session?.role === 'admin' ? navItems : [
    { name: "My RAMS", href: "/dashboard", icon: LayoutDashboard },
    { name: "Settings", href: "/settings", icon: Settings },
  ];

  return (
    <nav className="fixed left-0 top-0 h-full w-64 border-r border-border bg-card/50 backdrop-blur-xl z-50">
      <div className="flex flex-col h-full p-6">
        <div className="flex items-center gap-3 mb-10 px-2">
          <div className="w-10 h-10 rounded-xl premium-gradient flex items-center justify-center font-bold text-white shadow-lg shadow-primary/20">
            TRE
          </div>
          <div>
            <h1 className="font-bold text-lg tracking-tight">TRE Energy</h1>
            <p className="text-xs text-muted-foreground uppercase tracking-widest font-semibold">
              {session?.role === 'admin' ? 'Admin Portal' : 'Signer Portal'}
            </p>
          </div>
        </div>

        <div className="flex-1 space-y-2">
          {itemsToDisplay.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group",
                  isActive 
                    ? "bg-primary text-primary-foreground shadow-md shadow-primary/30" 
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                )}
              >
                <item.icon className={cn("w-5 h-5", isActive ? "text-primary-foreground" : "group-hover:scale-110 transition-transform")} />
                <span className="font-medium">{item.name}</span>
              </Link>
            );
          })}
        </div>

        <button 
          onClick={handleLogout}
          className="flex items-center gap-3 px-4 py-3 rounded-xl text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-all duration-200 mt-auto"
        >
          <LogOut className="w-5 h-5" />
          <span className="font-medium">Logout</span>
        </button>
      </div>
    </nav>
  );
}
