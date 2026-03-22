"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { FileText, Users, Settings, LogOut, LayoutDashboard, UserCheck, Menu, X, Layout } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useOrganization } from "@/hooks/useOrganization";

const navItems = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Forms", href: "/forms", icon: Layout },
  { name: "Launch RAMS", href: "/rams/new", icon: Users },
  { name: "Signers", href: "/users", icon: UserCheck },
  { name: "Settings", href: "/settings", icon: Settings },
];

export function Navbar() {
  const pathname = usePathname();
  const [session, setSession] = useState<any>(null);
  const [isOpen, setIsOpen] = useState(false);
  const { org } = useOrganization();

  useEffect(() => {
    const saved = localStorage.getItem("tre_user_session");
    if (saved) setSession(JSON.parse(saved));
  }, [pathname]);

  useEffect(() => {
    // Close sidebar on route change
    setIsOpen(false);
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
    <>
      {/* Mobile Bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-card/80 backdrop-blur-xl border-b border-border z-[60] flex items-center justify-between px-6">
        <div className="flex items-center gap-3">
          {org.logo_url ? (
            <div className="flex items-center gap-2">
              <img src={org.logo_url} alt={org.name} className="h-14 max-w-[180px] object-contain" />
            </div>
          ) : (
            <>
              <div className="w-8 h-8 rounded-lg premium-gradient flex items-center justify-center font-bold text-white text-xs">TRE</div>
              <span className="font-bold text-sm tracking-tight">{org.name}</span>
            </>
          )}
        </div>
        <button 
          onClick={() => setIsOpen(!isOpen)}
          className="p-2 hover:bg-secondary rounded-lg transition-colors"
        >
          {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Backdrop */}
      {isOpen && (
        <div 
          className="lg:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-[55] transition-opacity"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Navigation Sidebar */}
      <nav className={cn(
        "fixed left-0 top-0 h-full w-64 border-r border-slate-200 bg-white/70 backdrop-blur-xl z-[60] transition-transform duration-300 lg:translate-x-0 shadow-[4px_0_24px_-10px_rgba(0,0,0,0.05)]",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex flex-col h-full p-6">
          <div className="hidden lg:flex items-center gap-3 mb-10 px-2 min-h-[56px]">
            {org.logo_url ? (
               <img src={org.logo_url} alt={org.name} className="h-20 max-w-[280px] object-contain drop-shadow-sm" />
            ) : (
              <>
                <div className="w-10 h-10 rounded-xl premium-gradient flex items-center justify-center font-bold text-white shadow-lg shadow-primary/20 flex-shrink-0">
                  TRE
                </div>
                <div>
                  <h1 className="font-bold text-lg tracking-tight truncate max-w-[140px]">{org.name}</h1>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold truncate max-w-[140px]">
                    {session?.role === 'admin' ? 'Admin Portal' : 'Signer Portal'}
                  </p>
                </div>
              </>
            )}
          </div>


          <div className="flex-1 space-y-2 lg:mt-0 mt-20">
            {itemsToDisplay.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-300 group",
                    isActive 
                      ? "bg-emerald-600 text-white shadow-xl shadow-emerald-500/20 scale-[1.02]" 
                      : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                  )}
                >
                  <item.icon className={cn("w-5 h-5 transition-transform duration-300", isActive ? "text-white scale-110" : "group-hover:text-emerald-500 group-hover:scale-110")} />
                  <span className="font-bold text-xs uppercase tracking-wider">{item.name}</span>
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
    </>
  );
}
