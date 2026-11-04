import React from "react";
import { Check, CheckCheck, Clock } from "lucide-react";

interface MessageStatusProps {
  status: string;
  isReadRealtime: boolean;
  isChannel: boolean;
  isTargetOnline: boolean;
}

export const MessageStatus = ({
  status,
  isReadRealtime,
  isChannel,
  isTargetOnline,
}: MessageStatusProps) => {
  if (isChannel) {
    if (status === "pending")
      return (
        <Clock className="h-3 w-3 text-muted-foreground animate-pulse ml-2" />
      );
    return null;
  }

  const safeStatus = status || "delivered";
  const effectivelyDelivered =
    safeStatus === "delivered" || (safeStatus === "sent" && isTargetOnline);

  return (
    <span className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity duration-150 flex items-center ml-2 select-none">
      {safeStatus === "pending" && <Clock className="h-3 w-3 animate-pulse" />}
      {safeStatus === "sent" && !effectivelyDelivered && !isReadRealtime && (
        <Check className="h-3 w-3" />
      )}
      {effectivelyDelivered && !isReadRealtime && (
        <CheckCheck className="h-3.5 w-3.5" />
      )}
      {isReadRealtime && <CheckCheck className="h-3.5 w-3.5 text-blue-500" />}
    </span>
  );
};
