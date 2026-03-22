"use client";

import { useState, useRef, useEffect } from "react";
import SignatureCanvas from "react-signature-canvas";
import { Document, Page, pdfjs } from "react-pdf";
import { supabase } from "@/lib/supabase";
import { Check, Edit3, X, Loader2, Users, FileText, Key } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { useOrganization } from "@/hooks/useOrganization";

// Use the local worker (version 5.4.296) to match react-pdf and bypass CORS
pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

interface Signer {
  id: string;
  name: string;
  role_name: string;
  status: string;
  signature_data: string | null;
  signed_at: string | null;
  placement_x: number;
  placement_y: number;
  width: number;
  height: number;
  page_number: number;
  name_x: number | null;
  name_y: number | null;
  name_width: number | null;
  name_height: number | null;
  name_page_number: number | null;
  name_text: string | null;
  date_x: number | null;
  date_y: number | null;
  date_width: number | null;
  date_height: number | null;
  date_page_number: number | null;
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
  const { org } = useOrganization();
  const [loading, setLoading] = useState(true);
  const [signer, setSigner] = useState<any>(null);
  const [document, setDocument] = useState<any>(null);
  const [allSigners, setAllSigners] = useState<Signer[]>([]);
  const [fields, setFields] = useState<Field[]>([]);
  const [numPages, setNumPages] = useState(0);
  const [isSigning, setIsSigning] = useState(false);
  const [errorStatus, setErrorStatus] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  
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
        if (signerData.signed_at) {
            setSelectedDate(new Date(signerData.signed_at).toISOString().split('T')[0]);
        }

        // 2. Fetch all signers (which now contain the coordinate fields natively)
        const { data: signersRes } = await supabase
            .from("signers")
            .select("*")
            .eq("rams_id", signerData.rams_id);

        if (signersRes) {
           setAllSigners(signersRes);
           
           // Construct fields array from signers for backward compatibility in the UI overlay
           // We'll focus on the primary signature field for the "Sign Here" marker
           const mappedFields = signersRes
             .filter(s => s.placement_x != null)
             .map(s => ({
                role_name: s.role_name,
                placement_x: s.placement_x,
                placement_y: s.placement_y,
                page_number: s.page_number,
                width: s.width,
                height: s.height
             }));
           setFields(mappedFields);
        }

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

        // 5. Set up Realtime listener
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
          signed_at: new Date(selectedDate).toISOString()
        })
        .eq("id", signer.id);

      if (error) throw error;
      
      const updatedTimestamp = new Date(selectedDate).toISOString();
      const updatedSigner = { ...signer, status: "signed", signature_data: signatureData, signed_at: updatedTimestamp };
      setSigner(updatedSigner);

      // Check if this was the last signature
      const { data: latestSigners } = await supabase
        .from("signers")
        .select("status")
        .eq("rams_id", signer.rams_id);
      
      const allSigned = latestSigners?.every(s => s.status === 'signed');
      if (allSigned) {
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
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-muted-foreground animate-pulse">Loading secure RAMS document...</p>
      </div>
    );
  }

  if (errorStatus || !signer || !document) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-6 bg-slate-50 px-6 text-center">
        <div className="p-4 bg-red-500/10 rounded-full ring-1 ring-red-500/20">
          <X className="w-12 h-12 text-red-500" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">{errorStatus ? "Security Session Error" : "Document Not Found"}</h2>
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
    <div className="flex flex-col h-screen bg-slate-50 text-slate-900 overflow-hidden">
      {/* Header */}
      <header className="h-16 border-b border-slate-200 flex items-center justify-between px-6 bg-white/80 backdrop-blur-md z-30">
        <div className="flex items-center gap-3">
          {org.logo_url ? (
            <img src={org.logo_url} alt={org.name} className="h-12 max-w-[180px] object-contain" />
          ) : (
            <div className="w-8 h-8 rounded-lg premium-gradient flex items-center justify-center font-bold text-white text-[10px]">TRE</div>
          )}
          <div className="min-w-0">
            <h1 className="font-bold text-sm truncate max-w-[200px] md:max-w-md">{document.name}</h1>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Secure Signing Session</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-[10px] font-bold bg-slate-100 px-3 py-1.5 rounded-full border border-slate-200 text-slate-500">
             <span>{numPages} PAGES TOTAL</span>
          </div>
        </div>
      </header>

      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Left Side: PDF Viewer */}
        <div className="flex-1 bg-slate-100 overflow-auto p-4 md:p-8 flex flex-col items-center gap-8 custom-scrollbar scroll-smooth">
          <Document 
            file={pdfUrl} 
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

                  {/* Overlay for ALL field types */}
                  {allSigners.map((s) => {
                    const elements = [];
                    
                    // 1. Signature
                    if (s.signature_data && s.page_number === pageNum) {
                      elements.push(
                        <div key={`${s.id}-sig`} style={{ position: 'absolute', left: `${s.placement_x}%`, top: `${s.placement_y}%`, width: `${s.width}%`, height: `${s.height}%` }} className="animate-in fade-in zoom-in duration-500">
                          <img src={s.signature_data} className="w-full h-full object-contain mix-blend-multiply" />
                        </div>
                      );

                      if (s.signed_at) {
                        elements.push(
                          <div 
                            key={`${s.id}-date-stamp`}
                            style={{ 
                              position: 'absolute', 
                              left: `calc(${s.placement_x + s.width}% + 10px)`, 
                              top: `${s.placement_y}%`,
                              height: `${s.height}%`,
                              display: 'flex',
                              alignItems: 'center'
                            }}
                            className="animate-in fade-in slide-in-from-left-2 duration-700 delay-300 pointer-events-none"
                          >
                            <span className="text-[10px] font-bold text-slate-900 whitespace-nowrap bg-white/40 px-1 rounded backdrop-blur-[1px]">
                              {new Date(s.signed_at).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "2-digit" }).replace(/\//g, " ")}
                            </span>
                          </div>
                        );
                      }
                    }
                    
                    return elements;
                  })}

                  {/* "Sign Here" Marker */}
                  {isMarkerPage && (
                    <div
                      style={{
                        position: 'absolute',
                        left: `${currentRoleField.placement_x + (currentRoleField.width / 2)}%`,
                        top: `${currentRoleField.placement_y + (currentRoleField.height / 2)}%`,
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
        </div>

        {/* Right Side: Signing Panel */}
        <div id="signing-panel" className="w-full lg:w-[400px] bg-white border-l border-slate-200 flex flex-col z-20 overflow-y-auto">
          <div className="p-6 space-y-8">
            <div className="space-y-1 text-center">
              <h2 className="text-xl font-bold text-slate-900">Identity Check</h2>
              <p className="text-xs text-slate-500 font-medium">Signing as <span className="text-primary font-bold">{signer.role_name}</span>.</p>
            </div>

            <div className="space-y-4">
              {signer.status !== "signed" ? (
                <div className="space-y-4">
                  {!isVerified ? (
                    <div className="bg-white border border-amber-500/20 rounded-2xl p-6 space-y-4 shadow-sm text-center">
                        <Key className="w-8 h-8 text-amber-500 mx-auto" />
                        <h3 className="font-bold text-slate-900">{assignedUser.name}</h3>
                        <input type="password" maxLength={4} value={pin} onChange={(e) => setPin(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-center text-xl font-bold tracking-[0.5em] outline-none" placeholder="••••" />
                      <button onClick={handleVerifyPIN} disabled={pin.length < 4 || isVerifying} className="w-full py-3 bg-amber-500 text-black font-bold rounded-xl hover:scale-[1.02] transition-all disabled:opacity-50">
                        {isVerifying ? "Verifying..." : "Unlock Canvas"}
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-6 animate-in fade-in zoom-in duration-300">
                      <div className="space-y-4">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Provide your Signature</label>
                        <div className="bg-white rounded-2xl p-4 shadow-sm ring-1 ring-slate-200">
                          <SignatureCanvas 
                            ref={sigCanvas}
                            penColor="black"
                            canvasProps={{ width: 350, height: 180, className: "w-full h-[180px] cursor-crosshair touch-none" }}
                          />
                          <button onClick={() => sigCanvas.current?.clear()} className="mt-2 text-[10px] font-bold text-slate-400 hover:text-red-500 uppercase">Clear</button>
                        </div>
                      </div>

                      <button onClick={handleSaveSignature} disabled={isSigning} className="w-full py-4 rounded-xl premium-gradient text-white font-bold shadow-xl shadow-primary/20 hover:scale-[1.02] transition-all">
                        {isSigning ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : "Confirm & Save"}
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-emerald-500/5 rounded-3xl p-8 border border-emerald-500/20 flex flex-col items-center gap-6 text-center animate-in fade-in zoom-in duration-500">
                  <div className="w-20 h-20 rounded-full bg-emerald-500 flex items-center justify-center text-emerald-950 shadow-2xl">
                    <Check className="w-10 h-10 stroke-[3px]" />
                  </div>
                  <h3 className="text-2xl font-bold text-slate-900 tracking-tight">Document Secured</h3>
                  <Link href="/dashboard" className="w-full py-4 rounded-xl bg-slate-100 border border-slate-200 text-slate-900 font-bold hover:bg-slate-200 transition-all uppercase tracking-widest text-xs">Return to Dashboard</Link>
                </div>
              )}
            </div>

            <div className="space-y-4 pt-8 border-t border-slate-200">
              <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                <Users className="w-3 h-3" /> Collaboration Flow
              </h3>
              <div className="space-y-2">
                {allSigners.map((s) => (
                  <div key={s.id} className={cn("flex items-center gap-3 p-3 rounded-xl border transition-all", s.id === signer.id ? "bg-primary/5 border-primary/20" : "bg-slate-50 border-slate-200 text-slate-400")}>
                    <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-bold", s.status === "signed" ? "bg-emerald-500 text-white" : "bg-slate-200")}>
                      {s.status === "signed" ? <Check className="w-4 h-4" /> : s.role_name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold truncate">{s.name}</p>
                      <p className="text-[9px] font-medium uppercase tracking-wider">{s.role_name}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="mt-auto p-6 bg-slate-50 border-t border-slate-200 text-[9px] text-slate-400 text-center uppercase tracking-[0.2em] font-bold">
            {org.name} Today • Powered by Antigravity
          </div>
        </div>
      </div>
    </div>
  );
}
