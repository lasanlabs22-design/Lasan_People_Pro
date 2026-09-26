"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, Loader2, RefreshCw, RotateCcw, SwitchCamera } from "lucide-react";
import { TZ } from "@/lib/format";
import { Button } from "./ui";

const MAX_SIDE = 640;
const MAX_CHARS = 150_000;

function cameraError(e) {
  if (typeof window !== "undefined" && !window.isSecureContext) return "The camera only works over a secure (https) connection.";
  if (e?.name === "NotAllowedError" || e?.name === "SecurityError")
    return "Camera access is blocked. Allow it for this site in your browser settings, then try again.";
  if (e?.name === "NotFoundError" || e?.name === "OverconstrainedError") return "No camera was found on this device.";
  if (e?.name === "NotReadableError") return "Your camera is being used by another app. Close it and try again.";
  return "Couldn't start the camera. Try again.";
}

/** Grabs the current video frame, scaled down, stamped with the time, as a JPEG data URL. */
function snapshot(video) {
  const scale = Math.min(1, MAX_SIDE / Math.max(video.videoWidth, video.videoHeight));
  const w = Math.round(video.videoWidth * scale);
  const h = Math.round(video.videoHeight * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(video, 0, 0, w, h);

  const stamp = new Date().toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "medium", timeZone: TZ });
  const size = Math.max(12, Math.round(h / 28));
  ctx.font = `600 ${size}px system-ui, sans-serif`;
  ctx.fillStyle = "rgb(0 0 0 / 0.55)";
  ctx.fillRect(0, h - size * 1.9, w, size * 1.9);
  ctx.fillStyle = "#fff";
  ctx.textBaseline = "middle";
  ctx.fillText(stamp, size * 0.7, h - size * 0.95);

  for (const q of [0.85, 0.7, 0.55, 0.4]) {
    const url = canvas.toDataURL("image/jpeg", q);
    if (url.length < MAX_CHARS) return url;
  }
  throw new Error("Couldn't compress the photo. Try again.");
}

/**
 * Live camera viewfinder. Only a photo taken right now can be submitted; there is no file picker.
 * Calls onReady once the camera is streaming (so the caller can ask for location next, not at the
 * same time as the camera prompt) and onConfirm(dataUrl) when the person accepts their photo.
 */
export function CameraCapture({ onConfirm, onReady, confirmLabel = "Use photo", busy }) {
  const video = useRef(null);
  const stream = useRef(null);
  const [facing, setFacing] = useState("user");
  const [status, setStatus] = useState("starting"); // starting | live | error
  const [error, setError] = useState(null);
  const [photo, setPhoto] = useState(null);
  const [canSwitch, setCanSwitch] = useState(false);
  const [attempt, setAttempt] = useState(0);

  const stop = useCallback(() => {
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
  }, []);

  useEffect(() => {
    if (photo) return;
    let cancelled = false;
    (async () => {
      setStatus("starting");
      setError(null);
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw Object.assign(new Error(), { name: "Unsupported" });
        const s = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 960 } },
          audio: false,
        });
        if (cancelled) return s.getTracks().forEach((t) => t.stop());
        stop();
        stream.current = s;
        video.current.srcObject = s;
        await video.current.play().catch(() => {});
        setStatus("live");
        onReady?.();
        const devices = await navigator.mediaDevices.enumerateDevices().catch(() => []);
        if (!cancelled) setCanSwitch(devices.filter((d) => d.kind === "videoinput").length > 1);
      } catch (e) {
        if (cancelled) return;
        setError(cameraError(e));
        setStatus("error");
      }
    })();
    return () => {
      cancelled = true;
    };
    // onReady is only a notification; restarting the camera when it changes identity would flicker.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facing, photo, attempt, stop]);

  useEffect(() => stop, [stop]);

  function capture() {
    try {
      setPhoto(snapshot(video.current));
      stop();
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <div className="space-y-4">
      <div className="relative aspect-[4/3] overflow-hidden rounded-2xl border border-white/10 bg-black">
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element -- local data URL preview
          <img src={photo} alt="Your photo" className="size-full object-contain" />
        ) : (
          <video
            ref={video}
            playsInline
            muted
            className={`size-full object-contain ${facing === "user" ? "-scale-x-100" : ""} ${status === "live" ? "" : "invisible"}`}
          />
        )}
        {!photo && status === "starting" && (
          <div className="absolute inset-0 grid place-items-center text-sm text-muted">
            <span className="inline-flex items-center gap-2">
              <Loader2 className="size-4 animate-spin" /> Starting camera…
            </span>
          </div>
        )}
        {!photo && status === "error" && (
          <div className="absolute inset-0 grid place-items-center p-6 text-center text-sm text-rose-200">{error}</div>
        )}
        {!photo && status === "live" && (
          <div className="pointer-events-none absolute inset-0 grid place-items-center" aria-hidden>
            <div className="h-3/4 w-1/2 rounded-[50%] border-2 border-dashed border-white/40" />
          </div>
        )}
        {!photo && canSwitch && status === "live" && (
          <button
            type="button"
            onClick={() => setFacing((f) => (f === "user" ? "environment" : "user"))}
            className="absolute right-3 top-3 rounded-full bg-black/50 p-2 text-white hover:bg-black/70"
            aria-label="Switch camera"
          >
            <SwitchCamera className="size-4" />
          </button>
        )}
      </div>

      {photo ? (
        <div className="flex gap-2">
          <Button type="button" variant="secondary" className="flex-1" onClick={() => setPhoto(null)} disabled={busy}>
            <RotateCcw className="size-4" /> Retake
          </Button>
          <Button type="button" className="flex-1" onClick={() => onConfirm(photo)} disabled={busy}>
            {busy && <Loader2 className="size-4 animate-spin" />} {confirmLabel}
          </Button>
        </div>
      ) : status === "error" ? (
        <Button type="button" variant="secondary" className="w-full" onClick={() => setAttempt((n) => n + 1)}>
          <RefreshCw className="size-4" /> Try again
        </Button>
      ) : (
        <Button type="button" className="w-full" size="lg" onClick={capture} disabled={status !== "live"}>
          <Camera className="size-5" /> Take photo
        </Button>
      )}
      {!photo && error && status === "live" && <p className="text-xs text-rose-300">{error}</p>}
      <p className="text-center text-xs text-subtle">Face the camera in good light. The photo is stamped with the time and saved with your punch.</p>
    </div>
  );
}
