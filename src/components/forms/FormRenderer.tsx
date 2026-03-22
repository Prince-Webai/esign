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

  async function uploadImage(base64: string, id: string) {
    try {
      if (!base64.startsWith('data:image')) return base64;
      const byteString = atob(base64.split(',')[1]);
      const mimeString = base64.split(',')[0].split(':')[1].split(';')[0];
      const ab = new ArrayBuffer(byteString.length);
      const ia = new Uint8Array(ab);
      for (let i = 0; i < byteString.length; i++) { ia[i] = byteString.charCodeAt(i); }
      const blob = new Blob([ab], { type: mimeString });
      const fileName = `${id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${mimeString.split('/')[1]}`;
      const { error: uploadError } = await supabase.storage.from("form-submissions").upload(fileName, blob);
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from("form-submissions").getPublicUrl(fileName);
      return publicUrl;
    } catch (err) {
      console.error("Image upload failed:", err);
      return base64; // fall back to base64 if upload fails
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    try {
      const finalData = { ...formData };
      
      // 1. Scan for images and upload to Storage first
      const imageUploadPromises: Promise<any>[] = [];
      fields.forEach(field => {
        if (field.type === 'image' && Array.isArray(finalData[field.id])) {
          const images = finalData[field.id];
          images.forEach((img: string, idx: number) => {
            if (img.startsWith('data:image')) {
              imageUploadPromises.push(
                uploadImage(img, formId).then(url => {
                  finalData[field.id][idx] = url;
                })
              );
            }
          });
        }
      });

      if (imageUploadPromises.length > 0) {
        await Promise.all(imageUploadPromises);
      }

      // 2. Save submission record to DB with URLs (tiny payload)
      const { data: submission, error: subError } = await supabase
        .from("form_submissions")
        .insert([{ form_id: formId, data: finalData }])
        .select()
        .single();
      if (subError) throw subError;

      // 3. Show success immediately
      setSubmitted(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });

      // 4. Fire PDF generation in background (passing the finalData with URLs)
      fetch("/api/submit-form", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submissionId: submission.id, formId: formId, data: finalData }),
      }).catch(err => console.error("Background PDF generation error:", err));

    } catch (error: any) {
      alert("Submission error: " + error.message);
    } finally {
      setSubmitting(false);
    }
  };



  if (loading) return <div className="flex flex-col items-center justify-center py-32 space-y-4"><Loader2 className="w-10 h-10 text-emerald-600 animate-spin" /><p className="text-slate-500 font-medium text-sm">Initiating Secure Connection...</p></div>;
  if (!form) return <div className="text-center py-32 text-slate-500 font-medium text-sm">Form Not Discovered</div>;
  if (submitted) return (
    <div className="max-w-xl mx-auto py-32 text-center animate-in zoom-in duration-500">
       <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center mx-auto mb-6 border border-emerald-500/20 shadow-xl shadow-emerald-500/10"><CheckCircle2 className="w-8 h-8 text-emerald-500" /></div>
       <h2 className="text-3xl font-bold text-slate-900 mb-3 tracking-tight">Submission Successful</h2>
       <p className="text-slate-500 text-base mb-10">Your response has been securely received. Thank you!</p>
       <button onClick={() => window.location.reload()} className="px-8 py-3 bg-slate-900 rounded-xl text-white font-medium text-sm hover:bg-slate-800 transition-all shadow-md">Submit Another Response</button>
    </div>
  );

  // All actual fields — no builtin hacks
  const visibleFields = fields;

  return (
    <div className="max-w-2xl mx-auto py-16 px-6 animate-in fade-in slide-in-from-bottom-8 duration-700">
      <div className="mb-12">
         <div className="flex items-center gap-3 mb-5">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600 border border-emerald-100/50 shadow-sm"><FileText className="w-4 h-4" /></div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-600">Secure Entry</span>
         </div>
         <h1 className="text-4xl font-bold text-slate-900 tracking-tight mb-3">{form.name}</h1>
         <div className="h-1 w-16 bg-emerald-500 rounded-full mb-6" />
         {form.description && <p className="text-slate-500 font-medium leading-relaxed whitespace-pre-wrap text-base">{form.description}</p>}
      </div>

      <form onSubmit={handleSubmit} className="space-y-10">
         {visibleFields.map((field) => (
           field.type === 'header' ? (
             <div key={field.id} className="pt-10 pb-3 border-b-2 border-slate-900 mb-6 mt-14 animate-in fade-in duration-500">
               <h3 className="text-2xl font-bold text-slate-900 tracking-tight">{field.label}</h3>
             </div>
           ) : (
             <div key={field.id} className="space-y-4 group">
                 <label className="flex items-start gap-2">
                   <span className="text-sm font-medium text-slate-700 leading-snug">{field.label}</span>
                   {field.required && <span className="text-red-500 font-bold flex-shrink-0">*</span>}
                 </label>
                {field.type === 'input' && <input type="text" placeholder={field.placeholder} className={cn("w-full bg-white border border-slate-200/60 rounded-xl px-4 py-3.5 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all placeholder:text-slate-400 shadow-sm", errors[field.id] && "border-red-300 bg-red-50 focus:border-red-500 focus:ring-red-500/20")} value={formData[field.id] || ""} onChange={(e) => handleInputChange(field.id, e.target.value)} />}
                {field.type === 'textarea' && <textarea placeholder={field.placeholder} className={cn("w-full bg-white border border-slate-200/60 rounded-xl px-4 py-3.5 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all placeholder:text-slate-400 h-36 shadow-sm resize-none", errors[field.id] && "border-red-300 bg-red-50 focus:border-red-500 focus:ring-red-500/20")} value={formData[field.id] || ""} onChange={(e) => handleInputChange(field.id, e.target.value)} />}
                {field.type === 'date' && <input type="date" className={cn("w-full bg-white border border-slate-200/60 rounded-xl px-4 py-3.5 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all shadow-sm cursor-pointer", errors[field.id] && "border-red-300 bg-red-50 focus:border-red-500 focus:ring-red-500/20")} value={formData[field.id] || ""} onChange={(e) => handleInputChange(field.id, e.target.value)} />}
                {field.type === 'select' && (
                  <div className="space-y-3">
                    <div className="relative">
                      <select className={cn("w-full bg-white border border-slate-200/60 rounded-xl px-4 py-3.5 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 appearance-none transition-all cursor-pointer shadow-sm", errors[field.id] && "border-red-300 bg-red-50 focus:border-red-500 focus:ring-red-500/20")} value={formData[field.id] || ""} onChange={(e) => handleInputChange(field.id, e.target.value)}>
                        <option value="" disabled>{field.placeholder || "Select Parameter..."}</option>
                        {field.options?.map((opt, i) => <option key={i} value={opt}>{opt}</option>)}
                      </select>
                      <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 rotate-90 pointer-events-none" />
                    </div>
                    {formData[field.id] === 'Other' && (
                      <input type="text" placeholder="Please specify..." className="w-full bg-white border border-slate-200/60 rounded-xl px-4 py-3.5 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all placeholder:text-slate-400 shadow-sm animate-in fade-in slide-in-from-top-1 duration-200" value={formData[`${field.id}_other`] || ""} onChange={(e) => handleInputChange(`${field.id}_other`, e.target.value)} />
                    )}
                  </div>
                )}
                {field.type === 'radio' && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {field.options?.map((opt, i) => (
                        <label key={i} className={cn("flex items-center gap-3 p-4 rounded-xl border transition-all cursor-pointer group/radio shadow-sm", formData[field.id] === opt ? "bg-emerald-50 border-emerald-500 text-slate-900" : (errors[field.id] ? "bg-red-50 border-red-200 text-red-700" : "bg-white border-slate-200/60 text-slate-600 hover:border-emerald-200"))}>
                          <input type="radio" name={field.id} value={opt} checked={formData[field.id] === opt} onChange={(e) => handleInputChange(field.id, e.target.value)} className="hidden" />
                          <div className={cn("w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all shrink-0", formData[field.id] === opt ? "border-emerald-500 bg-white" : (errors[field.id] ? "border-red-400 bg-white" : "border-slate-300 bg-white"))}>{formData[field.id] === opt && <div className="w-2 h-2 rounded-full bg-emerald-500" />}</div>
                          <span className="font-medium text-sm">{opt}</span>
                        </label>
                      ))}
                    </div>
                    {formData[field.id] === 'Other' && (
                      <input type="text" placeholder="Please specify..." className="w-full bg-white border border-slate-200/60 rounded-xl px-4 py-3.5 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all placeholder:text-slate-400 shadow-sm animate-in fade-in slide-in-from-top-1 duration-200" value={formData[`${field.id}_other`] || ""} onChange={(e) => handleInputChange(`${field.id}_other`, e.target.value)} />
                    )}
                  </div>
                )}
                {field.type === 'image' && (
                  <div className="space-y-4">
                     <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {(formData[field.id] || []).map((imgData: string, idx: number) => (
                           <div key={idx} className="relative aspect-square rounded-xl overflow-hidden border border-emerald-100 shadow-sm animate-in zoom-in duration-300">
                              <img src={imgData} alt="Preview" className="w-full h-full object-cover" />
                              <button 
                                type="button" 
                                onClick={() => {
                                   const current = [...(formData[field.id] || [])];
                                   current.splice(idx, 1);
                                   handleInputChange(field.id, current.length > 0 ? current : null);
                                }} 
                                className="absolute top-2 right-2 p-1 bg-white/90 backdrop-blur shadow-sm rounded-lg text-red-500 hover:bg-red-500 hover:text-white transition-all transform hover:scale-105"
                              >
                                <X className="w-4 h-4" />
                              </button>
                           </div>
                        ))}
                        
                        {(!formData[field.id] || formData[field.id].length < 30) && (
                          <label className={cn(
                            "flex flex-col items-center justify-center aspect-square bg-slate-50 border-2 border-dashed rounded-xl cursor-pointer hover:bg-emerald-50 hover:border-emerald-300 transition-all shadow-sm",
                            errors[field.id] ? "border-red-300 bg-red-50" : "border-slate-200/60"
                          )}>
                            <div className="flex flex-col items-center justify-center text-center p-3">
                               <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center text-slate-400 shadow-sm mb-2">
                                  <Upload className="w-4 h-4" />
                               </div>
                               <p className="text-[11px] font-medium text-slate-900 uppercase tracking-wider">Upload Image</p>
                               <p className="text-[10px] text-slate-500 font-medium mt-1">
                                  {formData[field.id]?.length || 0} / 30 MAX
                               </p>
                            </div>
                            <input 
                              type="file" 
                              className="hidden" 
                              accept="image/*" 
                              multiple 
                              onChange={async (e) => {
                                const files = Array.from(e.target.files || []);
                                const currentCount = (formData[field.id] || []).length;
                                const remaining = 30 - currentCount;
                                const toUpload = files.slice(0, remaining);

                                // Helper for compression
                                const compress = (f: File): Promise<string> => {
                                  return new Promise((resolve) => {
                                    const reader = new FileReader();
                                    reader.readAsDataURL(f);
                                    reader.onload = (event) => {
                                      const img = new Image();
                                      img.src = event.target?.result as string;
                                      img.onload = () => {
                                        const canvas = document.createElement('canvas');
                                        let width = img.width;
                                        let height = img.height;
                                        const MAX_SIZE = 1200;
                                        if (width > height) {
                                          if (width > MAX_SIZE) { height *= MAX_SIZE / width; width = MAX_SIZE; }
                                        } else {
                                          if (height > MAX_SIZE) { width *= MAX_SIZE / height; height = MAX_SIZE; }
                                        }
                                        canvas.width = width;
                                        canvas.height = height;
                                        const ctx = canvas.getContext('2d');
                                        ctx?.drawImage(img, 0, 0, width, height);
                                        resolve(canvas.toDataURL('image/jpeg', 0.7));
                                      };
                                    };
                                  });
                                };

                                const compressedImages = await Promise.all(toUpload.map(compress));
                                setFormData(prev => {
                                  const existing = prev[field.id] || [];
                                  return { ...prev, [field.id]: [...existing, ...compressedImages].slice(0, 30) };
                                });
                              }} 
                            />
                          </label>
                        )}
                     </div>
                  </div>
                )}
                {errors[field.id] && <p className="text-sm font-medium text-red-500 pl-1 animate-in fade-in duration-300">{errors[field.id]}</p>}

             </div>
           )
         ))}
         <div className="pt-8">
            <button type="submit" disabled={submitting} className="w-full bg-slate-900 py-4 rounded-xl flex items-center justify-center gap-3 text-white font-semibold text-base shadow-md hover:bg-slate-800 transition-all disabled:opacity-50 group">
              {submitting ? <Loader2 className="w-5 h-5 animate-spin text-emerald-500" /> : <>Submit Response</>}
            </button>
         </div>
      </form>
    </div>
  );
}
