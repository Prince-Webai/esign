"use client";

import { useEffect, useState } from "react";
import { SignerDashboard } from "@/components/Dashboard";
import { Loader2 } from "lucide-react";

export default function DashboardPage() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedSession = localStorage.getItem("tre_user_session");
    if (savedSession) {
      const parsed = JSON.parse(savedSession);
      // Check expiry
      if (new Date().getTime() > parsed.expires) {
        localStorage.removeItem("tre_user_session");
        window.location.href = "/login";
      } else {
        setSession(parsed);
      }
    } else {
      window.location.href = "/login";
    }
    setLoading(false);
  }, []);

  if (loading || !session) {
    return (
      <div className="min-h-screen bg-[#020617] flex flex-col items-center justify-center gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Verifying Session...</p>
      </div>
    );
  }

  return <SignerDashboard userEmail={session.email} />;
}
