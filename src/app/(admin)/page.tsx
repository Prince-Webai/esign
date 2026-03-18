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

  // Custom Modal State
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [documentToDelete, setDocumentToDelete] = useState<{ id: string; name: string; jobNumber: string } | null>(null);
  const [deleteInput, setDeleteInput] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

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

  const deleteRams = (id: string, name: string, jobNumber: string) => {
    setDocumentToDelete({ id, name, jobNumber });
    setDeleteInput("");
    setIsDeleteModalOpen(true);
  };

  const handleFinalDelete = async () => {
    if (!documentToDelete || deleteInput !== documentToDelete.jobNumber) return;

    try {
      setIsDeleting(true);
      
      // Use the new atomic RPC for total reliability
      const { error } = await supabase.rpc('delete_rams_document', { rams_uuid: documentToDelete.id });
      
      if (error) throw error;
      
      setRams(prev => prev.filter(r => r.id !== documentToDelete.id));
      setIsDeleteModalOpen(false);
      setDocumentToDelete(null);
      alert("Document deleted successfully.");
    } catch (err: any) {
      console.error("Delete failed:", err);
      alert(err.message || "Failed to delete RAMS document.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-12 p-4 md:p-8 max-w-7xl mx-auto animate-in fade-in slide-in-from-top-4 duration-700">
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-8 bg-white p-10 rounded-[40px] border border-slate-200 shadow-xl shadow-slate-900/5">
        <div>
          <h1 className="text-4xl font-black tracking-tight mb-2 text-slate-900">Project Hub</h1>
          <p className="text-slate-500 font-medium text-lg">Manage your RAMS documents and track signatures in real-time.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-4">
          <Link 
            href="/templates/new"
            className="flex items-center justify-center gap-3 px-8 py-4 rounded-2xl border border-slate-200 bg-slate-50 hover:bg-slate-100 font-black transition-all text-[11px] uppercase tracking-widest text-slate-600 shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Create Template
          </Link>
          <Link 
            href="/rams/new"
            className="flex items-center justify-center gap-3 px-8 py-4 rounded-2xl bg-emerald-600 text-white font-black shadow-xl shadow-emerald-500/20 hover:bg-emerald-700 hover:scale-[1.03] transition-all active:scale-95 text-[11px] uppercase tracking-widest"
          >
            <FileUp className="w-4 h-4" />
            Launch RAMS
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {[
          { label: "Active RAMS", value: rams.filter(r => r.status !== 'completed').length.toString(), icon: FileText, color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-100" },
          { label: "Pending Signatures", value: rams.reduce((acc, r) => acc + r.signers.filter((s: any) => s.status === 'pending').length, 0).toString(), icon: Clock, color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-100" },
          { label: "Completed Items", value: rams.filter(r => r.status === 'completed').length.toString(), icon: Check, color: "text-blue-600", bg: "bg-blue-50", border: "border-blue-100" },
        ].map((stat) => (
          <div key={stat.label} className="p-8 rounded-[32px] bg-white border border-slate-200 shadow-sm transition-all hover:shadow-xl hover:shadow-slate-900/5 group">
            <div className="flex justify-between items-start mb-6">
              <div className={cn("p-4 rounded-2xl transition-transform group-hover:scale-110 duration-300 border", stat.bg, stat.color, stat.border)}>
                <stat.icon className="w-6 h-6" />
              </div>
              <span className="text-[10px] font-black text-slate-400 bg-slate-50 px-3 py-1.5 rounded-full uppercase tracking-widest border border-slate-100">Live Status</span>
            </div>
            <p className="text-4xl font-black mb-1 text-slate-900 tracking-tight">{stat.value}</p>
            <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">{stat.label}</p>
          </div>
        ))}
      </div>

      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-6 px-4">
          <h2 className="text-2xl font-black tracking-tight text-slate-900 flex items-center gap-3">
             <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.4)]" />
             Recent RAMS Activity
          </h2>
          <div className="relative w-full sm:w-auto group">
            <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-500 transition-colors" />
            <input 
              placeholder="Filter by name or job number..." 
              className="bg-white border border-slate-200 rounded-2xl pl-12 pr-6 py-3 text-sm font-bold text-slate-900 focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500/30 outline-none w-full sm:w-80 transition-all placeholder:text-slate-300 shadow-sm"
            />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-[40px] overflow-hidden shadow-xl shadow-slate-900/5 overflow-x-auto custom-scrollbar">
          <table className="w-full text-left min-w-[900px]">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50">
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Document Configuration</th>
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Execution Progress</th>
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Status</th>
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 text-right pr-12">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr><td colSpan={4} className="px-8 py-16 text-center text-slate-400 font-bold uppercase tracking-widest text-xs animate-pulse">Synchronizing Recordset...</td></tr>
              ) : rams.map((doc) => (
                <tr key={doc.id} className="hover:bg-slate-50/80 transition-all group">
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-5">
                      <div className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-emerald-600 group-hover:text-white group-hover:border-emerald-600 transition-all duration-300 shadow-sm">
                        <FileText className="w-6 h-6" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-black text-slate-900 text-[15px] truncate max-w-[240px] tracking-tight">{doc.name}</p>
                        <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest mt-0.5">Job #{doc.servicem8_job_id}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <div className="space-y-2.5 w-48">
                      <div className="flex justify-between text-[9px] font-black uppercase tracking-widest text-slate-400">
                        <span>{doc.signers.filter((s:any) => s.status === 'signed').length} / {doc.signers.length} Validated</span>
                        <span>{Math.round((doc.signers.filter((s:any) => s.status === 'signed').length / (doc.signers.length || 1)) * 100)}%</span>
                      </div>
                      <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden shadow-inner">
                        <div 
                          className="h-full bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.4)] transition-all duration-700 ease-out" 
                          style={{ width: `${(doc.signers.filter((s:any) => s.status === 'signed').length / (doc.signers.length || 1)) * 100}%` }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <span className={cn(
                      "inline-flex items-center px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border transition-all duration-300",
                      doc.signers.every((s:any) => s.status === 'signed') 
                        ? "bg-emerald-50 text-emerald-600 border-emerald-100 shadow-sm" 
                        : "bg-amber-50 text-amber-600 border-amber-100 shadow-sm"
                    )}>
                      {doc.signers.every((s:any) => s.status === 'signed') ? 'ALL SIGNED' : 'PENDING'}
                    </span>
                  </td>
                  <td className="px-8 py-6">
                    <div className="flex items-center justify-end gap-3 pr-4">
                        <Link 
                          href={`/rams/${doc.id}/view`}
                          className="px-5 py-2.5 bg-white text-slate-600 text-[10px] font-black uppercase tracking-widest rounded-xl border border-slate-200 hover:bg-slate-50 hover:text-slate-900 transition-all shadow-sm"
                        >
                          View
                        </Link>
                        {doc.status === 'completed' && (
                          <a 
                            href={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/rams/${doc.final_file_path}`}
                            target="_blank"
                            rel="noreferrer"
                            className="px-5 py-2.5 bg-emerald-50 text-emerald-600 text-[10px] font-black uppercase tracking-widest rounded-xl border border-emerald-100 hover:bg-emerald-600 hover:text-white transition-all shadow-sm"
                          >
                            Download
                          </a>
                        )}
                      <button 
                        onClick={() => deleteRams(doc.id, doc.name, doc.servicem8_job_id)}
                        className="p-3 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all border border-transparent hover:border-red-100"
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
          {!loading && rams.length === 0 && (
            <div className="py-32 text-center text-slate-400 font-bold uppercase tracking-widest text-xs flex flex-col items-center gap-4">
               <FileText className="w-12 h-12 text-slate-300" />
               No records found in active set
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && documentToDelete && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white border border-slate-200 rounded-[40px] w-full max-w-lg p-12 shadow-2xl animate-in zoom-in-95 duration-500">
            <div className="flex flex-col items-center text-center gap-8">
              <div className="p-6 bg-red-50 rounded-[32px] border border-red-100 text-red-500 flex items-center justify-center">
                <Trash2 className="w-10 h-10" />
              </div>
              
              <div className="space-y-3">
                <h3 className="text-3xl font-black text-slate-900 tracking-tight">Erase Document?</h3>
                <p className="text-slate-500 font-medium text-lg leading-relaxed">
                  This will permanently delete <strong className="text-slate-900 font-bold">{documentToDelete.name}</strong> and all associated signature records. This cannot be undone.
                </p>
              </div>

              <div className="w-full space-y-6">
                <div className="space-y-2.5 text-left">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 pl-4">
                    Confirm Job Number: <span className="text-red-500 font-black">{documentToDelete.jobNumber}</span>
                  </label>
                  <input
                    type="text"
                    value={deleteInput}
                    onChange={(e) => setDeleteInput(e.target.value)}
                    placeholder="Type Job Number to confirm..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-3xl px-8 py-5 outline-none focus:ring-4 focus:ring-red-500/10 focus:border-red-500/30 transition-all font-mono font-bold text-center text-slate-900"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={() => {
                      setIsDeleteModalOpen(false);
                      setDocumentToDelete(null);
                    }}
                    disabled={isDeleting}
                    className="w-full px-8 py-5 bg-slate-50 text-slate-600 text-[11px] font-black uppercase tracking-widest rounded-3xl border border-slate-200 hover:bg-slate-100 transition-all shadow-sm"
                  >
                    Keep Secure
                  </button>
                  <button
                    onClick={handleFinalDelete}
                    disabled={isDeleting || deleteInput !== documentToDelete.jobNumber}
                    className="w-full px-8 py-5 bg-red-500 text-white text-[11px] font-black uppercase tracking-widest rounded-3xl shadow-xl shadow-red-500/20 hover:bg-red-600 transition-all disabled:opacity-30 active:scale-95 transition-all"
                  >
                    {isDeleting ? "Shredding..." : "Confirm Deletion"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
