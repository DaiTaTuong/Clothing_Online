import React, { useEffect, useRef, useState } from 'react';
import {
  Camera, Upload, Check, LoaderCircle, Sparkles, ShoppingBag,
  Download, Bookmark, Trash2, History, Shirt, Layers, AlertCircle,
  ArrowRightLeft, Eye, Image as ImageIcon, Timer, Sun
} from 'lucide-react';
import { fitSize, money } from '../../../../shared/contracts/index.mjs';
import { api } from '../../app/api.js';
import { Dialog, Empty, IconButton } from '../../components/ui/index.jsx';

function pickDefaultSize(product, profile) {
  const recommended = fitSize(product, profile);
  if (recommended) return recommended;
  return Object.entries(product.stock || {}).find(([, qty]) => qty > 0)?.[0] || 'M';
}

export function Fitting({ session, products, itemId, itemsParam, navigate, onCart, addToCart, notify, onItem }) {
  // --- 1. State Quản lý Ảnh Người dùng & Bước 1 (Kiểm tra & Tách nền) ---
  const [personImage, setPersonImage] = useState(null);
  const [mattedImage, setMattedImage] = useState(null);
  const [framingMode, setFramingMode] = useState('auto'); // 'auto' | 'full_body' | 'half_body' | 'portrait_upper'
  const [detectedFraming, setDetectedFraming] = useState(null); // { framing, label, supportedSlots }
  const [step1Status, setStep1Status] = useState('idle'); // 'idle' | 'validating' | 'matted' | 'error'
  const [step1Error, setStep1Error] = useState('');
  const [tryOnWarnings, setTryOnWarnings] = useState([]);
  const [cameraActive, setCameraActive] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [lightStatus, setLightStatus] = useState('checking'); // 'checking' | 'good' | 'low'
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const fileInputRef = useRef(null);
  const timerRef = useRef(null);

  // --- 2. State Quản lý Slot Trang phục, Size & Phân tầng Layer ---
  const [outfit, setOutfit] = useState({ top: null, bottom: null, outer: null, dress: null });
  const [sizes, setSizes] = useState({});
  const [slotNotification, setSlotNotification] = useState('');

  // --- 3. State Quản lý Bước 2 (Phối đồ AI, Lưu & Lịch sử) ---
  const [resultImage, setResultImage] = useState(null);
  const [resultJobId, setResultJobId] = useState(null);
  const [step2Status, setStep2Status] = useState('idle'); // 'idle' | 'fitting' | 'completed' | 'error'
  const [step2Error, setStep2Error] = useState('');
  const [viewMode, setViewMode] = useState('after'); // 'before' | 'after' | 'split'
  const [splitPos, setSplitPos] = useState(50);
  const [tab, setTab] = useState('');
  const [history, setHistory] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [addingSet, setAddingSet] = useState(false);

  // Đồng bộ ?item_id=... hoặc ?items=id1,id2 từ URL (Shop / Chatbot "Phối cả set này")
  useEffect(() => {
    if (!products || Object.keys(products).length === 0) return;
    if (itemsParam) {
      const ids = itemsParam.split(',').map(s => s.trim()).filter(id => products[id]);
      if (ids.length > 0) {
        const next = { top: null, bottom: null, outer: null, dress: null };
        for (const id of ids) {
          const p = products[id];
          if (p.category === 'dresses') { next.top = null; next.bottom = null; next.dress = p; }
          else if (p.cut === 'blazer') next.outer = p;
          else if (p.category === 'bottoms') { next.bottom = p; next.dress = null; }
          else { next.top = p; next.dress = null; }
        }
        setOutfit(next);
        onItem?.(ids[0]);
        setSlotNotification(`Đã nạp sẵn set ${ids.length} món từ Stylist.`);
        return;
      }
    }
    if (itemId && products[itemId]) {
      const p = products[itemId];
      onItem?.(p.id);
      handleSelectGarment(p);
    }
  }, [itemId, itemsParam, products]);

  // Quản lý Camera Stream + kiểm tra độ sáng realtime
  useEffect(() => {
    if (!cameraActive) {
      clearInterval(timerRef.current);
      setCountdown(0);
      setLightStatus('checking');
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
      return;
    }

    let cancelled = false;
    navigator.mediaDevices?.getUserMedia({
      video: { facingMode: 'user', width: { ideal: 768 }, height: { ideal: 1024 } }
    })
      .then(stream => {
        if (cancelled) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      })
      .catch(() => {
        if (!cancelled) {
          setCameraActive(false);
          setStep1Error('Không thể mở máy ảnh. Vui lòng cấp quyền truy cập hoặc tải ảnh từ máy tính.');
        }
      });

    const probeCanvas = document.createElement('canvas');
    probeCanvas.width = 64;
    probeCanvas.height = 64;
    const probeCtx = probeCanvas.getContext('2d', { willReadFrequently: true });
    const lightInterval = setInterval(() => {
      const video = videoRef.current;
      if (!video || video.readyState < 2) return;
      probeCtx.drawImage(video, 0, 0, 64, 64);
      const pixels = probeCtx.getImageData(0, 0, 64, 64).data;
      let sum = 0;
      for (let i = 0; i < pixels.length; i += 4) {
        sum += 0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2];
      }
      const avg = sum / (pixels.length / 4);
      setLightStatus(avg < 55 ? 'low' : 'good');
    }, 600);

    return () => {
      cancelled = true;
      clearInterval(lightInterval);
      clearInterval(timerRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
    };
  }, [cameraActive]);

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
      setResultJobId(null);
      setIsSaved(false);
      setStep1Status('idle');
      setStep2Status('idle');
      setCameraActive(false);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }

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
    setResultJobId(null);
    setIsSaved(false);
    setStep1Status('idle');
    setStep2Status('idle');
    setCountdown(0);
    setCameraActive(false);
  }

  function startCountdownCapture(seconds) {
    clearInterval(timerRef.current);
    setCountdown(seconds);
    let left = seconds;
    timerRef.current = setInterval(() => {
      left -= 1;
      if (left <= 0) {
        clearInterval(timerRef.current);
        capturePhoto();
      } else {
        setCountdown(left);
      }
    }, 1000);
  }

  async function runStep1ValidateAndMatting() {
    if (!personImage) {
      setStep1Error('Vui lòng tải ảnh lên hoặc chụp ảnh trước.');
      return;
    }
    setStep1Status('validating');
    setStep1Error('');
    setTryOnWarnings([]);
    try {
      const payload = { image: personImage };
      if (framingMode !== 'auto') payload.preferredFraming = framingMode;
      const res = await api('/ai/validate-and-matting', 'POST', payload);
      if (res.success && res.image) {
        setMattedImage(res.image);
        setDetectedFraming({
          framing: res.framing || 'full_body',
          label: res.framingLabel || 'Toàn thân',
          supportedSlots: res.supportedSlots || ['top', 'outer', 'bottom', 'dress'],
        });
        setStep1Status('matted');
        notify?.(res.message || 'Bước 1 thành công: Đã tách nền trắng chuẩn #FFFFFF.');
      } else {
        throw new Error(res.error || 'Ảnh không đạt tiêu chuẩn.');
      }
    } catch (err) {
      setStep1Status('error');
      setStep1Error(err.message || 'Chưa nhận diện rõ khuôn mặt trong ảnh. Vui lòng chụp rõ mặt ở nơi đủ sáng.');
    }
  }

  function handleSelectGarment(p) {
    setSlotNotification('');
    const isBlazer = p.cut === 'blazer';
    const isTop = p.category === 'tops' && !isBlazer;
    const isOuter = isBlazer;
    const isBottom = p.category === 'bottoms';
    const isDress = p.category === 'dresses';

    setOutfit(prev => {
      if (isDress) {
        if (prev.dress?.id === p.id) return { ...prev, dress: null };
        if (prev.top || prev.bottom) setSlotNotification('Đầm liền đã thay thế áo và quần hiện tại.');
        return { top: null, bottom: null, outer: prev.outer, dress: p };
      }
      if (isTop) {
        if (prev.top?.id === p.id) return { ...prev, top: null };
        if (prev.top) setSlotNotification(`Đã đổi sang ${p.name} cho áo trong.`);
        return { ...prev, top: p, dress: null };
      }
      if (isOuter) {
        if (prev.outer?.id === p.id) return { ...prev, outer: null };
        if (prev.outer) setSlotNotification(`Đã đổi sang ${p.name} cho áo khoác ngoài.`);
        return { ...prev, outer: p };
      }
      if (isBottom) {
        if (prev.bottom?.id === p.id) return { ...prev, bottom: null };
        if (prev.bottom) setSlotNotification(`Đã đổi sang ${p.name} cho phần thân dưới.`);
        return { ...prev, bottom: p, dress: null };
      }
      return prev;
    });
  }

  function removeSlot(slotKey) {
    setOutfit(o => ({ ...o, [slotKey]: null }));
  }

  const selectedItems = [
    outfit.bottom && { ...outfit.bottom, slot: 'bottom', layer: 1 },
    outfit.top && { ...outfit.top, slot: 'top', layer: 1 },
    outfit.dress && { ...outfit.dress, slot: 'dress', layer: 1 },
    outfit.outer && { ...outfit.outer, slot: 'outer', layer: 2 },
  ].filter(Boolean);

  function chosenSizeFor(item) {
    return sizes[item.id] || pickDefaultSize(item, session?.profile);
  }

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
    setTryOnWarnings([]);
    setIsSaved(false);
    setResultJobId(null);

    try {
      const res = await api('/ai/try-on', 'POST', {
        personImage: mattedImage,
        framing: detectedFraming?.framing || (framingMode !== 'auto' ? framingMode : undefined),
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
        setResultJobId(res.jobId || null);
        setTryOnWarnings(Array.isArray(res.warnings) ? res.warnings : []);
        setStep2Status('completed');
        setViewMode('after');
        notify?.(res.cached ? 'Đã lấy kết quả phối đồ tức thì từ bộ nhớ đệm.' : 'Bước 2 thành công: Đã phối đồ AI hoàn tất.');
      } else {
        throw new Error(res.error || 'Không thể phối đồ đạt chất lượng yêu cầu.');
      }
    } catch (err) {
      setStep2Status('error');
      setStep2Error(err.message || 'Lỗi xử lý phối đồ AI. Vui lòng thử lại với tư thế đứng thẳng hơn.');
    }
  }

  async function handleSaveResult() {
    if (!resultJobId) {
      setIsSaved(true);
      notify?.('Đã lưu tạm trong phiên hiện tại.');
      return;
    }
    try {
      await api(`/try-ons/${resultJobId}`, 'PATCH', {});
      setIsSaved(true);
      notify?.(session?.user ? 'Đã lưu kết quả phối đồ vào tài khoản (30 ngày).' : 'Đã lưu kết quả vào lịch sử phiên (24 giờ).');
    } catch (err) {
      notify?.(err.message || 'Không thể lưu kết quả lúc này.');
    }
  }

  async function openHistory() {
    setHistory([]);
    setHistoryLoading(true);
    try {
      const res = await api('/try-ons');
      setHistory(res.items || []);
    } catch (err) {
      notify?.(err.message || 'Không thể tải lịch sử phối đồ.');
    } finally {
      setHistoryLoading(false);
    }
  }

  function downloadResult() {
    const target = resultImage || mattedImage || personImage;
    if (!target) return;
    const a = document.createElement('a');
    a.href = target;
    a.download = `forme_outfit_${Date.now()}.png`;
    a.click();
  }

  async function handleAddOutfitToCart() {
    if (selectedItems.length === 0 || addingSet) return;
    if (!addToCart) {
      onCart?.(selectedItems[0]);
      return;
    }
    setAddingSet(true);
    let added = 0;
    try {
      for (const item of selectedItems) {
        await addToCart(item, chosenSizeFor(item));
        added += 1;
      }
      notify?.(`Đã thêm trọn bộ ${added} món vào giỏ hàng!`);
    } catch (err) {
      notify?.(err.message || 'Có sản phẩm không đủ tồn kho cho size đã chọn.');
    } finally {
      setAddingSet(false);
    }
  }

  const garmentList = Object.values(products).filter(p => {
    if (!tab) return true;
    if (tab === 'outer') return p.cut === 'blazer';
    if (tab === 'tops') return p.category === 'tops' && p.cut !== 'blazer';
    return p.category === tab;
  });

  function renderSlotRow(label, slotKey, item) {
    return (
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px', fontSize: '11px', background: '#fff', padding: '5px 8px', borderRadius: '4px' }}>
        <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          <strong>{label}:</strong> {item ? item.name : <em style={{ color: '#999' }}>Chưa chọn</em>}
        </span>
        {item && (
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
            <select
              aria-label={`Chọn size cho ${item.name}`}
              value={chosenSizeFor(item)}
              onChange={e => setSizes(prev => ({ ...prev, [item.id]: e.target.value }))}
              style={{ fontSize: '10px', padding: '1px 4px', borderRadius: '3px', border: '1px solid var(--line)' }}
            >
              {Object.entries(item.stock || {}).map(([sz, qty]) => (
                <option key={sz} value={sz} disabled={qty <= 0}>{sz}</option>
              ))}
            </select>
            <IconButton label="Bỏ chọn" onClick={() => removeSlot(slotKey)}><Trash2 size={13} /></IconButton>
          </span>
        )}
      </div>
    );
  }

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
            <h2>Ảnh Của Bạn</h2>
          </div>

          <p style={{ fontSize: '11px', color: '#55695d', marginBottom: '8px' }}>
            Hỗ trợ chụp <strong>toàn thân, nửa người hoặc cận mặt &amp; vai</strong> (bắt buộc thấy rõ khuôn mặt, 1 người, đủ sáng).
          </p>

          {/* Chọn chế độ khung hình */}
          <div className="tabs" style={{ marginBottom: '10px', gap: '4px', flexWrap: 'wrap' }}>
            {[
              ['auto', 'Tự động'],
              ['full_body', 'Toàn thân'],
              ['half_body', 'Nửa người'],
              ['portrait_upper', 'Cận mặt & vai'],
            ].map(([key, label]) => (
              <button
                key={key}
                type="button"
                className={framingMode === key ? 'current' : ''}
                style={{ fontSize: '11px', padding: '4px 8px' }}
                onClick={() => setFramingMode(key)}
              >
                {label}
              </button>
            ))}
          </div>

          <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={handleFileUpload} />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px' }}>
            <button className="btn btn-outline" onClick={() => fileInputRef.current?.click()}>
              <Upload size={16} /> Tải ảnh lên
            </button>
            <button className={`btn ${cameraActive ? 'btn-primary' : 'btn-outline'}`} onClick={() => setCameraActive(!cameraActive)}>
              <Camera size={16} /> {cameraActive ? 'Tắt Camera' : 'Bật Camera'}
            </button>
          </div>

          {cameraActive && (
            <div style={{ position: 'relative', width: '100%', aspectRatio: '3/4', background: '#000', borderRadius: '6px', overflow: 'hidden', marginBottom: '12px' }}>
              <video ref={videoRef} autoPlay playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />

              {/* Trạng thái ánh sáng realtime */}
              <div style={{
                position: 'absolute', top: '8px', left: '8px', zIndex: 10,
                display: 'inline-flex', alignItems: 'center', gap: '4px',
                padding: '3px 8px', borderRadius: '999px', fontSize: '10px', fontWeight: 600,
                background: lightStatus === 'low' ? 'rgba(185, 28, 28, 0.85)' : 'rgba(21, 128, 61, 0.85)',
                color: '#fff'
              }}>
                <Sun size={12} />
                {lightStatus === 'low' ? 'Thiếu sáng — bật thêm đèn' : (lightStatus === 'good' ? 'Ánh sáng tốt ✓' : 'Đang đo sáng...')}
              </div>

              {/* Silhouette Guide Overlay thích ứng theo chế độ chụp */}
              <div style={{
                position: 'absolute',
                inset: framingMode === 'portrait_upper' ? '14% 16% 10%' : '8%',
                border: `2px dashed ${lightStatus === 'low' ? 'rgba(248,113,113,0.85)' : 'rgba(255,255,255,0.75)'}`,
                borderRadius: framingMode === 'portrait_upper' ? '90px 90px 18px 18px' : '50px 50px 10px 10px',
                pointerEvents: 'none', display: 'flex',
                flexDirection: 'column', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0'
              }}>
                <span style={{ background: 'rgba(0,0,0,0.65)', color: '#fff', fontSize: '10px', padding: '2px 8px', borderRadius: '4px' }}>
                  {framingMode === 'portrait_upper' ? 'Khuôn mặt rõ ở giữa khung' : 'Đầu & khuôn mặt rõ trong khung'}
                </span>
                <span style={{ background: 'rgba(0,0,0,0.65)', color: '#fff', fontSize: '10px', padding: '2px 8px', borderRadius: '4px' }}>
                  {framingMode === 'portrait_upper'
                    ? 'Lấy rõ cổ & hai bên vai'
                    : framingMode === 'half_body'
                      ? 'Lấy từ đầu đến eo / hông'
                      : 'Toàn thân hoặc nửa người có mặt'}
                </span>
              </div>

              {/* Số đếm ngược lớn khi hẹn giờ chụp */}
              {countdown > 0 && (
                <div style={{
                  position: 'absolute', inset: 0, display: 'grid', placeItems: 'center',
                  background: 'rgba(0,0,0,0.35)', color: '#fff', fontSize: '64px', fontWeight: 800, zIndex: 15
                }}>
                  {countdown}
                </div>
              )}

              {/* Cụm nút chụp ngay & hẹn giờ lùi ra xa */}
              <div style={{ position: 'absolute', bottom: '10px', left: '8px', right: '8px', display: 'flex', gap: '6px', justifyContent: 'center', zIndex: 20 }}>
                <button className="btn btn-primary" style={{ padding: '6px 10px', fontSize: '12px' }} onClick={capturePhoto} disabled={countdown > 0}>
                  <Camera size={14} /> Chụp
                </button>
                <button className="btn btn-outline" style={{ padding: '6px 10px', fontSize: '12px', background: 'rgba(255,255,255,0.92)' }} onClick={() => startCountdownCapture(3)} disabled={countdown > 0}>
                  <Timer size={14} /> 3s
                </button>
                <button className="btn btn-outline" style={{ padding: '6px 10px', fontSize: '12px', background: 'rgba(255,255,255,0.92)' }} onClick={() => startCountdownCapture(5)} disabled={countdown > 0}>
                  <Timer size={14} /> 5s
                </button>
              </div>
            </div>
          )}

          {personImage && !cameraActive && (
            <div style={{ position: 'relative', width: '100%', aspectRatio: '3/4', background: '#f8f8f8', borderRadius: '6px', overflow: 'hidden', marginBottom: '12px', border: '1px solid var(--line)' }}>
              <img src={mattedImage || personImage} alt="Ảnh người dùng" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              <span className="frame-label" style={{ top: '6px', left: '6px' }}>
                <span /> {mattedImage ? `${(detectedFraming?.label || 'NỀN TRẮNG').toUpperCase()} · #FFFFFF` : 'ẢNH GỐC'}
              </span>
              <IconButton label="Xóa ảnh" style={{ position: 'absolute', top: '6px', right: '6px' }} onClick={() => { setPersonImage(null); setMattedImage(null); setDetectedFraming(null); setTryOnWarnings([]); setResultImage(null); setResultJobId(null); setIsSaved(false); setStep1Status('idle'); setStep2Status('idle'); }}>
                <Trash2 size={16} />
              </IconButton>
            </div>
          )}

          {step1Error && (
            <div style={{ background: '#fdf2f2', border: '1px solid #f8b4b4', color: '#9b1c1c', padding: '8px 10px', borderRadius: '5px', fontSize: '11px', display: 'flex', gap: '6px', alignItems: 'flex-start', marginBottom: '12px' }}>
              <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
              <span>{step1Error}</span>
            </div>
          )}

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
              <IconButton label="Lượt thử đã lưu" onClick={openHistory}>
                <History size={18} />
              </IconButton>
              <IconButton label="Tải ảnh kết quả" onClick={downloadResult} disabled={!personImage}>
                <Download size={18} />
              </IconButton>
            </div>
          </div>

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
              /* Chế độ Split View (Before / After Slider dùng clip-path chồng khít 100%) */
              <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
                <img
                  src={resultImage}
                  alt="Sau khi thử đồ"
                  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain' }}
                />
                <img
                  src={mattedImage}
                  alt="Trước khi thử đồ"
                  style={{
                    position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain',
                    clipPath: `inset(0 ${100 - splitPos}% 0 0)`
                  }}
                />
                <div
                  style={{
                    position: 'absolute', top: 0, bottom: 0, left: `${splitPos}%`,
                    width: '2px', background: '#111', boxShadow: '0 0 8px rgba(0,0,0,0.4)', pointerEvents: 'none'
                  }}
                />
                <input
                  type="range"
                  aria-label="Thanh kéo so sánh trước và sau"
                  min="0"
                  max="100"
                  value={splitPos}
                  onChange={e => setSplitPos(Number(e.target.value))}
                  style={{ position: 'absolute', bottom: '15px', left: '10%', width: '80%', zIndex: 10 }}
                />
              </div>
            ) : (
              <img
                src={viewMode === 'before' ? (mattedImage || personImage) : (resultImage || mattedImage || personImage)}
                alt="Phối đồ AI"
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              />
            )}

            {personImage && (
              <div className="frame-label">
                <span />
                {viewMode === 'before' ? 'ẢNH NỀN TRẮNG (BƯỚC 1)' : (resultImage ? 'KẾT QUẢ AI VTO (BƯỚC 2)' : 'CHỜ PHỐI ĐỒ')}
              </div>
            )}

            {step2Status === 'fitting' && (
              <div className="model-status" role="status">
                <LoaderCircle size={18} className="spin" />
                <span>AI đang phân tích pose & uốn nếp trang phục...</span>
              </div>
            )}

            {resultImage && (
              <IconButton
                className="save-look"
                label={isSaved ? 'Đã lưu' : 'Lưu kết quả'}
                onClick={handleSaveResult}
              >
                <Bookmark size={19} fill={isSaved ? 'currentColor' : 'none'} />
              </IconButton>
            )}
          </div>

          {step2Error && (
            <p className="error stage-error" role="alert">
              {step2Error} <button className="text-button" onClick={runStep2TryOn}>Thử lại</button>
            </p>
          )}

          {tryOnWarnings.length > 0 && (
            <div style={{ background: '#fffbeb', border: '1px solid #fcd34d', color: '#92400e', padding: '8px 10px', borderRadius: '5px', fontSize: '11px', marginTop: '8px' }}>
              {tryOnWarnings.map((w, idx) => <div key={idx}>• {w}</div>)}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginTop: '12px' }}>
            <p className="stage-caption" style={{ margin: 0 }}>
              AI giữ 100% gương mặt, màu da và bối cảnh trắng. Quần áo ôm theo tư thế tự nhiên.
            </p>
            {selectedItems.length > 0 && (
              <button className="btn btn-primary" disabled={addingSet} onClick={handleAddOutfitToCart}>
                <ShoppingBag size={16} /> {addingSet ? 'Đang thêm...' : `Thêm cả bộ (${selectedItems.length})`}
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

          <div style={{ background: '#f4f6f3', border: '1px solid #e1e7dc', borderRadius: '6px', padding: '10px', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', fontWeight: 700, color: '#394f41', marginBottom: '8px' }}>
              <Layers size={14} /> CÁC MÓN ĐANG PHỐI ({selectedItems.length})
            </div>

            <div style={{ display: 'grid', gap: '6px' }}>
              {renderSlotRow('Áo trong', 'top', outfit.top)}
              {renderSlotRow('Khoác ngoài', 'outer', outfit.outer)}
              {renderSlotRow('Quần / Váy', 'bottom', outfit.bottom)}
              {outfit.dress && renderSlotRow('Đầm liền', 'dress', outfit.dress)}
            </div>

            {slotNotification && (
              <p style={{ margin: '6px 0 0', fontSize: '10px', color: '#8d5b20', fontWeight: 600 }}>
                • {slotNotification}
              </p>
            )}

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

      {history !== null && (
        <Dialog title="Lịch sử phối đồ đã lưu" close={() => setHistory(null)}>
          {historyLoading ? (
            <p className="muted" style={{ textAlign: 'center', padding: '16px' }}>Đang tải lịch sử...</p>
          ) : history.length === 0 ? (
            <Empty icon={Bookmark} title="Chưa có lượt thử nào được lưu" />
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '10px', maxHeight: '60vh', overflowY: 'auto' }}>
              {history.map(item => {
                const names = (item.productIds || [item.productId]).filter(Boolean).map(id => products[id]?.name || id).join(' + ');
                return (
                  <button
                    key={item.jobId}
                    type="button"
                    onClick={() => {
                      if (item.imageUrl) {
                        setResultImage(item.imageUrl);
                        setPersonImage(prev => prev || item.imageUrl);
                        setResultJobId(item.jobId);
                        setIsSaved(true);
                        setViewMode('after');
                      }
                      setHistory(null);
                    }}
                    style={{ textAlign: 'left', border: '1px solid var(--line)', borderRadius: '6px', overflow: 'hidden', background: '#fff', padding: 0, cursor: 'pointer' }}
                  >
                    {item.imageUrl && <img src={item.imageUrl} alt={names} style={{ width: '100%', aspectRatio: '3/4', objectFit: 'contain', background: '#fff' }} />}
                    <div style={{ padding: '6px 8px', fontSize: '11px' }}>
                      <strong style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{names || 'Bộ phối đồ'}</strong>
                      <small className="muted">{new Date(item.createdAt).toLocaleString('vi-VN')}</small>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </Dialog>
      )}
    </main>
  );
}
