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
    <div className="space-y-8 animate-in fade-in slide-in-from-top-4 duration-500" onClick={() => setOpenMenuId(null)}>
      {/* Header Area */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-white p-6 md:p-8 rounded-2xl border border-slate-200/60 shadow-sm">
        <div className="space-y-1">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900">Forms</h1>
          <p className="text-slate-500 text-sm flex items-center gap-2"> Manage data collection pipelines and view submissions</p>
        </div>
        <Link 
          href="/forms/new" 
          className="bg-emerald-600 px-5 py-2.5 rounded-xl flex items-center gap-2 text-white font-medium text-sm shadow-sm hover:bg-emerald-700 transition-colors"
        >
          <Plus className="w-4 h-4" /> 
          Create form
        </Link>
      </div>

      {/* Search Bar */}
      <div className="relative group max-w-xl">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-emerald-600 transition-colors" />
        <input 
          type="text" 
          placeholder="Search forms..." 
          className="w-full bg-white border border-slate-200/60 rounded-xl pl-11 pr-4 py-2.5 text-sm font-medium text-slate-900 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all placeholder:text-slate-400 shadow-sm" 
          value={searchTerm} 
          onChange={(e) => setSearchTerm(e.target.value)} 
        />
      </div>

      {/* Main Content */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 space-y-4">
          <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
          <p className="text-slate-500 font-medium text-sm">Loading forms...</p>
        </div>
      ) : filteredForms.length === 0 ? (
        <div className="bg-white border border-slate-200/60 rounded-2xl p-16 text-center shadow-sm">
          <FileText className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-500 font-medium text-sm">No forms found matching your criteria</p>
          <Link href="/forms/new" className="mt-4 inline-block text-emerald-600 font-semibold text-sm hover:text-emerald-700 transition-colors">
            Create your first form &rarr;
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredForms.map((form) => (
            <div key={form.id} className="group bg-white border border-slate-200/60 rounded-2xl p-6 hover:border-emerald-500/30 transition-all duration-300 hover:shadow-md relative">
               
               {/* 3-Dot Action Menu */}
               <div className="absolute right-4 top-4 z-10" onClick={(e) => e.stopPropagation()}>
                  <button onClick={() => setOpenMenuId(openMenuId === form.id ? null : form.id)} className="p-1.5 text-slate-400 hover:text-slate-900 bg-transparent hover:bg-slate-50 rounded-lg transition-colors border border-transparent hover:border-slate-200"><MoreVertical className="w-4 h-4" /></button>
                  {openMenuId === form.id && (
                    <div className="absolute right-0 mt-2 w-48 bg-white border border-slate-200 rounded-xl shadow-lg py-1.5 z-50 animate-in fade-in zoom-in-95 duration-200">
                      <Link href={`/forms/${form.id}`} target="_blank" className="flex items-center gap-2.5 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"><ExternalLink className="w-4 h-4" /> View live form</Link>
                      <Link href={`/forms/${form.id}/responses`} className="flex items-center gap-2.5 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-emerald-600 transition-colors"><Layout className="w-4 h-4" /> Submissions</Link>
                      <Link href={`/forms/${form.id}/edit`} className="flex items-center gap-2.5 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-blue-600 transition-colors"><Edit2 className="w-4 h-4" /> Edit builder</Link>
                      <div className="h-px bg-slate-100 my-1 mx-3" />
                      <button onClick={() => setDeletingFormId(form.id)} className="w-full flex items-center gap-2.5 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors text-left"><Trash2 className="w-4 h-4" /> Delete form</button>
                    </div>
                  )}
               </div>

               <div className="relative space-y-4">
                  <div className="w-10 h-10 bg-slate-50 border border-slate-100 rounded-xl text-slate-500 group-hover:text-emerald-600 group-hover:border-emerald-100 group-hover:bg-emerald-50 flex items-center justify-center transition-colors">
                     <FileText className="w-5 h-5" />
                  </div>

                  <div>
                     <h3 className="text-lg font-semibold text-slate-900 mb-1 pr-6 truncate">{form.name}</h3>
                     <p className="text-xs text-slate-500 mb-4 pb-4 border-b border-slate-100">Created {new Date(form.created_at).toLocaleDateString()}</p>
                     
                     <div className="flex items-center gap-6">
                        <div>
                           <p className="text-[11px] font-medium text-slate-400 mb-0.5">Responses</p>
                           <p className="text-sm font-semibold text-slate-700">{form.submission_count || 0}</p>
                        </div>
                        <div className="w-px h-6 bg-slate-100" />
                        <div>
                           <p className="text-[11px] font-medium text-slate-400 mb-0.5">Integrations</p>
                           <div className="flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                              <p className="text-[11px] font-medium text-slate-600">Active</p>
                           </div>
                        </div>
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
