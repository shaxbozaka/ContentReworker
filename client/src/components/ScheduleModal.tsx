import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { X, Check, Loader2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import SmartTimePicker from "./SmartTimePicker";

interface ScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  content: string;
  platform: string;
  hookLabel?: string;
}

interface ScheduledPost {
  id: number;
  scheduledAt: string;
}

export default function ScheduleModal({
  isOpen,
  onClose,
  content,
  platform,
}: ScheduleModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();

  const { data: postsData } = useQuery<{ posts: ScheduledPost[] }>({
    queryKey: ["/api/scheduled-posts"],
    queryFn: async () => apiRequest<{ posts: ScheduledPost[] }>("/api/scheduled-posts"),
  });

  const existingDates = postsData?.posts
    .filter(p => p.scheduledAt)
    .map(p => new Date(p.scheduledAt)) || [];

  const createMutation = useMutation({
    mutationFn: async (data: { content: string; platform: string; scheduledAt: string }) => {
      return apiRequest("/api/scheduled-posts", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/scheduled-posts"] });
      toast({ title: "Post scheduled" });
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Failed to schedule",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSchedule = () => {
    if (!selectedDate) {
      toast({ title: "Pick a time", variant: "destructive" });
      return;
    }

    createMutation.mutate({
      content,
      platform: platform.toLowerCase(),
      scheduledAt: selectedDate.toISOString(),
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/80" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-sm bg-[#141414] rounded-xl border border-white/10">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <h3 className="font-semibold text-white">Schedule Post</h3>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-white/10 text-white/50 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Time Picker */}
        <div className="p-4">
          <p className="text-white/50 text-sm mb-4">When should this go live?</p>
          <SmartTimePicker
            onSelect={setSelectedDate}
            selectedDate={selectedDate}
            existingPostDates={existingDates}
          />
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/10 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-lg text-sm text-white/60 hover:text-white hover:bg-white/10"
          >
            Cancel
          </button>
          <button
            onClick={handleSchedule}
            disabled={!selectedDate || createMutation.isPending}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-white text-black font-medium text-sm disabled:opacity-30"
          >
            {createMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Check className="w-4 h-4" />
            )}
            Schedule
          </button>
        </div>
      </div>
    </div>
  );
}
