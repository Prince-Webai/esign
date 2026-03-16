"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { FileUp, Users, Save, ChevronRight, X, Eye, EyeOff, Loader2, ShieldCheck } from "lucide-react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { cn } from "@/lib/utils";

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface Template {
  id: string;
  name: string;
  preview_url?: string;
}

interface TemplateField {
  id: string;
  role_name: string;
  default_email?: string;
  placement_x: number;
  placement_y: number;
  page_number: number;
  width: number;
  height: number;
}

interface SignerInput {
  role_name: string;
  name: string;
  email: string;
  assigned_user_id?: string;
}

interface RegisteredUser {
  id: string;
  name: string;
  email: string;
}

export function RAMSLauncher() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [registeredUsers, setRegisteredUsers] = useState<RegisteredUser[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [fields, setFields] = useState<TemplateField[]>([]);
  const [signers, setSigners] = useState<SignerInput[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [jobId, setJobId] = useState("");
  const [documentName, setDocumentName] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [numPages, setNumPages] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function fetchData() {
      const { data: templatesData } = await supabase.from("rams_templates").select("id, name, preview_url");
      if (templatesData) setTemplates(templatesData);
      
      const { data: usersData } = await supabase.from("registered_users").select("id, name, email");
      if (usersData) setRegisteredUsers(usersData);
    }
    fetchData();
  }, []);

  useEffect(() => {
    if (selectedTemplateId) {
      async function fetchFieldsAndPdf() {
        const { data } = await supabase
          .from("template_signature_fields")
          .select("*")
          .eq("template_id", selectedTemplateId);
        if (data) {
          setFields(data);
          setSigners(data.map(f => ({ 
            role_name: f.role_name, 
            name: "", 
            email: f.default_email || "",
            assigned_user_id: ""
          })));
        }

        const template = templates.find(t => t.id === selectedTemplateId);
        if (template?.preview_url) {
          try {
            console.log("Attempting to load template PDF:", template.preview_url);
            
            // Resilience: Try direct download, then try stripping bucket prefix if present
            let path = template.preview_url;
            if (path.includes('templates/')) {
              path = path.split('templates/').pop() || path;
            }

            const { data: blob, error } = await supabase.storage
              .from('templates')
              .download(path);
            
            if (error) {
              console.warn("Standard download failed, trying public URL fallback...", error);
              // Fallback: try to fetch via public URL if download fails (sometimes pathing is tricky)
              const { data: { publicUrl } } = supabase.storage.from('templates').getPublicUrl(path);
              const response = await fetch(publicUrl);
              const fallbackBlob = await response.blob();
              
              const file = new File([fallbackBlob], `${template.name}.pdf`, { type: 'application/pdf' });
              setFile(file);
              setDocumentName(template.name);
            } else if (blob) {
              const file = new File([blob], `${template.name}.pdf`, { type: 'application/pdf' });
              setFile(file);
              setDocumentName(template.name);
              console.log("Template PDF loaded successfully");
            }
          } catch (err) {
            console.error("Error pre-loading template PDF:", err);
          }
        }
      }
      fetchFieldsAndPdf();
    }
  }, [selectedTemplateId, templates]);

  const handleSignerUpdate = (index: number, updates: Partial<SignerInput>) => {
    setSigners(prev => {
      const newSigners = [...prev];
      newSigners[index] = { ...newSigners[index], ...updates };
      return newSigners;
    });
  };

  const handleSubmit = async () => {
    if (!file) {
      alert("A PDF document is required to launch RAMS. Please upload one in the section above.");
      return;
    }
    if (!selectedTemplateId || !jobId || !documentName) {
      alert("Please ensure the Template, Job ID, and Document Name are all filled in.");
      return;
    }
    if (signers.some(s => !s.name || !s.email)) {
      alert("Please fill in the Name and Email for all required signers.");
      return;
    }

    setIsUploading(true);
    
    try {
      // Create FormData to send file and metadata to API
      const formData = new FormData();
      formData.append('file', file);
      formData.append('templateId', selectedTemplateId);
      formData.append('documentName', documentName);
      formData.append('jobId', jobId);
      formData.append('signers', JSON.stringify(signers));

      const response = await fetch('/api/launch-rams', {
        method: 'POST',
        body: formData
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || "Failed to launch RAMS via API");
      }

      alert("RAMS document launched successfully!");
      window.location.href = "/";
    } catch (error: any) {
      console.error("CRITICAL: RAMS Launch Failed", error);
      const errorDetail = error.message || (typeof error === 'object' ? JSON.stringify(error) : String(error));
      alert(`Error launching RAMS: ${errorDetail}. Check console for technical details.`);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div className="lg:col-span-2 space-y-6">
        <div className="bg-card border border-border/50 rounded-2xl p-6 shadow-sm space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Select Template</label>
              <select 
                className="w-full bg-secondary border border-border/50 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                value={selectedTemplateId}
                onChange={(e) => setSelectedTemplateId(e.target.value)}
              >
                <option value="">Choose a template...</option>
                {templates.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-muted-foreground uppercase tracking-wider">ServiceM8 Job ID</label>
              <input 
                placeholder="e.g. TR-2045"
                className="w-full bg-secondary border border-border/50 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                value={jobId}
                onChange={(e) => setJobId(e.target.value)}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Document Name</label>
              <input 
                placeholder="e.g. Site Risk Assessment - 15/03/2026"
                className="w-full bg-secondary border border-border/50 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                value={documentName}
                onChange={(e) => setDocumentName(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em]">
                {file ? "Current RAMS PDF" : "Upload Final RAMS PDF (Optional if using Template Default)"}
              </label>
              {file && (
                <button 
                  onClick={() => setShowPreview(!showPreview)}
                  className="flex items-center gap-1.5 text-[10px] font-bold text-primary uppercase tracking-wider hover:bg-primary/5 px-2 py-1 rounded-lg transition-colors"
                >
                  {showPreview ? <><EyeOff className="w-3 h-3" /> Hide Preview</> : <><Eye className="w-3 h-3" /> View Preview</>}
                </button>
              )}
            </div>
            {!file ? (
              <label className="flex flex-col items-center justify-center h-48 border-2 border-dashed border-border/50 rounded-2xl cursor-pointer hover:bg-secondary/30 transition-all hover:border-primary/30 group">
                <FileUp className="w-8 h-8 text-muted-foreground mb-3 group-hover:scale-110 transition-transform" />
                <p className="font-semibold text-sm">Drop PDF here or click to upload</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-widest mt-1">Replaces template default</p>
                <input type="file" className="hidden" accept=".pdf" onChange={(e) => setFile(e.target.files?.[0] || null)} />
              </label>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-secondary/20 border border-border/50 rounded-2xl">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-2.5 bg-primary/10 text-primary rounded-xl">
                      <FileUp className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-sm truncate text-white">{file.name}</p>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                    </div>
                  </div>
                  <button onClick={() => { setFile(null); setShowPreview(false); }} className="p-2 hover:bg-destructive/10 hover:text-destructive rounded-xl transition-colors border border-transparent hover:border-destructive/20">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {showPreview && (
                  <div className="animate-in fade-in slide-in-from-top-4 duration-300">
                    <div className="relative border border-border/50 rounded-2xl overflow-hidden bg-white shadow-xl min-h-[500px] flex justify-center">
                      <div ref={containerRef} className="relative">
                        <Document file={file} onLoadSuccess={({ numPages }) => setNumPages(numPages)}>
                          <Page 
                            pageNumber={currentPage} 
                            renderTextLayer={false} 
                            renderAnnotationLayer={false}
                            width={containerRef.current?.offsetWidth || 700}
                            loading={<div className="h-96 flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>}
                          />
                        </Document>

                        {fields.filter(f => f.page_number === currentPage).map((field) => (
                          <div
                            key={field.id}
                            style={{
                              position: 'absolute',
                              left: `${field.placement_x}%`,
                              top: `${field.placement_y}%`,
                              width: `${field.width}%`,
                              height: `${field.height}%`,
                              transform: 'translate(-50%, -50%)'
                            }}
                            className="border-2 border-primary/50 bg-primary/10 rounded flex items-center justify-center text-[8px] font-bold text-primary uppercase tracking-tighter text-center"
                          >
                            <span className="truncate px-1">{field.role_name}</span>
                          </div>
                        ))}
                      </div>

                      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-black/80 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 z-10 shadow-2xl">
                        <button 
                          disabled={currentPage <= 1}
                          onClick={() => setCurrentPage(c => Math.max(1, c - 1))}
                          className="text-white hover:text-primary transition-colors disabled:opacity-30"
                        >
                          Prev
                        </button>
                        <span className="text-[10px] font-bold text-white uppercase tracking-widest whitespace-nowrap">
                          {currentPage} / {numPages}
                        </span>
                        <button 
                          disabled={currentPage >= numPages}
                          onClick={() => setCurrentPage(c => Math.min(numPages, c + 1))}
                          className="text-white hover:text-primary transition-colors disabled:opacity-30"
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="bg-card border border-border/50 rounded-2xl p-6 shadow-sm">
          <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
            <Users className="w-6 h-6 text-primary" />
            Assign Signers
          </h3>
          
          <div className="space-y-4">
            {signers.length === 0 && (
              <p className="text-sm text-muted-foreground italic text-center py-8">
                {selectedTemplateId ? "Loading fields..." : "Please select a template first to see signature placeholders."}
              </p>
            )}
            {signers.map((signer, index) => (
              <div key={index} className="grid grid-cols-1 md:grid-cols-3 gap-4 p-5 bg-secondary/10 border border-border/20 rounded-2xl group transition-all hover:border-primary/20">
                <div className="flex items-center gap-3 md:col-span-3 pb-3 border-b border-border/10 mb-1">
                  <div className="w-7 h-7 rounded-xl bg-primary/10 text-primary flex items-center justify-center text-[10px] font-black shadow-inner">
                    {index + 1}
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">{signer.role_name}</p>
                    {signer.assigned_user_id && (
                      <p className="text-[9px] text-emerald-500 font-bold uppercase tracking-widest mt-0.5 flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3" />
                        Verified Account Attached
                      </p>
                    )}
                  </div>
                  
                  <div className="ml-auto flex items-center gap-2">
                    <select 
                      className="bg-slate-900 border border-white/5 rounded-xl px-3 py-2 text-[10px] font-bold text-primary hover:bg-slate-800 transition-all outline-none cursor-pointer"
                      onChange={(e) => {
                        const user = registeredUsers.find(u => u.id === e.target.value);
                        if (user) {
                          handleSignerUpdate(index, { 
                            name: user.name, 
                            email: user.email, 
                            assigned_user_id: user.id 
                          });
                        } else {
                          handleSignerUpdate(index, { 
                            name: "", 
                            email: "", 
                            assigned_user_id: "" 
                          });
                        }
                      }}
                      value={signer.assigned_user_id || ""}
                    >
                      <option value="">Quick Assign Identity...</option>
                      {registeredUsers.map(u => (
                        <option key={u.id} value={u.id}>{u.name}</option>
                      ))}
                    </select>
                    {signer.assigned_user_id && (
                      <button 
                        onClick={() => {
                          handleSignerUpdate(index, { 
                            name: "", 
                            email: "", 
                            assigned_user_id: "" 
                          });
                        }}
                        className="p-2 text-slate-500 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
                        title="Clear Assignment"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {!signer.assigned_user_id ? (
                  <>
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-slate-600 uppercase tracking-widest pl-1">Full Name</label>
                      <input 
                        placeholder="John Doe"
                        className="w-full bg-slate-950/50 border border-white/5 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all placeholder:text-slate-800"
                        value={signer.name}
                        onChange={(e) => handleSignerUpdate(index, { name: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1 md:col-span-2">
                      <label className="text-[9px] font-bold text-slate-600 uppercase tracking-widest pl-1">Email Address</label>
                      <input 
                        placeholder="john@example.com"
                        type="email"
                        className="w-full bg-slate-950/50 border border-white/5 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all placeholder:text-slate-800"
                        value={signer.email}
                        onChange={(e) => handleSignerUpdate(index, { email: e.target.value })}
                      />
                    </div>
                  </>
                ) : (
                  <div className="md:col-span-3 flex items-center gap-6 py-2 px-4 bg-primary/5 border border-primary/10 rounded-2xl animate-in fade-in slide-in-from-left-2 duration-300">
                     <div className="flex-1">
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Assigned Name</p>
                        <p className="text-sm font-bold text-white">{signer.name}</p>
                     </div>
                     <div className="flex-1">
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Assigned Email</p>
                        <p className="text-sm font-bold text-slate-300 italic">{signer.email}</p>
                     </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <div className="bg-card border border-border/50 rounded-2xl p-6 shadow-sm sticky top-8">
          <h3 className="font-bold text-lg mb-6 tracking-tight text-white">Summary</h3>
          
          <div className="space-y-4 mb-8">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Template</span>
              <span className="font-medium text-white">{templates.find(t => t.id === selectedTemplateId)?.name || "-"}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Signers</span>
              <span className="font-medium text-white">{signers.filter(s => s.name && s.email).length} / {signers.length}</span>
            </div>
          </div>

          <button 
            disabled={isUploading}
            onClick={handleSubmit}
            className={cn(
              "w-full flex items-center justify-center gap-2 px-6 py-4 rounded-xl font-bold transition-all active:scale-95 disabled:opacity-50",
              (!file || !selectedTemplateId || signers.some(s => !s.name || !s.email))
                ? "bg-secondary text-muted-foreground cursor-not-allowed border border-border/50"
                : "premium-gradient text-primary-foreground shadow-lg shadow-primary/20 hover:scale-[1.02]"
            )}
          >
            {isUploading ? (
              <><Loader2 className="w-5 h-5 animate-spin" /> Processing...</>
            ) : (
              <><Save className="w-5 h-5" /> Launch RAMS</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
