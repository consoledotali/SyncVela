"use client";

import React, { useEffect, useRef, useState } from "react";
import { useAuthStore } from "@/src/store/authStore";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/src/components/ui/avatar";
import { Camera, Loader2 } from "lucide-react";
import { useS3Upload } from "@/src/hooks/useS3Upload";
import { authFetch } from "@/src/utils/apiClient";
import { resolveAvatarUrl } from "@/src/utils/avatarUtils";
import { toast } from "sonner";

export default function AvatarUploader() {
  const { user, login } = useAuthStore();
  const { uploadFile, isUploading: isS3Uploading } = useS3Upload();
  const [isUpdatingDB, setIsUpdatingDB] = useState(false);
  const [localPreviewUrl, setLocalPreviewUrl] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (localPreviewUrl) URL.revokeObjectURL(localPreviewUrl);
    };
  }, [localPreviewUrl]);

  const isUploading = isS3Uploading || isUpdatingDB;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const currentToken = useAuthStore.getState().token;
    if (!file || !user || !currentToken) return;

    setLocalPreviewUrl(URL.createObjectURL(file));

    try {
      const uploadData = await uploadFile(file, "avatar");

      if (!uploadData || !uploadData.fileKey) {
        throw new Error("File upload failed: No key received.");
      }

      setIsUpdatingDB(true);

      const response = await authFetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/users/profile/avatar`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ fileKey: uploadData.fileKey }),
        },
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update profile avatar");
      }

      const updatedUser = await response.json();
      const latestToken = useAuthStore.getState().token;

      if (!latestToken) {
        throw new Error("Session expired while updating profile.");
      }

      login(
        {
          ...user,
          avatarUrl: resolveAvatarUrl(updatedUser.avatarUrl),
        },
        latestToken,
      );

      toast.success("Profile avatar updated successfully!");
    } catch (error: unknown) {
      console.error("Avatar upload process failed:", error);
      const message =
        error instanceof Error
          ? error.message
          : "Failed to upload avatar. Please try again.";
      toast.error(message);
    } finally {
      setIsUpdatingDB(false);
      setLocalPreviewUrl(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  return (
    <div className="relative group cursor-pointer inline-block">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/png, image/jpeg, image/webp"
        className="hidden"
        disabled={isUploading}
      />

      <Avatar
        className="h-10 w-10 border-2 border-primary/20 transition-all duration-300 group-hover:border-primary/50 relative"
        onClick={() => !isUploading && fileInputRef.current?.click()}
      >
        <AvatarImage
          src={localPreviewUrl || resolveAvatarUrl(user?.avatarUrl)}
          alt={user?.name || "User Avatar"}
          className="object-cover"
        />
        <AvatarFallback className="bg-primary/10 text-primary font-bold text-xs uppercase">
          {user?.name ? user.name.slice(0, 2) : "ME"}
        </AvatarFallback>

        {isUploading && (
          <div className="absolute inset-0 bg-background/80 flex items-center justify-center rounded-full z-10 backdrop-blur-[1px]">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
          </div>
        )}
      </Avatar>

      {!isUploading && (
        <div
          onClick={() => fileInputRef.current?.click()}
          className="absolute inset-0 bg-background/60 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 shadow-sm"
          title="Change profile picture"
        >
          <Camera className="h-3.5 w-3.5 text-foreground drop-shadow-sm" />
        </div>
      )}
    </div>
  );
}

