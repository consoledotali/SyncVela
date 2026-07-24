import { create } from "zustand";

export interface UploadItem {
  id: string;
  file: File;
  fileName: string;
  fileSize: number;
  progress: number;
  status: "queued" | "uploading" | "done" | "error" | "cancelled";
  // socket context — captured at queue time so channel switch doesn't break it
  channelId: string | null;
  roomId: string | null;
  targetUserId: string | null;
  isChannel: boolean;
  text: string;
  sender: { id: string; name: string; avatarUrl: string | null };
  tempId: string;
}

interface UploadStore {
  uploads: UploadItem[];
  drafts: Record<string, string>; // chatId -> draft text
  queueUpload: (item: UploadItem) => void;
  updateProgress: (id: string, progress: number) => void;
  setStatus: (id: string, status: UploadItem["status"]) => void;
  removeUpload: (id: string) => void;
  setDraft: (chatId: string, text: string) => void;
}

export const useUploadStore = create<UploadStore>((set) => ({
  uploads: [],
  drafts: {},
  queueUpload: (item) => set((s) => ({ uploads: [...s.uploads, item] })),
  updateProgress: (id, progress) =>
    set((s) => ({
      uploads: s.uploads.map((u) => (u.id === id ? { ...u, progress } : u)),
    })),
  setStatus: (id, status) =>
    set((s) => ({
      uploads: s.uploads.map((u) => (u.id === id ? { ...u, status } : u)),
    })),
  removeUpload: (id) =>
    set((s) => ({ uploads: s.uploads.filter((u) => u.id !== id) })),
  setDraft: (chatId, text) =>
    set((s) => ({ drafts: { ...s.drafts, [chatId]: text } })),
}));
