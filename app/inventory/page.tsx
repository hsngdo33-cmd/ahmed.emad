"use client";
import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

export default function InventoryPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  
  // حالات المودالات
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isQRModalOpen, setIsQRModalOpen] = useState(false);
  
  // التعديل المباشر في الجدول
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<any>({});

  // بيانات المنتج الجديد
  const [newProduct, setNewProduct] = useState({
    name: "", unit: "كيلو", purchase_price: "", sale_price: "", stock_quantity: "", barcode: ""
  });

  // مراجع الـ Scanner
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const readerRef = useRef<any>(null);

  useEffect(() => { fetchProducts(); }, []);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const { data } = await supabase.from("products").select("*").order("name", { ascending: true });
      setProducts(data || []);
    } catch (err) {
      console.error("Fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  // --- وظائف الـ Scanner ---
  const startScanner = async () => {
    setIsQRModalOpen(true);
    setTimeout(async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" }
        });
        streamRef.current = stream;
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          const { BrowserMultiFormatReader } = await import("@zxing/browser");
          const codeReader = new BrowserMultiFormatReader();
          readerRef.current = codeReader;

          codeReader.decodeFromVideoElement(videoRef.current, (result, err) => {
            if (result) {
              setNewProduct(prev => ({ ...prev, barcode: result.getText() }));
              stopScanner();
              setIsQRModalOpen(false);
              setIsModalOpen(true); 
            }
          });
        }
      } catch (e) {
        alert("تأكد من السماح للكاميرا بالعمل");
        setIsQRModalOpen(false);
      }
    }, 500);
  };

  const stopScanner = () => {
    try {
      if (readerRef.current) {
        if (typeof readerRef.current.stopContinuousDecode === 'function') readerRef.current.stopContinuousDecode();
        else if (typeof readerRef.current.reset === 'function') readerRef.current.reset();
      }
    } catch (e) {}
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsQRModalOpen(false);
  };

  // --- عمليات الجدول ---
  const startEdit = (product: any) => {
    setEditingId(product.id);
    setEditForm({ ...product });
  };

  const saveEdit = async () => {
    const { error } = await supabase.from("products").update({
      name: editForm.name, unit: editForm.unit,
      purchase_price: Number(editForm.purchase_price),
      sale_price: Number(editForm.sale_price),
      stock_quantity: Number(editForm.stock_quantity)
    }).eq("id", editingId);

    if (!error) { setEditingId(null); fetchProducts(); }
    else alert("خطأ في التحديث: " + error.message);
  };

  // --- الإضافة النهائية (يدوي + باركود) ---
  const handleAddProduct = async () => {
    if (!newProduct.name) return alert("يرجى كتابة اسم الصنف");

    const productData: any = {
      name: newProduct.name,
      unit: newProduct.unit,
      purchase_price: Number(newProduct.purchase_price) || 0,
      sale_price: Number(newProduct.sale_price) || 0,
      stock_quantity: Number(newProduct.stock_quantity) || 0,
    };

    // نرسل الباركود فقط إذا لم يكن فارغاً (لتجنب مشاكل توافق الجداول)
    if (newProduct.barcode.trim() !== "") {
      productData.barcode = newProduct.barcode;
    }

    const { error } = await supabase.from("products").insert([productData]);

    if (error) {
      alert("حدث خطأ: " + error.message);
    } else {
      alert("تمت الإضافة بنجاح ✅");
      setIsModalOpen(false);
      setNewProduct({ name: "", unit: "كيلو", purchase_price: "", sale_price: "", stock_quantity: "", barcode: "" });
      fetchProducts();
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 text-right text-black font-sans" dir="rtl">
      <div className="max-w-7xl mx-auto">
        
        {/* Header */}
        <div className="flex justify-between items-center mb-8 bg-white p-5 rounded-2xl shadow-sm border-r-8 border-emerald-600">
          <div>
            <h1 className="text-2xl font-bold text-black">إدارة وتحكم المخزن</h1>
            <p className="text-slate-500 text-sm font-bold">تعديل مباشر وإضافة ذكية</p>
          </div>
          <div className="flex gap-3">
             <Link href="/" className="bg-slate-100 text-black px-5 py-2 rounded-xl text-sm font-bold border border-slate-200">🏠 الرئيسية</Link>
             <button onClick={startScanner} className="bg-indigo-600 text-white px-6 py-2 rounded-xl text-sm font-bold shadow-md hover:bg-indigo-700 transition-all">📷 سكان باركود</button>
             <button onClick={() => setIsModalOpen(true)} className="bg-emerald-600 text-white px-6 py-2 rounded-xl text-sm font-bold shadow-md hover:bg-emerald-700">+ إضافة صنف</button>
          </div>
        </div>

        {/* البحث */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 mb-6">
          <input 
            type="text" placeholder="ابحث عن صنف بالاسم..." 
            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:border-emerald-500"
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* الجدول */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <table className="w-full text-right text-sm">
            <thead className="bg-slate-900 text-white font-bold">
              <tr>
                <th className="p-4">اسم الصنف</th>
                <th className="p-4 text-center">الوحدة</th>
                <th className="p-4 text-center">الكمية</th>
                <th className="p-4 text-center">سعر الشراء</th>
                <th className="p-4 text-center">سعر البيع</th>
                <th className="p-4 text-center">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-black font-bold">
              {loading ? (
                <tr><td colSpan={6} className="p-10 text-center text-slate-400">جاري تحميل البيانات...</td></tr>
              ) : products.filter(p => p.name.includes(searchTerm)).map((p) => (
                <tr key={p.id} className={`${editingId === p.id ? 'bg-blue-50' : 'hover:bg-slate-50'} transition-all`}>
                  {editingId === p.id ? (
                    <>
                      <td className="p-2"><input className="w-full p-2 border rounded font-bold" value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} /></td>
                      <td className="p-2">
                        <select className="w-full p-2 border rounded font-bold" value={editForm.unit} onChange={e => setEditForm({...editForm, unit: e.target.value})}>
                          <option>كيلو</option><option>لتر</option><option>عبوة</option><option>كرتونة</option><option>شكارة</option>
                        </select>
                      </td>
                      <td className="p-2"><input type="number" className="w-full p-2 border rounded text-center font-bold" value={editForm.stock_quantity} onChange={e => setEditForm({...editForm, stock_quantity: e.target.value})} /></td>
                      <td className="p-2"><input type="number" className="w-full p-2 border rounded text-center text-red-600 font-bold" value={editForm.purchase_price} onChange={e => setEditForm({...editForm, purchase_price: e.target.value})} /></td>
                      <td className="p-2"><input type="number" className="w-full p-2 border rounded text-center text-blue-600 font-bold" value={editForm.sale_price} onChange={e => setEditForm({...editForm, sale_price: e.target.value})} /></td>
                      <td className="p-2 text-center flex gap-1 justify-center">
                        <button onClick={saveEdit} className="bg-emerald-500 text-white px-3 py-1 rounded-lg text-xs font-bold shadow-sm">حفظ ✅</button>
                        <button onClick={() => setEditingId(null)} className="bg-slate-400 text-white px-3 py-1 rounded-lg text-xs font-bold shadow-sm">إلغاء</button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="p-4 font-bold">{p.name}</td>
                      <td className="p-4 text-center text-slate-500 font-bold">{p.unit}</td>
                      <td className={`p-4 text-center font-bold ${p.stock_quantity <= 5 ? 'text-red-600' : 'text-emerald-600'}`}>{p.stock_quantity}</td>
                      <td className="p-4 text-center font-bold">{p.purchase_price} ج.م</td>
                      <td className="p-4 text-center text-blue-600 font-bold">{p.sale_price} ج.م</td>
                      <td className="p-4 text-center">
                        <button onClick={() => startEdit(p)} className="text-blue-600 hover:underline font-bold transition-all">✏️ تعديل</button>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* مودال الـ Scanner */}
      {isQRModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-[60]">
          <div className="bg-white p-4 rounded-3xl w-full max-w-sm text-center">
            <h3 className="font-bold mb-4 text-black text-lg">وجه الكاميرا للباركود 📷</h3>
            <video ref={videoRef} className="w-full rounded-2xl bg-black mb-4 border-2 border-indigo-500" playsInline />
            <button onClick={stopScanner} className="w-full py-3 bg-rose-500 text-white rounded-xl font-bold transition-all active:scale-95 shadow-lg">إلغاء المسح</button>
          </div>
        </div>
      )}

      {/* مودال الإضافة (يدوي + باركود) */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white p-6 rounded-3xl w-full max-w-md shadow-2xl text-black">
            <h2 className="text-xl font-bold mb-6 text-center border-b pb-4 decoration-emerald-500 underline italic">إضافة صنف للمخزن</h2>
            <div className="space-y-4 text-right">
              <div>
                <label className="text-[10px] font-bold text-slate-400 mr-2">اسم الصنف</label>
                <input placeholder="مثال: سماد نترات" className="w-full p-3 bg-slate-50 border rounded-xl font-bold outline-none focus:border-emerald-500" value={newProduct.name} onChange={e => setNewProduct({...newProduct, name: e.target.value})} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 mr-2">الوحدة</label>
                  <select className="w-full p-3 bg-slate-50 border rounded-xl font-bold text-black outline-none" value={newProduct.unit} onChange={e => setNewProduct({...newProduct, unit: e.target.value})}>
                    <option>كيلو</option><option>لتر</option><option>مللي</option><option>جرام</option><option>عبوة</option><option>كرتونة</option><option>شكارة</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 mr-2">الكمية</label>
                  <input placeholder="0" type="number" className="w-full p-3 bg-slate-50 border rounded-xl font-bold outline-none" value={newProduct.stock_quantity} onChange={e => setNewProduct({...newProduct, stock_quantity: e.target.value})} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 mr-2">سعر الشراء</label>
                  <input placeholder="0.00" type="number" className="w-full p-3 bg-slate-50 border rounded-xl font-bold text-red-600 outline-none" value={newProduct.purchase_price} onChange={e => setNewProduct({...newProduct, purchase_price: e.target.value})} />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 mr-2">سعر البيع</label>
                  <input placeholder="0.00" type="number" className="w-full p-3 bg-slate-50 border rounded-xl font-bold text-blue-600 outline-none" value={newProduct.sale_price} onChange={e => setNewProduct({...newProduct, sale_price: e.target.value})} />
                </div>
              </div>

              <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-xl">
                <p className="text-[10px] font-bold text-indigo-400 mb-1">كود الباركود (اختياري):</p>
                <input 
                  placeholder="يمكنك كتابة الكود يدوياً أو استخدام الكاميرا" 
                  className="w-full bg-transparent font-mono text-sm font-bold text-indigo-700 outline-none" 
                  value={newProduct.barcode}
                  onChange={e => setNewProduct({...newProduct, barcode: e.target.value})}
                />
              </div>

              <button onClick={handleAddProduct} className="w-full bg-emerald-600 text-white py-4 rounded-2xl font-bold shadow-lg mt-4 hover:bg-emerald-700 transition-all active:scale-[0.98]">تأكيد الحفظ في المخزن ✅</button>
              <button onClick={() => setIsModalOpen(false)} className="w-full text-slate-400 text-xs font-bold mt-2 hover:text-slate-600 transition-all">إلغاء وإغلاق</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}