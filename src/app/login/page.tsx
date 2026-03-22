"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Key, Mail, Loader2, ShieldCheck, ArrowRight } from "lucide-react";
import { useOrganization } from "@/hooks/useOrganization";

export default function LoginPage() {
  const { org } = useOrganization();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError("");

    try {
      // 1. Fetch user by email
      const { data: user, error: fetchError } = await supabase
        .from("registered_users")
        .select("*")
        .eq("email", email)
        .single();

      if (fetchError || !user) {
        throw new Error("User not found or incorrect credentials.");
      }

      // 2. Validate PIN/Password
      if (user.password_hash === password) {
        // Handle missing role column gracefully
        const userRole = user.role || 'admin'; // Default to admin for now if role missing
        
        const session = {
          userId: user.id,
          email: user.email,
          role: userRole,
          name: user.name,
          expires: new Date().getTime() + 24 * 60 * 60 * 1000
        };
        
        localStorage.setItem("tre_user_session", JSON.stringify(session));
        
        // Redirect
        if (userRole === 'admin') {
          window.location.href = "/";
        } else {
          window.location.href = "/dashboard";
        }
      } else {
        throw new Error("Incorrect password or PIN.");
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 relative overflow-hidden text-slate-900 animate-in fade-in duration-500">
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-500/5 rounded-full blur-[120px]" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/5 rounded-full blur-[120px]" />

      <div className="w-full max-w-md space-y-8 relative z-10">
        <div className="text-center space-y-3">
          {org.logo_url ? (
            <img src={org.logo_url} alt={org.name} className="h-20 max-w-[280px] mx-auto object-contain drop-shadow-sm mb-4" />
          ) : (
            <div className="inline-flex w-14 h-14 rounded-xl bg-emerald-600 items-center justify-center font-bold text-xl text-white shadow-sm mb-2">
              TRE
            </div>
          )}
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">{org.name}</h1>
          <p className="text-sm font-medium text-slate-500">Secure Identity-Based Signature Portal</p>
        </div>

        <div className="bg-white border border-slate-200/60 p-8 rounded-2xl shadow-sm space-y-6">
          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-2 text-left">
              <label className="text-sm font-medium text-slate-700 ml-1">Identity (Email)</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input 
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-white shadow-sm border border-slate-200/60 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all placeholder:text-slate-400 text-slate-900 font-medium"
                  placeholder="name@example.com"
                />
              </div>
            </div>

            <div className="space-y-2 text-left">
              <label className="text-sm font-medium text-slate-700 ml-1">Access PIN</label>
              <div className="relative">
                <Key className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input 
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-white shadow-sm border border-slate-200/60 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all placeholder:text-slate-400 text-slate-900 font-medium"
                  placeholder="••••"
                />
              </div>
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-sm font-medium text-red-600 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
            )}

            <button 
              disabled={isSubmitting}
              type="submit"
              className="w-full bg-emerald-600 text-white font-medium py-2.5 rounded-xl shadow-sm hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : "Access Document Vault"}
            </button>
          </form>
        </div>

        <p className="text-center text-xs font-medium text-slate-500 pt-6">
          {org.name} • Secure Infrastructure
        </p>
      </div>
    </div>
  );
}
