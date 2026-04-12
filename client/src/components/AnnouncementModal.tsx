import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertCircle, CheckCircle, Info } from "lucide-react";

export default function AnnouncementModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [announcement, setAnnouncement] = useState<any>(null);

  const { data: activeAnnouncement } = trpc.announcements.getActive.useQuery(undefined, {
    refetchOnWindowFocus: false,
    refetchOnMount: true,
  });

  const markAsReadMutation = trpc.announcements.markAsRead.useMutation({
    onSuccess: () => {
      setIsOpen(false);
      setAnnouncement(null);
    },
  });

  useEffect(() => {
    if (activeAnnouncement) {
      setAnnouncement(activeAnnouncement);
      setIsOpen(true);
    }
  }, [activeAnnouncement]);

  const handleClose = () => {
    if (announcement) {
      markAsReadMutation.mutate({ announcementId: announcement.id });
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "info":
        return <Info className="w-8 h-8 text-blue-500" />;
      case "warning":
        return <AlertCircle className="w-8 h-8 text-orange-500" />;
      case "success":
        return <CheckCircle className="w-8 h-8 text-green-500" />;
      default:
        return <Info className="w-8 h-8 text-blue-500" />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case "info":
        return "bg-blue-50 border-blue-200";
      case "warning":
        return "bg-orange-50 border-orange-200";
      case "success":
        return "bg-green-50 border-green-200";
      default:
        return "bg-gray-50 border-gray-200";
    }
  };

  if (!announcement) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            {getTypeIcon(announcement.type)}
            <DialogTitle className="text-2xl">{announcement.title}</DialogTitle>
          </div>
          <DialogDescription>
            {new Date(announcement.createdAt).toLocaleDateString("ar-IQ", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </DialogDescription>
        </DialogHeader>
        <div className={`p-4 rounded-lg border ${getTypeColor(announcement.type)}`}>
          <p className="text-base leading-relaxed whitespace-pre-wrap">{announcement.content}</p>
        </div>
        <DialogFooter>
          <Button onClick={handleClose} disabled={markAsReadMutation.isPending}>
            فهمت
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
