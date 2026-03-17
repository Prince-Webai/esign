"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { FileText, Plus, Search, ChevronRight, Clock, FileUp, Copy, Check, Trash2 } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export default function Dashboard() {
  const [rams, setRams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    async function fetchRAMS() {
      // Session Protection
      const session = localStorage.getItem("tre_user_session");
      if (!session) {
        window.location.href = "/login";
        return;
      }
      const parsed = JSON.parse(session);
      if (parsed.role !== 'admin') {
        window.location.href = "/dashboard";
        return;
      }

      const { data } = await supabase
        .from("rams_documents")
        .select("*, signers(*)")
        .order("created_at", { ascending: false });
      if (data) setRams(data);
      setLoading(false);
    }
    fetchRAMS();
  }, []);


  const copyLink = (token: string) => {
    const url = `${window.location.origin}/sign/${token}`;
    navigator.clipboard.writeText(url);
    setCopiedId(token);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const deleteRams = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}"? This action cannot be undone.`)) return;

    try {
      setLoading(true);
      
      // Use the new atomic RPC for total reliability
      const { error } = await supabase.rpc('delete_rams_document', { rams_uuid: id });
      
      if (error) throw error;
      
      setRams(prev => prev.filter(r => r.id !== id));
      alert("Document deleted successfully.");
    } catch (err: any) {
      console.error("Delete failed:", err);
      alert(err.message || "Failed to delete RAMS document. Please ensure the latest SQL script has been run in your Supabase dashboard.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 p-8 max-w-7xl mx-auto">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-4xl font-bold tracking-tight mb-2 text-white">Project Hub</h1>
          <p className="text-muted-foreground">Manage your RAMS documents and track signatures in real-time.</p>
        </div>
        <div className="flex gap-4">
          <Link 
            href="/templates/new"
            className="flex items-center gap-2 px-6 py-3 rounded-xl border border-border/50 bg-secondary hover:bg-secondary/70 font-semibold transition-all"
          >
            <Plus className="w-5 h-5" />
            Create Template
          </Link>
          <Link 
            href="/rams/new"
            className="flex items-center gap-2 px-6 py-3 rounded-xl premium-gradient text-primary-foreground font-semibold shadow-lg shadow-primary/20 hover:scale-[1.02] transition-transform active:scale-95"
          >
            <FileUp className="w-5 h-5" />
            Launch RAMS
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { label: "Active RAMS", value: rams.filter(r => r.status !== 'completed').length.toString(), icon: FileText, color: "text-emerald-500" },
          { label: "Pending Signatures", value: rams.reduce((acc, r) => acc + r.signers.filter((s: any) => s.status === 'pending').length, 0).toString(), icon: Clock, color: "text-amber-500" },
          { label: "Completed Documents", value: rams.filter(r => r.status === 'completed').length.toString(), icon: FileText, color: "text-blue-500" },
        ].map((stat) => (
          <div key={stat.label} className="p-6 rounded-2xl bg-card border border-border/50 shadow-sm transition-all hover:border-primary/20">
            <div className="flex justify-between items-start mb-4">
              <div className={cn("p-3 rounded-xl bg-secondary", stat.color)}>
                <stat.icon className="w-6 h-6" />
              </div>
              <span className="text-xs font-bold text-muted-foreground bg-secondary px-2 py-1 rounded-md uppercase tracking-wider">Live</span>
            </div>
            <p className="text-3xl font-bold mb-1 text-white">{stat.value}</p>
            <p className="text-sm text-muted-foreground">{stat.label}</p>
          </div>
        ))}
      </div>

      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold tracking-tight text-white">Recent RAMS</h2>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input 
              placeholder="Search RAMS..." 
              className="bg-card border border-border/50 rounded-xl pl-10 pr-4 py-2 text-sm focus:ring-2 focus:ring-primary/20 outline-none w-64 uppercase font-bold tracking-widest"
            />
          </div>
        </div>

        <div className="bg-card border border-border/50 rounded-2xl overflow-hidden shadow-xl">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-border/50 bg-secondary/30">
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Document</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Progress</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Status</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {loading ? (
                <tr><td colSpan={5} className="px-6 py-8 text-center text-muted-foreground animate-pulse">Loading documents...</td></tr>
              ) : rams.map((doc) => (
                <tr key={doc.id} className="hover:bg-secondary/20 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="font-semibold text-sm text-white">{doc.name}</p>
                        <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Job #{doc.servicem8_job_id}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="space-y-1.5 w-48">
                      <div className="flex justify-between text-[10px] font-bold uppercase text-muted-foreground">
                        <span>{doc.signers.filter((s:any) => s.status === 'signed').length} / {doc.signers.length} Signed</span>
                      </div>
                      <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.3)] transition-all duration-500" 
                          style={{ width: `${(doc.signers.filter((s:any) => s.status === 'signed').length / doc.signers.length) * 100}%` }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={cn(
                      "inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                      doc.status === 'completed' || doc.signers.every((s:any) => s.status === 'signed') 
                        ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/30" 
                        : "bg-amber-500/10 text-amber-500 border border-amber-500/30"
                    )}>
                      {doc.signers.every((s:any) => s.status === 'signed') ? 'ALL SIGNED' : 'PENDING'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-2 w-[240px]">
                      <div className="flex flex-1 gap-2">
                        <Link 
                          href={`/rams/${doc.id}/view`}
                          className="px-4 py-2 bg-secondary text-foreground text-xs font-bold rounded-lg border border-border/50 hover:bg-secondary/70 transition-all flex items-center gap-2"
                        >
                          View
                        </Link>
                        {doc.status === 'completed' && (
                          <a 
                            href={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/rams/${doc.final_file_path}`}
                            target="_blank"
                            rel="noreferrer"
                            className="px-4 py-2 bg-emerald-500/10 text-emerald-500 text-xs font-bold rounded-lg border border-emerald-500/20 hover:bg-emerald-500/20 transition-all flex items-center gap-2"
                          >
                            Download
                          </a>
                        )}
                      </div>
                      <button 
                        onClick={() => deleteRams(doc.id, doc.name)}
                        className="p-2 text-slate-500 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all border border-transparent hover:border-red-500/20"
                        title="Delete RAMS"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
