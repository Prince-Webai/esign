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
    <div className="space-y-8 p-4 md:p-8 max-w-7xl mx-auto animate-in fade-in slide-in-from-top-4 duration-700">
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-6 bg-white p-6 md:p-8 rounded-2xl border border-slate-200/60 shadow-sm">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight mb-1 text-slate-900">Project Hub</h1>
          <p className="text-slate-500 text-sm">Manage your RAMS documents and track signatures in real-time.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <Link 
            href="/templates/new"
            className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 font-medium transition-colors text-sm text-slate-700 shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Create Template
          </Link>
          <Link 
            href="/rams/new"
            className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-white font-medium shadow-sm hover:bg-emerald-700 transition-colors text-sm"
          >
            <FileUp className="w-4 h-4" />
            Launch RAMS
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { label: "Active RAMS", value: rams.filter(r => r.status !== 'completed').length.toString(), icon: FileText, color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-100" },
          { label: "Pending Signatures", value: rams.reduce((acc, r) => acc + r.signers.filter((s: any) => s.status === 'pending').length, 0).toString(), icon: Clock, color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-100" },
          { label: "Completed Items", value: rams.filter(r => r.status === 'completed').length.toString(), icon: Check, color: "text-blue-600", bg: "bg-blue-50", border: "border-blue-100" },
        ].map((stat) => (
          <div key={stat.label} className="p-6 rounded-2xl bg-white border border-slate-200/60 shadow-sm transition-all hover:shadow-md group">
            <div className="flex justify-between items-start mb-6">
              <div className={cn("p-3 rounded-xl transition-transform border", stat.bg, stat.color, stat.border)}>
                <stat.icon className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-medium text-slate-500 bg-slate-50 px-2.5 py-1 rounded-md border border-slate-100">Live Status</span>
            </div>
            <p className="text-3xl font-bold tracking-tight mb-1 text-slate-900">{stat.value}</p>
            <p className="text-sm font-medium text-slate-500">{stat.label}</p>
          </div>
        ))}
      </div>

      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 px-2">
          <h2 className="text-xl font-semibold tracking-tight text-slate-900 flex items-center gap-2">
             <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
             Recent Activity
          </h2>
          <div className="relative w-full sm:w-auto group">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-500 transition-colors" />
            <input 
              placeholder="Filter by name or job number..." 
              className="bg-white border border-slate-200/60 rounded-xl pl-10 pr-4 py-2 text-sm font-medium text-slate-900 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none w-full sm:w-72 transition-all placeholder:text-slate-400 shadow-sm"
            />
          </div>
        </div>

        <div className="bg-white border border-slate-200/60 rounded-2xl overflow-hidden shadow-sm overflow-x-auto custom-scrollbar">
          <table className="w-full text-left min-w-[900px]">
            <thead>
              <tr className="border-b border-slate-200/60 bg-slate-50/50">
                <th className="px-6 py-4 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Document</th>
                <th className="px-6 py-4 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Progress</th>
                <th className="px-6 py-4 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Status</th>
                <th className="px-6 py-4 text-[11px] font-semibold uppercase tracking-wider text-slate-500 text-right pr-6">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={4} className="px-6 py-12 text-center text-slate-400 font-medium text-sm animate-pulse">Loading documents...</td></tr>
              ) : rams.map((doc) => (
                <tr key={doc.id} className="hover:bg-slate-50/50 transition-all group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 group-hover:text-emerald-600 group-hover:bg-emerald-50 transition-all duration-300">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-900 text-sm truncate max-w-[240px]">{doc.name}</p>
                        <p className="text-xs text-slate-500 mt-0.5">Job #{doc.servicem8_job_id}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="space-y-2 w-48">
                      <div className="flex justify-between text-[10px] font-medium text-slate-500">
                        <span>{doc.signers.filter((s:any) => s.status === 'signed').length} / {doc.signers.length} Validated</span>
                        <span>{Math.round((doc.signers.filter((s:any) => s.status === 'signed').length / (doc.signers.length || 1)) * 100)}%</span>
                      </div>
                      <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-emerald-500 transition-all duration-700 ease-out" 
                          style={{ width: `${(doc.signers.filter((s:any) => s.status === 'signed').length / (doc.signers.length || 1)) * 100}%` }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={cn(
                      "inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-medium border transition-colors duration-300",
                      doc.signers.every((s:any) => s.status === 'signed') 
                        ? "bg-emerald-50 text-emerald-600 border-emerald-100" 
                        : "bg-amber-50 text-amber-600 border-amber-100"
                    )}>
                      {doc.signers.every((s:any) => s.status === 'signed') ? 'Completed' : 'Pending'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-2 pr-4">
                        <Link 
                          href={`/rams/${doc.id}/view`}
                          className="px-3 py-1.5 bg-white text-slate-600 text-xs font-medium rounded-lg border border-slate-200 hover:bg-slate-50 hover:text-slate-900 transition-all shadow-sm"
                        >
                          View
                        </Link>
                        {doc.status === 'completed' && (
                          <a 
                            href={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/rams/${doc.final_file_path}`}
                            download
                            className="px-3 py-1.5 bg-emerald-50 text-emerald-600 text-xs font-medium rounded-lg border border-emerald-100 hover:bg-emerald-500 hover:text-white transition-all"
                          >
                            PDF
                          </a>
                        )}
                      <button 
                        onClick={() => deleteRams(doc.id, doc.name, doc.servicem8_job_id)}
                        className="p-3 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all border border-transparent hover:border-red-100"
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
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white border border-slate-200/60 rounded-3xl w-full max-w-md p-8 shadow-xl animate-in zoom-in-95 duration-300">
            <div className="flex flex-col items-center text-center gap-6">
              <div className="p-4 bg-red-50 rounded-2xl border border-red-100 text-red-600 flex items-center justify-center">
                <Trash2 className="w-8 h-8" />
              </div>
              
              <div className="space-y-2">
                <h3 className="text-xl font-bold text-slate-900 tracking-tight">Delete document</h3>
                <p className="text-slate-500 text-sm">
                  This will permanently delete <strong className="text-slate-900 font-semibold">{documentToDelete.name}</strong> and all associated signatures. This cannot be undone.
                </p>
              </div>

              <div className="w-full space-y-6">
                <div className="space-y-2 text-left">
                  <label className="text-[11px] font-medium text-slate-500 pl-2">
                    Confirm Job Number: <span className="text-red-500 font-semibold">{documentToDelete.jobNumber}</span>
                  </label>
                  <input
                    type="text"
                    value={deleteInput}
                    onChange={(e) => setDeleteInput(e.target.value)}
                    placeholder="Type Job Number to confirm..."
                    className="w-full bg-white border border-slate-200/60 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all font-mono text-sm text-center text-slate-900 shadow-sm"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => {
                      setIsDeleteModalOpen(false);
                      setDocumentToDelete(null);
                    }}
                    disabled={isDeleting}
                    className="w-full px-4 py-2.5 bg-white text-slate-700 text-sm font-medium rounded-xl border border-slate-200/60 hover:bg-slate-50 transition-colors shadow-sm"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleFinalDelete}
                    disabled={isDeleting || deleteInput !== documentToDelete.jobNumber}
                    className="w-full px-4 py-2.5 bg-red-600 text-white text-sm font-medium rounded-xl shadow-sm hover:bg-red-700 transition-colors disabled:opacity-50"
                  >
                    {isDeleting ? "Deleting..." : "Delete"}
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
