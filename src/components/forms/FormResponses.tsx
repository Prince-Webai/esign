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
    <div className="space-y-8 animate-in fade-in slide-in-from-top-4 duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="flex items-center gap-6">
           <Link href="/forms" className="p-3 bg-white border border-slate-200 rounded-2xl text-slate-400 hover:text-slate-900 transition-colors shadow-sm"><ArrowLeft className="w-6 h-6" /></Link>
           <div className="space-y-1">
              <h1 className="text-4xl font-extrabold tracking-tight text-slate-900">{formName}</h1>
              <p className="text-emerald-500 font-bold uppercase tracking-widest text-[10px]">Transmission Hub & Insights</p>
           </div>
        </div>
        
        <div className="bg-white border border-slate-200 shadow-sm rounded-3xl p-6 flex items-center gap-8">
           <div className="text-right"><p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-0.5">Total Records</p><p className="text-2xl font-black text-slate-900">{submissions.length}</p></div>
           <div className="w-px h-10 bg-slate-100" />
           <div className="text-right"><p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-0.5">Automations</p><p className="text-2xl font-black text-emerald-500">ACTIVE</p></div>
        </div>
      </div>

      <div className="relative group">
        <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-emerald-500 transition-colors" />
        <input type="text" placeholder="Query submission data..." className="w-full bg-white border border-slate-200 shadow-sm rounded-3xl pl-16 pr-6 py-5 text-slate-900 outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500/30 transition-all placeholder:text-slate-300 font-medium" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-32 space-y-4"><Loader2 className="w-12 h-12 text-emerald-500 animate-spin" /><p className="text-slate-400 font-bold tracking-widest uppercase text-xs">Exhuming Secure Records...</p></div>
      ) : filteredSubmissions.length === 0 ? (
        <div className="bg-white border border-slate-200 shadow-sm rounded-[48px] p-24 text-center"><Clock className="w-12 h-12 text-slate-300 mx-auto mb-6" /><p className="text-slate-400 font-bold uppercase tracking-[0.2em] text-xs">No entries discovered in current timeline</p></div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
           {filteredSubmissions.map((sub) => (
             <div key={sub.id} className="group bg-white border border-slate-200 shadow-sm rounded-[32px] overflow-hidden hover:border-emerald-500/30 hover:shadow-xl hover:shadow-emerald-500/5 transition-all duration-500">
                <div className="p-8 flex flex-col lg:flex-row gap-8 items-start">
                   <div className="w-16 h-16 rounded-2xl bg-slate-50 flex flex-col items-center justify-center shrink-0 border border-slate-200 group-hover:scale-105 transition-transform duration-500">
                      <span className="text-emerald-600 font-black text-xl">{new Date(sub.submitted_at).getDate()}</span>
                      <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{new Date(sub.submitted_at).toLocaleString('default', { month: 'short' })}</span>
                   </div>

                   <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                      {fields.map(field => (
                        <div key={field.id} className="space-y-1.5 min-w-0">
                           <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">{field.label}</p>
                           {field.type === 'image' ? (
                              sub.data?.[field.id] && (Array.isArray(sub.data[field.id]) ? sub.data[field.id].length > 0 : true) ? (
                                <div className="flex flex-wrap gap-2 mt-1">
                                  {(Array.isArray(sub.data[field.id]) ? sub.data[field.id] : [sub.data[field.id]]).map((imgUrl: string, i: number) => (
                                    <div key={i} className="relative group/img w-14 h-14 rounded-xl overflow-hidden border border-slate-200 shadow-sm cursor-pointer" onClick={() => window.open(imgUrl, '_blank')}>
                                      <img src={imgUrl} alt="Thumbnail" className="w-full h-full object-cover transition-transform duration-300 group-hover/img:scale-110" />
                                      {/* Download Overlay */}
                                      <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center">
                                        <button 
                                          onClick={(e) => downloadImage(imgUrl, i, field.label, e)} 
                                          title="Download Image"
                                          className="p-1.5 bg-white hover:bg-emerald-50 text-slate-700 hover:text-emerald-600 rounded-full transition-all shadow-md transform hover:scale-110 active:scale-95"
                                        >
                                          <Download className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">N/A</p>
                           ) : (
                              <p className="text-sm font-bold text-slate-900 truncate max-w-full">{sub.data?.[field.id] || "—"}</p>

                           )}
                        </div>
                      ))}
                   </div>

                   <div className="w-full lg:w-auto flex lg:flex-col gap-3 shrink-0">
                      {sub.pdf_url && (
                        <button onClick={() => window.open(sub.pdf_url, '_blank')} className="flex-1 lg:w-full flex items-center justify-center gap-3 px-6 py-3 bg-emerald-50 text-emerald-600 rounded-2xl border border-emerald-100 font-black text-[10px] tracking-widest uppercase hover:bg-emerald-500 hover:text-white transition-all group/btn shadow-sm">
                           <Download className="w-4 h-4 group-hover/btn:translate-y-0.5 transition-transform" /> VIEW PDF
                        </button>
                      )}
                      <button onClick={() => regeneratePdf(sub)} className="flex-1 lg:w-full flex items-center justify-center gap-3 px-6 py-3 bg-blue-50 text-blue-600 rounded-2xl border border-blue-100 font-black text-[10px] tracking-widest uppercase hover:bg-blue-500 hover:text-white transition-all shadow-sm">
                         <Download className="w-4 h-4" /> REGEN PDF
                      </button>
                      <button onClick={() => setDeletingId(sub.id)} className="flex-1 lg:w-full flex items-center justify-center gap-3 px-6 py-3 bg-red-50 text-red-500 rounded-2xl border border-red-100 font-black text-[10px] tracking-widest uppercase hover:bg-red-500 hover:text-white transition-all shadow-sm">
                         <Trash2 className="w-4 h-4" /> DELETE
                      </button>
                      <div className="flex-1 lg:w-full px-6 py-3 bg-slate-50 rounded-2xl border border-slate-200 text-center shadow-inner">
                         <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Status</p>
                         <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">{sub.status}</p>
                      </div>
                   </div>
                </div>
             </div>
           ))}

           {hasMore && (
              <div className="flex justify-center pt-8">
                <button 
                  onClick={() => fetchData(true)} 
                  disabled={loadingMore}
                  className="px-8 py-4 bg-white border border-slate-200 text-slate-600 font-bold rounded-2xl shadow-sm hover:border-emerald-500 hover:text-emerald-600 transition-all active:scale-95 disabled:opacity-50 flex items-center gap-3"
                >
                  {loadingMore ? <Loader2 className="w-5 h-5 animate-spin" /> : <Clock className="w-5 h-5" />}
                  {loadingMore ? "EXCAVATING RECORDS..." : "LOAD OLDER RECORDS"}
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
        confirmText="DESTRUCTION CONFIRMED"
        isLoading={isDeleting}
      />
    </div>
  );
}
