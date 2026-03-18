"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Loader2, Send, CheckCircle2, ChevronRight, Image as ImageIcon, Upload, X, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

interface FormField {
  id: string; type: string; label: string; placeholder?: string; required: boolean; options?: string[];
}
interface Form {
  id: string; name: string; webhook_url: string; description?: string;
}

export function FormRenderer({ formId }: { formId: string }) {
  const [form, setForm] = useState<Form | null>(null);
  const [fields, setFields] = useState<FormField[]>([]);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => { fetchForm(); }, [formId]);

  async function fetchForm() {
    setLoading(true);
    const { data: formData } = await supabase.from("forms").select("*").eq("id", formId).single();
    if (formData) {
      setForm(formData);
      const { data: fieldsData } = await supabase.from("form_fields").select("*").eq("form_id", formId).order("order_index", { ascending: true });
      if (fieldsData) setFields(fieldsData);
    }
    setLoading(false);
  }

  const handleInputChange = (fieldId: string, value: any) => {
    setFormData(prev => ({ ...prev, [fieldId]: value }));
    if (errors[fieldId]) { const newErrors = { ...errors }; delete newErrors[fieldId]; setErrors(newErrors); }
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};
    visibleFields.forEach(field => { if (field.required && !formData[field.id]) newErrors[field.id] = `${field.label} is required`; });
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    try {
      const { data: submission, error: subError } = await supabase.from("form_submissions").insert([{ form_id: formId, data: formData }]).select().single();
      if (subError) throw subError;
      await fetch("/api/submit-form", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ submissionId: submission.id, formId: formId, data: formData }) });
      setSubmitted(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error: any) { alert("Submission error: " + error.message); } finally { setSubmitting(false); }
  };

  if (loading) return <div className="flex flex-col items-center justify-center py-32 space-y-4"><Loader2 className="w-12 h-12 text-emerald-600 animate-spin" /><p className="text-slate-400 font-bold tracking-widest uppercase text-xs">Initiating Secure Handshake...</p></div>;
  if (!form) return <div className="text-center py-32 text-slate-400 font-bold uppercase tracking-widest">Form Not Discovered</div>;
  if (submitted) return (
    <div className="max-w-xl mx-auto py-32 text-center animate-in zoom-in duration-500">
       <div className="w-24 h-24 rounded-[40px] bg-emerald-500/10 flex items-center justify-center mx-auto mb-8 border border-emerald-500/20 shadow-2xl shadow-emerald-500/10"><CheckCircle2 className="w-12 h-12 text-emerald-500" /></div>
       <h2 className="text-4xl font-black text-slate-900 mb-4">Submission Successful</h2>
       <p className="text-slate-500 text-lg mb-10">Your response has been received. Thank you!</p>
       <button onClick={() => window.location.reload()} className="px-10 py-4 bg-slate-900 rounded-2xl text-white font-black tracking-widest uppercase text-[10px] hover:bg-slate-800 transition-all shadow-xl shadow-slate-900/10">Submit Another Response</button>
    </div>
  );

  // All actual fields — no builtin hacks
  const visibleFields = fields;

  return (
    <div className="max-w-2xl mx-auto py-16 px-6 animate-in fade-in slide-in-from-bottom-8 duration-700">
      <div className="mb-16">
         <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 border border-emerald-100 shadow-sm"><FileText className="w-5 h-5" /></div>
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-emerald-600">Secure Entry</span>
         </div>
         <h1 className="text-5xl font-black text-slate-900 tracking-tight mb-4">{form.name}</h1>
         <div className="h-1.5 w-24 bg-emerald-500 rounded-full mb-8 shadow-lg shadow-emerald-500/10" />
         {form.description && <p className="text-slate-500 font-medium leading-relaxed whitespace-pre-wrap text-lg">{form.description}</p>}
      </div>

      <form onSubmit={handleSubmit} className="space-y-12">
         {visibleFields.map((field) => (
           field.type === 'header' ? (
             <div key={field.id} className="pt-12 pb-4 border-b-2 border-slate-900 mb-8 mt-16 animate-in fade-in duration-500">
               <h3 className="text-3xl font-black text-slate-900 tracking-tight uppercase">{field.label}</h3>
             </div>
           ) : (
             <div key={field.id} className="space-y-6 group">
                <label className="flex items-center gap-2"><span className="text-[12px] font-black uppercase tracking-[0.2em] text-slate-600 group-focus-within:text-emerald-600 transition-colors">{field.label}</span>{field.required && <span className="text-red-500 font-bold">•</span>}</label>
                {field.type === 'input' && <input type="text" placeholder={field.placeholder} className={cn("w-full bg-white border border-slate-200 rounded-2xl px-6 py-5 text-slate-900 outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500/30 transition-all placeholder:text-slate-300 shadow-sm", errors[field.id] && "border-red-300 bg-red-50 focus:border-red-500/30 focus:ring-red-500/10")} value={formData[field.id] || ""} onChange={(e) => handleInputChange(field.id, e.target.value)} />}
                {field.type === 'textarea' && <textarea placeholder={field.placeholder} className={cn("w-full bg-white border border-slate-200 rounded-2xl px-6 py-5 text-slate-900 outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500/30 transition-all placeholder:text-slate-300 h-44 shadow-sm resize-none", errors[field.id] && "border-red-300 bg-red-50 focus:border-red-500/30 focus:ring-red-500/10")} value={formData[field.id] || ""} onChange={(e) => handleInputChange(field.id, e.target.value)} />}
                {field.type === 'select' && (
                  <div className="relative">
                    <select className={cn("w-full bg-white border border-slate-200 rounded-2xl px-6 py-5 text-slate-900 outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500/30 appearance-none transition-all cursor-pointer shadow-sm", errors[field.id] && "border-red-300 bg-red-50 focus:border-red-500/30 focus:ring-red-500/10")} value={formData[field.id] || ""} onChange={(e) => handleInputChange(field.id, e.target.value)}>
                      <option value="" disabled>{field.placeholder || "Select Parameter..."}</option>
                      {field.options?.map((opt, i) => <option key={i} value={opt}>{opt}</option>)}
                    </select>
                    <ChevronRight className="absolute right-6 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300 rotate-90 pointer-events-none" />
                  </div>
                )}
                {field.type === 'radio' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {field.options?.map((opt, i) => (
                      <label key={i} className={cn("flex items-center gap-4 p-5 rounded-2xl border transition-all cursor-pointer group/radio", formData[field.id] === opt ? "bg-emerald-50 border-emerald-500 shadow-md shadow-emerald-500/5 text-slate-900" : (errors[field.id] ? "bg-red-50 border-red-200 text-red-700" : "bg-white border-slate-200 text-slate-500 hover:border-emerald-200 shadow-sm"))}>
                        <input type="radio" name={field.id} value={opt} checked={formData[field.id] === opt} onChange={(e) => handleInputChange(field.id, e.target.value)} className="hidden" />
                        <div className={cn("w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all shrink-0", formData[field.id] === opt ? "border-emerald-500 bg-white" : (errors[field.id] ? "border-red-400 bg-white" : "border-slate-200 shadow-inner bg-white"))}>{formData[field.id] === opt && <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm" />}</div>
                        <span className="font-bold text-[13px] tracking-tight">{opt}</span>
                      </label>
                    ))}
                  </div>
                )}
                {field.type === 'image' && (
                  <div className="space-y-4">
                     {formData[field.id] ? (
                       <div className="relative w-full aspect-video rounded-3xl overflow-hidden border border-emerald-100 shadow-lg">
                          <img src={formData[field.id]} alt="Preview" className="w-full h-full object-cover" />
                          <button type="button" onClick={() => handleInputChange(field.id, null)} className="absolute top-4 right-4 p-3 bg-white/90 backdrop-blur shadow-xl rounded-2xl text-red-500 hover:bg-red-500 hover:text-white transition-all transform hover:rotate-90"><X className="w-5 h-5" /></button>
                       </div>
                     ) : (
                      <label className={cn("flex flex-col items-center justify-center w-full h-56 bg-slate-50 border-2 border-dashed rounded-[40px] cursor-pointer hover:bg-emerald-50 hover:border-emerald-300 transition-all shadow-sm", errors[field.id] ? "border-red-300 bg-red-50" : "border-slate-200")}>
                        <div className="flex flex-col items-center justify-center p-8 text-center space-y-4">
                          <div className="w-14 h-14 rounded-2xl bg-white flex items-center justify-center text-slate-300 shadow-md"><Upload className="w-6 h-6" /></div>
                          <div className="space-y-1.5"><p className="text-[12px] font-black text-slate-900 uppercase tracking-[0.1em]">Transmit Image Artifact</p><p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">High resolution PNG, JPG acceptable</p></div>
                        </div>
                        <input type="file" className="hidden" accept="image/*" onChange={(e) => { const file = e.target.files?.[0]; if (file) { const reader = new FileReader(); reader.onloadend = () => handleInputChange(field.id, reader.result); reader.readAsDataURL(file); } }} />
                      </label>
                     )}
                  </div>
                )}
                {errors[field.id] && <p className="text-[10px] font-black uppercase tracking-[0.2em] text-red-500 pl-4 animate-in fade-in duration-300">{errors[field.id]}</p>}
             </div>
           )
         ))}
         <div className="pt-10">
            <button type="submit" disabled={submitting} className="w-full bg-slate-900 py-6 rounded-3xl flex items-center justify-center gap-4 text-white font-black shadow-2xl shadow-slate-900/10 hover:bg-slate-800 hover:scale-[1.01] active:scale-[0.98] transition-all disabled:opacity-50 group tracking-[0.2em] text-lg">
              {submitting ? <Loader2 className="w-6 h-6 animate-spin text-emerald-500" /> : <>SUBMIT</>}
            </button>
         </div>
      </form>
    </div>
  );
}
