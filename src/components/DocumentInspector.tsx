"use client";

import { useState, useEffect, useRef } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { supabase } from "@/lib/supabase";
import { Check, Loader2, FileText, Download, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

export function DocumentInspector({ ramsId }: { ramsId: string }) {
  const [loading, setLoading] = useState(true);
  const [document, setDocument] = useState<any>(null);
  const [allSigners, setAllSigners] = useState<any[]>([]);
  const [numPages, setNumPages] = useState(0);
  const [containerWidth, setContainerWidth] = useState<number>(800);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const parentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!parentRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) setContainerWidth(entry.contentRect.width);
    });
    observer.observe(parentRef.current);
    return () => observer.disconnect();
  }, [loading]);

  useEffect(() => {
    async function init() {
      const { data: docData } = await supabase
        .from("rams_documents")
        .select("*")
        .eq("id", ramsId)
        .single();

      if (!docData) return;
      setDocument(docData);

      const { data: signers } = await supabase
        .from("signers")
        .select("*")
        .eq("rams_id", ramsId);

      if (signers) setAllSigners(signers);
      setLoading(false);

      const channel = supabase
        .channel(`rams-inspect-${ramsId}`)
        .on("postgres_changes", {
          event: "UPDATE",
          schema: "public",
          table: "signers",
          filter: `rams_id=eq.${ramsId}`,
        }, (payload) => {
          setAllSigners((prev) =>
            prev.map(s => s.id === payload.new.id ? { ...s, ...payload.new } : s)
          );
        })
        .subscribe();

      return () => { supabase.removeChannel(channel); };
    }
    init();
  }, [ramsId]);

  async function handleRegenerate() {
     setIsRegenerating(true);
     try {
        const res = await fetch('/api/finalize-pdf', {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({ ramsId })
        });
        const data = await res.json();
        if (data.success) {
           const { data: updatedDoc } = await supabase
             .from("rams_documents")
             .select("*")
             .eq("id", ramsId)
             .single();
           if (updatedDoc) setDocument(updatedDoc);
        } else {
           alert("Regeneration failed: " + (data.error || "Unknown error"));
        }
     } catch (err: any) {
        alert("Error: " + err.message);
     } finally {
        setIsRegenerating(false);
     }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-20 gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-muted-foreground">Loading RAMS Inspector...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row gap-8">
      {/* Sidebar */}
      <div className="w-full lg:w-80 space-y-6">
        <div className="bg-card border border-border/50 rounded-2xl p-6 shadow-sm sticky top-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <h2 className="font-bold text-white leading-tight">Document Audit</h2>
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">
                Status: {document.status}
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Participants</p>
              <div className="space-y-2">
                {allSigners.map(s => (
                  <div key={s.id} className="flex items-center gap-3 p-2 bg-secondary/30 rounded-lg border border-border/30">
                    <div className={cn(
                      "w-6 h-6 rounded-full flex items-center justify-center text-[8px] font-bold shrink-0",
                      s.status === 'signed' ? "bg-emerald-500 text-black" : "bg-slate-700 text-slate-400"
                    )}>
                      {s.status === 'signed' ? <Check className="w-4 h-4" /> : (s.name || s.role_name || "?").charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      {/* Show actual name - fallback to role_name if name is empty */}
                      <p className="text-xs font-bold truncate text-white">
                        {s.name && s.name.trim() ? s.name : s.role_name}
                      </p>
                      <p className="text-[9px] text-muted-foreground uppercase">{s.role_name}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {document.status === 'completed' && (
              <div className="pt-4 space-y-3">
                <a
                  href={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/rams/${document.final_file_path}?t=${new Date().getTime()}`}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full flex items-center justify-center gap-2 py-3 bg-emerald-500 text-black font-bold rounded-xl hover:scale-[1.02] transition-transform shadow-lg shadow-emerald-500/20"
                >
                  <Download className="w-4 h-4" />
                  Download Signed PDF
                </a>
                
                <button
                  onClick={handleRegenerate}
                  disabled={isRegenerating}
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-slate-800 text-slate-200 text-[10px] font-bold uppercase tracking-widest rounded-xl hover:bg-slate-700 transition-colors disabled:opacity-50"
                >
                  {isRegenerating ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <RotateCcw className="w-3 h-3" />
                  )}
                  Regenerate Final PDF
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* PDF Viewer */}
      <div className="flex-1 space-y-4">
        <div className="flex items-center border border-border/50 bg-secondary/20 p-4 rounded-2xl">
          <div className="flex items-center gap-4 text-xs font-bold text-muted-foreground uppercase tracking-widest">
            <span>{numPages} Pages Total</span>
            <div className="w-px h-3 bg-border" />
            <span className="text-primary">Scroll to View All</span>
          </div>
        </div>

        <div ref={parentRef} className="relative border border-border/50 rounded-2xl overflow-hidden bg-slate-900/50 p-4 shadow-2xl flex flex-col items-center gap-6 overflow-y-auto max-h-[calc(100vh-200px)]">
          <Document
            file={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/rams/${document.file_path}`}
            onLoadSuccess={({ numPages }) => setNumPages(numPages)}
            loading={<div className="p-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>}
            className="flex flex-col items-center gap-8"
          >
            {Array.from(new Array(numPages), (el, index) => {
              const pageNum = index + 1;
              return (
                <div key={`page_${pageNum}`} className="relative bg-white shadow-xl">
                  <Page
                    pageNumber={pageNum}
                    renderTextLayer={false}
                    renderAnnotationLayer={false}
                    width={Math.min(containerWidth - 64, 900)}
                  />

                  {allSigners.filter(s => s.page_number === pageNum).map((signer) => (
                    <div
                      key={signer.id}
                      style={{
                        position: 'absolute',
                        left: `${signer.placement_x}%`,
                        top: `${signer.placement_y}%`,
                        width: `${signer.width}%`,
                        height: `${signer.height}%`,
                      }}
                      className={cn(
                        "animate-in fade-in zoom-in duration-500 flex items-center justify-center border-2 transition-all",
                        signer.signature_data
                          ? "border-transparent"
                          : "border-emerald-500/50 bg-emerald-500/5 rounded-lg border-dashed"
                      )}
                    >
                      {signer.signature_data ? (
                        <div className="relative w-full h-full">
                          <img
                            src={signer.signature_data}
                            className="w-full h-full object-contain mix-blend-multiply"
                          />
                          {signer.signed_at && (
                            <div 
                              style={{ 
                                position: 'absolute', 
                                left: `calc(100% + 10px)`, 
                                top: '50%',
                                transform: 'translateY(-50%)',
                              }}
                              className="animate-in fade-in slide-in-from-left-2 duration-700 delay-300 pointer-events-none"
                            >
                              <span className="text-[10px] font-bold text-slate-900 whitespace-nowrap bg-white/40 px-1 rounded backdrop-blur-[1px]">
                                {new Date(signer.signed_at).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "2-digit" }).replace(/\//g, " ")}
                              </span>
                            </div>
                          )}
                          {(signer.name_text || signer.name) && (
                            <div 
                              style={{ 
                                position: 'absolute', 
                                right: `calc(100% + 60px)`, 
                                top: '50%',
                                transform: 'translateY(-50%)',
                              }}
                              className="animate-in fade-in slide-in-from-right-2 duration-700 delay-300 pointer-events-none"
                            >
                              <span className="text-[18px] font-black text-slate-900 whitespace-nowrap bg-white/40 px-2 py-1 rounded backdrop-blur-[1px] shadow-sm">
                                {signer.name_text || signer.name}
                              </span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <>
                          <div className="absolute -top-6 left-0 bg-emerald-500 text-white text-[9px] font-black px-2 py-0.5 rounded-t-md uppercase tracking-widest whitespace-nowrap shadow-sm">
                            {signer.name && signer.name.trim() ? signer.name : signer.role_name}
                          </div>
                          <div className="text-[8px] font-bold text-emerald-600/40 uppercase text-center px-1">
                            {signer.role_name}
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              );
            })}
          </Document>
        </div>
      </div>
    </div>
  );
}
