"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Plus, Search, FileText, Edit2, Trash2, ExternalLink, Loader2, MoreVertical, Layout } from "lucide-react";
import Link from "next/link";
import { ConfirmationModal } from "@/components/ConfirmationModal";

interface Form {
  id: string; name: string; webhook_url: string; created_at: string; submission_count?: number;
}

export function FormDashboard() {
  const [forms, setForms] = useState<Form[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [deletingFormId, setDeletingFormId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    fetchForms();
    const closeMenu = () => setOpenMenuId(null);
    window.addEventListener('click', closeMenu);
    return () => window.removeEventListener('click', closeMenu);
  }, []);

  async function fetchForms() {
    setLoading(true);
    const { data, error } = await supabase.from("forms").select(`*, form_submissions(count)`).order("created_at", { ascending: false });
    if (data) setForms(data.map((f: any) => ({ ...f, submission_count: f.form_submissions?.[0]?.count || 0 })));
    setLoading(false);
  }

  async function deleteForm() {
    if (!deletingFormId) return;
    setIsDeleting(true);
    const { error } = await supabase.from("forms").delete().eq("id", deletingFormId);
    if (!error) {
      setForms(forms.filter(f => f.id !== deletingFormId));
      setDeletingFormId(null);
      setOpenMenuId(null);
    }
    else alert("Error deleting form: " + error.message);
    setIsDeleting(false);
  }

  const filteredForms = forms.filter(f => f.name.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-top-4 duration-500" onClick={() => setOpenMenuId(null)}>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-white p-8 rounded-[32px] border border-slate-200 shadow-sm">
        <div className="space-y-1">
          <h1 className="text-4xl font-extrabold tracking-tight text-slate-900">Form Ecosystem</h1>
          <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px] flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]" /> Strategic Data Management</p>
        </div>
        <Link href="/forms/new" className="bg-emerald-600 px-8 py-4 rounded-2xl flex items-center gap-3 text-white font-black text-sm shadow-xl shadow-emerald-500/20 hover:bg-emerald-700 transition-all hover:scale-[1.03] active:scale-95 group"><Plus className="w-5 h-5 group-hover:rotate-90 transition-transform duration-300" /> CREATE NEW FORM</Link>
      </div>

      <div className="relative group max-w-2xl">
        <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-emerald-600 transition-colors" />
        <input type="text" placeholder="Filtering through active form configurations..." className="w-full bg-white border border-slate-200 rounded-3xl pl-16 pr-6 py-5 text-slate-900 outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500/30 transition-all placeholder:text-slate-300 shadow-sm" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-32 space-y-4"><Loader2 className="w-12 h-12 text-emerald-600 animate-spin" /><p className="text-slate-400 font-bold tracking-widest uppercase text-xs">Synchronizing Records...</p></div>
      ) : filteredForms.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-[48px] p-24 text-center shadow-sm"><FileText className="w-16 h-16 text-slate-300 mx-auto mb-6" /><p className="text-slate-400 font-bold uppercase tracking-[0.2em] text-xs">No active configurations detected</p><Link href="/forms/new" className="mt-8 inline-block text-emerald-600 font-black text-xs uppercase tracking-widest hover:text-emerald-700 transition-colors">Initialize first form →</Link></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {filteredForms.map((form) => (
            <div key={form.id} className="group bg-white border border-slate-200 rounded-[32px] p-8 hover:border-emerald-500/30 transition-all duration-500 hover:shadow-xl hover:shadow-emerald-500/5 relative">
               
               {/* 3-Dot Action Menu */}
               <div className="absolute right-6 top-6 z-10" onClick={(e) => e.stopPropagation()}>
                  <button onClick={() => setOpenMenuId(openMenuId === form.id ? null : form.id)} className="p-2 text-slate-400 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 rounded-lg transition-colors border border-slate-100"><MoreVertical className="w-5 h-5" /></button>
                  {openMenuId === form.id && (
                    <div className="absolute right-0 mt-2 w-48 bg-white border border-slate-200 rounded-2xl shadow-xl py-2 z-50 animate-in fade-in zoom-in-95 duration-200">
                      <Link href={`/forms/${form.id}`} target="_blank" className="flex items-center gap-3 px-4 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"><ExternalLink className="w-4 h-4" /> View Form</Link>
                      <Link href={`/forms/${form.id}/responses`} className="flex items-center gap-3 px-4 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50 hover:text-emerald-600 transition-colors"><Layout className="w-4 h-4" /> Submissions</Link>
                      <Link href={`/forms/${form.id}/edit`} className="flex items-center gap-3 px-4 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50 hover:text-blue-600 transition-colors"><Edit2 className="w-4 h-4" /> Edit Form</Link>
                      <div className="h-px bg-slate-100 my-1 mx-4" />
                      <button onClick={() => setDeletingFormId(form.id)} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-bold text-red-500 hover:bg-red-50 transition-colors text-left"><Trash2 className="w-4 h-4" /> Delete Form</button>
                    </div>
                  )}
               </div>

               <div className="relative space-y-8">
                  <div className="p-3.5 bg-slate-50 rounded-2xl text-slate-400 group-hover:bg-emerald-600 group-hover:text-white transition-all duration-500 shadow-sm w-max">
                     <FileText className="w-6 h-6" />
                  </div>

                  <div>
                     <h3 className="text-2xl font-black text-slate-900 mb-2 pr-10 truncate group-hover:text-emerald-600 transition-colors">{form.name}</h3>
                     <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-6">Configured Pipeline</p>
                     
                     <div className="flex items-center gap-6">
                        <div><p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-0.5">Submissions</p><p className="text-xl font-black text-slate-900">{form.submission_count || 0}</p></div>
                        <div className="w-px h-8 bg-slate-100" />
                        <div><p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-0.5">Integrations</p><p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">ENABLED</p></div>
                     </div>
                  </div>
               </div>
            </div>
          ))}
        </div>
      )}
      <ConfirmationModal 
        isOpen={!!deletingFormId}
        onClose={() => setDeletingFormId(null)}
        onConfirm={deleteForm}
        title="Delete Form"
        message="Are you sure you want to delete this form? This will permanently remove all associated fields and submissions. This action cannot be undone."
        confirmText="YES, DELETE FORM"
        isLoading={isDeleting}
      />
    </div>
  );
}
