"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { FileStack, Plus, ChevronLeft } from "lucide-react";
import Link from "next/link";

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchTemplates() {
      const { data } = await supabase
        .from("rams_templates")
        .select("*")
        .order("created_at", { ascending: false });
      if (data) setTemplates(data);
      setLoading(false);
    }
    fetchTemplates();
  }, []);

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-end">
        <div className="flex items-center gap-4">
          <Link 
            href="/" 
            className="p-2 h-10 w-10 flex items-center justify-center rounded-xl bg-secondary hover:bg-secondary/70 transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white">RAMS Templates</h1>
            <p className="text-muted-foreground">Manage your reusable signature placements.</p>
          </div>
        </div>
        <Link 
          href="/templates/new"
          className="flex items-center gap-2 px-6 py-3 rounded-xl premium-gradient text-primary-foreground font-semibold shadow-lg shadow-primary/20 hover:scale-[1.02] transition-transform active:scale-95"
        >
          <Plus className="w-5 h-5" />
          New Template
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <p className="text-muted-foreground animate-pulse">Loading templates...</p>
        ) : templates.length === 0 ? (
          <div className="col-span-full p-12 text-center border border-dashed border-border/50 rounded-2xl bg-secondary/20">
            <FileStack className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-sm text-muted-foreground">No templates created yet.</p>
          </div>
        ) : templates.map((t) => (
          <div key={t.id} className="p-6 rounded-2xl bg-card border border-border/50 shadow-sm transition-all hover:border-primary/20 group">
            <div className="flex justify-between items-start mb-4">
               <div className="p-3 rounded-xl bg-secondary text-primary">
                 <FileStack className="w-6 h-6" />
               </div>
               <span className="text-[10px] font-bold text-muted-foreground bg-secondary px-2 py-1 rounded-md uppercase tracking-wider">
                 {new Date(t.created_at).toLocaleDateString()}
               </span>
            </div>
            <h3 className="text-xl font-bold text-white mb-1">{t.name}</h3>
            <p className="text-sm text-muted-foreground mb-6">Standard signature mapping for {t.name}.</p>
            <div className="flex gap-2">
               <Link href={`/templates/${t.id}`} className="flex-1 text-center py-2 text-xs font-bold rounded-lg bg-secondary hover:bg-secondary/70 transition-colors">
                 Edit
               </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
