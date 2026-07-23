"use client";

import React, { useEffect, useState, useCallback } from "react";
import { X, Download, ChevronLeft, ChevronRight } from "lucide-react";
import { getFileDetails } from "./utils";

export interface LightboxItem {
  url: string;
  fileName?: string;
  mimeType?: string;
}

interface LightboxProps {
  items: LightboxItem[];
  startIndex?: number;
  onClose: () => void;
}

// Resolve how a given item should render inside the stage.
const resolveKind = (item: LightboxItem): "image" | "video" | "pdf" | "file" => {
  const { type } = getFileDetails(item.url, item.mimeType);
  if (type === "image") return "image";
  if (type === "video") return "video";
  const isPdf =
    item.mimeType?.includes("pdf") ||
    item.url.split("?")[0].toLowerCase().endsWith(".pdf");
  if (isPdf) return "pdf";
  return "file";
};

// Full-screen media viewer with a thumbnail rail (Slack/production style).
// Navigates the whole message's attachments in one window: click a thumb, use
// the arrow buttons, or press ← / → . Escape / backdrop / X closes.
export const Lightbox = ({ items, startIndex = 0, onClose }: LightboxProps) => {
  const [index, setIndex] = useState(startIndex);
  const safeItems = items.length > 0 ? items : [];
  const current = safeItems[index];
  const hasMultiple = safeItems.length > 1;

  const goPrev = useCallback(() => {
    setIndex((i) => (i - 1 + safeItems.length) % safeItems.length);
  }, [safeItems.length]);

  const goNext = useCallback(() => {
    setIndex((i) => (i + 1) % safeItems.length);
  }, [safeItems.length]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft" && hasMultiple) goPrev();
      if (e.key === "ArrowRight" && hasMultiple) goNext();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose, goPrev, goNext, hasMultiple]);

  if (!current) return null;

  const kind = resolveKind(current);

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col bg-black/90 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={onClose}
    >
      {/* Top bar */}
      <div
        className="flex items-center justify-between px-5 py-3 text-white/90 shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="text-sm font-medium truncate max-w-[50vw]">
          {current.fileName || "Attachment"}
          {hasMultiple && (
            <span className="ml-2 text-white/50">
              {index + 1} / {safeItems.length}
            </span>
          )}
        </span>
        <div className="flex items-center gap-2">
          <a
            href={current.url}
            download={current.fileName}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="p-2 rounded-full hover:bg-white/10 transition-colors"
            title="Download"
          >
            <Download className="h-5 w-5" />
          </a>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-white/10 transition-colors"
            title="Close (Esc)"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Body: stage + optional thumbnail rail */}
      <div className="flex-1 flex min-h-0">
        {/* Media stage */}
        <div
          className="relative flex-1 flex items-center justify-center p-4 min-w-0"
          onClick={(e) => e.stopPropagation()}
        >
          {hasMultiple && (
            <button
              onClick={goPrev}
              className="absolute left-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors z-10"
              title="Previous (←)"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
          )}

          {kind === "image" && (
            <img
              key={current.url}
              src={current.url}
              alt={current.fileName || "Image"}
              className="max-w-full max-h-full object-contain rounded-lg shadow-2xl animate-in zoom-in-95 duration-150"
            />
          )}
          {kind === "video" && (
            <video
              key={current.url}
              src={current.url}
              controls
              autoPlay
              className="max-w-full max-h-full rounded-lg shadow-2xl"
            />
          )}
          {kind === "pdf" && (
            <iframe
              key={current.url}
              src={current.url}
              title={current.fileName || "PDF preview"}
              className="w-full h-full max-w-5xl bg-white rounded-lg shadow-2xl"
            />
          )}
          {kind === "file" && (
            <div className="flex flex-col items-center gap-4 text-white/80">
              <p className="text-sm">
                No inline preview available for this file.
              </p>
              <a
                href={current.url}
                download={current.fileName}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors text-sm font-medium"
              >
                <Download className="h-4 w-4" />
                Download {current.fileName || "file"}
              </a>
            </div>
          )}

          {hasMultiple && (
            <button
              onClick={goNext}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors z-10"
              title="Next (→)"
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          )}
        </div>

        {/* Thumbnail rail — only when the message has more than one attachment */}
        {hasMultiple && (
          <div
            className="w-[92px] shrink-0 overflow-y-auto py-4 px-3 flex flex-col gap-2 border-l border-white/10 custom-scrollbar"
            onClick={(e) => e.stopPropagation()}
          >
            {safeItems.map((item, i) => {
              const thumbKind = resolveKind(item);
              const isActive = i === index;
              return (
                <button
                  key={item.url + i}
                  onClick={() => setIndex(i)}
                  className={`relative w-full aspect-square rounded-md overflow-hidden border-2 transition-all shrink-0 ${
                    isActive
                      ? "border-primary ring-1 ring-primary"
                      : "border-transparent opacity-60 hover:opacity-100"
                  }`}
                  title={item.fileName}
                >
                  {thumbKind === "image" ? (
                    <img
                      src={item.url}
                      alt={item.fileName || "thumb"}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  ) : thumbKind === "video" ? (
                    <video
                      src={item.url}
                      className="w-full h-full object-cover pointer-events-none"
                      preload="metadata"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-white/10 text-white/70 px-1">
                      <span className="text-[9px] font-bold uppercase">
                        {thumbKind === "pdf" ? "PDF" : "FILE"}
                      </span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
