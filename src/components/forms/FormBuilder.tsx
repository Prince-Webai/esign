"use client";

import { useState, useEffect } from "react";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Plus, GripVertical, Trash2, Save, X, Type, AlignLeft, CircleDot, Image as ImageIcon, ChevronDown, Calendar, Webhook, Loader2, ArrowLeft, Settings2, Eye, Link as LinkIcon, CheckCircle2, ExternalLink, Heading2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { useRouter } from "next/navigation";

type FieldType = 'input' | 'textarea' | 'select' | 'radio' | 'image' | 'date' | 'header';

interface FormField {
  id: string; type: FieldType; label: string; placeholder?: string; required: boolean; options?: string[]; order_index: number;
}
interface FormConfig {
  name: string; webhook_url: string; description: string;
}

function SidebarItem({ type, label, icon: Icon }: { type: FieldType, label: string, icon: any }) {
  return (
    <div className="flex items-center gap-3 p-3 bg-white border border-slate-200/60 rounded-xl cursor-pointer hover:border-emerald-500/30 hover:bg-emerald-50 hover:shadow-sm transition-all group shadow-sm">
      <div className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-200/60 flex items-center justify-center text-slate-400 group-hover:text-emerald-600 group-hover:bg-white transition-colors shadow-sm"><Icon className="w-4 h-4" /></div>
      <span className="font-medium text-sm text-slate-700 group-hover:text-emerald-700 transition-colors">{label}</span>
    </div>
  );
}

function SortableField({ field, onDelete, onUpdate, onSelect, onSelectNull, isSelected }: { field: FormField, onDelete: () => void, onUpdate: (updates: Partial<FormField>) => void, onSelect: () => void, onSelectNull: () => void, isSelected: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: field.id });
  const style = { transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 50 : 'auto', opacity: isDragging ? 0.3 : 1 };

  return (
    <div ref={setNodeRef} style={style} className={cn("relative group border-2 p-5 transition-all duration-300 shadow-sm", isSelected ? "border-emerald-500 ring-4 ring-emerald-500/5 shadow-lg bg-white rounded-2xl z-10" : "border-slate-200/60 hover:border-emerald-300 hover:shadow-md cursor-pointer rounded-2xl bg-white")} onClick={!isSelected ? (e) => { e.stopPropagation(); onSelect(); } : undefined}>
      <div className="flex items-start gap-3">
        {/* Isolated Drag Handle */}
        <button {...attributes} {...listeners} className="p-2 cursor-grab flex active:cursor-grabbing text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all mt-1"><GripVertical className="w-4 h-4" /></button>
        <div className="flex-1 space-y-3 w-full">
          {/* ALWAYS VISIBLE WYSIWYG PREVIEW */}
          <div className="pointer-events-none w-full">
             <div className="space-y-1 w-full mb-3">
               {isSelected && <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded-md mb-2 inline-block">Editing {field.type}</span>}
               {field.type !== 'header' && <h4 className="text-base font-semibold text-slate-900 leading-tight">{field.label || "Untitled Field"}{field.required && <span className="text-red-500 ml-1.5">*</span>}</h4>}
             </div>
             {field.type === 'input' && <div className="w-full bg-white shadow-sm border border-slate-200/60 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-500">{field.placeholder || "Text input placeholder"}</div>}
             {field.type === 'textarea' && <div className="w-full bg-white shadow-sm border border-slate-200/60 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-500 h-24">{field.placeholder || "Long text placeholder"}</div>}
             {field.type === 'select' && <div className="w-full bg-white shadow-sm border border-slate-200/60 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-500 flex justify-between items-center"><span>{field.placeholder || "Select option"}</span><ChevronDown className="w-4 h-4 text-slate-400" /></div>}
             {field.type === 'radio' && <div className="space-y-2">{field.options?.map((opt, i) => <div key={i} className="flex items-center gap-3 bg-white border border-slate-200/60 p-3 rounded-xl shadow-sm"><div className="w-4 h-4 rounded-full border-2 border-slate-300 bg-slate-50" /><span className="text-sm text-slate-700 font-medium">{opt}</span></div>)}</div>}
             {field.type === 'image' && <div className="border-2 border-dashed border-slate-200/60 bg-slate-50 rounded-xl h-24 flex flex-col items-center justify-center text-slate-400"><ImageIcon className="w-6 h-6 mb-2 text-slate-300" /><span className="text-[11px] font-semibold uppercase tracking-wider">Image Upload Dropzone</span></div>}
             {field.type === 'date' && <div className="w-full bg-white shadow-sm border border-slate-200/60 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-500 flex justify-between items-center"><span>Select date</span><Calendar className="w-4 h-4 text-slate-400" /></div>}
             {field.type === 'header' && (
               <div className="py-4 border-b-2 border-slate-900 mb-2 mt-4">
                 <h3 className="text-2xl font-bold text-slate-900 tracking-tight">{field.label || "Section Header"}</h3>
               </div>
             )}
          </div>

          {/* CONFIGURATION DRAWER */}
          {isSelected && (
            <div className="mt-6 pt-5 border-t border-slate-100 animate-in fade-in slide-in-from-top-2 duration-300" onClick={(e) => e.stopPropagation()}>
               <div className="flex justify-between items-center mb-5">
                 <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-100 px-3 py-1 rounded-lg">Field Configuration</span>
                 <div className="flex items-center gap-2">
                   <button onClick={(e) => { e.stopPropagation(); onSelectNull(); }} className="px-3 py-1.5 text-xs font-medium text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-all shadow-sm">Done</button>
                   <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="p-1.5 text-slate-400 hover:text-red-600 bg-white border border-slate-200/60 hover:border-red-200 hover:bg-red-50 rounded-lg transition-all shadow-sm" title="Delete Field"><Trash2 className="w-4 h-4" /></button>
                 </div>
               </div>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-5 w-full">
                  <div className="space-y-1.5"><label className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider pl-1">Label Text</label><input value={field.label} onChange={e => onUpdate({label: e.target.value})} className="w-full bg-white border border-slate-200/60 rounded-xl px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none text-slate-900 transition-all shadow-sm" placeholder="e.g. Your Full Name" /></div>
                  {(field.type === 'input' || field.type === 'textarea' || field.type === 'select') && (<div className="space-y-1.5"><label className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider pl-1">Placeholder Hint</label><input value={field.placeholder || ""} onChange={e => onUpdate({placeholder: e.target.value})} className="w-full bg-white border border-slate-200/60 rounded-xl px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none text-slate-900 transition-all shadow-sm placeholder:text-slate-400" placeholder="e.g. John Doe" /></div>)}
               </div>
               <div className="mt-5 flex items-center justify-between p-4 bg-slate-50/50 border border-slate-200/60 rounded-xl shadow-sm">
                  <div className="space-y-0.5"><p className="text-sm font-semibold text-slate-900">Required Property</p><p className="text-xs text-slate-500">Mark as mandatory for users</p></div>
                  <button onClick={() => onUpdate({required: !field.required})} className={cn("w-12 h-6 flex items-center rounded-full transition-all duration-300", field.required ? "bg-emerald-500" : "bg-slate-300")}><div className={cn("w-4 h-4 rounded-full bg-white shadow-sm transition-transform mx-1", field.required ? "translate-x-6" : "")} /></button>
               </div>
               {(field.type === 'select' || field.type === 'radio') && (
                  <div className="space-y-4 pt-5 mt-5 border-t border-slate-100">
                     <label className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider pl-1">Radio / Select Options</label>
                     <div className="space-y-2.5">
                        {field.options?.map((opt, idx) => (<div key={idx} className="flex gap-3 items-center group/opt"><div className="w-5 flex justify-center text-slate-300"><CircleDot className="w-4 h-4" /></div><input value={opt} onChange={e => { const next = [...(field.options || [])]; next[idx] = e.target.value; onUpdate({options: next}); }} className="flex-1 bg-white border border-slate-200/60 rounded-xl px-3 py-2 text-sm font-medium text-slate-900 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all shadow-sm" placeholder="Option value" /><button onClick={() => { const next = field.options?.filter((_, i) => i !== idx); onUpdate({options: next}); }} className="p-2 text-slate-400 hover:text-red-500 bg-white border border-slate-200/60 hover:border-red-200 hover:bg-red-50 rounded-lg transition-all shadow-sm"><X className="w-3.5 h-3.5" /></button></div>))}
                        <button onClick={() => onUpdate({options: [...(field.options || []), `Option ${(field.options?.length || 0) + 1}`]})} className="w-full py-2.5 bg-white border border-dashed border-slate-300 rounded-xl text-xs font-medium text-slate-500 hover:text-emerald-700 hover:border-emerald-300 hover:bg-emerald-50 shadow-sm transition-all flex items-center justify-center gap-2 mt-3"><Plus className="w-4 h-4" /> Add Another Option</button>
                     </div>
                  </div>
               )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function FormBuilder({ formId }: { formId?: string }) {
  const router = useRouter();
  const [fields, setFields] = useState<FormField[]>([]);
  const [config, setConfig] = useState<FormConfig>({ name: "Untitled Form", webhook_url: "", description: "" });
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isLeftOpen, setIsLeftOpen] = useState(true);
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [publishedUrl, setPublishedUrl] = useState("");

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  useEffect(() => { if (formId) fetchForm(); }, [formId]);

  async function fetchForm() {
    const { data: form } = await supabase.from("forms").select("*").eq("id", formId).single();
    if (form) setConfig(prev => ({ ...prev, name: form.name, webhook_url: form.webhook_url || "", description: form.description || "" }));
    
    const { data: fieldsData } = await supabase.from("form_fields").select("*").eq("form_id", formId).order("order_index", { ascending: true });
    if (fieldsData) setFields(fieldsData);
  }

  const addField = (type: FieldType) => {
    const newField: FormField = { id: Math.random().toString(36).substr(2, 9), type, label: `New ${type.charAt(0).toUpperCase() + type.slice(1)} Field`, placeholder: "", required: false, options: type === 'select' || type === 'radio' ? ["Option 1", "Option 2"] : undefined, order_index: fields.length };
    setFields([...fields, newField]);
    setSelectedFieldId(newField.id);
  };

  const deleteField = (id: string) => { setFields(fields.filter(f => f.id !== id)); if (selectedFieldId === id) setSelectedFieldId(null); };
  const updateField = (id: string, updates: Partial<FormField>) => { setFields(fields.map(f => f.id === id ? { ...f, ...updates } : f)); };

  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setFields((items) => {
        const oldIndex = items.findIndex((i) => i.id === active.id);
        const newIndex = items.findIndex((i) => i.id === over.id);
        const newArray = arrayMove(items, oldIndex, newIndex);
        return newArray.map((item, index) => ({ ...item, order_index: index }));
      });
    }
  };

  const publishForm = async () => {
    setIsSaving(true);
    try {
      let currentFormId = formId;
      const formPayload = { name: config.name, description: config.description, webhook_url: config.webhook_url, updated_at: new Date().toISOString() };
      
      if (currentFormId) { await supabase.from("forms").update(formPayload).eq("id", currentFormId); }
      else { const { data } = await supabase.from("forms").insert([formPayload]).select().single(); currentFormId = data.id; }
      
      await supabase.from("form_fields").delete().eq("form_id", currentFormId);
      
      const payloadFields = fields.map((f, index) => ({ form_id: currentFormId, type: f.type, label: f.label, placeholder: f.placeholder, required: f.required, options: f.options, order_index: index }));
      if (payloadFields.length > 0) await supabase.from("form_fields").insert(payloadFields);
      
      setPublishedUrl(`${window.location.origin}/forms/${currentFormId}`);
      setShowPublishModal(true);
      if (!formId) window.history.replaceState(null, '', `/forms/${currentFormId}/edit`);
    } catch (error: any) { alert("Error saving form: " + error.message); } finally { setIsSaving(false); }
  };

  const handlePreviewAlert = () => alert("Please hit 'PUBLISH' first so the system can generate your shareable link!");

  const currentSelectedField = fields.find(f => f.id === selectedFieldId);

  return (
    <div className="fixed inset-0 z-[100] bg-[#F8FAFC] flex flex-col h-screen animate-in fade-in duration-500 overflow-hidden">
      
      {/* Publish Success Modal */}
      {showPublishModal && (
        <div className="fixed inset-0 z-[200] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center animate-in fade-in duration-300 p-6">
           <div className="bg-white rounded-3xl p-8 md:p-10 max-w-lg w-full shadow-xl border border-slate-200 space-y-8 animate-in zoom-in-95 duration-500">
              <div className="flex items-center gap-4 border-b border-slate-100 pb-5">
                 <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center border border-emerald-100 shrink-0"><CheckCircle2 className="w-6 h-6 text-emerald-500" /></div>
                 <div><h2 className="text-xl font-bold text-slate-900">Form Published</h2><p className="text-slate-500 text-sm font-medium">Your data pipeline is officially live.</p></div>
              </div>
              
              <div className="space-y-2">
                 <label className="text-[11px] font-semibold text-slate-500 tracking-wider pl-1">Public Share Link</label>
                 <div className="flex gap-2 p-2 bg-white border border-slate-200/60 rounded-xl items-center shadow-sm">
                    <LinkIcon className="w-4 h-4 text-slate-400 ml-2 shrink-0" />
                    <input value={publishedUrl} readOnly className="flex-1 bg-transparent outline-none text-slate-700 font-medium text-sm px-2 truncate" />
                    <button onClick={() => { navigator.clipboard.writeText(publishedUrl); alert("URL Copied to Clipboard!"); }} className="px-4 py-2 bg-emerald-600 text-white font-medium text-xs rounded-lg hover:bg-emerald-700 transition-all shadow-sm">Copy</button>
                 </div>
              </div>
              
              <div className="flex flex-col gap-3 pt-4 border-t border-slate-100">
                 <button onClick={() => window.open(publishedUrl, '_blank')} className="w-full bg-slate-900 text-white font-medium text-sm py-3 rounded-xl hover:bg-slate-800 transition-all flex items-center justify-center gap-2">Test Live Form <ExternalLink className="w-4 h-4" /></button>
                 <button onClick={() => setShowPublishModal(false)} className="w-full text-center text-slate-500 hover:text-slate-900 font-medium text-sm py-3 transition-colors">Continue Editing</button>
                 <Link href="/forms" className="w-full text-center text-slate-400 hover:text-emerald-600 font-semibold text-xs py-2 transition-colors">Return to Dashboard</Link>
              </div>
           </div>
        </div>
      )}

      {/* Top Header Row */}
      <div className="flex justify-between items-center bg-white border-b border-slate-200/60 px-6 md:px-8 py-4 shrink-0 z-10">
        <div className="flex items-center gap-5">
           <Link href="/forms" className="p-2.5 text-slate-400 hover:text-slate-900 bg-white border border-slate-200/60 hover:bg-slate-50 rounded-lg transition-all shadow-sm"><ArrowLeft className="w-4 h-4" /></Link>
           <div className="w-px h-8 bg-slate-200" />
           <div className="space-y-0.5">
              <span className="font-bold text-slate-900 text-lg tracking-tight">TRE<span className="text-emerald-500">Forms</span></span>
              <p className="text-emerald-500 text-[10px] font-semibold uppercase tracking-wider flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" /> Builder</p>
           </div>
        </div>
        <div className="flex items-center gap-3">
           {formId ? (
             <Link href={`/forms/${formId}`} target="_blank" className="hidden md:flex items-center gap-2 px-5 py-2.5 bg-white border border-slate-200/60 rounded-xl text-slate-600 font-medium hover:text-slate-900 hover:bg-slate-50 transition-all text-sm shadow-sm"><Eye className="w-4 h-4" /> Preview</Link>
           ) : (
             <button onClick={handlePreviewAlert} className="hidden md:flex items-center gap-2 px-5 py-2.5 bg-white border border-slate-200/60 rounded-xl text-slate-600 font-medium hover:text-slate-900 hover:bg-slate-50 transition-all text-sm shadow-sm"><Eye className="w-4 h-4" /> Preview</button>
           )}
           <button onClick={publishForm} disabled={isSaving} className="bg-emerald-600 px-6 py-2.5 rounded-xl flex items-center gap-2 text-white font-medium text-sm shadow-sm hover:bg-emerald-700 transition-all active:scale-95 disabled:opacity-50">
             {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Publish
           </button>
        </div>
      </div>

      <div className="flex-1 flex gap-6 min-h-0 p-6 pt-6 relative items-start">
        {/* Left Sidebar */}
        <div className={cn("flex transition-all duration-300 shrink-0 sticky top-0", isLeftOpen ? "w-[280px] h-full" : "w-16")}>
           {isLeftOpen ? (
             <div className="h-full w-full bg-white border border-slate-200/60 rounded-2xl p-5 overflow-y-auto relative shadow-sm flex flex-col custom-scrollbar">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 pl-1">Elements</h3>
                  <button onClick={() => setIsLeftOpen(false)} className="p-1.5 text-slate-400 hover:text-slate-900 bg-white border border-slate-200/60 hover:bg-slate-50 rounded-lg transition-colors shadow-sm"><ArrowLeft className="w-3.5 h-3.5" /></button>
                </div>
                <div className="grid grid-cols-1 gap-3 flex-1">
                   {['input', 'textarea', 'select', 'radio', 'date', 'image', 'header'].map((type) => (
                     <button key={type} onClick={() => addField(type as FieldType)} className="w-full text-left focus:outline-none">
                        <SidebarItem type={type as FieldType} label={type === 'input' ? 'Short Text' : type === 'textarea' ? 'Long Text' : type === 'select' ? 'Dropdown' : type === 'radio' ? 'Selection' : type === 'header' ? 'Section Header' : type.charAt(0).toUpperCase() + type.slice(1)} icon={type === 'input' ? Type : type === 'textarea' ? AlignLeft : type === 'select' ? ChevronDown : type === 'radio' ? CircleDot : type === 'date' ? Calendar : type === 'header' ? Heading2 : ImageIcon} />
                     </button>
                   ))}
                </div>
                <div className="mt-6 pt-6 border-t border-slate-100 space-y-3 shrink-0">
                  <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 pl-1">Integrations</h3>
                  <div className="space-y-2">
                     <label className="text-xs font-medium text-slate-600 block pl-1">Target Webhook URL</label>
                     <div className="relative">
                        <Webhook className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-500" />
                        <input value={config.webhook_url} onChange={(e) => setConfig({ ...config, webhook_url: e.target.value })} placeholder="https://hook.endpoint..." className="w-full bg-white shadow-sm border border-slate-200/60 rounded-xl pl-10 pr-4 py-2 text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all placeholder:text-slate-400 font-medium text-slate-900" />
                     </div>
                  </div>
                </div>
             </div>
           ) : (
             <button onClick={() => setIsLeftOpen(true)} className="w-14 bg-white border border-slate-200/60 rounded-2xl flex flex-col items-center py-6 gap-6 hover:bg-slate-50 hover:border-slate-300 transition-all group shadow-sm z-10">
                <Plus className="w-5 h-5 text-slate-400 group-hover:text-emerald-600 transition-colors" />
                <div className="w-px h-12 bg-slate-200" />
                <span className="[writing-mode:vertical-lr] text-[10px] font-medium uppercase tracking-widest text-slate-400 group-hover:text-slate-900 transition-colors">Add Components</span>
             </button>
           )}
        </div>

        {/* Center: Expansive Workspace */}
        <div className="flex-1 overflow-y-auto px-4 md:px-8 custom-scrollbar bg-transparent h-full" onClick={() => setSelectedFieldId(null)}>
           <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
             <SortableContext items={fields.map(f => f.id)} strategy={verticalListSortingStrategy}>
               <div className={cn("mx-auto transition-all duration-500 flex flex-col gap-6", "max-w-[700px]")}>
                 <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3 border border-slate-200/60 bg-white rounded-xl px-3 py-1.5 shadow-sm">
                       <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-600 flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Canvas Active</span>
                       <span className="text-slate-200">|</span>
                       <span className="text-slate-500 font-medium text-xs">{fields.length} Modules</span>
                    </div>
                    {currentSelectedField && <div className="text-[11px] font-semibold uppercase tracking-wider text-amber-600 bg-amber-50 border border-amber-100 px-3 py-1.5 rounded-lg shadow-sm flex items-center gap-1.5"><Settings2 className="w-3.5 h-3.5" /> Component Selected</div>}
                 </div>
                 
                 {/* Form Title & Description Headers */}
                 <div className="px-6 pt-6 space-y-4" onClick={(e) => e.stopPropagation()}>
                    <input value={config.name} onChange={(e) => setConfig({ ...config, name: e.target.value })} className="w-full bg-transparent text-4xl font-bold text-slate-900 tracking-tight outline-none focus:text-emerald-600 transition-colors border-none p-0 h-auto placeholder:text-slate-300" placeholder="Form Title..." />
                    <div className="h-1 w-16 bg-emerald-500 rounded-full" />
                    <textarea value={config.description} onChange={(e) => setConfig({ ...config, description: e.target.value })} className="w-full bg-transparent text-base font-medium text-slate-500 outline-none hover:bg-white/50 focus:bg-white focus:ring-2 focus:ring-emerald-500/10 focus:border border focus:border-emerald-500/20 border-transparent rounded-xl p-3 -ml-3 transition-all resize-none min-h-[100px] placeholder:text-slate-300 leading-relaxed" placeholder="Type a form description or greeting message here for your users..." />
                 </div>

                 <div className="flex flex-col gap-5 w-full pb-32 mt-2">
                 {fields.map((field) => (
                   <SortableField key={field.id} field={field} isSelected={selectedFieldId === field.id} onDelete={() => deleteField(field.id)} onUpdate={(updates) => updateField(field.id, updates)} onSelect={() => setSelectedFieldId(field.id)} onSelectNull={() => setSelectedFieldId(null)} />
                 ))}
                 
                 {fields.length === 0 && (
                   <div className="py-20 flex flex-col items-center justify-center text-center border-2 border-dashed border-slate-300 bg-white rounded-2xl group shadow-sm transition-all hover:bg-emerald-50/50 hover:border-emerald-200 cursor-pointer" onClick={(e) => { e.stopPropagation(); setIsLeftOpen(true);}}>
                      <div className="w-16 h-16 rounded-2xl bg-slate-50 border border-slate-200/60 flex items-center justify-center mb-5 group-hover:-translate-y-1 transition-transform duration-300 shadow-sm"><Plus className="w-8 h-8 text-slate-400 group-hover:text-emerald-500 transition-colors" /></div>
                      <p className="text-slate-700 font-semibold text-xl tracking-tight">Initialize Form Structure</p>
                      <p className="text-slate-500 text-sm mt-1 max-w-sm">Tap here or select a component from the elements panel to add your first field.</p>
                   </div>
                 )}
                 </div>
               </div>
             </SortableContext>
           </DndContext>
        </div>
      </div>
    </div>
  );
}
