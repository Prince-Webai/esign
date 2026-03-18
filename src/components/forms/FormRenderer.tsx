"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Loader2, Send, CheckCircle2, ChevronRight, Image as ImageIcon, Upload, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface FormField {
  id: string;
  type: string;
  label: string;
  placeholder?: string;
  required: boolean;
  options?: string[];
}

interface Form {
  id: string;
  name: string;
  webhook_url: string;
}

export function FormRenderer({ formId }: { formId: string }) {
  const [form, setForm] = useState<Form | null>(null);
  const [fields, setFields] = useState<FormField[]>([]);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchForm();
  }, [formId]);

  async function fetchForm() {
    setLoading(true);
    const { data: formData, error: formError } = await supabase
      .from("forms")
      .select("*")
      .eq("id", formId)
      .single();

    if (formData) {
      setForm(formData);
      const { data: fieldsData } = await supabase
        .from("form_fields")
        .select("*")
        .eq("form_id", formId)
        .order("order_index", { ascending: true });
      
      if (fieldsData) setFields(fieldsData);
    }
    setLoading(false);
  }

  const handleInputChange = (fieldId: string, value: any) => {
    setFormData(prev => ({ ...prev, [fieldId]: value }));
    if (errors[fieldId]) {
      const newErrors = { ...errors };
      delete newErrors[fieldId];
      setErrors(newErrors);
    }
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};
    fields.forEach(field => {
      if (field.required && !formData[field.id]) {
        newErrors[field.id] = `${field.label} is required`;
      }
    });
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    try {
      // 1. Save submission to Supabase
      const { data: submission, error: subError } = await supabase
        .from("form_submissions")
        .insert([{
          form_id: formId,
          data: formData
        }])
        .select()
        .single();

      if (subError) throw subError;

      // 2. Trigger Webhook and PDF Generation via API
      const response = await fetch("/api/submit-form", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submissionId: submission.id,
          formId: formId,
          data: formData
        })
      });

      if (!response.ok) {
        console.warn("Webhook/PDF trigger failed, but submission saved.");
      }

      setSubmitted(true);
    } catch (error: any) {
      alert("Submission error: " + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 space-y-4">
        <Loader2 className="w-12 h-12 text-primary animate-spin" />
        <p className="text-slate-600 font-bold tracking-widest uppercase text-xs">Accessing Secure Form...</p>
      </div>
    );
  }

  if (!form) return (
    <div className="text-center py-32 text-slate-500 font-bold uppercase tracking-widest">
       Form Not Found or Expired
    </div>
  );

  if (submitted) {
    return (
      <div className="max-w-xl mx-auto py-32 text-center animate-in zoom-in duration-500">
         <div className="w-24 h-24 rounded-[40px] bg-emerald-500/10 flex items-center justify-center mx-auto mb-8 border border-emerald-500/20 shadow-2xl shadow-emerald-500/10">
            <CheckCircle2 className="w-12 h-12 text-emerald-500" />
         </div>
         <h2 className="text-4xl font-black text-white mb-4">Submission Received</h2>
         <p className="text-slate-500 text-lg mb-10">Your response has been securely encrypted and transmitted. A PDF report is being generated.</p>
         <button 
           onClick={() => window.location.reload()}
           className="px-10 py-4 bg-slate-900 border border-white/5 rounded-2xl text-slate-400 font-black tracking-widest uppercase text-xs hover:text-white transition-all"
         >
           Submit Another Response
         </button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto py-12 px-6 animate-in fade-in slide-in-from-bottom-8 duration-700">
      <div className="mb-12">
         <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
               <Loader2 className="w-5 h-5 scroll-reveal" />
            </div>
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-primary">Secure Entry Link</span>
         </div>
         <h1 className="text-5xl font-black text-white tracking-tight mb-4">{form.name}</h1>
         <div className="h-1.5 w-24 bg-primary rounded-full mb-6 shadow-lg shadow-primary/20" />
         <p className="text-slate-500 font-medium">Please provide the requested details below. All fields marked with * are mandatory.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-10">
         {fields.map((field) => (
           <div key={field.id} className="space-y-4 group">
              <label className="flex items-center gap-2">
                 <span className="text-xs font-black uppercase tracking-widest text-slate-400 group-focus-within:text-primary transition-colors">
                    {field.label}
                 </span>
                 {field.required && <span className="text-red-500 font-bold">*</span>}
              </label>

              {field.type === 'input' && (
                <input 
                  type="text"
                  placeholder={field.placeholder}
                  className={cn(
                    "w-full bg-slate-900/40 border border-white/5 rounded-[24px] px-6 py-5 text-white outline-none focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-slate-700",
                    errors[field.id] && "border-red-500/50 bg-red-500/5"
                  )}
                  value={formData[field.id] || ""}
                  onChange={(e) => handleInputChange(field.id, e.target.value)}
                />
              )}

              {field.type === 'textarea' && (
                <textarea 
                  placeholder={field.placeholder}
                  className={cn(
                    "w-full bg-slate-900/40 border border-white/5 rounded-[24px] px-6 py-5 text-white outline-none focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-slate-700 h-40 resize-none",
                    errors[field.id] && "border-red-500/50 bg-red-500/5"
                  )}
                  value={formData[field.id] || ""}
                  onChange={(e) => handleInputChange(field.id, e.target.value)}
                />
              )}

              {field.type === 'select' && (
                <div className="relative">
                  <select 
                    className={cn(
                      "w-full bg-slate-900/40 border border-white/5 rounded-[24px] px-6 py-5 text-white outline-none focus:ring-2 focus:ring-primary/20 appearance-none transition-all cursor-pointer",
                      errors[field.id] && "border-red-500/50 bg-red-500/5"
                    )}
                    value={formData[field.id] || ""}
                    onChange={(e) => handleInputChange(field.id, e.target.value)}
                  >
                    <option value="" disabled className="bg-slate-900">{field.placeholder || "Select an option"}</option>
                    {field.options?.map((opt, i) => (
                      <option key={i} value={opt} className="bg-slate-900">{opt}</option>
                    ))}
                  </select>
                  <ChevronRight className="absolute right-6 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-600 rotate-90 pointer-events-none" />
                </div>
              )}

              {field.type === 'radio' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {field.options?.map((opt, i) => (
                    <label 
                      key={i} 
                      className={cn(
                        "flex items-center gap-4 p-5 rounded-2xl border transition-all cursor-pointer",
                        formData[field.id] === opt 
                          ? "bg-primary/10 border-primary/40 text-white" 
                          : "bg-slate-900/40 border-white/5 text-slate-500 hover:border-white/10"
                      )}
                    >
                      <input 
                        type="radio" 
                        name={field.id}
                        value={opt}
                        checked={formData[field.id] === opt}
                        onChange={(e) => handleInputChange(field.id, e.target.value)}
                        className="hidden"
                      />
                      <div className={cn(
                        "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all",
                        formData[field.id] === opt ? "border-primary" : "border-slate-700"
                      )}>
                        {formData[field.id] === opt && <div className="w-2.5 h-2.5 rounded-full bg-primary" />}
                      </div>
                      <span className="font-bold text-sm tracking-tight">{opt}</span>
                    </label>
                  ))}
                </div>
              )}

              {field.type === 'image' && (
                <div className="space-y-4">
                   {formData[field.id] ? (
                     <div className="relative w-full aspect-video rounded-3xl overflow-hidden border border-primary/20">
                        <img src={formData[field.id]} alt="Preview" className="w-full h-full object-cover" />
                        <button 
                          onClick={() => handleInputChange(field.id, null)}
                          className="absolute top-4 right-4 p-2 bg-black/60 backdrop-blur-md rounded-xl text-white hover:bg-red-500 transition-colors"
                        >
                           <X className="w-5 h-5" />
                        </button>
                     </div>
                   ) : (
                    <label className={cn(
                      "flex flex-col items-center justify-center w-full h-48 bg-slate-900/40 border-2 border-dashed rounded-[32px] cursor-pointer hover:bg-primary/5 hover:border-primary/30 transition-all",
                      errors[field.id] ? "border-red-500/50" : "border-white/5"
                    )}>
                      <div className="flex flex-col items-center justify-center p-6 text-center space-y-3">
                        <div className="w-12 h-12 rounded-2xl bg-slate-950 flex items-center justify-center text-slate-500">
                           <Upload className="w-6 h-6" />
                        </div>
                        <div>
                          <p className="text-sm font-black text-slate-400 uppercase tracking-widest">Transmit Image Artifact</p>
                          <p className="text-[10px] text-slate-600 font-bold uppercase tracking-widest mt-1">PNG, JPG up to 10MB</p>
                        </div>
                      </div>
                      <input 
                        type="file" 
                        className="hidden" 
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onloadend = () => handleInputChange(field.id, reader.result);
                            reader.readAsDataURL(file);
                          }
                        }}
                      />
                    </label>
                   )}
                </div>
              )}

              {errors[field.id] && (
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-red-500 pl-2 animate-in fade-in duration-300">
                   {errors[field.id]}
                </p>
              )}
           </div>
         ))}

         <div className="pt-8">
            <button 
              type="submit"
              disabled={submitting}
              className="w-full premium-gradient py-6 rounded-3xl flex items-center justify-center gap-4 text-primary-foreground font-black shadow-2xl shadow-primary/20 hover:scale-[1.01] active:scale-[0.98] transition-all disabled:opacity-50 group"
            >
              {submitting ? (
                 <Loader2 className="w-6 h-6 animate-spin" />
              ) : (
                <>
                  TRANSMIT SECURE DATA
                  <Send className="w-5 h-5 group-hover:translate-x-2 group-hover:-translate-y-2 transition-transform duration-300" />
                </>
              )}
            </button>
         </div>
      </form>
    </div>
  );
}
