"use client";

import { useState, useRef, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Settings, Image as ImageIcon, Save, Loader2, UploadCloud, X, Mail, Code, Type } from "lucide-react";
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
  const [name, setName] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [emailSubject, setEmailSubject] = useState(DEFAULT_SUBJECT);
  const [emailBody, setEmailBody] = useState(DEFAULT_BODY);
  const [emailFormat, setEmailFormat] = useState<'text' | 'html'>('text');
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync state when org data loads or refreshes
  useEffect(() => {
    if (org && !orgLoading) {
      setName(org.name || "");
      setLogoPreview(org.logo_url);
      
      // Only set if they exist in DB, otherwise keep defaults
      if (org.email_subject) setEmailSubject(org.email_subject);
      if (org.email_body) setEmailBody(org.email_body);
      if (org.email_template_format) setEmailFormat(org.email_template_format);
    }
  }, [org, orgLoading]);

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
          email_template_format: emailFormat,
          updated_at: new Date().toISOString()
        })
        .eq("id", 1);

      if (updateError) throw updateError;

      setMessage({ type: 'success', text: 'Settings saved successfully!' });
      await refreshOrg(); // Wait for the refresh to complete
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
      <div className="flex items-center gap-4 pb-6 border-b border-slate-200/60">
        <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-200/60 text-slate-500 flex items-center justify-center shadow-sm">
          <Settings className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Organization Settings</h1>
          <p className="text-sm font-medium text-slate-500 mt-0.5">Manage your company branding and email templates.</p>
        </div>
      </div>

      {orgLoading && !org.name ? (
        <div className="py-20 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
      ) : (
        <div className="space-y-6 animate-in fade-in duration-500">
          {/* Branding Card */}
          <div className="bg-white border border-slate-200/60 shadow-sm rounded-2xl p-6 lg:p-8 space-y-6">
            <h2 className="text-lg font-semibold text-slate-900">Branding</h2>

            {/* Organization Name */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Organization Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-white shadow-sm border border-slate-200/60 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all placeholder:text-slate-400 text-slate-900 font-medium"
                placeholder="e.g. TRE Energy"
              />
              <p className="text-xs text-slate-500">Appears on login page, dashboard headers, and PDFs.</p>
            </div>

            <div className="w-full h-px bg-slate-100" />

            {/* Organization Logo */}
            <div className="space-y-3">
              <label className="text-sm font-medium text-slate-700">Organization Logo</label>
              <div className="flex flex-col sm:flex-row gap-6 items-start">
                <div className="w-24 h-24 flex-shrink-0 bg-slate-50 border-2 border-dashed border-slate-200/60 rounded-xl flex items-center justify-center relative group overflow-hidden">
                  {logoPreview ? (
                    <>
                      <div className="absolute inset-0 pattern-checkboard opacity-10 pointer-events-none" />
                      <img src={logoPreview} alt="Logo preview" className="w-full h-full object-contain p-2 relative z-10" />
                      <button onClick={clearLogo} className="absolute top-1.5 right-1.5 w-6 h-6 bg-white/90 shadow-sm rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-20 text-red-500 hover:bg-red-50">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </>
                  ) : (
                    <ImageIcon className="w-6 h-6 text-slate-300" />
                  )}
                </div>
                <div className="flex-1 space-y-3">
                  <div onClick={() => fileInputRef.current?.click()} className="w-full sm:max-w-xs border border-slate-200/60 bg-white hover:bg-slate-50 shadow-sm transition-colors p-2.5 rounded-xl flex items-center justify-center gap-2 cursor-pointer group">
                    <UploadCloud className="w-4 h-4 text-slate-400 group-hover:text-emerald-500 transition-colors" />
                    <span className="text-sm font-medium text-slate-700">Choose custom logo...</span>
                  </div>
                  <input type="file" ref={fileInputRef} className="hidden" accept="image/png, image/jpeg, image/svg+xml" onChange={handleFileChange} />
                  <p className="text-xs text-slate-500 leading-relaxed max-w-sm">Upload a PNG or SVG with a transparent background. This logo will be embedded in all newly generated PDFs.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Email Template Card */}
          <div className="bg-white border border-slate-200/60 shadow-sm rounded-2xl p-6 lg:p-8 space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-slate-50 text-slate-500 flex items-center justify-center border border-slate-200/60 shadow-sm">
                  <Mail className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">Signing Email Template</h2>
                  <p className="text-sm font-medium text-slate-500 mt-0.5">Settings for the RAMS document launch email.</p>
                </div>
              </div>

              {/* Format Toggle */}
              <div className="flex bg-slate-50 border border-slate-200/60 p-1 rounded-xl shadow-sm">
                <button 
                  onClick={() => setEmailFormat('text')}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${emailFormat === 'text' ? 'bg-white shadow-sm text-slate-900 border border-slate-200/60' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  <Type className="w-3.5 h-3.5" />
                  Plain Text
                </button>
                <button 
                  onClick={() => setEmailFormat('html')}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${emailFormat === 'html' ? 'bg-white shadow-sm text-slate-900 border border-slate-200/60' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  <Code className="w-3.5 h-3.5" />
                  HTML
                </button>
              </div>
            </div>

            {/* Variable hints */}
            <div className="flex flex-wrap gap-2 pt-2">
              {['{{signer_name}}', '{{document_name}}', '{{signing_link}}'].map(v => (
                <span key={v} className="text-xs font-mono font-medium bg-slate-50 text-slate-600 border border-slate-200/60 px-2 py-1 rounded-md">{v}</span>
              ))}
              <span className="text-xs font-medium text-slate-500 self-center ml-2">← available variables</span>
            </div>

            {/* Email Subject */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Email Subject</label>
              <input
                type="text"
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
                className="w-full bg-white shadow-sm border border-slate-200/60 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all text-slate-900 font-medium placeholder:text-slate-400"
                placeholder="E-Signature Required: {{document_name}}"
              />
            </div>

            {/* Email Body */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">
                Email Body {emailFormat === 'html' ? '(HTML Code)' : '(Text Content)'}
              </label>
              <textarea
                value={emailBody}
                onChange={(e) => setEmailBody(e.target.value)}
                rows={12}
                className="w-full bg-white shadow-sm border border-slate-200/60 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all text-slate-900 font-mono leading-relaxed resize-y placeholder:text-slate-400"
                placeholder={emailFormat === 'html' ? "Enter HTML code here..." : "Write your email message here..."}
              />
              <p className="text-xs font-medium text-slate-500">
                {emailFormat === 'text' 
                  ? "We'll automatically handle line breaks and add a branding wrapper." 
                  : "Your HTML will be rendered exactly as entered. Make sure to include all necessary styling."}
              </p>
            </div>

            {/* Reset to default */}
            <button
              onClick={() => { setEmailSubject(DEFAULT_SUBJECT); setEmailBody(DEFAULT_BODY); setEmailFormat('text'); }}
              className="text-sm font-medium text-slate-500 hover:text-slate-900 underline underline-offset-4 transition-colors pt-2"
            >
              Reset to default template
            </button>
          </div>

          {/* Save Bar */}
          <div className="bg-white border border-slate-200/60 shadow-sm rounded-2xl px-6 py-4 flex flex-col-reverse md:flex-row items-center justify-between gap-4">
            {message ? (
              <p className={`text-sm font-medium flex-1 ${message.type === 'error' ? 'text-red-500' : 'text-emerald-600'}`}>{message.text}</p>
            ) : <div className="flex-1" />}

            <button
              onClick={handleSave}
              disabled={isSaving}
              className="w-full md:w-auto flex items-center justify-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-xl shadow-sm transition-colors disabled:opacity-50"
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

