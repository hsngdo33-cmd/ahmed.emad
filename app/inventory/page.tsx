"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

export default function InventoryPage() {

  // =========================
  // STATES
  // =========================

  const [products, setProducts] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);

  // مودالات
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isBarcodeViewOpen, setIsBarcodeViewOpen] = useState(false);

  // المنتج الحالي للعرض
  const [barcodeProduct, setBarcodeProduct] = useState<any>(null);

  // تعديل
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<any>({});

  // منتج جديد
  const [newProduct, setNewProduct] = useState({
    name: "",
    unit: "كيلو",
    purchase_price: "",
    sale_price: "",
    stock_quantity: "",
    barcode: "",
  });

  // سكانر USB
  const scannerInputRef = useRef<HTMLInputElement>(null);
  const [scannerValue, setScannerValue] = useState("");

  // سكانر كاميرا
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const readerRef = useRef<any>(null);

  // Canvas للباركود
  const barcodeCanvasRef = useRef<HTMLCanvasElement>(null);

  // =========================
  // FETCH
  // =========================

  useEffect(() => {
    fetchProducts();
  }, []);

  useEffect(() => {
    scannerInputRef.current?.focus();
  }, []);

  const fetchProducts = async () => {
    setLoading(true);

    const { data } = await supabase
      .from("products")
      .select("*")
      .order("name", { ascending: true });

    setProducts(data || []);
    setLoading(false);

    setTimeout(() => {
      scannerInputRef.current?.focus();
    }, 100);
  };

  // =========================
  // توليد باركود تلقائي
  // =========================

  const generateBarcode = () => {
    return `${Date.now()}${Math.floor(Math.random() * 999)}`;
  };

  // =========================
  // رسم BARCODE
  // =========================

  const drawBarcode = async (
    value: string,
    canvas: HTMLCanvasElement
  ) => {
    const JsBarcode = (await import("jsbarcode")).default;

    JsBarcode(canvas, value, {
      format: "CODE128",
      lineColor: "#000",
      width: 2,
      height: 70,
      displayValue: true,
      fontSize: 18,
      margin: 10,
    });
  };

  // =========================
  // فتح عرض الباركود
  // =========================

  const openBarcodeView = async (product: any) => {
    setBarcodeProduct(product);
    setIsBarcodeViewOpen(true);

    setTimeout(async () => {
      if (barcodeCanvasRef.current) {
        await drawBarcode(product.barcode, barcodeCanvasRef.current);
      }
    }, 100);
  };

  // =========================
  // طباعة الباركود
  // =========================

  const printBarcode = () => {

    if (!barcodeCanvasRef.current || !barcodeProduct) return;

    const dataUrl = barcodeCanvasRef.current.toDataURL("image/png");

    const win = window.open("", "_blank");

    if (!win) return;

    win.document.write(`
      <html dir="rtl">
      <head>
        <title>طباعة باركود</title>

        <style>

          body{
            font-family:Arial;
            text-align:center;
            padding:20px;
          }

          .label{
            width:300px;
            margin:auto;
            border:1px dashed #999;
            padding:15px;
            border-radius:12px;
          }

          img{
            width:100%;
          }

          h2{
            margin:10px 0 5px;
            font-size:22px;
          }

          p{
            margin:5px 0;
            color:#555;
            font-size:14px;
          }

        </style>

      </head>

      <body>

        <div class="label">

          <img src="${dataUrl}" />

          <h2>${barcodeProduct.name}</h2>

          <p>
            سعر البيع:
            ${barcodeProduct.sale_price}
            ج.م
          </p>

          <p>
            الوحدة:
            ${barcodeProduct.unit}
          </p>

        </div>

        <script>
          window.onload = () => {
            window.print();
          }
        </script>

      </body>

      </html>
    `);

    win.document.close();
  };

  // =========================
  // SCANNER USB
  // =========================

  const handleScannerInput = async (value: string) => {

    if (!value.trim()) return;

    const found = products.find(
      (p) => p.barcode?.toString() === value.toString()
    );

    // صوت نجاح
    const successAudio = new Audio(
      "https://actions.google.com/sounds/v1/cartoon/wood_plank_flicks.ogg"
    );

    // صوت خطأ
    const errorAudio = new Audio(
      "https://actions.google.com/sounds/v1/alarms/beep_short.ogg"
    );

    if (found) {

      successAudio.play();

      setSearchTerm(value);

    } else {

      errorAudio.play();

      setNewProduct((prev) => ({
        ...prev,
        barcode: value,
      }));

      setIsModalOpen(true);
    }

    setScannerValue("");

    setTimeout(() => {
      scannerInputRef.current?.focus();
    }, 100);
  };

  // =========================
  // SCANNER CAMERA
  // =========================

  const startScanner = async () => {

    setIsScannerOpen(true);

    setTimeout(async () => {

      try {

        const stream =
          await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: "environment",
            },
          });

        streamRef.current = stream;

        if (videoRef.current) {

          videoRef.current.srcObject = stream;

          const { BrowserMultiFormatReader } =
            await import("@zxing/browser");

          const codeReader =
            new BrowserMultiFormatReader();

          readerRef.current = codeReader;

          codeReader.decodeFromVideoElement(
            videoRef.current,
            (result) => {

              if (result) {

                const code = result.getText();

                stopScanner();

                handleScannerInput(code);
              }
            }
          );
        }

      } catch {

        alert("تأكد من السماح للكاميرا");

        setIsScannerOpen(false);
      }

    }, 300);
  };

  const stopScanner = () => {

    try {

      if (readerRef.current?.reset) {
        readerRef.current.reset();
      }

    } catch {}

    if (streamRef.current) {

      streamRef.current
        .getTracks()
        .forEach((track) => track.stop());

      streamRef.current = null;
    }

    setIsScannerOpen(false);
  };

  // =========================
  // EDIT
  // =========================

  const startEdit = (product: any) => {
    setEditingId(product.id);
    setEditForm({ ...product });
  };

  const saveEdit = async () => {

    const exists = products.find(
      (p) =>
        p.barcode === editForm.barcode &&
        p.id !== editingId
    );

    if (exists) {
      return alert("الباركود مستخدم بالفعل");
    }

    const { error } = await supabase
      .from("products")
      .update({
        name: editForm.name,
        unit: editForm.unit,
        purchase_price: Number(editForm.purchase_price),
        sale_price: Number(editForm.sale_price),
        stock_quantity: Number(editForm.stock_quantity),
        barcode: editForm.barcode,
      })
      .eq("id", editingId);

    if (!error) {

      alert("تم التعديل بنجاح ✅");

      setEditingId(null);

      fetchProducts();

    } else {

      alert(error.message);
    }
  };

  // =========================
  // ADD PRODUCT
  // =========================

  const handleAddProduct = async () => {

    if (!newProduct.name) {
      return alert("اكتب اسم المنتج");
    }

    const barcodeValue =
      newProduct.barcode.trim() !== ""
        ? newProduct.barcode
        : generateBarcode();

    // منع التكرار
    const exists = products.find(
      (p) => p.barcode === barcodeValue
    );

    if (exists) {
      return alert("الباركود مستخدم بالفعل");
    }

    const { error } = await supabase
      .from("products")
      .insert([
        {
          name: newProduct.name,
          unit: newProduct.unit,
          purchase_price:
            Number(newProduct.purchase_price) || 0,
          sale_price:
            Number(newProduct.sale_price) || 0,
          stock_quantity:
            Number(newProduct.stock_quantity) || 0,
          barcode: barcodeValue,
        },
      ]);

    if (!error) {

      alert("تمت الإضافة بنجاح ✅");

      setIsModalOpen(false);

      setNewProduct({
        name: "",
        unit: "كيلو",
        purchase_price: "",
        sale_price: "",
        stock_quantity: "",
        barcode: "",
      });

      fetchProducts();

    } else {

      alert(error.message);
    }
  };

  // =========================
  // FILTER
  // =========================

  const filteredProducts = products.filter(
    (p) =>
      p.name
        ?.toLowerCase()
        .includes(searchTerm.toLowerCase()) ||

      p.barcode
        ?.toString()
        .includes(searchTerm)
  );

  // =========================
  // UI
  // =========================

  return (

    <div
      className="min-h-screen bg-slate-50 p-6"
      dir="rtl"
    >

      {/* INPUT مخفي لسكانر USB */}

      <input
        ref={scannerInputRef}
        type="text"
        value={scannerValue}
        onChange={(e) =>
          setScannerValue(e.target.value)
        }
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            handleScannerInput(scannerValue);
          }
        }}
        className="opacity-0 absolute pointer-events-none"
      />

      <div className="max-w-7xl mx-auto">

        {/* HEADER */}

        <div className="bg-white p-5 rounded-3xl shadow mb-6 flex justify-between items-center">

          <div>
            <h1 className="text-3xl font-black">
              إدارة المخزن
            </h1>

            <p className="text-slate-500 font-bold mt-1">
              نظام باركود احترافي
            </p>
          </div>

          <div className="flex gap-3">

            <Link
              href="/"
              className="bg-slate-200 px-5 py-3 rounded-2xl font-bold"
            >
              الرئيسية
            </Link>

            <button
              onClick={startScanner}
              className="bg-indigo-600 text-white px-5 py-3 rounded-2xl font-bold"
            >
              📷 سكان بالكاميرا
            </button>

            <button
              onClick={() => setIsModalOpen(true)}
              className="bg-emerald-600 text-white px-5 py-3 rounded-2xl font-bold"
            >
              + إضافة صنف
            </button>

          </div>

        </div>

        {/* SEARCH */}

        <div className="bg-white p-4 rounded-3xl shadow mb-6">

          <input
            type="text"
            placeholder="بحث بالاسم أو الباركود..."
            className="w-full p-4 border rounded-2xl font-bold outline-none"
            value={searchTerm}
            onChange={(e) =>
              setSearchTerm(e.target.value)
            }
          />

        </div>

        {/* TABLE */}

        <div className="bg-white rounded-3xl shadow overflow-hidden">

          <table className="w-full text-sm">

            <thead className="bg-slate-900 text-white">

              <tr>

                <th className="p-4">الصنف</th>
                <th className="p-4">الوحدة</th>
                <th className="p-4">الكمية</th>
                <th className="p-4">شراء</th>
                <th className="p-4">بيع</th>
                <th className="p-4">باركود</th>
                <th className="p-4">إجراءات</th>

              </tr>

            </thead>

            <tbody>

              {loading ? (

                <tr>
                  <td
                    colSpan={7}
                    className="p-10 text-center"
                  >
                    جاري التحميل...
                  </td>
                </tr>

              ) : filteredProducts.map((p) => (

                <tr
                  key={p.id}
                  className="border-b hover:bg-slate-50"
                >

                  {editingId === p.id ? (

                    <>

                      <td className="p-2">
                        <input
                          value={editForm.name}
                          onChange={(e) =>
                            setEditForm({
                              ...editForm,
                              name: e.target.value,
                            })
                          }
                          className="w-full border p-2 rounded"
                        />
                      </td>

                      <td className="p-2">

                        <select
                          value={editForm.unit}
                          onChange={(e) =>
                            setEditForm({
                              ...editForm,
                              unit: e.target.value,
                            })
                          }
                          className="w-full border p-2 rounded"
                        >
                          <option>كيلو</option>
                          <option>لتر</option>
                          <option>عبوة</option>
                          <option>كرتونة</option>
                        </select>

                      </td>

                      <td className="p-2">
                        <input
                          type="number"
                          value={editForm.stock_quantity}
                          onChange={(e) =>
                            setEditForm({
                              ...editForm,
                              stock_quantity:
                                e.target.value,
                            })
                          }
                          className="w-full border p-2 rounded"
                        />
                      </td>

                      <td className="p-2">
                        <input
                          type="number"
                          value={editForm.purchase_price}
                          onChange={(e) =>
                            setEditForm({
                              ...editForm,
                              purchase_price:
                                e.target.value,
                            })
                          }
                          className="w-full border p-2 rounded"
                        />
                      </td>

                      <td className="p-2">
                        <input
                          type="number"
                          value={editForm.sale_price}
                          onChange={(e) =>
                            setEditForm({
                              ...editForm,
                              sale_price:
                                e.target.value,
                            })
                          }
                          className="w-full border p-2 rounded"
                        />
                      </td>

                      <td className="p-2">

                        <input
                          value={editForm.barcode}
                          onChange={(e) =>
                            setEditForm({
                              ...editForm,
                              barcode:
                                e.target.value,
                            })
                          }
                          className="w-full border p-2 rounded font-mono"
                        />

                      </td>

                      <td className="p-2">

                        <div className="flex gap-2 justify-center">

                          <button
                            onClick={saveEdit}
                            className="bg-emerald-500 text-white px-3 py-1 rounded-lg"
                          >
                            حفظ
                          </button>

                          <button
                            onClick={() =>
                              setEditingId(null)
                            }
                            className="bg-slate-300 px-3 py-1 rounded-lg"
                          >
                            إلغاء
                          </button>

                        </div>

                      </td>

                    </>

                  ) : (

                    <>

                      <td className="p-4 font-bold">
                        {p.name}
                      </td>

                      <td className="p-4">
                        {p.unit}
                      </td>

                      <td
                        className={`p-4 font-bold ${
                          p.stock_quantity <= 5
                            ? "text-red-600"
                            : "text-emerald-600"
                        }`}
                      >
                        {p.stock_quantity}
                      </td>

                      <td className="p-4">
                        {p.purchase_price}
                      </td>

                      <td className="p-4">
                        {p.sale_price}
                      </td>

                      <td className="p-4">

                        <button
                          onClick={() =>
                            openBarcodeView(p)
                          }
                          className="bg-indigo-100 text-indigo-700 px-3 py-2 rounded-xl text-xs font-bold"
                        >
                          🏷️ عرض
                        </button>

                      </td>

                      <td className="p-4">

                        <div className="flex gap-2 justify-center">

                          <button
                            onClick={() =>
                              startEdit(p)
                            }
                            className="text-blue-600 font-bold"
                          >
                            ✏️ تعديل
                          </button>

                        </div>

                      </td>

                    </>

                  )}

                </tr>

              ))}

            </tbody>

          </table>

        </div>

      </div>

      {/* مودال إضافة */}

      {isModalOpen && (

        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">

          <div className="bg-white rounded-3xl p-6 w-full max-w-md">

            <h2 className="text-2xl font-black mb-6 text-center">
              إضافة صنف
            </h2>

            <div className="space-y-4">

              <input
                placeholder="اسم الصنف"
                value={newProduct.name}
                onChange={(e) =>
                  setNewProduct({
                    ...newProduct,
                    name: e.target.value,
                  })
                }
                className="w-full border p-4 rounded-2xl"
              />

              <input
                placeholder="الباركود"
                value={newProduct.barcode}
                onChange={(e) =>
                  setNewProduct({
                    ...newProduct,
                    barcode: e.target.value,
                  })
                }
                className="w-full border p-4 rounded-2xl font-mono"
              />

              <input
                type="number"
                placeholder="الكمية"
                value={newProduct.stock_quantity}
                onChange={(e) =>
                  setNewProduct({
                    ...newProduct,
                    stock_quantity:
                      e.target.value,
                  })
                }
                className="w-full border p-4 rounded-2xl"
              />

              <input
                type="number"
                placeholder="سعر الشراء"
                value={newProduct.purchase_price}
                onChange={(e) =>
                  setNewProduct({
                    ...newProduct,
                    purchase_price:
                      e.target.value,
                  })
                }
                className="w-full border p-4 rounded-2xl"
              />

              <input
                type="number"
                placeholder="سعر البيع"
                value={newProduct.sale_price}
                onChange={(e) =>
                  setNewProduct({
                    ...newProduct,
                    sale_price:
                      e.target.value,
                  })
                }
                className="w-full border p-4 rounded-2xl"
              />

              <button
                onClick={handleAddProduct}
                className="w-full bg-emerald-600 text-white py-4 rounded-2xl font-bold"
              >
                حفظ المنتج ✅
              </button>

              <button
                onClick={() =>
                  setIsModalOpen(false)
                }
                className="w-full bg-slate-200 py-4 rounded-2xl font-bold"
              >
                إلغاء
              </button>

            </div>

          </div>

        </div>

      )}

      {/* مودال الكاميرا */}

      {isScannerOpen && (

        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">

          <div className="bg-white p-4 rounded-3xl w-full max-w-md">

            <h2 className="font-black text-center mb-4">
              وجه الكاميرا للباركود
            </h2>

            <video
              ref={videoRef}
              className="w-full rounded-2xl"
              playsInline
            />

            <button
              onClick={stopScanner}
              className="w-full bg-rose-500 text-white py-4 rounded-2xl mt-4 font-bold"
            >
              إغلاق
            </button>

          </div>

        </div>

      )}

      {/* مودال عرض الباركود */}

      {isBarcodeViewOpen && barcodeProduct && (

        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">

          <div className="bg-white p-6 rounded-3xl w-full max-w-md text-center">

            <h2 className="text-2xl font-black mb-2">
              {barcodeProduct.name}
            </h2>

            <div className="bg-white border rounded-2xl p-4 mb-4">

              <canvas ref={barcodeCanvasRef} />

            </div>

            <p className="font-mono text-sm mb-6">
              {barcodeProduct.barcode}
            </p>

            <div className="flex gap-3">

              <button
                onClick={printBarcode}
                className="flex-1 bg-slate-900 text-white py-4 rounded-2xl font-bold"
              >
                🖨️ طباعة
              </button>

              <button
                onClick={() =>
                  setIsBarcodeViewOpen(false)
                }
                className="flex-1 bg-slate-200 py-4 rounded-2xl font-bold"
              >
                إغلاق
              </button>

            </div>

          </div>

        </div>

      )}

    </div>
  );
}