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

  useEffect(() => { fetchData(); }, [formId]);

  async function fetchData() {
    setLoading(true);
    const { data: form } = await supabase.from("forms").select("name").eq("id", formId).single();
    if (form) setFormName(form.name);
    const { data: fieldsData } = await supabase.from("form_fields").select("id, label, type").eq("form_id", formId).order("order_index", { ascending: true });
    if (fieldsData) setFields(fieldsData);
    const { data: subData } = await supabase.from("form_submissions").select("*").eq("form_id", formId).order("submitted_at", { ascending: false });
    if (subData) setSubmissions(subData);
    setLoading(false);
  }

  async function regeneratePdf(sub: Submission) {
    try {
      const res = await fetch("/api/submit-form", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submissionId: sub.id, formId, data: sub.data })
      });
      const result = await res.json();
      if (result.success) { fetchData(); }
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
        <div className="bg-white border border-slate-200 shadow-sm rounded-[48px] p-24 text-center"><Clock className="w-12 h-12 text-slate-200 mx-auto mb-6" /><p className="text-slate-400 font-bold uppercase tracking-[0.2em] text-xs">No entries discovered in current timeline</p></div>
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
                              sub.data?.[field.id] ? (
                                <button onClick={() => window.open(sub.data?.[field.id], '_blank')} className="w-12 h-12 rounded-lg overflow-hidden border border-slate-200 hover:border-emerald-500/30 transition-all"><img src={sub.data?.[field.id]} alt="Sub" className="w-full h-full object-cover" /></button>
                              ) : <p className="text-xs text-slate-400 font-black tracking-widest">N/A</p>
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
