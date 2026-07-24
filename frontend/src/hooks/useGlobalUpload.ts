"use client";

import { useEffect, useRef } from "react";
import axios from "axios";
import { useUploadStore, UploadItem } from "@/src/store/uploadStore";
import { useChatStore } from "@/src/store/chat";
import { authFetch } from "@/src/lib/authFetch";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

export const useGlobalUpload = (socket: any) => {
  const { uploads, updateProgress, setStatus, removeUpload } = useUploadStore();
  const processingRef = useRef<Set<string>>(new Set());
  const abortRefs = useRef<Map<string, AbortController>>(new Map());

  useEffect(() => {
    uploads
      .filter((u) => u.status === "queued" && !processingRef.current.has(u.id))
      .forEach((item) => {
        processingRef.current.add(item.id);
        processUpload(item);
      });
  }, [uploads]);

  const processUpload = async (item: UploadItem) => {
    setStatus(item.id, "uploading");
    const controller = new AbortController();
    abortRefs.current.set(item.id, controller);

    try {
      const presignRes = await authFetch(`${API}/api/upload/presign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: item.file.name,
          contentType: item.file.type || "application/octet-stream",
          fileSize: item.file.size,
          visibility: "private",
        }),
      });

      if (!presignRes.ok) throw new Error("Presign failed");

      const { uploadUrl, finalFileUrl, fileKey, visibility: signedVisibility } =
        await presignRes.json();

      const putHeaders: Record<string, string> = {
        "Content-Type": item.file.type || "application/octet-stream",
      };
      if (signedVisibility === "public") putHeaders["x-amz-acl"] = "public-read";

      await axios.put(uploadUrl, item.file, {
        headers: putHeaders,
        signal: controller.signal,
        onUploadProgress: (e) => {
          if (e.total) updateProgress(item.id, Math.round((e.loaded / e.total) * 100));
        },
      });

      setStatus(item.id, "done");

      const attachment = {
        url: finalFileUrl,
        fileKey,
        fileName: item.file.name,
        mimeType: item.file.type || "application/octet-stream",
        size: item.file.size,
      };

      const basePayload = {
        id: item.tempId,
        tempId: item.tempId,
        text: item.text || " ",
        senderId: item.sender.id,
        createdAt: new Date().toISOString(),
        status: "pending" as const,
        sender: item.sender,
        attachments: [attachment],
      };

      if (socket) {
        const chatState = useChatStore.getState();
        // Optimistic add only if user is still in that chat
        const localPayload = {
          ...basePayload,
          attachments: [{ ...attachment, url: URL.createObjectURL(item.file) }],
        };

        if (item.isChannel && item.channelId) {
          if (chatState.activeChannelId === item.channelId) {
            chatState.addPendingMessage(item.channelId, "channel", localPayload);
          }
          socket.emit("send_channel_message", { channelId: item.channelId, ...basePayload });
        } else if (!item.isChannel && item.roomId && item.targetUserId) {
          if (chatState.activeRoomId === item.roomId) {
            chatState.addPendingMessage(item.roomId, item.targetUserId, localPayload);
          }
          socket.emit("sendPrivateMessage", {
            roomId: item.roomId,
            targetUserId: item.targetUserId,
            ...basePayload,
          });
        }
      }

      setTimeout(() => {
        removeUpload(item.id);
        processingRef.current.delete(item.id);
      }, 2000);
    } catch (err: any) {
      const isCancelled = err?.name === "CanceledError" || err?.name === "AbortError";
      setStatus(item.id, isCancelled ? "cancelled" : "error");
      setTimeout(() => {
        removeUpload(item.id);
        processingRef.current.delete(item.id);
      }, 2500);
    } finally {
      abortRefs.current.delete(item.id);
    }
  };

  const cancelUpload = (id: string) => {
    abortRefs.current.get(id)?.abort();
    setStatus(id, "cancelled");
    setTimeout(() => {
      removeUpload(id);
      processingRef.current.delete(id);
    }, 1500);
  };

  return { cancelUpload };
};
