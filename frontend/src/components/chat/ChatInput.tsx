import React, { useState, useRef } from "react";
import { useSocket } from "@/src/providers/SocketProvider";
import { useChatStore } from "@/src/store/chat";
import { useMessageSender } from "@/src/hooks/useMessageSender";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Paperclip, SendHorizonal, X, Loader2 } from "lucide-react";

export default function ChatInput() {
  const { socket, isConnected } = useSocket();
  const { activeRoomId, activeChannelId, selectedUser, channels } =
    useChatStore();
  const { sendMessage, isUploading } = useMessageSender();

  const [inputText, setInputText] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [typingTimeout, setTypingTimeout] = useState<NodeJS.Timeout | null>(
    null,
  );

  const fileInputRef = useRef<HTMLInputElement>(null);

  // 🛡️ Context Check: Are we in a Channel or DM?
  const isChannelView = !!activeChannelId;
  const isDMView = !!activeRoomId && !!selectedUser;
  const isInputDisabled = (!isChannelView && !isDMView) || isUploading;

  // Find active channel name for placeholder
  const activeChannel = channels.find((c) => c.id === activeChannelId);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10485760) {
      alert("⚠️ File size must be under 10MB");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    setSelectedFile(file);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputText(e.target.value);

    // Typing Indicator Logic (Only for DMs right now)
    if (socket && isDMView && selectedUser) {
      socket.emit("typing", { targetUserId: selectedUser.id });
      if (typingTimeout) clearTimeout(typingTimeout);
      const newTimeout = setTimeout(
        () => socket.emit("stopTyping", { targetUserId: selectedUser.id }),
        2000,
      );
      setTypingTimeout(newTimeout);
    }
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(inputText, selectedFile, () => {
      setInputText("");
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";

      if (socket && isDMView && selectedUser) {
        socket.emit("stopTyping", { targetUserId: selectedUser.id });
      }
    });
  };

  return (
    <div className="flex flex-col bg-background border-t border-border p-3 gap-2">
      {/* 📎 FILE PREVIEW PILL */}
      {selectedFile && (
        <div className="flex items-center justify-between bg-muted/50 border border-border rounded-md px-3 py-2 mx-1 max-w-sm">
          <div className="flex items-center gap-2 overflow-hidden">
            <Paperclip className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="text-sm font-medium text-foreground truncate">
              {selectedFile.name}
            </span>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setSelectedFile(null)}
            className="h-6 w-6 shrink-0 ml-2 text-destructive"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* 💬 MAIN INPUT FORM */}
      <form onSubmit={onSubmit} className="flex items-center gap-2">
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          className="hidden"
          accept="image/*,application/pdf,.csv,.doc,.docx"
        />

        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => fileInputRef.current?.click()}
          disabled={isInputDisabled}
          className="shrink-0 text-muted-foreground hover:text-foreground"
        >
          <Paperclip className="h-5 w-5" />
        </Button>

        <Input
          type="text"
          value={inputText}
          onChange={handleInputChange}
          placeholder={
            !isConnected
              ? "Connecting..."
              : isChannelView
                ? `Message #${activeChannel?.name || "channel"}`
                : isDMView
                  ? `Message ${selectedUser?.name?.split(" ")[0]}`
                  : "Select a chat..."
          }
          disabled={isInputDisabled}
          className="flex-1 bg-muted/30 border-transparent focus-visible:ring-1 focus-visible:ring-ring transition-colors"
        />

        <Button
          type="submit"
          disabled={isInputDisabled || (!inputText.trim() && !selectedFile)}
          className="shrink-0 transition-all"
        >
          {isUploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <span className="hidden sm:inline mr-2">Send</span>
              <SendHorizonal className="h-4 w-4" />
            </>
          )}
        </Button>
      </form>
    </div>
  );
}
