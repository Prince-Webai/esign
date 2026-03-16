"use client";

import { useEffect } from "react";
import { Loader2 } from "lucide-react";

export default function RootPage() {
  useEffect(() => {
    const session = localStorage.getItem("tre_user_session");
    
    if (!session) {
      window.location.href = "/login";
      return;
    }

    try {
      const parsed = JSON.parse(session);
      
      // Check for expiry
      if (new Date().getTime() > parsed.expires) {
        localStorage.removeItem("tre_user_session");
        window.location.href = "/login";
        return;
      }

      if (parsed.role === "admin") {
        // Redirection to (admin) group implicitly means /
        // but if there's confusion, it will hit the (admin)/page.tsx
        // However, Next.js root already serves (admin)/page.tsx if nothing else
        // Let's just stay here or force refresh if needed.
        // If we are at /, (admin)/page.tsx is already the content.
        // We just need to make sure we don't redirect ADMIN back to / login.
      } else {
        window.location.href = "/dashboard";
      }
    } catch (e) {
      window.location.href = "/login";
    }
  }, []);

  return (
    <div className="min-h-screen bg-[#020617] flex flex-col items-center justify-center gap-4">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
      <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Redirecting...</p>
    </div>
  );
}
