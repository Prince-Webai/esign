"use client";

import { useState, useRef, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Settings, Image as ImageIcon, Save, Loader2, UploadCloud, X, Mail } from "lucide-react";
import { useOrganization } from "@/hooks/useOrganization";

const DEFAULT_SUBJECT = "E-Signature Required: {{document_name}}";
const DEFAULT_BODY = `Hello {{signer_name}},

You have been requested to sign the following document: {{document_name}}

Please use the signing link provided in this email to complete your digital signature.

If you have any questions, please don't hesitate to contact us.

Best Regards,
TRE Energy Team`;

export default function SettingsPage() {
  const { org, loading: orgLoading, refreshOrg } = useOrganization();
  const [name, setName] = useState(org.name);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [emailSubject, setEmailSubject] = useState(DEFAULT_SUBJECT);
  const [emailBody, setEmailBody] = useState(DEFAULT_BODY);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (org) {
      setName(org.name);
      setLogoPreview(org.logo_url);
      if ((org as any).email_subject) setEmailSubject((org as any).email_subject);
      if ((org as any).email_body) setEmailBody((org as any).email_body);
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

      if (logoPreview === null && org.logo_url !== null) finalLogoUrl = null;
      
      if (logoFile) {
        const fileExt = logoFile.name.split('.').pop();
        const fileName = `logo-${Date.now()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage.from("org-assets").upload(fileName, logoFile, { upsert: true });
        if (uploadError) throw uploadError;
        const { data: publicUrlData } = supabase.storage.from("org-assets").getPublicUrl(fileName);
        finalLogoUrl = `${publicUrlData.publicUrl}?t=${Date.now()}`;
      }

      const { error: updateError } = await supabase
        .from("organization_settings")
        .update({
          name: name || "TRE Energy",
          logo_url: finalLogoUrl,
          email_subject: emailSubject,
          email_body: emailBody,
          updated_at: new Date().toISOString()
        })
        .eq("id", 1);

      if (updateError) throw updateError;

      setMessage({ type: 'success', text: 'Settings saved successfully!' });
      refreshOrg();
      setLogoFile(null);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || "Failed to save settings." });
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
          <p className="text-muted-foreground">Manage your company branding and email templates.</p>
        </div>
      </div>

      {orgLoading ? (
        <div className="py-20 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
      ) : (
        <div className="space-y-6">
          {/* Branding Card */}
          <div className="bg-white border border-slate-200 shadow-sm rounded-3xl p-6 lg:p-8 space-y-8">
            <h2 className="text-lg font-bold text-slate-900">Branding</h2>

            {/* Organization Name */}
            <div className="space-y-3">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Organization Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all placeholder:text-slate-400 text-slate-900 font-semibold"
                placeholder="e.g. TRE Energy"
              />
              <p className="text-xs text-slate-400">Appears on login page, dashboard headers, and PDFs.</p>
            </div>

            <div className="w-full h-px bg-slate-100" />

            {/* Organization Logo */}
            <div className="space-y-3">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Organization Logo</label>
              <div className="flex flex-col sm:flex-row gap-6 items-start">
                <div className="w-32 h-32 flex-shrink-0 bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl flex items-center justify-center relative group overflow-hidden">
                  {logoPreview ? (
                    <>
                      <div className="absolute inset-0 pattern-checkboard opacity-10 pointer-events-none" />
                      <img src={logoPreview} alt="Logo preview" className="w-full h-full object-contain p-2 relative z-10" />
                      <button onClick={clearLogo} className="absolute top-2 right-2 w-6 h-6 bg-white/90 shadow rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-20 text-red-500 hover:bg-red-50">
                        <X className="w-4 h-4" />
                      </button>
                    </>
                  ) : (
                    <ImageIcon className="w-8 h-8 text-slate-300" />
                  )}
                </div>
                <div className="flex-1 space-y-4">
                  <div onClick={() => fileInputRef.current?.click()} className="w-full sm:max-w-xs border border-slate-200 bg-slate-50 hover:bg-slate-100 transition-colors p-4 rounded-xl flex items-center justify-center gap-3 cursor-pointer group">
                    <UploadCloud className="w-5 h-5 text-slate-400 group-hover:text-primary transition-colors" />
                    <span className="text-sm font-semibold text-slate-700">Choose custom logo...</span>
                  </div>
                  <input type="file" ref={fileInputRef} className="hidden" accept="image/png, image/jpeg, image/svg+xml" onChange={handleFileChange} />
                  <p className="text-xs text-slate-400 leading-relaxed">Upload a PNG or SVG with a transparent background. This logo will be embedded in all newly generated PDFs.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Email Template Card */}
          <div className="bg-white border border-slate-200 shadow-sm rounded-3xl p-6 lg:p-8 space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center">
                <Mail className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">Signing Email Template</h2>
                <p className="text-xs text-slate-400">This is the email sent to signers when a RAMS document is launched.</p>
              </div>
            </div>

            {/* Variable hints */}
            <div className="flex flex-wrap gap-2">
              {['{{signer_name}}', '{{document_name}}', '{{signing_link}}'].map(v => (
                <span key={v} className="text-[10px] font-mono bg-blue-50 text-blue-600 border border-blue-200 px-2 py-1 rounded-md">{v}</span>
              ))}
              <span className="text-[10px] text-slate-400 self-center">← use these variables in your template</span>
            </div>

            {/* Email Subject */}
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Email Subject</label>
              <input
                type="text"
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all text-slate-900"
                placeholder="E-Signature Required: {{document_name}}"
              />
            </div>

            {/* Email Body */}
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Email Body</label>
              <textarea
                value={emailBody}
                onChange={(e) => setEmailBody(e.target.value)}
                rows={12}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all text-slate-900 font-mono leading-relaxed resize-y"
                placeholder="Write your email message here..."
              />
              <p className="text-xs text-slate-400">The signing link button will always be included in the email. The body appears above it.</p>
            </div>

            {/* Reset to default */}
            <button
              onClick={() => { setEmailSubject(DEFAULT_SUBJECT); setEmailBody(DEFAULT_BODY); }}
              className="text-xs text-slate-400 hover:text-slate-600 underline underline-offset-2 transition-colors"
            >
              Reset to default template
            </button>
          </div>

          {/* Save Bar */}
          <div className="bg-white border border-slate-200 shadow-sm rounded-2xl px-6 py-4 flex items-center justify-between">
            {message ? (
              <p className={`text-sm font-bold flex-1 ${message.type === 'error' ? 'text-red-500' : 'text-emerald-600'}`}>{message.text}</p>
            ) : <div className="flex-1" />}

            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-2 px-8 py-3 bg-primary text-primary-foreground font-bold rounded-xl shadow-lg shadow-primary/20 hover:scale-[1.02] transition-all active:scale-95 disabled:opacity-50"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save All Settings
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
