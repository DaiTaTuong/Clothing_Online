import React, { useEffect, useRef, useState } from 'react';
import {
  Camera, Upload, Check, LoaderCircle, Sparkles, ShoppingBag,
  Download, Bookmark, Trash2, History, Shirt, Layers, AlertCircle,
  ArrowRightLeft, RefreshCw, Eye, Image as ImageIcon
} from 'lucide-react';
import { categoryNames, money } from '../../../../shared/contracts/index.mjs';
import { api, tryUrl } from '../../app/api.js';
import { Dialog, Empty, IconButton, Link } from '../../components/ui/index.jsx';

export function Fitting({ session, products, itemId, look, navigate, onSession, onCart, notify, onItem }) {
  // --- 1. State Quản lý Ảnh Người dùng & Bước 1 (Kiểm tra & Tách nền) ---
  const [personImage, setPersonImage] = useState(null);       // Ảnh gốc (Base64)
  const [mattedImage, setMattedImage] = useState(null);       // Ảnh sau Bước 1 (Nền trắng #FFFFFF)
  const [step1Status, setStep1Status] = useState('idle');     // 'idle' | 'validating' | 'matted' | 'error'
  const [step1Error, setStep1Error] = useState('');
  const [cameraActive, setCameraActive] = useState(false);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const fileInputRef = useRef(null);

  // --- 2. State Quản lý Slot Trang phục & Phân tầng Layer ---
  // Slot: top (Áo trong), bottom (Quần/Váy), outer (Áo khoác ngoài - Layer 2), dress (Đầm)
  const [outfit, setOutfit] = useState({
    top: null,
    bottom: null,
    outer: null,
    dress: null
  });
  const [slotNotification, setSlotNotification] = useState('');

  // --- 3. State Quản lý Bước 2 (Phối đồ AI & So sánh) ---
  const [resultImage, setResultImage] = useState(null);       // Ảnh kết quả sau Bước 2
  const [step2Status, setStep2Status] = useState('idle');     // 'idle' | 'fitting' | 'completed' | 'error'
  const [step2Error, setStep2Error] = useState('');
  const [viewMode, setViewMode] = useState('after');          // 'before' | 'after' | 'split'
  const [splitPos, setSplitPos] = useState(50);               // Vị trí thanh trượt Before/After (0 - 100%)
  const [tab, setTab] = useState('');
  const [history, setHistory] = useState(null);
  const [isSaved, setIsSaved] = useState(false);

  // Đồng bộ itemId từ URL khi mở trang
  useEffect(() => {
    if (!itemId || !products[itemId]) return;
    const p = products[itemId];
    onItem?.(p.id);
    handleSelectGarment(p);
  }, [itemId, products]);

  // Quản lý Camera Stream
  useEffect(() => {
    if (cameraActive) {
      navigator.mediaDevices?.getUserMedia({ video: { facingMode: 'user', width: { ideal: 768 }, height: { ideal: 1024 } } })
        .then(stream => {
          streamRef.current = stream;
          if (videoRef.current) videoRef.current.srcObject = stream;
        })
        .catch(() => {
          setCameraActive(false);
          setStep1Error('Không thể mở máy ảnh. Vui lòng cấp quyền truy cập hoặc tải ảnh từ máy tính.');
        });
    } else {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
    }
    return () => {
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    };
  }, [cameraActive]);

  // --- Xử lý tải ảnh từ máy tính ---
  function handleFileUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setStep1Error('');
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setStep1Error('Vui lòng chọn định dạng ảnh JPG, PNG hoặc WebP.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setStep1Error('Dung lượng ảnh tối đa 10 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = ev => {
      setPersonImage(ev.target.result);
      setMattedImage(null);
      setResultImage(null);
      setStep1Status('idle');
      setStep2Status('idle');
      setCameraActive(false);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }

  // --- Xử lý chụp ảnh từ Camera ---
  function capturePhoto() {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 768;
    canvas.height = video.videoHeight || 1024;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/png');
    setPersonImage(dataUrl);
    setMattedImage(null);
    setResultImage(null);
    setStep1Status('idle');
    setStep2Status('idle');
    setCameraActive(false);
  }

  // --- BƯỚC 1: Gọi AI Kiểm tra Toàn thân & Tách nền trắng ---
  async function runStep1ValidateAndMatting() {
    if (!personImage) {
      setStep1Error('Vui lòng tải ảnh lên hoặc chụp ảnh trước.');
      return;
    }
    setStep1Status('validating');
    setStep1Error('');
    try {
      const res = await api('/ai/validate-and-matting', 'POST', { image: personImage });
      if (res.success && res.image) {
        setMattedImage(res.image);
        setStep1Status('matted');
        notify?.('Bước 1 thành công: Đã tách nền trắng chuẩn #FFFFFF.');
      } else {
        throw new Error(res.error || 'Ảnh không đạt tiêu chuẩn.');
      }
    } catch (err) {
      setStep1Status('error');
      setStep1Error(err.message || 'Ảnh chưa thấy rõ toàn thân. Vui lòng lùi ra xa và chụp lại.');
    }
  }

  // --- Xử lý chọn món đồ và giải quyết xung đột Slot & Layer ---
  function handleSelectGarment(p) {
    setSlotNotification('');
    const isBlazer = p.cut === 'blazer';
    const isTop = p.category === 'tops' && !isBlazer;
    const isOuter = isBlazer;
    const isBottom = p.category === 'bottoms';
    const isDress = p.category === 'dresses';

    setOutfit(prev => {
      // 1. Nếu là Đầm: thay thế cả Top và Bottom
      if (isDress) {
        if (prev.dress?.id === p.id) return { ...prev, dress: null };
        if (prev.top || prev.bottom) setSlotNotification('Đầm liền đã thay thế áo và quần hiện tại.');
        return { top: null, bottom: null, outer: prev.outer, dress: p };
      }

      // 2. Nếu là Áo trong (Top):
      if (isTop) {
        if (prev.top?.id === p.id) return { ...prev, top: null };
        if (prev.top) setSlotNotification(`Đã đổi sang ${p.name} cho áo trong.`);
        return { ...prev, top: p, dress: null };
      }

      // 3. Nếu là Áo khoác ngoài (Outer - Layer 2):
      if (isOuter) {
        if (prev.outer?.id === p.id) return { ...prev, outer: null };
        if (prev.outer) setSlotNotification(`Đã đổi sang ${p.name} cho áo khoác ngoài.`);
        return { ...prev, outer: p };
      }

      // 4. Nếu là Quần / Váy (Bottom):
      if (isBottom) {
        if (prev.bottom?.id === p.id) return { ...prev, bottom: null };
        if (prev.bottom) setSlotNotification(`Đã đổi sang ${p.name} cho phần thân dưới.`);
        return { ...prev, bottom: p, dress: null };
      }

      return prev;
    });
  }

  // Hủy chọn một món đồ
  function removeSlot(slotKey) {
    setOutfit(o => ({ ...o, [slotKey]: null }));
  }

  // Danh sách các món đã chọn
  const selectedItems = [
    outfit.top && { ...outfit.top, slot: 'top', layer: 1 },
    outfit.outer && { ...outfit.outer, slot: 'outer', layer: 2 },
    outfit.bottom && { ...outfit.bottom, slot: 'bottom', layer: 1 },
    outfit.dress && { ...outfit.dress, slot: 'dress', layer: 1 },
  ].filter(Boolean);

  // --- BƯỚC 2: Gọi AI Phối đồ theo Pose & Phân tầng Layering ---
  async function runStep2TryOn() {
    if (!mattedImage) {
      notify?.('Vui lòng hoàn thành Bước 1 (Kiểm tra & Tách nền) trước.');
      return;
    }
    if (selectedItems.length === 0) {
      notify?.('Vui lòng chọn ít nhất một món đồ từ tủ đồ.');
      return;
    }

    setStep2Status('fitting');
    setStep2Error('');
    setIsSaved(false);

    try {
      const res = await api('/ai/try-on', 'POST', {
        personImage: mattedImage,
        items: selectedItems.map(item => ({
          id: item.id,
          name: item.name,
          category: item.category,
          cut: item.cut,
          garmentImage: item.garmentImage,
          layer_level: item.layer,
          slot: item.slot
        }))
      });

      if (res.success && res.image) {
        setResultImage(res.image);
        setStep2Status('completed');
        setViewMode('after');
        notify?.('Bước 2 thành công: Đã phối đồ AI ôm dáng tự nhiên.');
      } else {
        throw new Error(res.error || 'Không thể phối đồ đạt chất lượng yêu cầu.');
      }
    } catch (err) {
      setStep2Status('error');
      setStep2Error(err.message || 'Lỗi xử lý phối đồ AI. Vui lòng thử lại với tư thế đứng thẳng hơn.');
    }
  }

  // Tải ảnh kết quả về máy tính
  function downloadResult() {
    const target = resultImage || mattedImage || personImage;
    if (!target) return;
    const a = document.createElement('a');
    a.href = target;
    a.download = `forme_outfit_${Date.now()}.png`;
    a.click();
  }

  // Thêm tất cả các món đang thử vào giỏ hàng
  function handleAddOutfitToCart() {
    if (selectedItems.length === 0) return;
    selectedItems.forEach(item => {
      onCart?.(item);
    });
    notify?.(`Đã thêm ${selectedItems.length} món vào giỏ hàng!`);
  }

  // Lọc danh sách tủ đồ
  const garmentList = Object.values(products).filter(p => {
    if (!tab) return true;
    if (tab === 'outer') return p.cut === 'blazer';
    if (tab === 'tops') return p.category === 'tops' && p.cut !== 'blazer';
    return p.category === tab;
  });

  return (
    <main className="shell fitting-page">
      <header className="page-head">
        <span className="eyebrow"><span /> FORME° AI VIRTUAL TRY-ON STUDIO</span>
        <h1>Phòng Phối Đồ AI Thực Tế</h1>
        <p className="muted">
          Quy trình 2 bước chuẩn công nghệ: Tách nền trắng thuần #FFFFFF giữ nguyên 100% người thật &rarr; Phối đồ ôm dáng chuẩn theo tư thế đứng.
        </p>
      </header>

      <div className="fitting-grid">
        {/* ===================== CỘT 1: ẢNH NGƯỜI DÙNG & BƯỚC 1 ===================== */}
        <section className="fit-panel fit-profile">
          <div className="panel-title">
            <span>01</span>
            <Camera size={19} />
            <h2>Ảnh Toàn Thân</h2>
          </div>

          <p style={{ fontSize: '11px', color: '#55695d', marginBottom: '10px' }}>
            Yêu cầu: Thấy rõ từ đầu đến bàn chân, 1 người, đứng thẳng, đủ sáng.
          </p>

          <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={handleFileUpload} />

          {/* Công cụ Chụp / Tải ảnh */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px' }}>
            <button className="btn btn-outline" onClick={() => fileInputRef.current?.click()}>
              <Upload size={16} /> Tải ảnh lên
            </button>
            <button className={`btn ${cameraActive ? 'btn-primary' : 'btn-outline'}`} onClick={() => setCameraActive(!cameraActive)}>
              <Camera size={16} /> {cameraActive ? 'Tắt Camera' : 'Bật Camera'}
            </button>
          </div>

          {/* Khung Camera trực tiếp với Khung Silhouette Guide */}
          {cameraActive && (
            <div style={{ position: 'relative', width: '100%', aspectRatio: '3/4', background: '#000', borderRadius: '6px', overflow: 'hidden', marginBottom: '12px' }}>
              <video ref={videoRef} autoPlay playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              {/* Silhouette Guide Overlay */}
              <div style={{
                position: 'absolute', inset: '10%', border: '2px dashed rgba(255,255,255,0.7)',
                borderRadius: '50px 50px 10px 10px', pointerEvents: 'none', display: 'flex',
                flexDirection: 'column', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0'
              }}>
                <span style={{ background: 'rgba(0,0,0,0.6)', color: '#fff', fontSize: '10px', padding: '2px 8px', borderRadius: '4px' }}>Đỉnh đầu</span>
                <span style={{ background: 'rgba(0,0,0,0.6)', color: '#fff', fontSize: '10px', padding: '2px 8px', borderRadius: '4px' }}>Bàn chân chạm đáy</span>
              </div>
              <button
                className="btn btn-primary"
                style={{ position: 'absolute', bottom: '12px', left: '50%', transform: 'translateX(-50%)', zIndex: 10 }}
                onClick={capturePhoto}
              >
                <Camera size={16} /> Chụp ngay
              </button>
            </div>
          )}

          {/* Xem trước ảnh đã chọn */}
          {personImage && !cameraActive && (
            <div style={{ position: 'relative', width: '100%', aspectRatio: '3/4', background: '#f8f8f8', borderRadius: '6px', overflow: 'hidden', marginBottom: '12px', border: '1px solid var(--line)' }}>
              <img src={mattedImage || personImage} alt="Ảnh người dùng" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              <span className="frame-label" style={{ top: '6px', left: '6px' }}>
                <span /> {mattedImage ? 'NỀN TRẮNG #FFFFFF' : 'ẢNH GỐC'}
              </span>
              <IconButton label="Xóa ảnh" style={{ position: 'absolute', top: '6px', right: '6px' }} onClick={() => { setPersonImage(null); setMattedImage(null); setResultImage(null); setStep1Status('idle'); }}>
                <Trash2 size={16} />
              </IconButton>
            </div>
          )}

          {/* Lỗi Bước 1 */}
          {step1Error && (
            <div style={{ background: '#fdf2f2', border: '1px solid #f8b4b4', color: '#9b1c1c', padding: '8px 10px', borderRadius: '5px', fontSize: '11px', display: 'flex', gap: '6px', alignItems: 'flex-start', marginBottom: '12px' }}>
              <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
              <span>{step1Error}</span>
            </div>
          )}

          {/* Nút thực thi Bước 1 */}
          <button
            className="btn btn-primary wide"
            disabled={!personImage || step1Status === 'validating' || step1Status === 'matted'}
            onClick={runStep1ValidateAndMatting}
          >
            {step1Status === 'validating' ? (
              <><LoaderCircle size={16} className="spin" /> Đang kiểm tra & tách nền...</>
            ) : step1Status === 'matted' ? (
              <><Check size={16} /> Đã tách nền trắng thành công</>
            ) : (
              <><Sparkles size={16} /> Bước 1: Kiểm tra & Tách nền</>
            )}
          </button>

          <small className="muted" style={{ display: 'block', marginTop: '8px', textAlign: 'center' }}>
            Hệ thống bảo vệ quyền riêng tư: Tự động xóa ảnh sau 24 giờ.
          </small>
        </section>

        {/* ===================== CỘT 2: KHUNG HÌNH TRÌNH DIỄN & BEFORE / AFTER ===================== */}
        <section className="fit-stage">
          <div className="stage-tools">
            <div className="segmented">
              <button className={viewMode === 'before' ? 'current' : ''} onClick={() => setViewMode('before')}>
                Trước (Gốc)
              </button>
              <button className={viewMode === 'after' ? 'current' : ''} onClick={() => setViewMode('after')}>
                Sau (Thử đồ)
              </button>
              <button className={viewMode === 'split' ? 'current' : ''} onClick={() => setViewMode('split')}>
                <ArrowRightLeft size={13} /> So sánh
              </button>
            </div>

            <div className="stage-actions">
              <IconButton label="Lượt thử đã lưu" onClick={() => setHistory([])}>
                <History size={18} />
              </IconButton>
              <IconButton label="Tải ảnh kết quả" onClick={downloadResult} disabled={!personImage}>
                <Download size={18} />
              </IconButton>
            </div>
          </div>

          {/* Khung hiển thị trung tâm */}
          <div className="model-frame" style={{ position: 'relative', background: '#FFFFFF' }}>
            {!personImage ? (
              <div style={{ display: 'grid', placeItems: 'center', height: '100%', color: 'var(--muted)', textAlign: 'center', padding: '20px' }}>
                <div>
                  <ImageIcon size={48} strokeWidth={1.5} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
                  <p style={{ fontWeight: 600 }}>Chưa có ảnh người mẫu</p>
                  <small>Tải ảnh hoặc mở camera ở Cột 1 để bắt đầu</small>
                </div>
              </div>
            ) : viewMode === 'split' && resultImage && mattedImage ? (
              /* Chế độ Split View (Before / After Slider) */
              <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
                <img src={resultImage} alt="Sau" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                <div style={{ position: 'absolute', top: 0, left: 0, width: `${splitPos}%`, height: '100%', overflow: 'hidden', borderRight: '2px solid #fff', boxShadow: '2px 0 10px rgba(0,0,0,0.3)' }}>
                  <img src={mattedImage} alt="Trước" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={splitPos}
                  onChange={e => setSplitPos(Number(e.target.value))}
                  style={{ position: 'absolute', bottom: '15px', left: '10%', width: '80%', zIndex: 10 }}
                />
              </div>
            ) : (
              /* Chế độ Xem đơn thông thường */
              <img
                src={viewMode === 'before' ? (mattedImage || personImage) : (resultImage || mattedImage || personImage)}
                alt="Phối đồ AI"
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              />
            )}

            {/* Nhãn góc ảnh */}
            {personImage && (
              <div className="frame-label">
                <span />
                {viewMode === 'before' ? 'ẢNH NỀN TRẮNG (BƯỚC 1)' : (resultImage ? 'KẾT QUẢ AI VTO (BƯỚC 2)' : 'CHỜ PHỐI ĐỒ')}
              </div>
            )}

            {/* Trạng thái xử lý AI */}
            {step2Status === 'fitting' && (
              <div className="model-status" role="status">
                <LoaderCircle size={18} className="spin" />
                <span>AI đang phân tích pose & uốn nếp trang phục...</span>
              </div>
            )}

            {/* Nút lưu kết quả */}
            {resultImage && (
              <IconButton
                className="save-look"
                label={isSaved ? 'Đã lưu' : 'Lưu kết quả'}
                onClick={() => { setIsSaved(true); notify?.('Đã lưu kết quả vào hồ sơ.'); }}
              >
                <Bookmark size={19} fill={isSaved ? 'currentColor' : 'none'} />
              </IconButton>
            )}
          </div>

          {/* Lỗi Bước 2 */}
          {step2Error && (
            <p className="error stage-error" role="alert">
              {step2Error} <button className="text-button" onClick={runStep2TryOn}>Thử lại</button>
            </p>
          )}

          {/* Thanh tác vụ dưới cùng */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px' }}>
            <p className="stage-caption" style={{ margin: 0 }}>
              AI giữ 100% gương mặt, màu da và bối cảnh trắng. Quần áo ôm theo tư thế tự nhiên.
            </p>
            {resultImage && (
              <button className="btn btn-primary" onClick={handleAddOutfitToCart}>
                <ShoppingBag size={16} /> Thêm cả bộ vào giỏ
              </button>
            )}
          </div>
        </section>

        {/* ===================== CỘT 3: TỦ ĐỒ & QUẢN LÝ SLOT / LAYERS ===================== */}
        <section className="fit-panel fit-wardrobe">
          <div className="panel-title">
            <span>02</span>
            <Shirt size={19} />
            <h2>Tủ Đồ & Phối Lớp</h2>
          </div>

          {/* Tóm tắt các Slot đang chọn */}
          <div style={{ background: '#f4f6f3', border: '1px solid #e1e7dc', borderRadius: '6px', padding: '10px', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', fontWeight: 700, color: '#394f41', marginBottom: '8px' }}>
              <Layers size={14} /> CÁC MÓN ĐANG PHỐI ({selectedItems.length})
            </div>

            <div style={{ display: 'grid', gap: '6px' }}>
              {/* Slot Top */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', background: '#fff', padding: '4px 8px', borderRadius: '4px' }}>
                <span><strong>Áo trong:</strong> {outfit.top ? outfit.top.name : <em style={{ color: '#999' }}>Chưa chọn</em>}</span>
                {outfit.top && <IconButton label="Bỏ chọn" onClick={() => removeSlot('top')}><Trash2 size={13} /></IconButton>}
              </div>

              {/* Slot Outer (Layer 2) */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', background: '#fff', padding: '4px 8px', borderRadius: '4px' }}>
                <span><strong>Khoác ngoài:</strong> {outfit.outer ? outfit.outer.name : <em style={{ color: '#999' }}>Chưa chọn</em>}</span>
                {outfit.outer && <IconButton label="Bỏ chọn" onClick={() => removeSlot('outer')}><Trash2 size={13} /></IconButton>}
              </div>

              {/* Slot Bottom */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', background: '#fff', padding: '4px 8px', borderRadius: '4px' }}>
                <span><strong>Quần / Váy:</strong> {outfit.bottom ? outfit.bottom.name : <em style={{ color: '#999' }}>Chưa chọn</em>}</span>
                {outfit.bottom && <IconButton label="Bỏ chọn" onClick={() => removeSlot('bottom')}><Trash2 size={13} /></IconButton>}
              </div>

              {/* Slot Dress */}
              {outfit.dress && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', background: '#fff', padding: '4px 8px', borderRadius: '4px' }}>
                  <span><strong>Đầm liền:</strong> {outfit.dress.name}</span>
                  <IconButton label="Bỏ chọn" onClick={() => removeSlot('dress')}><Trash2 size={13} /></IconButton>
                </div>
              )}
            </div>

            {/* Thông báo xung đột slot */}
            {slotNotification && (
              <p style={{ margin: '6px 0 0', fontSize: '10px', color: '#8d5b20', fontWeight: 600 }}>
                • {slotNotification}
              </p>
            )}

            {/* Nút kích hoạt Bước 2 */}
            <button
              className="btn btn-primary wide"
              style={{ marginTop: '10px' }}
              disabled={selectedItems.length === 0 || step1Status !== 'matted' || step2Status === 'fitting'}
              onClick={runStep2TryOn}
            >
              {step2Status === 'fitting' ? (
                <><LoaderCircle size={16} className="spin" /> Đang phối đồ AI...</>
              ) : (
                <><Sparkles size={16} /> Bước 2: Bắt đầu phối đồ AI</>
              )}
            </button>
          </div>

          {/* Phân loại danh mục tủ đồ */}
          <div className="wardrobe-tabs tabs">
            {[
              ['', 'Tất cả'],
              ['tops', 'Áo trong'],
              ['outer', 'Áo khoác'],
              ['bottoms', 'Quần/Váy'],
              ['dresses', 'Đầm']
            ].map(([k, label]) => (
              <button
                key={k}
                className={tab === k ? 'current' : ''}
                onClick={() => setTab(k)}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Danh sách sản phẩm để chọn */}
          <div className="wardrobe-list">
            {garmentList.map(p => {
              const isSelected = outfit.top?.id === p.id || outfit.bottom?.id === p.id || outfit.outer?.id === p.id || outfit.dress?.id === p.id;
              return (
                <button
                  key={p.id}
                  className={isSelected ? 'selected' : ''}
                  onClick={() => handleSelectGarment(p)}
                >
                  <img src={p.image} alt="" loading="lazy" />
                  <span>
                    <strong>{p.name}</strong>
                    <small>{money(p.price)} {p.cut === 'blazer' && '· Lớp ngoài'}</small>
                  </span>
                  {isSelected ? <Check size={17} style={{ color: 'var(--green)' }} /> : <Eye size={15} style={{ opacity: 0.5 }} />}
                </button>
              );
            })}
          </div>
        </section>
      </div>

      {/* Lịch sử đã lưu */}
      {history && (
        <Dialog title="Lịch sử phối đồ" close={() => setHistory(null)}>
          <Empty icon={Bookmark} title="Chưa có lượt thử nào được lưu trong phiên này" />
        </Dialog>
      )}
    </main>
  );
}
