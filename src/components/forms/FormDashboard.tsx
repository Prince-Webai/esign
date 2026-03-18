"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Plus, ListFilter, Search, FileText, Settings, Trash2, ExternalLink, Loader2, ChevronRight, Layout } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";

interface Form {
  id: string;
  name: string;
  webhook_url: string;
  created_at: string;
  submissions_count?: number;
}

export function FormDashboard() {
  const [forms, setForms] = useState<Form[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    fetchForms();
  }, []);

  async function fetchForms() {
    setLoading(true);
    const { data, error } = await supabase
      .from("forms")
      .select(`
        *,
        form_submissions(count)
      `)
      .order("created_at", { ascending: false });

    if (data) {
      setForms(data.map((f: any) => ({
        ...f,
        submissions_count: f.form_submissions?.[0]?.count || 0
      })));
    }
    setLoading(false);
  }

  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to delete this form? This will remove all fields and submissions.")) return;
    
    const { error } = await supabase.from("forms").delete().eq("id", id);
    if (!error) {
      setForms(forms.filter(f => f.id !== id));
    } else {
      alert("Error deleting form: " + error.message);
    }
  }

  const filteredForms = forms.filter(f => 
    f.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight text-white mb-2">Dynamic Forms</h1>
          <p className="text-slate-500 text-lg">Build, manage, and automate your data collection</p>
        </div>
        <Link 
          href="/forms/new" 
          className="premium-gradient px-8 py-4 rounded-2xl flex items-center gap-3 text-primary-foreground font-black shadow-2xl shadow-primary/20 hover:scale-[1.03] transition-all active:scale-95 group"
        >
          <Plus className="w-6 h-6 group-hover:rotate-90 transition-transform duration-300" />
          CREATE NEW FORM
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="md:col-span-3 relative group">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-600 group-focus-within:text-primary transition-colors" />
          <input 
            type="text" 
            placeholder="Search forms by name..."
            className="w-full bg-slate-900/40 backdrop-blur-xl border border-white/5 rounded-3xl pl-14 pr-6 py-5 text-white outline-none focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-slate-700"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="bg-slate-900/40 backdrop-blur-xl border border-white/5 rounded-3xl px-6 py-5 flex items-center justify-between text-slate-500 font-bold group hover:border-white/10 transition-colors cursor-pointer">
           <span className="flex items-center gap-3">
              <ListFilter className="w-5 h-5" />
              LATEST FIRST
           </span>
           <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-32 space-y-4">
          <Loader2 className="w-12 h-12 text-primary animate-spin" />
          <p className="text-slate-600 font-bold tracking-widest uppercase text-xs">Syncing Data Vault...</p>
        </div>
      ) : filteredForms.length === 0 ? (
        <div className="bg-slate-900/20 border border-white/5 rounded-[40px] p-24 text-center group hover:border-primary/20 transition-all duration-500">
          <div className="w-24 h-24 rounded-[32px] bg-slate-900 border border-white/5 flex items-center justify-center mx-auto mb-8 group-hover:scale-110 transition-transform duration-500">
            <Layout className="w-10 h-10 text-slate-800 group-hover:text-primary transition-colors" />
          </div>
          <h3 className="text-2xl font-bold text-slate-400 mb-2">No forms discovered</h3>
          <p className="text-slate-600 max-w-sm mx-auto mb-10">Start by creating your first automated form to begin collecting structured information.</p>
          <Link href="/forms/new" className="text-primary font-black tracking-widest uppercase text-xs flex items-center justify-center gap-2 hover:gap-4 transition-all">
            Initiate Deployment <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {filteredForms.map((form) => (
            <div 
              key={form.id} 
              className="group bg-slate-900/40 backdrop-blur-xl border border-white/5 rounded-[40px] overflow-hidden hover:border-primary/20 transition-all duration-500 hover:shadow-2xl hover:shadow-primary/5"
            >
              <div className="p-8 pb-4">
                <div className="flex justify-between items-start mb-6">
                  <div className="w-16 h-16 rounded-3xl bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform duration-500">
                    <FileText className="w-8 h-8" />
                  </div>
                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <button 
                      onClick={() => window.open(`/forms/${form.id}/preview`, '_blank')}
                      className="p-3 bg-slate-950 text-slate-500 hover:text-white rounded-2xl border border-white/5 hover:border-white/10 transition-all"
                    >
                      <ExternalLink className="w-5 h-5" />
                    </button>
                    <button 
                      onClick={() => window.location.href = `/forms/${form.id}/edit`}
                      className="p-3 bg-slate-950 text-slate-500 hover:text-primary rounded-2xl border border-white/5 hover:border-primary/20 transition-all"
                    >
                      <Settings className="w-5 h-5" />
                    </button>
                    <button 
                      onClick={() => handleDelete(form.id)}
                      className="p-3 bg-slate-950 text-slate-500 hover:text-red-500 rounded-2xl border border-white/5 hover:border-red-500/20 transition-all"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <h3 className="text-2xl font-black text-white group-hover:text-primary transition-colors cursor-pointer truncate">
                    {form.name}
                  </h3>
                  <p className="text-slate-500 font-medium line-clamp-1">
                    Webhook: {form.webhook_url || "NONE CONFIGURED"}
                  </p>
                </div>
              </div>

              <div className="px-8 py-6 bg-slate-950/40 mt-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Active Pipeline</span>
                </div>
                <div className="flex items-center gap-6">
                   <div className="text-right">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-600 mb-0.5">Submissions</p>
                      <p className="text-lg font-black text-white">{form.submissions_count}</p>
                   </div>
                   <Link 
                     href={`/forms/${form.id}/responses`}
                     className="p-2 h-10 w-10 rounded-xl bg-primary/20 text-primary flex items-center justify-center hover:bg-primary transition-all hover:text-primary-foreground group-hover:rotate-45"
                   >
                     <ChevronRight className="w-6 h-6" />
                   </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
