import React, { useState, useRef, useEffect, useId } from "react";
import { ZoomIn, ZoomOut, Check, X, RotateCcw, Move } from "lucide-react";

interface ImageCropperModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageSrc: string;
  onCropComplete: (croppedBlob: Blob) => void;
}

export default function ImageCropperModal({
  isOpen,
  onClose,
  imageSrc,
  onCropComplete
}: ImageCropperModalProps) {
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const canvasWidthId = useId();
  const scaleId = useId();

  // Reset local state when a new image is loaded or the modal is opened
  useEffect(() => {
    if (isOpen && imageSrc) {
      setIsLoading(true);
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        setImage(img);
        // Calcula escala inicial para preencher a área quadrada de 400x400
        const minScale = Math.max(400 / img.width, 400 / img.height);
        setScale(minScale);
        setOffset({ x: 0, y: 0 });
        setIsLoading(false);
      };
      img.onerror = () => {
        setIsLoading(false);
        alert("Erro ao carregar a imagem para recortar.");
      };
      img.src = imageSrc;
    }
  }, [isOpen, imageSrc]);

  // Redraw canvas whenever scale, offset or image changes
  useEffect(() => {
    if (!image || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Limpa a tela
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Salva o estado do contexto
    ctx.save();

    // Aplica as transformações (foca no centro do canvas)
    ctx.translate(canvas.width / 2 + offset.x, canvas.height / 2 + offset.y);
    ctx.scale(scale, scale);

    // Desenha a imagem centralizada nela mesma
    ctx.drawImage(image, -image.width / 2, -image.height / 2);

    // Restaura o estado do contexto
    ctx.restore();
  }, [image, scale, offset]);

  if (!isOpen) return null;

  // Eventos de Arrasto/Foco (Mouse & Touch)
  const handleStartDrag = (clientX: number, clientY: number) => {
    if (!image) return;
    setIsDragging(true);
    dragStart.current = {
      x: clientX - offset.x,
      y: clientY - offset.y
    };
  };

  const handleDrag = (clientX: number, clientY: number) => {
    if (!isDragging) return;
    const newX = clientX - dragStart.current.x;
    const newY = clientY - dragStart.current.y;

    // Limita o arrasto para manter a imagem cobrindo pelo menos o centro (opcional, vamos deixar livre para melhor usabilidade)
    setOffset({ x: newX, y: newY });
  };

  const handleStopDrag = () => {
    setIsDragging(false);
  };

  const handleConfirmCrop = () => {
    if (!canvasRef.current) return;
    
    // O canvas principal tem 400x400 pixels.
    // O círculo visualizado tem 320x320 pixels e está centralizado no canvas de 400x400.
    // Portanto, as coordenadas de início do recorte são:
    // x = (400 - 320) / 2 = 40
    // y = (400 - 320) / 2 = 40
    const cropSize = 320;
    const startX = (400 - cropSize) / 2;
    const startY = (400 - cropSize) / 2;

    // Criamos um canvas temporário de 320x320 com a área restrita
    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = cropSize;
    tempCanvas.height = cropSize;
    const tempCtx = tempCanvas.getContext("2d");
    
    if (tempCtx) {
      // Copia apenas a área de 320x320 centrada no canvas original
      tempCtx.drawImage(
        canvasRef.current,
        startX,
        startY,
        cropSize,
        cropSize,
        0,
        0,
        cropSize,
        cropSize
      );

      tempCanvas.toBlob(
        (blob) => {
          if (blob) {
            onCropComplete(blob);
            onClose();
          } else {
            alert("Erro ao processar o recorte.");
          }
        },
        "image/jpeg",
        0.95
      );
    } else {
      // Fallback para o canvas original caso haja problema ao obter contexto
      canvasRef.current.toBlob(
        (blob) => {
          if (blob) {
            onCropComplete(blob);
            onClose();
          } else {
            alert("Erro ao processar o recorte.");
          }
        },
        "image/jpeg",
        0.9
      );
    }
  };

  const zoomIn = () => setScale(prev => Math.min(prev + 0.1, 5));
  const zoomOut = () => setScale(prev => {
    if (!image) return prev;
    const minScale = Math.max(400 / image.width, 400 / image.height);
    return Math.max(prev - 0.1, minScale);
  });

  const resetAll = () => {
    if (!image) return;
    const minScale = Math.max(400 / image.width, 400 / image.height);
    setScale(minScale);
    setOffset({ x: 0, y: 0 });
  };

  return (
    <div className="fixed inset-0 bg-[#141414]/85 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="bg-white border text-left border-[#141414] shadow-2xl max-w-lg w-full flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex justify-between items-center bg-[#E4E3E0]/45 p-4 border-b border-[#141414]/15">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold text-gray-900 uppercase">Recortar Foto do Crachá</span>
          </div>
          <button 
            type="button" 
            onClick={onClose} 
            className="text-gray-500 hover:text-black hover:bg-neutral-200/50 p-1 rounded-sm transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Workspace do Recorte */}
        <div className="p-6 flex flex-col items-center justify-center bg-zinc-50 border-b border-zinc-200">
          {isLoading ? (
            <div className="w-[400px] h-[400px] flex flex-col items-center justify-center bg-white border border-[#141414]/15">
              <span className="w-6 h-6 border-2 border-[#141414] border-t-transparent rounded-full animate-spin mb-2"></span>
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-neutral-500">Ajustando...</span>
            </div>
          ) : (
            <div 
              className="relative w-[400px] h-[400px] bg-neutral-900 overflow-hidden cursor-move border border-[#141414] select-none"
              style={{ width: "400px", height: "400px" }}
              onMouseDown={(e) => handleStartDrag(e.clientX, e.clientY)}
              onMouseMove={(e) => handleDrag(e.clientX, e.clientY)}
              onMouseUp={handleStopDrag}
              onMouseLeave={handleStopDrag}
              onTouchStart={(e) => {
                if (e.touches[0]) handleStartDrag(e.touches[0].clientX, e.touches[0].clientY);
              }}
              onTouchMove={(e) => {
                if (e.touches[0]) handleDrag(e.touches[0].clientX, e.touches[0].clientY);
              }}
              onTouchEnd={handleStopDrag}
            >
              <canvas
                id={canvasWidthId}
                ref={canvasRef}
                width={400}
                height={400}
                className="w-full h-full block bg-zinc-900"
              />

              {/* Grid / Overlay para 1:1 Aspect Ratio Preview */}
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                {/* Círculo do Preview no centro */}
                <div className="w-[320px] h-[320px] rounded-full border-2 border-dashed border-white shadow-[0_0_0_9999px_rgba(20,20,20,0.6)] flex items-center justify-center">
                  <div className="w-full h-full flex flex-col justify-between items-center py-2 px-2 text-[8px] font-mono text-white/50 uppercase select-none">
                    <span className="text-center font-bold tracking-tight bg-black/40 px-1 py-0.5 rounded-sm">Limite de Recorte</span>
                    <Move className="w-5 h-5 text-white/80 animate-pulse" />
                    <span className="text-center font-bold tracking-tight bg-black/40 px-1 py-0.5 rounded-sm">Arraste para ajustar</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Slider e Controles */}
        <div className="p-4 space-y-4 bg-white">
          <div className="flex flex-col gap-2">
            <div className="flex justify-between items-center text-[10px] font-mono font-bold text-gray-500 uppercase">
              <span>Zoom</span>
              <span>{(scale * 100).toFixed(0)}%</span>
            </div>
            <div className="flex items-center gap-3">
              <button 
                type="button" 
                onClick={zoomOut}
                className="p-1 px-2 border border-zinc-200 hover:border-black hover:bg-neutral-50 transition-colors"
                title="Menos zoom"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <input
                id={scaleId}
                type="range"
                min={0.2}
                max={4}
                step={0.01}
                value={scale}
                onChange={(e) => setScale(parseFloat(e.target.value))}
                className="grow bg-neutral-200 h-1 rounded-lg appearance-none cursor-pointer accent-[#141414]"
              />
              <button 
                type="button" 
                onClick={zoomIn}
                className="p-1 px-2 border border-zinc-200 hover:border-black hover:bg-neutral-50 transition-colors"
                title="Mais zoom"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <button 
                type="button" 
                onClick={resetAll}
                className="p-1.5 border border-zinc-200 hover:border-black hover:bg-neutral-50 transition-colors"
                title="Resetar"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex gap-2 justify-end pt-2 border-t border-zinc-200">
            <button
              type="button"
              onClick={onClose}
              className="border border-[#141414]/30 hover:border-[#141414] text-xs font-mono font-bold uppercase tracking-widest px-4 py-2 transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleConfirmCrop}
              disabled={isLoading || !image}
              className="bg-[#141414] text-white hover:bg-neutral-800 disabled:opacity-50 text-xs font-mono font-bold uppercase tracking-widest px-4 py-2 transition-colors cursor-pointer border border-[#141414] flex items-center gap-1.5"
            >
              <Check className="w-3.5 h-3.5" /> Confirmar Recorte
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
