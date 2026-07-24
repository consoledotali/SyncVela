"use client";

import React from "react";
import { X, CheckCircle2, AlertCircle, FileText, Image as ImageIcon } from "lucide-react";
import { useUploadStore } from "@/src/store/uploadStore";
import { useSocket } from "@/src/providers/SocketProvider";
import { useGlobalUpload } from "@/src/hooks/useGlobalUpload";

export default function GlobalUploadManager() {
  const { socket } = useSocket();
  const { uploads } = useUploadStore();
  const { cancelUpload } = useGlobalUpload(socket);

  const visible = uploads.filter((u) => u.status !== "cancelled");
  if (visible.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 w-[300px]">
      {visible.map((u) => {
        const isImage = u.file.type.startsWith("image/");
        const totalMB = (u.fileSize / 1024 / 1024).toFixed(1);
        const remainingMB = u.status === "uploading"
          ? ((u.fileSize * (100 - u.progress)) / 100 / 1024 / 1024).toFixed(1)
          : null;

        return (
          <div
            key={u.id}
            className="bg-background border border-border rounded-xl shadow-lg p-3 flex flex-col gap-2 animate-in slide-in-from-bottom-2 duration-200"
          >
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-muted rounded-md shrink-0">
                {isImage
                  ? <ImageIcon className="h-4 w-4 text-primary" />
                  : <FileText className="h-4 w-4 text-blue-500" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate text-foreground">{u.fileName}</p>
                <p className="text-[11px] text-muted-foreground">
                  {u.status === "uploading" && remainingMB !== null
                    ? `${remainingMB} MB remaining`
                    : u.status === "done"
                    ? `${totalMB} MB · Done`
                    : u.status === "error"
                    ? "Upload failed"
                    : `${totalMB} MB`}
                </p>
              </div>
              {u.status === "done" && <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />}
              {u.status === "error" && <AlertCircle className="h-4 w-4 text-destructive shrink-0" />}
              {(u.status === "uploading" || u.status === "queued") && (
                <button
                  onClick={() => cancelUpload(u.id)}
                  className="p-1 hover:bg-muted rounded-md transition-colors shrink-0"
                  title="Cancel"
                >
                  <X className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              )}
            </div>

            {(u.status === "uploading" || u.status === "queued") && (
              <div className="w-full">
                <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                  <span>{u.status === "queued" ? "Queued..." : "Uploading..."}</span>
                  <span>{u.progress}%</span>
                </div>
                <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-150"
                    style={{ width: `${u.progress}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
