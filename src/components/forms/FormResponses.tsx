"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Loader2, ArrowLeft, Download, FileText, Search, Clock, Trash2 } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { ConfirmationModal } from "@/components/ConfirmationModal";

interface Submission {
  id: string; data: Record<string, any>; pdf_url: string; submitted_at: string; status: string;
}
interface FormField {
  id: string; label: string; type: string;
}

export function FormResponses({ formId }: { formId: string }) {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [fields, setFields] = useState<FormField[]>([]);
  const [formName, setFormName] = useState("");
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const PAGE_SIZE = 10;
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => { fetchData(false); }, [formId]);

  async function fetchData(isLoadMore = false) {
    if (!isLoadMore) setLoading(true);
    else setLoadingMore(true);

    try {
      if (!isLoadMore) {
        const [formRes, fieldsRes] = await Promise.all([
          supabase.from("forms").select("name").eq("id", formId).single(),
          supabase.from("form_fields").select("id, label, type").eq("form_id", formId).order("order_index", { ascending: true })
        ]);
        if (formRes.data) setFormName(formRes.data.name);
        if (fieldsRes.data) setFields(fieldsRes.data);
      }

      const currentPage = isLoadMore ? page + 1 : 0;
      const from = currentPage * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      const { data: subData, count } = await supabase
        .from("form_submissions")
        .select("*", { count: 'exact' })
        .eq("form_id", formId)
        .order("submitted_at", { ascending: false })
        .range(from, to);

      if (subData) {
        if (isLoadMore) {
          setSubmissions(prev => [...prev, ...subData]);
        } else {
          setSubmissions(subData);
        }
        setPage(currentPage);
        setHasMore(count !== null ? from + PAGE_SIZE < count : false);
      }
    } catch (err) {
      console.error("Failed to fetch data:", err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }

  async function regeneratePdf(sub: Submission) {
    try {
      const res = await fetch("/api/submit-form", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submissionId: sub.id, formId, data: sub.data, isRegeneration: true })
      });

      const result = await res.json();
      if (result.success) { fetchData(false); }
      else { alert("PDF regeneration failed: " + result.error); }
    } catch (e: any) { alert("Error: " + e.message); }
  }

  async function deleteSubmission() {
    if (!deletingId) return;
    setIsDeleting(true);
    const { error } = await supabase.from("form_submissions").delete().eq("id", deletingId);
    if (!error) {
      setSubmissions(prev => prev.filter(s => s.id !== deletingId));
      setDeletingId(null);
    } else {
      console.error("Delete submission error:", error);
      alert(`Delete failed: ${error.message}`);
    }
    setIsDeleting(false);
  }

  const downloadImage = async (url: string, index: number, fieldLabel: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      // Create a clean filename
      const cleanLabel = (fieldLabel || 'image').replace(/[^a-z0-9]/gi, '_').toLowerCase();
      const filename = `${cleanLabel}-${index + 1}.png`;

      // Fetch the image as a blob to force download
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error('Download failed:', error);
      // Fallback: just open in new tab
      window.open(url, '_blank');
    }
  };


  const filteredSubmissions = submissions.filter(s => JSON.stringify(s.data).toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-top-4 duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="flex items-center gap-4">
           <Link href="/forms" className="p-2 bg-white border border-slate-200/60 rounded-xl text-slate-500 hover:bg-slate-50 hover:text-slate-900 transition-colors shadow-sm"><ArrowLeft className="w-5 h-5" /></Link>
           <div className="space-y-0.5">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">{formName}</h1>
              <p className="text-sm font-medium text-slate-500">Manage form submissions</p>
           </div>
        </div>
        
        <div className="bg-white border border-slate-200/60 shadow-sm rounded-2xl p-4 flex items-center gap-6">
           <div className="text-right"><p className="text-[10px] font-medium uppercase tracking-wider text-slate-500 mb-0.5">Total Records</p><p className="text-xl font-bold text-slate-900">{submissions.length}</p></div>
           <div className="w-px h-8 bg-slate-200" />
           <div className="text-right"><p className="text-[10px] font-medium uppercase tracking-wider text-slate-500 mb-0.5">Automations</p><p className="text-xl font-bold text-emerald-600">Active</p></div>
        </div>
      </div>

      <div className="relative group">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-emerald-500 transition-colors" />
        <input type="text" placeholder="Search submissions..." className="w-full bg-white border border-slate-200/60 shadow-sm rounded-xl pl-10 pr-4 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all placeholder:text-slate-400 font-medium" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 space-y-4"><Loader2 className="w-8 h-8 text-emerald-500 animate-spin" /><p className="text-slate-500 font-medium text-sm">Loading submissions...</p></div>
      ) : filteredSubmissions.length === 0 ? (
        <div className="bg-white border border-slate-200/60 shadow-sm rounded-2xl p-16 text-center"><Clock className="w-10 h-10 text-slate-400 mx-auto mb-4" /><p className="text-slate-500 font-medium text-sm">No submissions found for this form.</p></div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
           {filteredSubmissions.map((sub) => (
             <div key={sub.id} className="group bg-white border border-slate-200/60 shadow-sm rounded-2xl overflow-hidden hover:shadow-md transition-shadow duration-300">
                <div className="p-6 flex flex-col lg:flex-row gap-6 items-start">
                   <div className="w-12 h-12 rounded-xl bg-slate-50 flex flex-col items-center justify-center shrink-0 border border-slate-200/60">
                      <span className="text-emerald-600 font-bold text-lg leading-none">{new Date(sub.submitted_at).getDate()}</span>
                      <span className="text-[9px] font-medium text-slate-500 uppercase tracking-widest mt-0.5">{new Date(sub.submitted_at).toLocaleString('default', { month: 'short' })}</span>
                   </div>

                   <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {fields.map(field => (
                        <div key={field.id} className="space-y-1.5 min-w-0">
                           <p className="text-xs font-medium text-slate-500">{field.label}</p>
                           {field.type === 'image' ? (
                              sub.data?.[field.id] && (Array.isArray(sub.data[field.id]) ? sub.data[field.id].length > 0 : true) ? (
                                <div className="flex flex-wrap gap-2 mt-1">
                                  {(Array.isArray(sub.data[field.id]) ? sub.data[field.id] : [sub.data[field.id]]).map((imgUrl: string, i: number) => (
                                    <div key={i} className="relative group/img w-14 h-14 rounded-xl overflow-hidden border border-slate-200/60 shadow-sm cursor-pointer" onClick={() => window.open(imgUrl, '_blank')}>
                                      <img src={imgUrl} alt="Thumbnail" className="w-full h-full object-cover transition-transform duration-300 group-hover/img:scale-110" />
                                      {/* Download Overlay */}
                                      <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center">
                                        <button 
                                          onClick={(e) => downloadImage(imgUrl, i, field.label, e)} 
                                          title="Download Image"
                                          className="p-1.5 bg-white hover:bg-emerald-50 text-slate-700 hover:text-emerald-600 rounded-lg transition-colors shadow-md"
                                        >
                                          <Download className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : <p className="text-sm font-medium text-slate-400 mt-1">N/A</p>
                           ) : (
                              <p className="text-sm font-medium text-slate-900 truncate max-w-full">{sub.data?.[field.id] || "—"}</p>

                           )}
                        </div>
                      ))}
                   </div>

                   <div className="w-full lg:w-auto flex lg:flex-col gap-2 shrink-0">
                      {sub.pdf_url && (
                        <button onClick={() => window.open(sub.pdf_url, '_blank')} className="flex-1 lg:w-full flex items-center justify-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-100 font-medium text-sm hover:bg-emerald-100 transition-colors shadow-sm">
                           <Download className="w-4 h-4" /> View PDF
                        </button>
                      )}
                      <button onClick={() => regeneratePdf(sub)} className="flex-1 lg:w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-xl border border-blue-100 font-medium text-sm hover:bg-blue-100 transition-colors shadow-sm">
                         <Download className="w-4 h-4" /> Regen PDF
                      </button>
                      <button onClick={() => setDeletingId(sub.id)} className="flex-1 lg:w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-xl border border-red-100 font-medium text-sm hover:bg-red-100 transition-colors shadow-sm">
                         <Trash2 className="w-4 h-4" /> Delete
                      </button>
                      <div className="flex-1 lg:w-full px-4 py-2 bg-slate-50/50 rounded-xl border border-slate-200/60 text-center shadow-sm">
                         <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wider mb-0.5">Status</p>
                         <p className="text-xs font-bold text-emerald-600 uppercase tracking-wide">{sub.status}</p>
                      </div>
                   </div>
                </div>
             </div>
           ))}

           {hasMore && (
              <div className="flex justify-center pt-6">
                <button 
                  onClick={() => fetchData(true)} 
                  disabled={loadingMore}
                  className="px-6 py-2 bg-white flex items-center gap-2 border border-slate-200/60 text-slate-600 font-medium text-sm rounded-xl shadow-sm hover:bg-slate-50 focus:ring-2 focus:ring-emerald-500/20 transition-all disabled:opacity-50"
                >
                  {loadingMore ? <Loader2 className="w-4 h-4 animate-spin" /> : <Clock className="w-4 h-4" />}
                  {loadingMore ? "Loading..." : "Load more submissions"}
                </button>
              </div>
           )}
        </div>
      )}

      <ConfirmationModal 
        isOpen={!!deletingId}
        onClose={() => setDeletingId(null)}
        onConfirm={deleteSubmission}
        title="Delete Record"
        message="Are you sure you want to permanently delete this submission? This action cannot be reversed and all data within this record will be lost."
        confirmText="Delete"
        isLoading={isDeleting}
      />
    </div>
  );
}
