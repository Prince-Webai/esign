"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Loader2, ArrowLeft, Download, Calendar, User, FileText, Layout, ExternalLink, ChevronRight, Search, Clock } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface Submission {
  id: string;
  data: Record<string, any>;
  pdf_url: string;
  submitted_at: string;
  status: string;
}

interface FormField {
  id: string;
  label: string;
  type: string;
}

export function FormResponses({ formId }: { formId: string }) {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [fields, setFields] = useState<FormField[]>([]);
  const [formName, setFormName] = useState("");
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    fetchData();
  }, [formId]);

  async function fetchData() {
    setLoading(true);
    
    // 1. Fetch form and fields
    const { data: form } = await supabase.from("forms").select("name").eq("id", formId).single();
    if (form) setFormName(form.name);

    const { data: fieldsData } = await supabase.from("form_fields").select("id, label, type").eq("form_id", formId).order("order_index", { ascending: true });
    if (fieldsData) setFields(fieldsData);

    // 2. Fetch submissions
    const { data: subData } = await supabase.from("form_submissions").select("*").eq("form_id", formId).order("submitted_at", { ascending: false });
    if (subData) setSubmissions(subData);
    
    setLoading(false);
  }

  const filteredSubmissions = submissions.filter(s => 
    JSON.stringify(s.data).toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-top-4 duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="flex items-center gap-6">
           <Link href="/forms" className="p-3 bg-slate-900 border border-white/5 rounded-2xl text-slate-500 hover:text-white transition-colors">
              <ArrowLeft className="w-6 h-6" />
           </Link>
           <div className="space-y-1">
              <h1 className="text-4xl font-extrabold tracking-tight text-white">{formName}</h1>
              <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px]">Transmission Hub & Insights</p>
           </div>
        </div>
        
        <div className="bg-slate-900/40 border border-white/5 rounded-3xl p-6 flex items-center gap-8">
           <div className="text-right">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-0.5">Total Records</p>
              <p className="text-2xl font-black text-white">{submissions.length}</p>
           </div>
           <div className="w-px h-10 bg-white/5" />
           <div className="text-right">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-0.5">Automations</p>
              <p className="text-2xl font-black text-emerald-500">ACTIVE</p>
           </div>
        </div>
      </div>

      <div className="relative group">
        <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-600 group-focus-within:text-primary transition-colors" />
        <input 
          type="text" 
          placeholder="Query submission data..."
          className="w-full bg-slate-900/40 backdrop-blur-xl border border-white/5 rounded-3xl pl-16 pr-6 py-5 text-white outline-none focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-slate-700 font-medium"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-32 space-y-4">
          <Loader2 className="w-12 h-12 text-primary animate-spin" />
          <p className="text-slate-600 font-bold tracking-widest uppercase text-xs">Exhuming Secure Records...</p>
        </div>
      ) : filteredSubmissions.length === 0 ? (
        <div className="bg-slate-900/40 border border-white/5 rounded-[48px] p-24 text-center">
           <Clock className="w-12 h-12 text-slate-800 mx-auto mb-6" />
           <p className="text-slate-500 font-bold uppercase tracking-[0.2em] text-xs">No entries discovered in current timeline</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
           {filteredSubmissions.map((sub) => (
             <div key={sub.id} className="group bg-slate-900/40 backdrop-blur-xl border border-white/5 rounded-[32px] overflow-hidden hover:border-primary/20 transition-all duration-300">
                <div className="p-8 flex flex-col lg:flex-row gap-8 items-start">
                   <div className="w-16 h-16 rounded-2xl bg-slate-950 flex flex-col items-center justify-center shrink-0 border border-white/5 group-hover:scale-105 transition-transform duration-500">
                      <span className="text-primary font-black text-xl">{new Date(sub.submitted_at).getDate()}</span>
                      <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">{new Date(sub.submitted_at).toLocaleString('default', { month: 'short' })}</span>
                   </div>

                   <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                      {fields.map(field => (
                        <div key={field.id} className="space-y-1.5 min-w-0">
                           <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">{field.label}</p>
                           {field.type === 'image' ? (
                              sub.data[field.id] ? (
                                <button 
                                  onClick={() => window.open(sub.data[field.id], '_blank')}
                                  className="w-12 h-12 rounded-lg overflow-hidden border border-white/5 hover:border-primary/30 transition-all"
                                >
                                   <img src={sub.data[field.id]} alt="Sub" className="w-full h-full object-cover" />
                                </button>
                              ) : <p className="text-xs text-slate-800 font-black tracking-widest">N/A</p>
                           ) : (
                              <p className="text-sm font-bold text-white truncate max-w-full">
                                 {sub.data[field.id] || "—"}
                              </p>
                           )}
                        </div>
                      ))}
                   </div>

                   <div className="w-full lg:w-auto flex lg:flex-col gap-3 shrink-0">
                      {sub.pdf_url && (
                        <button 
                          onClick={() => window.open(sub.pdf_url, '_blank')}
                          className="flex-1 lg:w-full flex items-center justify-center gap-3 px-6 py-3 bg-emerald-500/10 text-emerald-500 rounded-2xl border border-emerald-500/20 font-black text-[10px] tracking-widest uppercase hover:bg-emerald-500 hover:text-white transition-all group/btn"
                        >
                           <Download className="w-4 h-4 group-hover/btn:translate-y-0.5 transition-transform" />
                           REPORT PDF
                        </button>
                      )}
                      <div className="flex-1 lg:w-full px-6 py-3 bg-slate-950 rounded-2xl border border-white/5 text-center">
                         <p className="text-[8px] font-black text-slate-600 uppercase tracking-widest mb-0.5">Status</p>
                         <p className="text-[10px] font-black text-primary uppercase tracking-widest">{sub.status}</p>
                      </div>
                   </div>
                </div>
             </div>
           ))}
        </div>
      )}
    </div>
  );
}
