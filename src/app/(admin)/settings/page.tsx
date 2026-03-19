"use client";

import { useState, useRef, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Settings, Image as ImageIcon, Save, Loader2, UploadCloud, X } from "lucide-react";
import { useOrganization } from "@/hooks/useOrganization";

export default function SettingsPage() {
  const { org, loading: orgLoading, refreshOrg } = useOrganization();
  const [name, setName] = useState(org.name);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (org) {
      setName(org.name);
      setLogoPreview(org.logo_url);
    }
  }, [org]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setLogoFile(file);
      const reader = new FileReader();
      reader.onload = (e) => setLogoPreview(e.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  const clearLogo = () => {
    setLogoFile(null);
    setLogoPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSave = async () => {
    setIsSaving(true);
    setMessage(null);

    try {
      let finalLogoUrl = org.logo_url;

      // 1. If user cleared the logo completely
      if (logoPreview === null && org.logo_url !== null) {
        finalLogoUrl = null;
      }
      
      // 2. If user uploaded a new logo
      if (logoFile) {
         // Create a unique filename
         const fileExt = logoFile.name.split('.').pop();
         const fileName = `logo-${Date.now()}.${fileExt}`;
         
         const { error: uploadError } = await supabase.storage
           .from("org-assets")
           .upload(fileName, logoFile, { upsert: true });
           
         if (uploadError) throw uploadError;
         
         const { data: publicUrlData } = supabase.storage
           .from("org-assets")
           .getPublicUrl(fileName);
           
         finalLogoUrl = `${publicUrlData.publicUrl}?t=${Date.now()}`;
      }

      // 3. Update the database
      const { error: updateError } = await supabase
        .from("organization_settings")
        .update({
          name: name || "TRE Energy", // Fallback
          logo_url: finalLogoUrl,
          updated_at: new Date().toISOString()
        })
        .eq("id", 1);

      if (updateError) throw updateError;

      setMessage({ type: 'success', text: 'Organization settings saved successfully!' });
      refreshOrg();
      
      // Reset file input state but keep preview active
      setLogoFile(null);
    } catch (err: any) {
      console.error("Save error:", err);
      setMessage({ type: 'error', text: err.message || "Failed to save settings. Make sure you ran the SQL migration." });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 lg:space-y-8">
      {/* Page Header */}
      <div className="flex items-center gap-3 pb-6 border-b border-slate-200">
        <div className="w-12 h-12 rounded-xl bg-orange-500/10 text-orange-500 flex items-center justify-center">
          <Settings className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Organization Settings</h1>
          <p className="text-muted-foreground">Manage your company branding globally.</p>
        </div>
      </div>

      {orgLoading ? (
        <div className="py-20 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
      ) : (
        <div className="bg-white border border-slate-200 shadow-sm rounded-3xl p-6 lg:p-8 space-y-8">
          
          {/* Organization Name */}
          <div className="space-y-3">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">
              Organization Name
            </label>
            <input 
              type="text" 
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all placeholder:text-slate-400 text-slate-900 font-semibold"
              placeholder="e.g. TRE Energy"
            />
            <p className="text-xs text-slate-400">This name will appear on the login page, dashboard headers, and pdfs.</p>
          </div>

          <div className="w-full h-px bg-slate-100 my-6"></div>

          {/* Organization Logo */}
          <div className="space-y-3">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">
              Organization Logo
            </label>
            
            <div className="flex flex-col sm:flex-row gap-6 items-start">
              {/* Logo Preview box */}
              <div className="w-32 h-32 flex-shrink-0 bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl flex items-center justify-center relative group overflow-hidden">
                {logoPreview ? (
                  <>
                     {/* Checkboard pattern for transparent PNGs */}
                     <div className="absolute inset-0 pattern-checkboard opacity-10 pointer-events-none"></div>
                     <img src={logoPreview} alt="Logo preview" className="w-full h-full object-contain p-2 relative z-10" />
                     <button 
                       onClick={clearLogo}
                       className="absolute top-2 right-2 w-6 h-6 bg-white/90 shadow rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-20 text-red-500 hover:bg-red-50"
                     >
                       <X className="w-4 h-4" />
                     </button>
                  </>
                ) : (
                  <ImageIcon className="w-8 h-8 text-slate-300" />
                )}
              </div>

              <div className="flex-1 space-y-4">
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full sm:max-w-xs border border-slate-200 bg-slate-50 hover:bg-slate-100 transition-colors p-4 rounded-xl flex items-center justify-center gap-3 cursor-pointer group"
                >
                  <UploadCloud className="w-5 h-5 text-slate-400 group-hover:text-primary transition-colors" />
                  <span className="text-sm font-semibold text-slate-700">Choose custom logo...</span>
                </div>
                <input 
                  type="file" 
                  ref={fileInputRef}
                  className="hidden" 
                  accept="image/png, image/jpeg, image/svg+xml"
                  onChange={handleFileChange}
                />
                <p className="text-xs text-slate-400 leading-relaxed">
                  Upload a high-resolution PNG or SVG with a transparent background. Best results with a 1:1 or 3:1 aspect ratio. This logo will be embedded in all newly generated PDFs.
                </p>
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-slate-100 flex items-center justify-between">
            {message ? (
              <p className={`text-sm font-bold flex-1 ${message.type === 'error' ? 'text-red-500' : 'text-emerald-600'}`}>
                 {message.text}
              </p>
            ) : <div className="flex-1"></div>}

            <button
               onClick={handleSave}
               disabled={isSaving}
               className="flex items-center gap-2 px-8 py-3 bg-primary text-primary-foreground font-bold rounded-xl shadow-lg shadow-primary/20 hover:scale-[1.02] transition-all active:scale-95 disabled:opacity-50"
            >
               {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
               Save Settings
            </button>
          </div>

        </div>
      )}
    </div>
  );
}
