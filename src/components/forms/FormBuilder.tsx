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
    <div className="flex items-center gap-4 p-4 bg-slate-50 border border-slate-200 rounded-2xl cursor-pointer hover:border-emerald-500/30 hover:bg-emerald-500/5 transition-all group shadow-sm">
      <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-400 group-hover:text-emerald-600 transition-colors shadow-sm"><Icon className="w-5 h-5" /></div>
      <span className="font-bold text-sm text-slate-600 group-hover:text-slate-900 transition-colors">{label}</span>
    </div>
  );
}

function SortableField({ field, onDelete, onUpdate, onSelect, onSelectNull, isSelected }: { field: FormField, onDelete: () => void, onUpdate: (updates: Partial<FormField>) => void, onSelect: () => void, onSelectNull: () => void, isSelected: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: field.id });
  const style = { transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 50 : 'auto', opacity: isDragging ? 0.3 : 1 };

  return (
    <div ref={setNodeRef} style={style} className={cn("relative group border-2 p-6 transition-all duration-300 shadow-sm", isSelected ? "border-emerald-500 ring-4 ring-emerald-500/10 shadow-xl bg-white rounded-2xl z-10" : "border-slate-200 hover:border-emerald-300 hover:shadow-md cursor-pointer rounded-2xl bg-white")} onClick={!isSelected ? (e) => { e.stopPropagation(); onSelect(); } : undefined}>
      <div className="flex items-start gap-4">
        {/* Isolated Drag Handle */}
        <button {...attributes} {...listeners} className="p-3 cursor-grab flex active:cursor-grabbing text-slate-300 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all mt-1"><GripVertical className="w-5 h-5" /></button>
        <div className="flex-1 space-y-4 w-full">
          {/* ALWAYS VISIBLE WYSIWYG PREVIEW */}
          <div className="pointer-events-none w-full">
             <div className="space-y-1 w-full mb-4">
               {isSelected && <span className="text-[10px] font-black uppercase tracking-widest text-[#FA890F] bg-orange-50 border border-orange-100 px-3 py-1 rounded-lg mb-2 inline-block">Editing {field.type}</span>}
               <h4 className="text-[17px] font-bold text-slate-800 leading-tight">{field.label || "Untitled Field"}{field.required && <span className="text-red-500 ml-1.5">*</span>}</h4>
             </div>
             {field.type === 'input' && <div className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium text-slate-400 shadow-inner">{field.placeholder || "Text input placeholder"}</div>}
             {field.type === 'textarea' && <div className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium text-slate-400 h-24 shadow-inner">{field.placeholder || "Long text placeholder"}</div>}
             {field.type === 'select' && <div className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium text-slate-400 flex justify-between items-center shadow-inner"><span>{field.placeholder || "Select option"}</span><ChevronDown className="w-5 h-5 text-slate-300" /></div>}
             {field.type === 'radio' && <div className="space-y-3">{field.options?.map((opt, i) => <div key={i} className="flex items-center gap-3 bg-slate-50 border border-slate-200 p-4 rounded-xl shadow-sm"><div className="w-4 h-4 rounded-full border-2 border-slate-300 bg-white" /><span className="text-sm text-slate-600 font-bold">{opt}</span></div>)}</div>}
             {field.type === 'image' && <div className="border-2 border-dashed border-slate-200 bg-slate-50 rounded-xl h-32 flex flex-col items-center justify-center text-slate-400"><ImageIcon className="w-8 h-8 mb-3 text-slate-300" /><span className="text-xs font-bold uppercase tracking-widest">Image Upload Dropzone</span></div>}
             {field.type === 'date' && <div className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium text-slate-400 flex justify-between items-center shadow-inner"><span>Select date</span><Calendar className="w-5 h-5 text-slate-300" /></div>}
             {field.type === 'header' && (
               <div className="py-6 border-b-4 border-slate-900 mb-2 mt-4">
                 <h3 className="text-3xl font-black text-slate-900 tracking-tight uppercase">{field.label || "Section Header"}</h3>
               </div>
             )}
          </div>

          {/* CONFIGURATION DRAWER */}
          {isSelected && (
            <div className="mt-8 pt-6 border-t border-slate-100 animate-in fade-in slide-in-from-top-2 duration-300" onClick={(e) => e.stopPropagation()}>
               <div className="flex justify-between items-center mb-6">
                 <span className="text-xs font-bold uppercase tracking-widest text-emerald-600 bg-emerald-50 border border-emerald-100 px-4 py-1.5 rounded-xl">Field Configuration</span>
                 <div className="flex items-center gap-2">
                   <button onClick={(e) => { e.stopPropagation(); onSelectNull(); }} className="px-4 py-2 text-xs font-black uppercase tracking-widest text-emerald-700 hover:text-emerald-900 bg-emerald-100 hover:bg-emerald-200 rounded-lg transition-all shadow-sm">Done Editing</button>
                   <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="p-2 text-slate-400 hover:text-white bg-slate-50 border border-slate-200 hover:border-red-500 hover:bg-red-500 rounded-lg transition-all shadow-sm" title="Delete Field"><Trash2 className="w-4 h-4" /></button>
                 </div>
               </div>
               <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full">
                  <div className="space-y-2"><label className="text-xs font-bold text-slate-500 uppercase tracking-widest pl-1">Label Text</label><input value={field.label} onChange={e => onUpdate({label: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-black focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500/30 outline-none text-slate-900 transition-all shadow-sm" placeholder="e.g. Your Full Name" /></div>
                  {(field.type === 'input' || field.type === 'textarea' || field.type === 'select') && (<div className="space-y-2"><label className="text-xs font-bold text-slate-500 uppercase tracking-widest pl-1">Placeholder Hint</label><input value={field.placeholder || ""} onChange={e => onUpdate({placeholder: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500/30 outline-none text-slate-900 transition-all shadow-sm placeholder:text-slate-300" placeholder="e.g. John Doe" /></div>)}
               </div>
               <div className="mt-6 flex items-center justify-between p-5 bg-slate-50 border border-slate-200 rounded-xl shadow-sm">
                  <div className="space-y-1"><p className="text-sm font-black text-slate-900">Required Property</p><p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Mark as mandatory for users</p></div>
                  <button onClick={() => onUpdate({required: !field.required})} className={cn("w-14 h-8 flex items-center rounded-full transition-all duration-300", field.required ? "bg-emerald-500" : "bg-slate-300")}><div className={cn("w-6 h-6 rounded-full bg-white shadow-md transition-transform mx-1", field.required ? "translate-x-6" : "")} /></button>
               </div>
               {(field.type === 'select' || field.type === 'radio') && (
                  <div className="space-y-4 pt-6 mt-6 border-t border-slate-100">
                     <label className="text-xs font-bold text-slate-500 uppercase tracking-widest pl-1">Radio / Select Options</label>
                     <div className="space-y-3">
                        {field.options?.map((opt, idx) => (<div key={idx} className="flex gap-4 items-center group/opt"><div className="w-6 flex justify-center text-slate-300"><CircleDot className="w-4 h-4" /></div><input value={opt} onChange={e => { const next = [...(field.options || [])]; next[idx] = e.target.value; onUpdate({options: next}); }} className="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-black text-slate-900 outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500/30 transition-all shadow-sm" placeholder="Option value" /><button onClick={() => { const next = field.options?.filter((_, i) => i !== idx); onUpdate({options: next}); }} className="p-3 text-slate-400 hover:text-red-500 bg-slate-50 border border-slate-200 hover:border-red-200 hover:bg-red-50 rounded-xl transition-all shadow-sm"><X className="w-4 h-4" /></button></div>))}
                        <button onClick={() => onUpdate({options: [...(field.options || []), `Option ${(field.options?.length || 0) + 1}`]})} className="w-full py-4 bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl text-xs font-bold uppercase tracking-widest text-slate-400 hover:text-emerald-600 hover:border-emerald-300 hover:bg-emerald-50 transition-all flex items-center justify-center gap-3 mt-4"><Plus className="w-5 h-5" /> Add Another Option</button>
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
           <div className="bg-white rounded-[40px] p-8 md:p-12 max-w-lg w-full shadow-2xl space-y-8 animate-in zoom-in-95 duration-500">
              <div className="flex items-center gap-4 border-b border-slate-100 pb-6">
                 <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center border border-emerald-100 shrink-0"><CheckCircle2 className="w-8 h-8 text-emerald-500" /></div>
                 <div><h2 className="text-2xl font-black text-slate-900">Form Published</h2><p className="text-slate-500 text-sm font-medium">Your data pipeline is officially live.</p></div>
              </div>
              
              <div className="space-y-3">
                 <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 pl-2">Public Share Link</label>
                 <div className="flex gap-2 p-3 bg-slate-50 border border-slate-200 rounded-2xl items-center shadow-inner">
                    <LinkIcon className="w-5 h-5 text-slate-400 ml-2" />
                    <input value={publishedUrl} readOnly className="flex-1 bg-transparent outline-none text-slate-700 font-bold text-sm px-2 truncate" />
                    <button onClick={() => { navigator.clipboard.writeText(publishedUrl); alert("URL Copied to Clipboard!"); }} className="px-5 py-2.5 bg-emerald-600 text-white font-black text-[10px] uppercase tracking-widest rounded-xl hover:bg-emerald-700 transition-all shadow-md">Copy</button>
                 </div>
              </div>
              
              <div className="flex flex-col gap-3 pt-4 border-t border-slate-100">
                 <button onClick={() => window.open(publishedUrl, '_blank')} className="w-full bg-slate-900 text-white font-black text-sm py-4 rounded-full hover:bg-slate-800 transition-all shadow-lg flex items-center justify-center gap-2">Test Live Form <ExternalLink className="w-4 h-4" /></button>
                 <button onClick={() => setShowPublishModal(false)} className="w-full text-center text-slate-500 hover:text-slate-900 font-bold py-4 transition-colors">Continue Editing Builder</button>
                 <Link href="/forms" className="w-full text-center text-slate-400 hover:text-emerald-600 font-black tracking-widest uppercase text-[10px] py-4 transition-colors">Return to Dashboard</Link>
              </div>
           </div>
        </div>
      )}

      {/* Top Header Row */}
      <div className="flex justify-between items-center bg-white border-b border-slate-200 px-6 md:px-10 py-5 shrink-0 shadow-sm z-10">
        <div className="flex items-center gap-6">
           <Link href="/forms" className="p-3 text-slate-400 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 rounded-xl transition-all shadow-inner"><ArrowLeft className="w-5 h-5" /></Link>
           <div className="w-px h-10 bg-slate-200" />
           <div className="space-y-1">
              <span className="font-extrabold text-slate-900 text-xl tracking-tight">TRE<span className="text-emerald-500">Forms</span></span>
              <p className="text-emerald-500 text-[10px] font-bold uppercase tracking-widest flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" /> Builder</p>
           </div>
        </div>
        <div className="flex items-center gap-4">
           {formId ? (
             <Link href={`/forms/${formId}`} target="_blank" className="hidden md:flex items-center gap-2 px-6 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-600 font-black hover:text-slate-900 hover:bg-slate-100 transition-all text-xs tracking-widest uppercase shadow-sm"><Eye className="w-4 h-4" /> PREVIEW</Link>
           ) : (
             <button onClick={handlePreviewAlert} className="hidden md:flex items-center gap-2 px-6 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-600 font-black hover:text-slate-900 hover:bg-slate-100 transition-all text-xs tracking-widest uppercase shadow-sm"><Eye className="w-4 h-4" /> PREVIEW</button>
           )}
           <button onClick={publishForm} disabled={isSaving} className="bg-emerald-600 px-8 py-3.5 rounded-xl flex items-center gap-3 text-white font-black text-xs tracking-widest uppercase shadow-xl shadow-emerald-500/20 hover:bg-emerald-700 transition-all active:scale-95 disabled:opacity-50">
             {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} PUBLISH
           </button>
        </div>
      </div>

      <div className="flex-1 flex gap-8 min-h-0 p-6 md:p-8 pt-6 relative items-start">
        {/* Left Sidebar */}
        <div className={cn("flex transition-all duration-300 shrink-0 sticky top-0", isLeftOpen ? "w-[320px] h-full" : "w-16")}>
           {isLeftOpen ? (
             <div className="h-full w-full bg-white border border-slate-200 rounded-[32px] p-6 overflow-y-auto relative shadow-sm flex flex-col custom-scrollbar">
                <div className="flex justify-between items-center mb-8">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 pl-1">Elements</h3>
                  <button onClick={() => setIsLeftOpen(false)} className="p-2 text-slate-400 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 rounded-xl transition-colors shadow-sm"><ArrowLeft className="w-4 h-4" /></button>
                </div>
                <div className="grid grid-cols-1 gap-4 flex-1">
                   {['input', 'textarea', 'select', 'radio', 'date', 'image', 'header'].map((type) => (
                     <button key={type} onClick={() => addField(type as FieldType)} className="w-full text-left focus:outline-none">
                        <SidebarItem type={type as FieldType} label={type === 'input' ? 'Short Text' : type === 'textarea' ? 'Long Text' : type === 'select' ? 'Dropdown' : type === 'radio' ? 'Selection' : type === 'header' ? 'Section Header' : type.charAt(0).toUpperCase() + type.slice(1)} icon={type === 'input' ? Type : type === 'textarea' ? AlignLeft : type === 'select' ? ChevronDown : type === 'radio' ? CircleDot : type === 'date' ? Calendar : type === 'header' ? Heading2 : ImageIcon} />
                     </button>
                   ))}
                </div>
                <div className="mt-8 pt-8 border-t border-slate-100 space-y-4 shrink-0">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 pl-1">Integrations</h3>
                  <div className="space-y-3">
                     <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest block pl-1">Target Webhook URL</label>
                     <div className="relative">
                        <Webhook className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-500" />
                        <input value={config.webhook_url} onChange={(e) => setConfig({ ...config, webhook_url: e.target.value })} placeholder="https://hook.endpoint..." className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-11 pr-4 py-3 text-sm focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500/30 outline-none transition-all placeholder:text-slate-300 font-bold text-slate-900 shadow-sm" />
                     </div>
                  </div>
                </div>
             </div>
           ) : (
             <button onClick={() => setIsLeftOpen(true)} className="w-[64px] bg-white border border-slate-200 rounded-[32px] flex flex-col items-center py-8 gap-8 hover:bg-slate-50 hover:border-slate-300 transition-all group shadow-sm z-10">
                <Plus className="w-6 h-6 text-slate-400 group-hover:text-emerald-600 transition-colors" />
                <div className="w-px h-16 bg-slate-200" />
                <span className="[writing-mode:vertical-lr] text-xs font-bold uppercase tracking-[0.3em] text-slate-400 group-hover:text-slate-900 transition-colors">Add Components</span>
             </button>
           )}
        </div>

        {/* Center: Expansive Workspace */}
        <div className="flex-1 overflow-y-auto px-4 md:px-12 py-6 custom-scrollbar bg-transparent h-full" onClick={() => setSelectedFieldId(null)}>
           <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
             <SortableContext items={fields.map(f => f.id)} strategy={verticalListSortingStrategy}>
               <div className={cn("mx-auto transition-all duration-500 flex flex-col gap-8", "max-w-[760px]")}>
                 <div className="flex items-center justify-between mb-2 ml-2">
                    <div className="flex items-center gap-3">
                       <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600 bg-emerald-50 border border-emerald-100 px-4 py-1.5 rounded-xl shadow-sm">Canvas Editing View</span>
                       <span className="text-slate-300 font-bold">•</span>
                       <span className="text-slate-500 font-black text-[10px] uppercase tracking-widest">{fields.length} Modules</span>
                    </div>
                    {currentSelectedField && <div className="text-[10px] font-black uppercase tracking-widest text-[#FA890F] bg-orange-50 border border-orange-100 px-4 py-1.5 rounded-xl shadow-sm flex items-center gap-2"><Settings2 className="w-3.5 h-3.5" /> Element Config Active</div>}
                 </div>
                 
                 {/* Form Title & Description Headers */}
                 <div className="px-8 pt-8 space-y-4" onClick={(e) => e.stopPropagation()}>
                    <input value={config.name} onChange={(e) => setConfig({ ...config, name: e.target.value })} className="w-full bg-transparent text-5xl font-black text-slate-900 tracking-tight outline-none focus:text-emerald-600 transition-colors border-none p-0 h-auto placeholder:text-slate-200" placeholder="Your Application Form..." />
                    <div className="h-1.5 w-24 bg-emerald-500 rounded-full shadow-lg shadow-emerald-500/10 mb-4" />
                    <textarea value={config.description} onChange={(e) => setConfig({ ...config, description: e.target.value })} className="w-full bg-transparent text-lg font-medium text-slate-500 outline-none hover:bg-white/50 focus:bg-white focus:ring-4 focus:ring-emerald-500/5 focus:border border focus:border-emerald-500/20 border-transparent rounded-2xl p-4 -ml-4 transition-all resize-none min-h-[100px] placeholder:text-slate-300 leading-relaxed" placeholder="Type a form description or greeting message here for your users..." />
                 </div>

                 <div className="flex flex-col gap-6 w-full pb-32 mt-4">
                 {fields.map((field) => (
                   <SortableField key={field.id} field={field} isSelected={selectedFieldId === field.id} onDelete={() => deleteField(field.id)} onUpdate={(updates) => updateField(field.id, updates)} onSelect={() => setSelectedFieldId(field.id)} onSelectNull={() => setSelectedFieldId(null)} />
                 ))}
                 
                 {fields.length === 0 && (
                   <div className="py-24 flex flex-col items-center justify-center text-center border-2 border-dashed border-slate-300 rounded-[40px] group bg-white shadow-sm transition-all hover:bg-emerald-50/50 hover:border-emerald-200 cursor-pointer" onClick={(e) => { e.stopPropagation(); setIsLeftOpen(true);}}>
                      <div className="w-20 h-20 rounded-3xl bg-slate-50 border border-slate-200 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-500 shadow-sm"><Plus className="w-10 h-10 text-slate-400 group-hover:text-emerald-500 transition-colors" /></div>
                      <p className="text-slate-600 font-extrabold text-lg uppercase tracking-tight">Initialize Architecture</p>
                      <p className="text-slate-400 text-sm mt-2 max-w-sm">Tap here or select a component from the left dashboard to configure your form.</p>
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
