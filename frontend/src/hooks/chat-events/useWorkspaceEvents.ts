import { useEffect } from "react";
import { useChatStore } from "@/src/store/chat";

export const useWorkspaceEvents = (socket: any) => {
  useEffect(() => {
    if (!socket) return;
    const chatState = useChatStore.getState;

    const handleMemberJoined = (data: { workspaceId: string; user: any }) => {
      const { activeWorkspaceId, users, setUsers } = chatState();

      // 🛡️ STRICT CHECK: Agar user active workspace mein hi hai tabhi sidebar update karo
      if (activeWorkspaceId === data.workspaceId) {
        // Duplicate data ko memory array mein aane se roko
        const isDuplicate = users.some((u) => u.id === data.user.id);
        if (!isDuplicate) {
          console.log("🟢 Real-time User Joined:", data.user.name);
          setUsers([...users, { ...data.user, unreadCount: 0 }]);
        }
      }
    };

    // BIND
    socket.on("workspace_member_joined", handleMemberJoined);

    // UNBIND
    return () => {
      socket.off("workspace_member_joined", handleMemberJoined);
    };
  }, [socket]);
};
