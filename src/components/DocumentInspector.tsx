"use client";

import { useState, useEffect, useRef } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { supabase } from "@/lib/supabase";
import { Check, Loader2, Users, FileText, Download } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

// Use the local worker (version 5.4.296) to match react-pdf and bypass CORS
pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

export function DocumentInspector({ ramsId }: { ramsId: string }) {
  const [loading, setLoading] = useState(true);
  const [document, setDocument] = useState<any>(null);
  const [allSigners, setAllSigners] = useState<any[]>([]);
  const [fields, setFields] = useState<any[]>([]);
  const [numPages, setNumPages] = useState(0);
  const [containerWidth, setContainerWidth] = useState<number>(800);
  const containerRef = useRef<HTMLDivElement>(null);
  const parentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!parentRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });
    observer.observe(parentRef.current);
    return () => observer.disconnect();
  }, [loading]);

  useEffect(() => {
    async function init() {
      // 1. Fetch document
      const { data: docData } = await supabase
        .from("rams_documents")
        .select("*")
        .eq("id", ramsId)
        .single();

      if (!docData) return;
      setDocument(docData);

      // 2. Fetch all signers
      const { data: signers } = await supabase
        .from("signers")
        .select("*")
        .eq("rams_id", ramsId);
      
      if (signers) setAllSigners(signers);

      // 3. Fetch template fields
      const { data: templateFields } = await supabase
        .from("template_signature_fields")
        .select("*")
        .eq("template_id", docData.template_id);
      
      if (templateFields) setFields(templateFields);

      setLoading(false);

      // 4. Realtime updates for signatures
      const channel = supabase
        .channel(`rams-inspect-${ramsId}`)
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "signers",
            filter: `rams_id=eq.${ramsId}`,
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
    }

    init();
  }, [ramsId]);

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
      {/* Sidebar: Details & Audit */}
      <div className="w-full lg:w-80 space-y-6">
        <div className="bg-card border border-border/50 rounded-2xl p-6 shadow-sm sticky top-8">
           <div className="flex items-center gap-3 mb-6">
             <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
               <FileText className="w-6 h-6" />
             </div>
             <div>
               <h2 className="font-bold text-white leading-tight">Document Audit</h2>
               <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Status: {document.status}</p>
             </div>
           </div>

           <div className="space-y-4">
             <div className="space-y-2">
               <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Participants</p>
               <div className="space-y-2">
                 {allSigners.map(s => (
                   <div key={s.id} className="flex items-center gap-3 p-2 bg-secondary/30 rounded-lg border border-border/30">
                     <div className={cn(
                       "w-6 h-6 rounded-full flex items-center justify-center text-[8px] font-bold",
                       s.status === 'signed' ? "bg-emerald-500 text-black" : "bg-slate-700 text-slate-400"
                     )}>
                       {s.status === 'signed' ? <Check className="w-4 h-4" /> : s.role_name.charAt(0)}
                     </div>
                     <div className="flex-1 min-w-0">
                       <p className="text-xs font-bold truncate text-white">{s.name}</p>
                       <p className="text-[9px] text-muted-foreground uppercase">{s.role_name}</p>
                     </div>
                   </div>
                 ))}
               </div>
             </div>

             {document.status === 'completed' && (
               <a 
                 href={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/rams/${document.final_file_path}`}
                 target="_blank"
                 rel="noreferrer"
                 className="w-full flex items-center justify-center gap-2 py-3 bg-emerald-500 text-black font-bold rounded-xl hover:scale-[1.02] transition-transform shadow-lg shadow-emerald-500/20"
               >
                 <Download className="w-4 h-4" />
                 Download Signed PDF
               </a>
             )}
           </div>
        </div>
      </div>

      {/* Main View: PDF with live overlays */}
      <div className="flex-1 space-y-4">
        <div className="flex items-center justify-between border border-border/50 bg-secondary/20 p-4 rounded-2xl">
           <div className="flex items-center gap-4 text-xs font-bold text-muted-foreground uppercase tracking-widest">
              <span>{numPages} Pages Total</span>
              <div className="w-px h-3 bg-border"></div>
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
                  
                  {/* Per-Page Signatures Overlay */}
                  {allSigners.filter(s => s.page_number === pageNum).map((signer) => (
                    <div
                      key={signer.id}
                      style={{
                        position: 'absolute',
                        left: `${signer.placement_x}%`,
                        top: `${signer.placement_y}%`,
                        width: `${signer.width}%`,
                        height: `${signer.height}%`,
                        transform: 'translate(-50%, -50%)'
                      }}
                      className={cn(
                        "animate-in fade-in zoom-in duration-500 flex items-center justify-center border-2 transition-all",
                        signer.signature_data 
                          ? "border-transparent" 
                          : "border-emerald-500/50 bg-emerald-500/5 rounded-lg border-dashed"
                      )}
                    >
                      {signer.signature_data ? (
                        <img 
                          src={signer.signature_data} 
                          className="w-full h-full object-contain mix-blend-multiply" 
                        />
                      ) : (
                        <div className="absolute -top-6 left-0 bg-emerald-500 text-white text-[9px] font-black px-2 py-0.5 rounded-t-md uppercase tracking-widest whitespace-nowrap shadow-sm">
                           {signer.name || `Signer`}
                        </div>
                      )}
                      {!signer.signature_data && (
                        <div className="text-[8px] font-bold text-emerald-600/40 uppercase text-center px-1">
                          {signer.role_name}
                        </div>
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
