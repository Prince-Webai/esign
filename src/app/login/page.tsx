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
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 relative overflow-hidden text-slate-900">
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/10 rounded-full blur-[120px]" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/10 rounded-full blur-[120px]" />

      <div className="w-full max-w-md space-y-8 relative z-10">
        <div className="text-center space-y-4">
          {org.logo_url ? (
            <img src={org.logo_url} alt={org.name} className="h-16 mx-auto object-contain drop-shadow-xl mb-2" />
          ) : (
            <div className="inline-flex w-16 h-16 rounded-2xl premium-gradient items-center justify-center font-bold text-2xl text-white shadow-2xl shadow-primary/20 mb-2">
              TRE
            </div>
          )}
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">{org.name}</h1>
          <p className="text-slate-500 font-medium italic">Secure Identity-Based Signature Portal</p>
        </div>

        <div className="bg-white border border-slate-200 p-8 rounded-3xl shadow-sm space-y-6">
          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2 text-left">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Identity (Email)</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input 
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-12 py-4 text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all placeholder:text-slate-400 text-slate-900"
                  placeholder="name@example.com"
                />
              </div>
            </div>

            <div className="space-y-2 text-left">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Access PIN</label>
              <div className="relative">
                <Key className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input 
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-12 py-4 text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all placeholder:text-slate-400 text-slate-900"
                  placeholder="••••"
                />
              </div>
            </div>

            {error && (
              <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-xs text-red-500 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
            )}

            <button 
              disabled={isSubmitting}
              type="submit"
              className="w-full premium-gradient text-primary-foreground font-bold py-4 rounded-2xl shadow-xl shadow-primary/10 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : "Access Document Vault"}
            </button>
          </form>
        </div>

        <p className="text-center text-[10px] text-slate-600 font-bold uppercase tracking-[0.2em] pt-8">
          {org.name} • Secure Infrastructure
        </p>
      </div>
    </div>
  );
}
