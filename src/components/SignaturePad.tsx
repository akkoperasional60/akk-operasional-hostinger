import React, { useRef, useState, useEffect } from 'react';
import { Eraser, Check, X, RotateCcw, PenTool } from 'lucide-react';

interface SignaturePadProps {
  onSave: (signatureDataUrl: string) => void;
  onClose?: () => void;
  title?: string;
  signerName?: string;
  signerRole?: string;
}

export const SignaturePad: React.FC<SignaturePadProps> = ({
  onSave,
  onClose,
  title = 'Tanda Tangan Digital Resmi',
  signerName,
  signerRole
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [penColor, setPenColor] = useState('#1e3a8a'); // Dark blue ink
  const [penWidth, setPenWidth] = useState(2.5);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas dimensions based on display size
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width || 400;
    canvas.height = rect.height || 200;

    // Fill white background for signature contrast
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = penColor;
    ctx.lineWidth = penWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, [penColor, penWidth]);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    setIsDrawing(true);
    setHasDrawn(true);

    const coords = getEventCoordinates(e, canvas);
    ctx.beginPath();
    ctx.moveTo(coords.x, coords.y);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const coords = getEventCoordinates(e, canvas);
    ctx.strokeStyle = penColor;
    ctx.lineWidth = penWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineTo(coords.x, coords.y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const getEventCoordinates = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>,
    canvas: HTMLCanvasElement
  ) => {
    const rect = canvas.getBoundingClientRect();
    let clientX = 0;
    let clientY = 0;

    if ('touches' in e) {
      if (e.touches.length > 0) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
      }
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  };

  const handleClear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
  };

  const handleComplete = () => {
    const canvas = canvasRef.current;
    if (!canvas || !hasDrawn) return;
    const dataUrl = canvas.toDataURL('image/png', 0.9);
    onSave(dataUrl);
    if (onClose) onClose();
  };

  return (
    <div className="fixed inset-0 z-70 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col">
        
        {/* Header */}
        <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <PenTool className="w-4 h-4" />
            </div>
            <div>
              <h4 className="font-bold text-white text-sm">
                {title}
              </h4>
              <p className="text-[10px] text-slate-400">
                {signerName ? `${signerName} (${signerRole || 'Otoritas'})` : 'Gunakan jari atau mouse untuk membubuhkan tanda tangan'}
              </p>
            </div>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Canvas Area */}
        <div className="p-4 space-y-3 bg-slate-900/50">
          <div className="relative rounded-xl overflow-hidden border-2 border-dashed border-slate-700 bg-white shadow-inner">
            <canvas
              ref={canvasRef}
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              onTouchStart={startDrawing}
              onTouchMove={draw}
              onTouchEnd={stopDrawing}
              className="w-full h-48 touch-none cursor-crosshair block"
            />
            {!hasDrawn && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-slate-400 text-xs italic">
                Tulis tanda tangan Anda di area ini...
              </div>
            )}
            <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-slate-100 text-[9px] text-slate-500 font-mono">
              PT AKK Secure Sign
            </div>
          </div>

          {/* Controls & Tools */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPenColor('#1e3a8a')}
                className={`w-5 h-5 rounded-full bg-blue-900 border ${penColor === '#1e3a8a' ? 'ring-2 ring-white' : ''}`}
                title="Tinta Biru"
              />
              <button
                type="button"
                onClick={() => setPenColor('#020617')}
                className={`w-5 h-5 rounded-full bg-slate-950 border ${penColor === '#020617' ? 'ring-2 ring-white' : ''}`}
                title="Tinta Hitam"
              />
              <span className="text-slate-600">|</span>
              <button
                type="button"
                onClick={handleClear}
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1 transition cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Ulangi</span>
              </button>
            </div>

            <div className="text-[10px] text-slate-400">
              {hasDrawn ? <span className="text-emerald-400 font-bold">✓ Tanda tangan terkam</span> : 'Belum ditandatangani'}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-3 px-4 bg-slate-950 border-t border-slate-800 flex items-center justify-end gap-2">
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition cursor-pointer"
            >
              Batal
            </button>
          )}
          <button
            type="button"
            onClick={handleComplete}
            disabled={!hasDrawn}
            className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:bg-slate-800 disabled:text-slate-600 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-amber-500/20 transition cursor-pointer active:scale-95 disabled:cursor-not-allowed"
          >
            <Check className="w-4 h-4" />
            <span>Simpan Tanda Tangan</span>
          </button>
        </div>

      </div>
    </div>
  );
};
