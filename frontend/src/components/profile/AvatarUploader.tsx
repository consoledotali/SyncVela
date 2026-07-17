"use client";

import React, { useRef, useState } from "react";
import { useAuthStore } from "@/src/store/authStore";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/src/components/ui/avatar";
import { Camera, Loader2 } from "lucide-react";
import { useS3Upload } from "@/src/hooks/useS3Upload";

export default function AvatarUploader() {
  const { user, login } = useAuthStore();

  // 🚀 S3 Engine Hook
  const { uploadFile, isUploading: isS3Uploading } = useS3Upload();
  const [isUpdatingDB, setIsUpdatingDB] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Unified loading state
  const isUploading = isS3Uploading || isUpdatingDB;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];

    // Initial memory check
    const currentToken = useAuthStore.getState().token;
    if (!file || !user || !currentToken) return;

    try {
      // 1. FILE STORAGE UPLOAD
      // Agar token expire hua toh yeh hook background mein naya token mangwa kar Zustand mein rakh dega
      const uploadData = await uploadFile(file);

      if (!uploadData || !uploadData.url) {
        throw new Error("S3 Cloud storage upload rejected the file.");
      }

      setIsUpdatingDB(true);

      // 2. FETCH LATEST TOKEN (Closure Trap Bypass)
      // Kyunke S3 uploader ne shayad naya token fetch kar liya ho.
      const latestToken = useAuthStore.getState().token;

      // 🛡️ TYPE SAFETY GUARD: TypeScript ko strict guarantee do ke token null nahi hai
      if (!latestToken) {
        throw new Error(
          "Authentication token was lost during the upload pipeline.",
        );
      }

      // 3. DATABASE RECORD SYNC
      const updateRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/users/avatar`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${latestToken}`,
        },
        body: JSON.stringify({ avatarUrl: uploadData.url }),
      });

      if (!updateRes.ok) {
        throw new Error("Database avatar link mapping failed.");
      }

      const updateData = await updateRes.json();

      // 4. GLOBAL STATE OVERWRITE WITH CACHE BUSTING
      const updatedUserWithCache = {
        ...updateData.user,
        avatarUrl: `${updateData.user.avatarUrl}?t=${Date.now()}`,
      };

      // Type-safe login trigger
      login(updatedUserWithCache, latestToken);
    } catch (error) {
      console.error("❌ Avatar Injection Pipeline Failed:", error);
      alert("Failed to update avatar. Check console.");
    } finally {
      setIsUpdatingDB(false);
      // Reset DOM input
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  if (!user) return null;

  return (
    <div className="flex flex-col items-center gap-3 select-none">
      {/* 🚀 FIXED RADIUS: !rounded-2xl applies the square-snap aesthetic */}
      <div
        className="relative group cursor-pointer !rounded-2xl overflow-hidden transition-all duration-200 hover:ring-2 hover:ring-primary hover:ring-offset-2"
        onClick={() => !isUploading && fileInputRef.current?.click()}
      >
        <Avatar className="h-24 w-24 border border-border shadow-sm !rounded-2xl">
          <AvatarImage
            src={
              user.avatarUrl ||
              `https://api.dicebear.com/7.x/initials/svg?seed=${user.name}`
            }
            className="object-cover w-full h-full !rounded-2xl"
          />
          <AvatarFallback className="bg-primary/5 text-primary text-xl font-bold !rounded-2xl">
            {user.name.substring(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>

        {/* Hover Overlay Engine */}
        <div
          className={`absolute inset-0 bg-black/40 flex items-center justify-center transition-opacity duration-200 ${
            isUploading ? "opacity-100" : "opacity-0 group-hover:opacity-100"
          }`}
        >
          {isUploading ? (
            <Loader2 className="h-6 w-6 text-white animate-spin" />
          ) : (
            <Camera className="h-6 w-6 text-white" />
          )}
        </div>

        <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          accept="image/png, image/jpeg, image/webp"
          onChange={handleFileChange}
          disabled={isUploading}
        />
      </div>

      <div className="text-center">
        <h3 className="font-bold text-[15px] text-foreground">{user.name}</h3>
        <p className="text-xs text-muted-foreground font-medium">
          {user.email}
        </p>
      </div>
    </div>
  );
}

