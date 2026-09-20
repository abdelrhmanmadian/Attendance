import { useEffect, useState } from "react";
import { api } from "../api/client";

interface Props {
  doctorName: string;
  codeId: string;
  code: string;
  validFrom: string;
  validUntil: string;
  onClose: () => void;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-GB", { timeZone: "Africa/Cairo", hour: "2-digit", minute: "2-digit" });
}

export default function ProjectorCodeView({ doctorName, codeId, code, validFrom, validUntil, onClose }: Props) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  useEffect(() => {
    api.get<{ dataUrl: string }>(`/codes/${codeId}/qrcode`).then((r) => setQrDataUrl(r.dataUrl));
  }, [codeId]);

  return (
    <div className="fixed inset-0 bg-white flex flex-col items-center justify-center p-8 z-50">
      <button onClick={onClose} className="absolute top-6 right-6 text-slate-400 hover:text-slate-600 text-3xl">
        &times;
      </button>
      <h1 className="text-3xl md:text-5xl font-bold text-slate-800 mb-8 text-center">{doctorName}</h1>
      <div className="text-7xl md:text-9xl font-mono font-black tracking-widest text-slate-900 mb-8">{code}</div>
      {qrDataUrl && <img src={qrDataUrl} alt="Check-in QR code" className="w-56 h-56 md:w-72 md:h-72 mb-8" />}
      <p className="text-xl md:text-2xl text-slate-600">
        Valid {formatTime(validFrom)} – {formatTime(validUntil)} (Cairo time)
      </p>
    </div>
  );
}
