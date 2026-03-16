"use client";

import { useState, useRef, useEffect } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { Plus, Trash2, Save, FileUp, Loader2, X, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";

// Set up worker for react-pdf
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface SignatureField {
  id: string;
  role_name: string;
  default_email?: string;
  x: number;
  y: number;
  page_number: number;
  width: number;
  height: number;
  is_grid_cell: boolean;
}

export function TemplateCreator({ templateId }: { templateId?: string }) {
  const [file, setFile] = useState<File | string | null>(null);
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [fields, setFields] = useState<SignatureField[]>([]);
  const [templateName, setTemplateName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [isAddMode, setIsAddMode] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState<{ x: number, y: number } | null>(null);
  const [drawingRect, setDrawingRect] = useState<{ x: number, y: number, width: number, height: number } | null>(null);
  
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (templateId) {
      async function loadTemplate() {
        const { data: template } = await supabase
          .from("rams_templates")
          .select("*")
          .eq("id", templateId)
          .single();
        
        if (template) {
          setTemplateName(template.name);
          if (template.preview_url) {
            // Store the existing path in the file state
            setFile(template.preview_url);
          }
        }

        const { data: fieldsData } = await supabase
          .from("template_signature_fields")
          .select("*")
          .eq("template_id", templateId);
        
        if (fieldsData) {
          setFields(fieldsData.map((f, index) => ({
            id: f.id,
            role_name: f.role_name || `Signer ${index + 1}`,
            default_email: f.default_email,
            x: f.placement_x,
            y: f.placement_y,
            page_number: f.page_number,
            width: f.width,
            height: f.height,
            is_grid_cell: f.is_grid_cell
          })));
        }
      }
      loadTemplate();
    }
  }, [templateId]);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    // 1. If we click a field, don't start drawing
    if ((e.target as HTMLElement).closest('.signature-field-box')) return;
    
    if (!isAddMode) {
      setSelectedFieldId(null);
      return;
    }

    if (!containerRef.current) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    setIsDrawing(true);
    setStartPos({ x, y });
    setDrawingRect({ x, y, width: 0, height: 0 });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDrawing || !startPos || !containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const currentX = ((e.clientX - rect.left) / rect.width) * 100;
    const currentY = ((e.clientY - rect.top) / rect.height) * 100;

    const x = Math.min(startPos.x, currentX);
    const y = Math.min(startPos.y, currentY);
    const width = Math.abs(currentX - startPos.x);
    const height = Math.abs(currentY - startPos.y);

    setDrawingRect({ x, y, width, height });
  };

  const handleMouseUp = () => {
    if (!isDrawing || !drawingRect) return;

    // Only add if it has some minimum size
    if (drawingRect.width > 0.5 && drawingRect.height > 0.5) {
      const newField: SignatureField = {
        id: Math.random().toString(36).substr(2, 9),
        role_name: `Signer ${fields.length + 1}`,
        x: drawingRect.x + (drawingRect.width / 2),
        y: drawingRect.y + (drawingRect.height / 2),
        page_number: currentPage,
        width: drawingRect.width,
        height: drawingRect.height,
        is_grid_cell: false,
      };

      setFields([...fields, newField]);
      setSelectedFieldId(newField.id);
      setIsAddMode(false);
    }

    setIsDrawing(false);
    setStartPos(null);
    setDrawingRect(null);
  };

  const updateField = (id: string, updates: Partial<SignatureField>) => {
    setFields(fields.map(f => f.id === id ? { ...f, ...updates } : f));
  };

  const startResizing = (e: React.MouseEvent, fieldId: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    const initialX = e.clientX;
    const initialY = e.clientY;
    const field = fields.find(f => f.id === fieldId);
    if (!field || !containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const initialWidth = (field.width / 100) * rect.width;
    const initialHeight = (field.height / 100) * rect.height;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - initialX;
      const deltaY = moveEvent.clientY - initialY;
      
      const newWidthPx = Math.max(20, initialWidth + deltaX);
      const newHeightPx = Math.max(10, initialHeight + deltaY);

      updateField(fieldId, {
        width: (newWidthPx / rect.width) * 100,
        height: (newHeightPx / rect.height) * 100
      });
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const startDragging = (e: React.MouseEvent, fieldId: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    const initialX = e.clientX;
    const initialY = e.clientY;
    const field = fields.find(f => f.id === fieldId);
    if (!field || !containerRef.current) return;

    const initialFieldX = field.x;
    const initialFieldY = field.y;
    const rect = containerRef.current.getBoundingClientRect();

    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = ((moveEvent.clientX - initialX) / rect.width) * 100;
      const deltaY = ((moveEvent.clientY - initialY) / rect.height) * 100;
      
      updateField(fieldId, {
        x: Math.min(Math.max(0, initialFieldX + deltaX), 100),
        y: Math.min(Math.max(0, initialFieldY + deltaY), 100)
      });
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const removeField = (id: string) => {
    setFields(fields.filter(f => f.id !== id));
  };

  const toggleGridCell = (id: string) => {
    setFields(fields.map(f => f.id === id ? { ...f, is_grid_cell: !f.is_grid_cell } : f));
  };

  const saveTemplate = async () => {
    if (!templateName || !file) {
      alert("Please provide a template name and upload a PDF.");
      return;
    }

    setIsSaving(true);
    console.log("Starting template save process...", { templateName, fieldCount: fields.length });
    
    try {
      let finalPath = "";
      let currentTemplateId = templateId;

      // 1. Upload sample PDF only if it's a new File object
      if (file && typeof file !== 'string') {
        console.log("Uploading PDF to storage...");
        const fileExt = (file as File).name.split('.').pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('templates')
          .upload(fileName, file as File);

        if (uploadError) {
          console.error("Storage upload failed:", uploadError);
          throw new Error(`PDF Upload Failed: ${uploadError.message}`);
        }
        finalPath = uploadData.path;
        console.log("PDF uploaded successfully:", finalPath);
      } else if (typeof file === 'string') {
        // Use the existing path
        finalPath = file;
        console.log("Using existing PDF path:", finalPath);
      }

      // 2. Insert/Update Template
      if (currentTemplateId) {
        console.log("Updating existing template:", currentTemplateId);
        const updates: any = { name: templateName, updated_at: new Date().toISOString() };
        if (finalPath) updates.preview_url = finalPath;
        
        const { error } = await supabase
          .from('rams_templates')
          .update(updates)
          .eq('id', currentTemplateId);
        
        if (error) {
          console.error("Template update failed:", error);
          throw new Error(`Template Update Failed: ${error.message}`);
        }
      } else {
        console.log("Creating new template...");
        const { data: templateData, error: templateError } = await supabase
          .from('rams_templates')
          .insert([{ name: templateName, preview_url: finalPath }])
          .select()
          .single();

        if (templateError) {
          console.error("Template creation failed:", templateError);
          throw new Error(`Template Creation Failed: ${templateError.message}`);
        }
        currentTemplateId = templateData.id;
        console.log("Template created successfully ID:", currentTemplateId);
      }

      // 3. Sync Fields
      console.log("Syncing signature fields...");
      const { error: deleteError } = await supabase
        .from('template_signature_fields')
        .delete()
        .eq('template_id', currentTemplateId);
      
      if (deleteError) {
        console.error("Old fields deletion failed:", deleteError);
        throw new Error(`Fields Sync (Delete) Failed: ${deleteError.message}`);
      }

      const fieldData = fields.map(f => ({
        template_id: currentTemplateId,
        role_name: f.role_name,
        default_email: f.default_email,
        page_number: f.page_number,
        placement_x: f.x,
        placement_y: f.y,
        width: f.width,
        height: f.height,
        is_grid_cell: f.is_grid_cell
      }));

      const { error: fieldsError } = await supabase
        .from('template_signature_fields')
        .insert(fieldData);

      if (fieldsError) {
        console.error("Fields insertion failed:", fieldsError);
        throw new Error(`Fields Sync (Insert) Failed: ${fieldsError.message}`);
      }

      console.log("Template saved successfully!");
      alert(templateId ? "Template updated successfully!" : "Template saved successfully!");
      window.location.href = "/templates";
    } catch (error: any) {
      console.error(error);
      alert(`Error saving template: ${error.message || "Unknown error"}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
      <div className="lg:col-span-3 space-y-6">
        <div className="bg-card border border-border/50 rounded-2xl p-6 shadow-sm">
          {!file ? (
            <label className="flex flex-col items-center justify-center h-96 border-2 border-dashed border-border rounded-xl cursor-pointer hover:bg-secondary/50 transition-colors">
              <FileUp className="w-12 h-12 text-muted-foreground mb-4" />
              <p className="font-semibold">Click to upload sample RAMS PDF</p>
              <p className="text-sm text-muted-foreground">PDF files only (max 10MB)</p>
              <input type="file" className="hidden" accept=".pdf" onChange={onFileChange} />
            </label>
          ) : (
            <div className="relative">
              <div 
                ref={containerRef}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                className={cn(
                  "relative border border-border rounded-lg overflow-hidden bg-white select-none",
                  isAddMode ? "cursor-crosshair" : "cursor-default"
                )}
              >
                <Document 
                  file={typeof file === 'string' 
                    ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/templates/${file}` 
                    : file
                  } 
                  onLoadSuccess={onDocumentLoadSuccess}
                >
                  <Page 
                    pageNumber={currentPage} 
                    renderTextLayer={false}
                    renderAnnotationLayer={false}
                    width={containerRef.current?.offsetWidth || 800}
                    loading={
                      <div className="flex h-[800px] items-center justify-center bg-secondary/20">
                        <Loader2 className="w-8 h-8 animate-spin text-primary" />
                      </div>
                    }
                  />
                </Document>

                {/* Ghost drawing rectangle */}
                {isDrawing && drawingRect && (
                  <div 
                    className="absolute border-2 border-dashed border-primary bg-primary/10 rounded-lg pointer-events-none z-50"
                    style={{
                      left: `${drawingRect.x}%`,
                      top: `${drawingRect.y}%`,
                      width: `${drawingRect.width}%`,
                      height: `${drawingRect.height}%`,
                    }}
                  />
                )}
                {fields.filter(f => f.page_number === currentPage).map((field) => (
                  <div
                    key={field.id}
                    className={cn(
                      "absolute border-2 signature-field-box group/field flex items-center justify-center cursor-move rounded-lg shadow-sm backdrop-blur-[2px] transition-all",
                      selectedFieldId === field.id 
                        ? "border-primary bg-primary/20 ring-4 ring-primary/10 shadow-lg z-20" 
                        : "border-primary/40 bg-primary/5 hover:border-primary/60 z-10"
                    )}
                    style={{
                      left: `${field.x}%`,
                      top: `${field.y}%`,
                      width: `${field.width}%`,
                      height: `${field.height}%`,
                      transform: 'translate(-50%, -50%)'
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedFieldId(field.id);
                    }}
                    onMouseDown={(e) => startDragging(e, field.id)}
                  >
                    <span className={cn(
                      "text-[10px] uppercase truncate px-2 select-none font-black",
                      selectedFieldId === field.id ? "text-primary scale-110" : "text-primary/70"
                    )}>
                      {field.role_name}
                    </span>
                    
                    {/* Delete Shortcut */}
                    {selectedFieldId === field.id && (
                      <button 
                        onClick={(e) => { e.stopPropagation(); removeField(field.id); }}
                        className="absolute -top-2 -right-2 w-5 h-5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center shadow-lg hover:bg-red-600 transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}

                    {/* Resize Handle */}
                    <div 
                      onMouseDown={(e) => startResizing(e, field.id)}
                      className={cn(
                        "absolute bottom-0 right-0 w-6 h-6 cursor-nwse-resize flex items-end justify-end p-1 transition-opacity",
                        selectedFieldId === field.id ? "opacity-100" : "opacity-0 group-hover/field:opacity-50"
                      )}
                    >
                      <div className="w-2.5 h-2.5 border-r-2 border-b-2 border-primary rounded-br-sm" />
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex flex-col md:flex-row justify-between items-start md:items-center mt-4 gap-4 p-4 bg-secondary/20 rounded-xl border border-border/50">
                <div className="flex items-center gap-4">
                  <button 
                    onClick={() => setIsAddMode(!isAddMode)}
                    className={cn(
                      "flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold transition-all active:scale-95",
                      isAddMode 
                        ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20 ring-4 ring-primary/10" 
                        : "bg-secondary text-muted-foreground hover:bg-secondary/80"
                    )}
                  >
                    <Plus className={cn("w-5 h-5", isAddMode && "animate-spin")} />
                    {isAddMode ? "CLICK ON PDF TO PLACE" : "ADD NEW FIELD"}
                  </button>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest hidden md:block">
                    {isAddMode ? "Click anywhere on the document to drop a signature box" : "Select a box to move or resize it"}
                  </p>
                </div>

                <div className="flex items-center gap-4 text-sm font-bold text-muted-foreground uppercase">
                  <span>Page {currentPage} of {numPages}</span>
                  <div className="flex gap-1">
                    <button 
                      disabled={currentPage <= 1}
                      onClick={() => setCurrentPage(currentPage - 1)}
                      className="p-2 bg-secondary rounded-lg disabled:opacity-50 hover:text-primary transition-colors"
                    >
                      Prev
                    </button>
                    <button 
                      disabled={currentPage >= numPages}
                      onClick={() => setCurrentPage(currentPage + 1)}
                      className="p-2 bg-secondary rounded-lg disabled:opacity-50 hover:text-primary transition-colors"
                    >
                      Next
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-6">
        <div className="bg-card border border-border/50 rounded-2xl p-6 shadow-sm sticky top-8">
          <div className="space-y-4 mb-8">
            <h3 className="font-bold text-lg">Template Details</h3>
            <input 
              placeholder="Template Name (e.g. Electrical RAMS)"
              className="w-full bg-secondary border border-border/50 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/20 outline-none"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
            />
          </div>

          <div className="space-y-4">
            <h3 className="font-bold text-lg flex justify-between">
              Signature Fields
              <span className="text-sm font-normal text-muted-foreground">{fields.length} added</span>
            </h3>
            
            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
              {fields.map((field, index) => (
                <div key={field.id} className="p-3 bg-secondary/50 rounded-xl border border-border/50 space-y-3">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[10px] uppercase font-black text-primary bg-primary/10 px-2 py-0.5 rounded-md">
                      Signer {index + 1}
                    </span>
                    <button onClick={() => removeField(field.id)} className="text-muted-foreground hover:text-destructive transition-colors p-1">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="space-y-1.5">
                    <p className="text-[9px] font-bold text-muted-foreground uppercase px-1">Signer Role</p>
                    <input 
                      placeholder="e.g. Site Manager"
                      className="w-full bg-card border border-border/30 rounded-lg px-3 py-2 text-xs font-bold outline-none focus:border-primary/50 transition-colors"
                      value={field.role_name}
                      onChange={(e) => updateField(field.id, { role_name: e.target.value })}
                    />
                  </div>

                  <div className="flex items-center gap-2 bg-card p-2 rounded-lg border border-border/30">
                    <input 
                      type="checkbox" 
                      id={`grid-${field.id}`}
                      checked={field.is_grid_cell}
                      onChange={() => toggleGridCell(field.id)}
                      className="rounded border-border text-primary cursor-pointer"
                    />
                    <label htmlFor={`grid-${field.id}`} className="text-[10px] font-bold text-muted-foreground uppercase cursor-pointer select-none">
                      Grid (Name/Date)
                    </label>
                  </div>

                  <div className="flex items-center gap-4 text-[10px] text-muted-foreground uppercase tracking-widest font-bold">
                    <div className="flex-1 space-y-1">
                      <span>Width</span>
                      <input 
                        type="range" min="2" max="50" step="0.5"
                        value={field.width}
                        onChange={(e) => updateField(field.id, { width: parseFloat(e.target.value) })}
                        className="w-full h-1 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary"
                      />
                    </div>
                    <div className="flex-1 space-y-1">
                      <span>Height</span>
                      <input 
                        type="range" min="1" max="20" step="0.5"
                        value={field.height}
                        onChange={(e) => updateField(field.id, { height: parseFloat(e.target.value) })}
                        className="w-full h-1 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary"
                      />
                    </div>
                  </div>

                  <div className="flex justify-between text-[10px] text-muted-foreground uppercase tracking-widest font-bold">
                    <span>Page {field.page_number}</span>
                    <span>X: {Math.round(field.x)}% Y: {Math.round(field.y)}%</span>
                  </div>
                </div>
              ))}
              {fields.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8 italic">
                  Click on the PDF to add a signature field.
                </p>
              )}
            </div>
          </div>

          <button 
            disabled={isSaving || !file || fields.length === 0 || !templateName}
            onClick={saveTemplate}
            className="w-full mt-8 flex items-center justify-center gap-2 px-6 py-4 rounded-xl premium-gradient text-primary-foreground font-bold shadow-lg shadow-primary/20 hover:scale-[1.02] transition-all active:scale-95 disabled:opacity-50 disabled:hover:scale-100"
          >
            {isSaving ? "Saving..." : <><Save className="w-5 h-5" /> Save Template</>}
          </button>
        </div>
      </div>
    </div>
  );
}
