"use client";

import { useState, useRef, useEffect } from "react";
import SignatureCanvas from "react-signature-canvas";
import { Document, Page, pdfjs } from "react-pdf";
import { supabase } from "@/lib/supabase";
import { Check, Edit3, X, Loader2, Users, FileText, Key } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

// Use a stable version-specific worker URL to avoid resolution issues in production
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.mjs`;

interface Signer {
  id: string;
  name: string;
  role_name: string;
  status: string;
  signature_data: string | null;
}

interface Field {
  role_name: string;
  placement_x: number;
  placement_y: number;
  page_number: number;
  width: number;
  height: number;
}

export default function SigningPage({ token }: { token: string }) {
  const [loading, setLoading] = useState(true);
  const [signer, setSigner] = useState<any>(null);
  const [document, setDocument] = useState<any>(null);
  const [allSigners, setAllSigners] = useState<Signer[]>([]);
  const [fields, setFields] = useState<Field[]>([]);
  const [numPages, setNumPages] = useState(0);
  const [isSigning, setIsSigning] = useState(false);
  const [errorStatus, setErrorStatus] = useState<string | null>(null);
  
  // Security State
  const [pin, setPin] = useState("");
  const [isVerified, setIsVerified] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [assignedUser, setAssignedUser] = useState<any>(null);

  const [containerWidth, setContainerWidth] = useState<number>(800);
  const containerRef = useRef<HTMLDivElement>(null);
  const sigCanvas = useRef<SignatureCanvas>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [loading]);

  useEffect(() => {
    async function init() {
      try {
        // 1. Fetch current signer with document
        const { data: signerData, error: signerError } = await supabase
          .from("signers")
          .select("*, rams_documents(*)")
          .eq("token", token)
          .single();

        if (signerError || !signerData) {
          console.error("Signer fetch error:", signerError);
          setErrorStatus(signerError?.message || "Invalid or expired signing link. Please check the URL and try again.");
          return;
        }

        setSigner(signerData);
        setDocument(signerData.rams_documents);

        // 2 & 3. Fetch all signers and template fields in parallel
        const [signersRes, fieldsRes] = await Promise.all([
          supabase
            .from("signers")
            .select("id, name, role_name, status, signature_data")
            .eq("rams_id", signerData.rams_id),
          supabase
            .from("template_signature_fields")
            .select("*")
            .eq("template_id", signerData.rams_documents.template_id)
        ]);

        if (signersRes.data) setAllSigners(signersRes.data);
        if (fieldsRes.data) setFields(fieldsRes.data);

        // 4. Identity Verification
        if (signerData.assigned_user_id) {
          const { data: userData } = await supabase
            .from("registered_users")
            .select("*")
            .eq("id", signerData.assigned_user_id)
            .single();
          
          if (userData) {
            setAssignedUser(userData);
            setIsVerified(false); // Force PIN verification
          } else {
            setIsVerified(true); // Fallback to open signing if user record missing
          }
        } else {
          setIsVerified(true); // Open signing for unassigned roles (e.g. Guest)
        }

        // 5. Set up Realtime listener inside the block where signerData is available
        const channel = supabase
          .channel(`rams-${signerData.rams_id}`)
          .on(
            "postgres_changes",
            {
              event: "UPDATE",
              schema: "public",
              table: "signers",
              filter: `rams_id=eq.${signerData.rams_id}`,
            },
            (payload) => {
              setAllSigners((prev) => 
                prev.map(s => s.id === payload.new.id ? { ...s, ...payload.new } : s)
              );
            }
          )
          .subscribe();

        return () => {
          supabase.removeChannel(channel);
        };
      } catch (err: any) {
        console.error("CRITICAL: SigningPage Initialization error:", err);
        setErrorStatus(err.message || "A technical error occurred while loading the secure signing session.");
      } finally {
        setLoading(false);
      }
    }

    init();
  }, [token]);

  const pdfUrl = signer && document 
    ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/rams/${document.file_path}`
    : null;

  const handleVerifyPIN = () => {
    if (!assignedUser) return;
    setIsVerifying(true);
    
    // Simple PIN check for this version
    if (pin === assignedUser.password_hash) {
      setIsVerified(true);
    } else {
      alert("Incorrect PIN. Please try again.");
      setPin("");
    }
    setIsVerifying(false);
  };

  const handleSaveSignature = async () => {
    if (!sigCanvas.current || sigCanvas.current.isEmpty()) return;

    const signatureData = sigCanvas.current.toDataURL("image/png");
    
    setIsSigning(true);
    try {
      const { error } = await supabase
        .from("signers")
        .update({
          signature_data: signatureData,
          status: "signed",
          signed_at: new Date().toISOString()
        })
        .eq("id", signer.id);

      if (error) throw error;
      
      const now = new Date().toISOString();
      const updatedSigner = { ...signer, status: "signed", signature_data: signatureData, signed_at: now };
      setSigner(updatedSigner);

      // Check if this was the last signature
      const { data: latestSigners } = await supabase
        .from("signers")
        .select("status")
        .eq("rams_id", signer.rams_id);
      
      const allSigned = latestSigners?.every(s => s.status === 'signed');
      if (allSigned) {
        console.log("All signers have signed! Triggering finalization...");
        fetch('/api/finalize-pdf', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ramsId: signer.rams_id })
        }).catch(err => console.error("Finalization trigger failed:", err));
      }

      setIsSigning(false);
    } catch (error) {
      console.error(error);
      alert("Error saving signature");
      setIsSigning(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-[#020617]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-muted-foreground animate-pulse">Loading secure RAMS document...</p>
      </div>
    );
  }

  if (errorStatus || !signer || !document) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-6 bg-[#020617] px-6 text-center">
        <div className="p-4 bg-red-500/10 rounded-full ring-1 ring-red-500/20">
          <X className="w-12 h-12 text-red-500" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-white tracking-tight">{errorStatus ? "Security Session Error" : "Document Not Found"}</h2>
          <p className="text-muted-foreground text-sm max-w-sm mx-auto">
            {errorStatus || "This signing link is invalid, expired, or the document has been moved."}
          </p>
        </div>
        <Link 
          href="/" 
          className="mt-2 px-8 py-3 bg-secondary text-foreground text-sm font-bold rounded-xl border border-border/50 hover:bg-secondary/80 transition-all"
        >
          Return to Dashboard
        </Link>
      </div>
    );
  }

  const currentRoleField = fields.find(f => f.role_name === signer.role_name);

  return (
    <div className="flex flex-col h-screen bg-[#020617] text-slate-100 overflow-hidden">
      {/* Header */}
      <header className="h-16 border-b border-white/5 flex items-center justify-between px-6 bg-slate-900/40 backdrop-blur-md z-30">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg premium-gradient flex items-center justify-center font-bold text-[10px]">TRE</div>
          <div className="min-w-0">
            <h1 className="font-bold text-sm truncate max-w-[200px] md:max-w-md">{document.name}</h1>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Secure Signing Session</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-[10px] font-bold bg-white/5 px-3 py-1.5 rounded-full border border-white/10 text-slate-400">
             <span>{numPages} PAGES TOTAL</span>
          </div>
          <div className="hidden md:flex items-center gap-2 text-[10px] font-bold text-primary uppercase tracking-[0.2em]">
             Scroll to Sign
          </div>
        </div>
      </header>

      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Left Side: PDF Viewer */}
        <div className="flex-1 bg-slate-950 overflow-auto p-4 md:p-8 flex flex-col items-center gap-8 custom-scrollbar scroll-smooth">
          <Document 
            file={pdfUrl} 
            onLoadError={(error) => {
              console.error('PDF Load Error:', error);
            }}
            onLoadSuccess={({ numPages }) => setNumPages(numPages)}
            loading={<div className="h-[800px] w-full flex items-center justify-center bg-slate-900/50"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>}
            className="flex flex-col items-center gap-8"
          >
            {Array.from(new Array(numPages), (el, index) => {
              const pageNum = index + 1;
              const isMarkerPage = !signer.signature_data && isVerified && currentRoleField?.page_number === pageNum;
              
              return (
                <div 
                  key={`page_${pageNum}`}
                  id={`page-${pageNum}`}
                  className="relative shadow-2xl transition-all duration-500 bg-white"
                  style={{ height: 'fit-content' }}
                >
                  <Page 
                    pageNumber={pageNum} 
                    renderTextLayer={false} 
                    renderAnnotationLayer={false}
                    width={Math.min(containerWidth - 64, 1100)}
                    className="shadow-2xl"
                    loading={<div className="h-[800px] w-full flex items-center justify-center bg-slate-900/50"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>}
                  />

                  {/* Per-Page Signatures Overlay */}
                  {fields.filter(f => f.page_number === pageNum).map((field) => {
                    const signerForField = allSigners.find(s => s.role_name === field.role_name);
                    if (!signerForField?.signature_data) return null;

                    return (
                      <div
                        key={field.role_name}
                        style={{
                          position: 'absolute',
                          left: `${field.placement_x}%`,
                          top: `${field.placement_y}%`,
                          width: `${field.width}%`,
                          height: `${field.height}%`,
                          transform: 'translate(-50%, -50%)'
                        }}
                        className="animate-in fade-in zoom-in duration-500 group"
                      >
                        <img src={signerForField.signature_data} className="w-full h-full object-contain mix-blend-multiply" />
                      </div>
                    );
                  })}

                  {/* "Sign Here" Marker */}
                  {isMarkerPage && (
                    <div
                      style={{
                        position: 'absolute',
                        left: `${currentRoleField.placement_x}%`,
                        top: `${currentRoleField.placement_y}%`,
                        transform: 'translate(-50%, -50%)'
                      }}
                      className="flex flex-col items-center gap-2 animate-bounce cursor-pointer z-20"
                      onClick={() => {
                          document.getElementById('signing-panel')?.scrollIntoView({ behavior: 'smooth' });
                      }}
                    >
                      <div className="bg-primary text-primary-foreground text-[10px] font-bold px-3 py-1 rounded-full shadow-lg shadow-primary/20 flex items-center gap-2">
                          <Edit3 className="w-3 h-3" /> Sign Here
                      </div>
                      <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[8px] border-t-primary shadow-primary/20"></div>
                    </div>
                  )}
                </div>
              );
            })}
          </Document>

          {numPages > 0 && (
            <div className="flex justify-center py-8 w-full">
              <button 
                onClick={() => {
                   const markerPage = document.getElementById(`page-${currentRoleField?.page_number}`);
                   markerPage?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }}
                className="bg-primary/10 border border-primary/20 px-8 py-4 rounded-2xl text-[10px] font-bold text-primary uppercase tracking-widest hover:bg-primary/20 transition-all flex items-center gap-2"
              >
                <Edit3 className="w-4 h-4" /> Scroll to Signature Spot
              </button>
            </div>
          )}
        </div>

        {/* Right Side: Signing Panel */}
        <div id="signing-panel" className="w-full lg:w-[400px] bg-slate-900/50 backdrop-blur-2xl border-l border-white/5 flex flex-col z-20 overflow-y-auto">
          <div className="p-6 space-y-8">
            {/* User Greeting */}
            <div className="space-y-1 text-center">
              <h2 className="text-xl font-bold text-white">Identity Check</h2>
              <p className="text-xs text-slate-400 font-medium">Signing as <span className="text-primary font-bold">{signer.role_name}</span>.</p>
            </div>

            {/* Signature Area */}
            <div className="space-y-4">
              {signer.status !== "signed" ? (
                <div className="space-y-4">
                  {!isVerified ? (
                    <div className="bg-slate-900 border border-amber-500/30 rounded-2xl p-6 space-y-4 shadow-xl">
                      <div className="flex flex-col items-center text-center gap-2">
                        <div className="w-12 h-12 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center">
                          <Key className="w-6 h-6" />
                        </div>
                        <h3 className="font-bold text-white">{assignedUser.name}</h3>
                        <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Enter your 4-digit PIN</p>
                      </div>
                      
                      <div className="flex justify-center gap-3">
                        <input 
                          type="password"
                          maxLength={4}
                          value={pin}
                          onChange={(e) => setPin(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleVerifyPIN()}
                          className="w-32 bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-center text-xl font-bold tracking-[0.5em] focus:ring-2 focus:ring-primary/20 outline-none"
                          placeholder="••••"
                        />
                      </div>

                      <button 
                        onClick={handleVerifyPIN}
                        disabled={pin.length < 4 || isVerifying}
                        className="w-full py-3 bg-amber-500 text-black font-bold rounded-xl hover:scale-[1.02] transition-all disabled:opacity-50"
                      >
                        {isVerifying ? "Verifying..." : "Unlock Canvas"}
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-4 animate-in fade-in zoom-in duration-300">
                      <div className="flex justify-between items-end">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                          <Edit3 className="w-3 h-3" /> Digital Signature
                        </label>
                      </div>
                      <div className="bg-white rounded-2xl p-4 shadow-xl ring-1 ring-white/10 group">
                        <SignatureCanvas 
                          ref={sigCanvas}
                          penColor="black"
                          canvasProps={{ 
                            width: 350, 
                            height: 180, 
                            className: "w-full h-[180px] cursor-crosshair touch-none" 
                          }}
                        />
                        <div className="mt-2 pt-2 border-t border-slate-100 flex justify-between items-center px-1">
                          <span className="text-[9px] text-slate-400 font-medium italic">Sign inside the area</span>
                          <button 
                            onClick={() => sigCanvas.current?.clear()}
                            className="text-[10px] font-bold text-slate-400 hover:text-destructive transition-colors uppercase tracking-widest"
                          >
                            Clear
                          </button>
                        </div>
                      </div>

                      <button 
                        disabled={isSigning}
                        onClick={handleSaveSignature}
                        className="w-full flex items-center justify-center gap-3 px-8 py-4 rounded-xl premium-gradient text-primary-foreground font-bold shadow-xl shadow-primary/10 hover:scale-[1.02] transition-all active:scale-95 disabled:opacity-50"
                      >
                        {isSigning ? (
                          <><Loader2 className="w-5 h-5 animate-spin" /> Processing...</>
                        ) : (
                          <><Check className="w-5 h-5" /> Confirm Signature</>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-emerald-500/5 rounded-3xl p-8 border border-emerald-500/20 flex flex-col items-center gap-6 text-center animate-in fade-in zoom-in duration-500">
                  <div className="w-20 h-20 rounded-full bg-emerald-500 flex items-center justify-center text-emerald-950 shadow-2xl shadow-emerald-500/40 border-4 border-emerald-400/50">
                    <Check className="w-10 h-10 stroke-[3px]" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-2xl font-bold text-white tracking-tight">Document Secured</h3>
                    <p className="text-slate-400 text-sm font-medium">Your digital signature has been verified and permanently attached to this RAMS.</p>
                  </div>
                  
                  <div className="w-full h-px bg-white/5 my-2"></div>
                  
                  <Link 
                    href="/dashboard"
                    className="w-full flex items-center justify-center gap-3 px-6 py-4 rounded-xl bg-white/5 border border-white/10 text-white font-bold hover:bg-white/10 transition-all uppercase tracking-widest text-xs"
                  >
                    Return to Dashboard
                  </Link>
                </div>
              )}
            </div>

            {/* Document Details */}
            <div className="space-y-4 pt-8 border-t border-white/5">
              <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                <Users className="w-3 h-3" /> Collaboration Flow
              </h3>
              <div className="space-y-2">
                {allSigners.map((s) => (
                  <div key={s.id} className={cn(
                    "flex items-center gap-3 p-3 rounded-xl border transition-all",
                    s.id === signer.id ? "bg-primary/10 border-primary/20 ring-1 ring-primary/10" : "bg-white/5 border-white/5"
                  )}>
                    <div className={cn(
                      "w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-bold",
                      s.status === "signed" ? "bg-emerald-500 text-black shadow-lg shadow-emerald-500/20" : "bg-slate-800 text-slate-400"
                    )}>
                      {s.status === "signed" ? <Check className="w-4 h-4" /> : s.role_name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold truncate text-white">{s.name}</p>
                      <p className="text-[9px] text-slate-500 font-medium uppercase tracking-wider">{s.role_name}</p>
                    </div>
                    {s.status === "signed" && (
                      <div className="flex items-center gap-1.5 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                        <div className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse"></div>
                        <span className="text-[8px] font-bold text-emerald-500 uppercase">Live</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
          
          <div className="mt-auto p-6 bg-slate-950/50 border-t border-white/5">
              <p className="text-[9px] text-slate-500 text-center uppercase tracking-[0.2em] font-bold">
                TRE Energy Today • Powered by Antigravity
              </p>
          </div>
        </div>
      </div>
    </div>
  );
}
