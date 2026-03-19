"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { 
  FileUp, 
  Users, 
  Save, 
  X, 
  Loader2, 
  ShieldCheck, 
  Plus, 
  Eye, 
  EyeOff, 
  Trash2, 
  PenTool, 
  User, 
  Calendar, 
  Type 
} from "lucide-react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { cn } from "@/lib/utils";

// Use the local worker (version 5.4.296) to match react-pdf and bypass CORS
pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

interface SignerField {
  id: string;
  role_name: string;
  name: string;
  email: string;
  assigned_user_id?: string;
  // Signature coordinates
  x: number;
  y: number;
  width: number;
  height: number;
  page_number: number;
  // Name (Text) field coordinates
  name_x?: number;
  name_y?: number;
  name_width?: number;
  name_height?: number;
  name_page_number?: number;
  name_text?: string;
  // Date field coordinates
  date_x?: number;
  date_y?: number;
  date_width?: number;
  date_height?: number;
  date_page_number?: number;
  signed_at?: string;
}

interface RegisteredUser {
  id: string;
  name: string;
  email: string;
}

export function RAMSLauncher() {
  const [registeredUsers, setRegisteredUsers] = useState<RegisteredUser[]>([]);
  const [signers, setSigners] = useState<SignerField[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  
  const [jobId, setJobId] = useState("");
  const [documentName, setDocumentName] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  
  // PDF Viewer State
  const [numPages, setNumPages] = useState(0);
  const pageRefs = useRef<{ [key: number]: HTMLDivElement | null }>({});

  // Drawing State
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [placementMode, setPlacementMode] = useState<{ signerId: string, type: 'sig' | 'name' | 'date' } | null>(null);
  const [isAddingSigner, setIsAddingSigner] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawingPage, setDrawingPage] = useState<number | null>(null);
  const [startPos, setStartPos] = useState<{ x: number, y: number } | null>(null);
  const [drawingRect, setDrawingRect] = useState<{ x: number, y: number, width: number, height: number } | null>(null);

  useEffect(() => {
    async function fetchData() {
      const { data: usersData } = await supabase.from("registered_users").select("id, name, email");
      if (usersData) setRegisteredUsers(usersData);
    }
    fetchData();
  }, []);

  // Cleanup object URLs to prevent memory leaks
  useEffect(() => {
    if (file) {
      const url = URL.createObjectURL(file);
      setFileUrl(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setFileUrl(null);
    }
  }, [file]);

  const updateSigner = (id: string, updates: Partial<SignerField>) => {
    setSigners(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
  };
  
  const removeSigner = (id: string) => {
    setSigners(prev => prev.filter(s => s.id !== id));
  };

  const activeDrawingRect = useRef<{ x: number, y: number, width: number, height: number } | null>(null);

  // --- Drawing Logic ---
  const handleMouseDown = (e: React.MouseEvent, pageNum: number) => {
    if ((e.target as HTMLElement).closest('.signature-field-box')) return;
    if (!isAddingSigner && !placementMode) return;

    const container = pageRefs.current[pageNum];
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    setIsDrawing(true);
    setDrawingPage(pageNum);
    setStartPos({ x, y });
    setDrawingRect({ x, y, width: 0, height: 0 });
    activeDrawingRect.current = { x, y, width: 0, height: 0 };

    const onWindowMouseMove = (moveEvent: MouseEvent) => {
        const containerRect = container.getBoundingClientRect();
        const currentX = ((moveEvent.clientX - containerRect.left) / containerRect.width) * 100;
        const currentY = ((moveEvent.clientY - containerRect.top) / containerRect.height) * 100;

        const rectX = Math.min(x, currentX);
        const rectY = Math.min(y, currentY);
        const rectWidth = Math.abs(currentX - x);
        const rectHeight = Math.abs(currentY - y);

        const newRect = { x: rectX, y: rectY, width: rectWidth, height: rectHeight };
        setDrawingRect(newRect);
        activeDrawingRect.current = newRect;
    };

    const onWindowMouseUp = (upEvent: MouseEvent) => {
        window.removeEventListener('mousemove', onWindowMouseMove);
        window.removeEventListener('mouseup', onWindowMouseUp);

        const currentRect = activeDrawingRect.current;
        if (currentRect && currentRect.width > 0.5 && currentRect.height > 0.5) {
            setSigners(prevSigners => {
                const activeMode = placementMode;
                const addingSigner = isAddingSigner;
                
                const isCreatingNew = addingSigner || (activeMode && (!activeMode.signerId || activeMode.signerId === 'new-signer-ref'));

                if (isCreatingNew) {
                    const newId = Math.random().toString(36).substr(2, 9);
                    const newSigner: SignerField = {
                        id: newId,
                        x: 0, y: 0, width: 0, height: 0, 
                        page_number: pageNum,
                        role_name: `Signer ${prevSigners.length + 1}`,
                        name: "",
                        email: ""
                    };

                    if (addingSigner || activeMode?.type === 'sig') {
                        newSigner.x = currentRect.x;
                        newSigner.y = currentRect.y;
                        newSigner.width = currentRect.width;
                        newSigner.height = currentRect.height;
                        newSigner.page_number = pageNum;
                    } else if (activeMode?.type === 'name') {
                        newSigner.name_x = currentRect.x;
                        newSigner.name_y = currentRect.y;
                        newSigner.name_width = currentRect.width;
                        newSigner.name_height = currentRect.height;
                        newSigner.name_page_number = pageNum;
                    } else if (activeMode?.type === 'date') {
                        newSigner.date_x = currentRect.x;
                        newSigner.date_y = currentRect.y;
                        newSigner.date_width = currentRect.width;
                        newSigner.date_height = currentRect.height;
                        newSigner.date_page_number = pageNum;
                    }

                    setSelectedFieldId(newId);
                    setIsAddingSigner(false);
                    setPlacementMode(null);
                    return [...prevSigners, newSigner];
                } else if (activeMode) {
                    setSelectedFieldId(activeMode.signerId);
                    setPlacementMode(null);
                    const updates: any = {
                        [`${activeMode.type}_x`]: currentRect.x,
                        [`${activeMode.type}_y`]: currentRect.y,
                        [`${activeMode.type}_width`]: currentRect.width,
                        [`${activeMode.type}_height`]: currentRect.height,
                        [`${activeMode.type}_page_number`]: pageNum
                    };
                    if (activeMode.type === 'sig') {
                        updates.x = currentRect.x;
                        updates.y = currentRect.y;
                        updates.width = currentRect.width;
                        updates.height = currentRect.height;
                        updates.page_number = pageNum;
                    }
                    return prevSigners.map(s => s.id === activeMode.signerId ? { ...s, ...updates } : s);
                }
                return prevSigners;
            });
        }

        setIsDrawing(false);
        setDrawingPage(null);
        setStartPos(null);
        setDrawingRect(null);
        activeDrawingRect.current = null;
    };

    window.addEventListener('mousemove', onWindowMouseMove);
    window.addEventListener('mouseup', onWindowMouseUp);
  };


  const startDragging = (e: React.MouseEvent, fieldId: string, type: 'sig' | 'name' | 'date' = 'sig') => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedFieldId(fieldId);
    
    const field = signers.find(f => f.id === fieldId);
    if (!field) return;

    let initialX = field.x;
    let initialY = field.y;
    let page = field.page_number;

    if (type === 'name') {
        initialX = field.name_x!;
        initialY = field.name_y!;
        page = field.name_page_number!;
    } else if (type === 'date') {
        initialX = field.date_x!;
        initialY = field.date_y!;
        page = field.date_page_number!;
    }

    const mouseStartX = e.clientX;
    const mouseStartY = e.clientY;

    const onMouseMove = (moveEvent: MouseEvent) => {
        const container = pageRefs.current[page];
        if (!container) return;
        const rect = container.getBoundingClientRect();
        
        const deltaX = ((moveEvent.clientX - mouseStartX) / rect.width) * 100;
        const deltaY = ((moveEvent.clientY - mouseStartY) / rect.height) * 100;

        const updates: Partial<SignerField> = {};
        if (type === 'sig') {
            updates.x = Math.max(0, Math.min(100, initialX + deltaX));
            updates.y = Math.max(0, Math.min(100, initialY + deltaY));
        } else if (type === 'name') {
            updates.name_x = Math.max(0, Math.min(100, initialX + deltaX));
            updates.name_y = Math.max(0, Math.min(100, initialY + deltaY));
        } else if (type === 'date') {
            updates.date_x = Math.max(0, Math.min(100, initialX + deltaX));
            updates.date_y = Math.max(0, Math.min(100, initialY + deltaY));
        }
        
        updateSigner(fieldId, updates);
    };

    const onMouseUp = () => {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  const startResizing = (e: React.MouseEvent, fieldId: string, type: 'sig' | 'name' | 'date' = 'sig') => {
    e.preventDefault();
    e.stopPropagation();
    
    const field = signers.find(f => f.id === fieldId);
    if (!field) return;

    const initialMouseX = e.clientX;
    const initialMouseY = e.clientY;
    
    let initialWidth = field.width;
    let initialHeight = field.height;
    let page = field.page_number;

    if (type === 'name') {
        initialWidth = field.name_width!;
        initialHeight = field.name_height!;
        page = field.name_page_number!;
    } else if (type === 'date') {
        initialWidth = field.date_width!;
        initialHeight = field.date_height!;
        page = field.date_page_number!;
    }

    const onMouseMove = (moveEvent: MouseEvent) => {
        const container = pageRefs.current[page];
        if (!container) return;
        const rect = container.getBoundingClientRect();
        
        const deltaX = ((moveEvent.clientX - initialMouseX) / rect.width) * 100;
        const deltaY = ((moveEvent.clientY - initialMouseY) / rect.height) * 100;

        const updates: Partial<SignerField> = {};
        if (type === 'sig') {
            updates.width = Math.max(5, initialWidth + deltaX);
            updates.height = Math.max(5, initialHeight + deltaY);
        } else if (type === 'name') {
            updates.name_width = Math.max(5, initialWidth + deltaX);
            updates.name_height = Math.max(5, initialHeight + deltaY);
        } else if (type === 'date') {
            updates.date_width = Math.max(5, initialWidth + deltaX);
            updates.date_height = Math.max(5, initialHeight + deltaY);
        }
        
        updateSigner(fieldId, updates);
    };

    const onMouseUp = () => {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  const handleSubmit = async () => {
    if (!file || signers.length === 0) return;
    setIsUploading(true);

    try {
      const fileName = `${Date.now()}-${file.name.replace(/\s/g, "_")}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("rams")
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: ramsDoc, error: ramsError } = await supabase
        .from("rams_documents")
        .insert({
          servicem8_job_id: jobId,
          name: documentName || file.name,
          file_path: fileName,
          status: "pending"
        })
        .select()
        .single();

      if (ramsError) throw ramsError;

      const signersWithRams = signers.map(s => ({
        rams_id: ramsDoc.id,
        role_name: s.role_name,
        name: s.name,
        email: s.email,
        assigned_user_id: s.assigned_user_id || null,
        placement_x: s.x,
        placement_y: s.y,
        width: s.width,
        height: s.height,
        page_number: s.page_number,
        name_placement_x: s.name_x || null,
        name_placement_y: s.name_y || null,
        name_width: s.name_width || null,
        name_height: s.name_height || null,
        name_page_number: s.name_page_number || null,
        name_text: s.name_text || null,
        date_placement_x: s.date_x || null,
        date_placement_y: s.date_y || null,
        date_width: s.date_width || null,
        date_height: s.date_height || null,
        date_page_number: s.date_page_number || null
      }));

      const { error: signersError } = await supabase.from("signers").insert(signersWithRams);
      if (signersError) throw signersError;

      fetch('/api/launch-rams', {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ ramsId: ramsDoc.id })
      });

      alert("RAMS Published! Emails are being dispatched.");
      window.location.href = "/rams";
    } catch (error: any) {
      console.error(error);
      alert(error.message || "Error publishing RAMS");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8">
      <div className="flex flex-col lg:flex-row gap-8 min-h-[85vh]">
        <div className="flex-1 space-y-8">
          <div className="space-y-2">
            <h1 className="text-4xl font-black tracking-tight text-slate-900 uppercase">Launch New RAMS</h1>
            <p className="text-slate-500 font-medium">Coordinate your team signatures on safety documents.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm ring-1 ring-slate-900/5">
             <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">Job Reference</label>
                <input 
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3.5 text-sm font-bold outline-none focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-slate-300"
                  placeholder="e.g. JB-9092"
                  value={jobId}
                  onChange={e => setJobId(e.target.value)}
                />
             </div>
             <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">Document Title</label>
                <input 
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3.5 text-sm font-bold outline-none focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-slate-300"
                  placeholder="e.g. Electrical Safety RAMS"
                  value={documentName}
                  onChange={e => setDocumentName(e.target.value)}
                />
             </div>
          </div>

          {!file ? (
            <label className="group relative flex flex-col items-center justify-center w-full h-80 border-4 border-dashed border-slate-200 rounded-[40px] bg-slate-50/50 hover:bg-white hover:border-primary/40 transition-all cursor-pointer overflow-hidden">
               <div className="space-y-4 text-center z-10">
                  <div className="mx-auto w-16 h-16 bg-white rounded-2xl shadow-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-500">
                    <FileUp className="w-8 h-8 text-primary" />
                  </div>
                  <div className="space-y-1">
                    <p className="font-bold text-slate-900">Drop the finalized RAMS PDF here</p>
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Supports PDF up to 20MB</p>
                  </div>
               </div>
               <input type="file" className="hidden" accept=".pdf" onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) setFile(f);
               }} />
            </label>
          ) : (
            <div className="space-y-4">
               <div className="flex items-center justify-between bg-white/50 p-4 rounded-2xl border border-slate-200 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                      <FileUp className="w-5 h-5 text-emerald-600" />
                    </div>
                    <div>
                      <h2 className="font-bold text-slate-900">{file.name}</h2>
                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Ready for Digitization</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setFile(null)}
                    className="p-2 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-xl transition-all"
                  >
                    <X className="w-5 h-5" />
                  </button>
               </div>

               {fileUrl && (
                  <div className="animate-in fade-in flex flex-col items-center pt-4">
                        <div className="w-full flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-5 bg-white/80 backdrop-blur-xl rounded-t-3xl border border-slate-200/60 shadow-lg sticky top-0 z-30 ring-1 ring-slate-900/5">
                          <div className="flex flex-wrap items-center gap-3 min-w-0">
                            <div className="flex items-center gap-2 p-1 bg-slate-100/50 rounded-2xl border border-slate-200/50">
                              <button 
                                onClick={() => {
                                  // Always add a new signer when clicking this button
                                  setIsAddingSigner(!isAddingSigner);
                                  setPlacementMode(null);
                                  if (!isAddingSigner) {
                                    setSelectedFieldId(null); // Clear selection when starting to add a new signer
                                  }
                                }}
                                className={cn(
                                  "flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all shadow-sm border uppercase tracking-widest",
                                  isAddingSigner 
                                    ? "bg-emerald-600 text-white border-emerald-700 ring-4 ring-emerald-500/20 scale-95"
                                    : "bg-white border-emerald-100 hover:bg-emerald-50 text-emerald-700 hover:scale-[1.02]"
                                )}
                              >
                                {isAddingSigner ? <X className="w-4 h-4" /> : <PenTool className="w-4 h-4" />}
                                1. Sign area
                              </button>
                            </div>

                          </div>

                          <div className="flex items-center gap-4 bg-slate-50 px-4 py-2 rounded-2xl border border-slate-200 shadow-inner">
                             <div className="flex flex-col items-end">
                                <span className="text-sm font-black text-slate-900 tracking-tighter leading-none">{numPages}</span>
                                <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Pages</span>
                             </div>
                             <div className="h-6 w-px bg-slate-200"></div>
                             <div className="p-2 bg-white rounded-xl shadow-sm border border-slate-100">
                                <FileUp className="w-4 h-4 text-primary" />
                             </div>
                          </div>
                        </div>

                        <div className="bg-slate-100 w-full flex flex-col items-center py-8 rounded-b-2xl border border-border/50 border-t-0 shadow-inner max-h-[800px] overflow-y-auto custom-scrollbar">
                            <Document file={fileUrl} onLoadSuccess={({ numPages }) => setNumPages(numPages)} className="flex flex-col gap-12 items-center w-full">
                              {Array.from(new Array(numPages), (el, index) => {
                                const pageNum = index + 1;
                                return (
                                  <div 
                                    key={`page_${pageNum}`}
                                    ref={(el) => { pageRefs.current[pageNum] = el; }}
                                    id={`page-${pageNum}`}
                                    className={cn(
                                      "relative transition-cursor shadow-2xl ring-1 ring-slate-900/5 bg-white mx-auto",
                                      (placementMode || isAddingSigner) ? "cursor-crosshair" : "cursor-default"
                                    )}
                                    style={{ width: '800px' }}
                                    onMouseDown={(e) => handleMouseDown(e, pageNum)}
                                  >
                                    <Page 
                                      pageNumber={pageNum} 
                                      width={800} 
                                      renderTextLayer={false} 
                                      renderAnnotationLayer={false}
                                      loading={<div className="h-[800px] w-[800px] flex items-center justify-center bg-slate-900/5"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>}
                                    />
                                    
                                    {isDrawing && drawingPage === pageNum && drawingRect && (
                                      <div 
                                        className={cn(
                                          "absolute border-2 z-50 pointer-events-none shadow-2xl",
                                          "border-emerald-500 bg-emerald-500/20"
                                        )}
                                        style={{
                                          left: `${drawingRect.x}%`,
                                          top: `${drawingRect.y}%`,
                                          width: `${drawingRect.width}%`,
                                          height: `${drawingRect.height}%`,
                                        }}
                                      />
                                    )}

                                    {/* Signatures */}
                                    {signers.filter(s => s.page_number === pageNum && s.width > 0.1).map((signer, i) => (
                                      <div
                                          key={`${signer.id}-sig`}
                                          className={cn(
                                            "absolute border-2 signature-field-box group/field flex items-center justify-center cursor-move rounded shadow-sm backdrop-blur-sm transition-all",
                                            selectedFieldId === signer.id && !placementMode
                                                ? "border-emerald-500 bg-emerald-500/20 ring-4 ring-emerald-500/10 shadow-lg z-20" 
                                                : "border-emerald-500/50 bg-emerald-500/10 hover:border-emerald-500 hover:bg-emerald-500/20 z-10"
                                          )}
                                          style={{
                                            left: `${signer.x}%`,
                                            top: `${signer.y}%`,
                                            width: `${signer.width}%`,
                                            height: `${signer.height}%`,
                                          }}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setSelectedFieldId(signer.id);
                                          }}
                                          onMouseDown={(e) => startDragging(e, signer.id, 'sig')}
                                      >
                                          <div className="flex flex-col items-center pointer-events-none text-center">
                                            <span className="text-[7px] text-emerald-700/60 font-black uppercase tracking-tighter">SIG AREA</span>
                                            <div className={cn(
                                                "mt-0.5 px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest",
                                                selectedFieldId === signer.id ? "bg-emerald-600 text-white shadow-sm" : "bg-emerald-500/10 text-emerald-700"
                                            )}>
                                                {signer.role_name}
                                            </div>
                                          </div>

                                          <div 
                                            onMouseDown={(e) => startResizing(e, signer.id, 'sig')}
                                            className={cn(
                                            "absolute -bottom-1 -right-1 w-5 h-5 cursor-nwse-resize flex items-end justify-end transition-opacity opacity-0 group-hover/field:opacity-100",
                                            selectedFieldId === signer.id && "opacity-100"
                                            )}
                                          >
                                            <div className="w-2.5 h-2.5 border-r-2 border-b-2 border-emerald-600 rounded-br-sm" />
                                          </div>
                                      </div>
                                    ))}

                                  </div>
                                );
                              })}
                            </Document>
                        </div>
                    </div>
               )}
            </div>
          )}
        </div>

        <div className="w-full lg:w-96 space-y-6">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm sticky top-8 ring-1 ring-slate-900/5">
            <h3 className="font-black text-xl mb-6 tracking-tight text-slate-900 flex items-center gap-2 uppercase">
               <Users className="w-5 h-5 text-primary" />
               Team Members
            </h3>
            
            <div className="space-y-4 mb-8 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
              {signers.length === 0 ? (
                 <div className="py-12 px-4 bg-slate-50 border border-slate-100 rounded-[32px] text-center shadow-inner">
                    <p className="font-bold text-slate-400 text-sm">No signers defined.</p>
                    <p className="text-[10px] text-slate-400 mt-2 uppercase font-black tracking-widest">Draw on PDF to start</p>
                 </div>
              ) : (
                 signers.map((signer, index) => (
                    <div key={signer.id} 
                         className={cn(
                            "p-4 bg-slate-50 border rounded-2xl transition-all",
                            selectedFieldId === signer.id ? "border-emerald-500 bg-white shadow-lg ring-1 ring-emerald-500" : "border-slate-100"
                         )}
                         onClick={() => setSelectedFieldId(signer.id)}
                         style={{ cursor: 'pointer' }}
                    >
                       <div className="flex justify-between items-center mb-3">
                          <span className="text-[9px] uppercase font-black tracking-widest bg-emerald-500 text-white px-2.5 py-1 rounded-lg shadow-sm">
                             Signer {index + 1}
                          </span>
                          <button 
                            onClick={(e) => { e.stopPropagation(); removeSigner(signer.id); }}
                            className="p-1.5 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-lg transition-colors border border-transparent hover:border-red-100"
                          >
                             <Trash2 className="w-4 h-4" />
                          </button>
                       </div>

                       <div className="space-y-3">
                          <div>
                             <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 block pl-1">Assign User</label>
                             <select 
                                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold outline-none cursor-pointer hover:border-emerald-500 transition-colors"
                                value={signer.assigned_user_id || ""}
                                onChange={(e) => {
                                   const u = registeredUsers.find(ru => ru.id === e.target.value);
                                   if (u) {
                                      updateSigner(signer.id, { name: u.name, email: u.email, assigned_user_id: u.id });
                                   } else {
                                      updateSigner(signer.id, { assigned_user_id: "" });
                                   }
                                }}
                             >
                                <option value="">Manual Entry</option>
                                {registeredUsers.map(u => (
                                   <option key={u.id} value={u.id}>{u.name}</option>
                                ))}
                             </select>
                          </div>

                          {!signer.assigned_user_id && (
                             <div className="grid grid-cols-1 gap-2">
                                <input 
                                   className="w-full rounded-xl px-3 py-2.5 text-xs border border-slate-200 focus:border-emerald-500 outline-none font-medium bg-white"
                                   placeholder="Full Name"
                                   value={signer.name}
                                   onChange={e => updateSigner(signer.id, { name: e.target.value })}
                                />
                                <input 
                                   className="w-full rounded-xl px-3 py-2.5 text-xs border border-slate-200 focus:border-emerald-500 outline-none font-medium bg-white"
                                   placeholder="Email Address"
                                   type="email"
                                   value={signer.email}
                                   onChange={e => updateSigner(signer.id, { email: e.target.value })}
                                />
                             </div>
                          )}
                          
                          {signer.assigned_user_id && (
                             <div className="flex items-center gap-2 p-2 bg-emerald-50 rounded-xl border border-emerald-100">
                                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                                <span className="text-[10px] font-black text-emerald-800 uppercase tracking-widest">Verified Profile Attached</span>
                             </div>
                          )}
                       </div>
                    </div>
                 ))
              )}
            </div>

            <button 
              disabled={isUploading || !file || signers.length === 0}
              onClick={handleSubmit}
              className={cn(
                "w-full flex items-center justify-center gap-3 px-6 py-4 rounded-2xl font-black transition-all active:scale-95 disabled:opacity-50 uppercase tracking-widest text-xs",
                (!file || signers.length === 0)
                  ? "bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200"
                  : "bg-emerald-600 text-white shadow-xl shadow-emerald-500/20 hover:bg-emerald-700 hover:scale-[1.02]"
              )}
            >
              {isUploading ? (
                <> <Loader2 className="w-5 h-5 animate-spin" /> Publishing...</>
              ) : (
                <> <Save className="w-5 h-5" /> Launch {signers.length} Requests</>
              )}
            </button>
            
            <p className="text-[9px] text-center text-slate-400 font-black uppercase tracking-[0.3em] mt-6">
               Instant Email Dispatch
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
