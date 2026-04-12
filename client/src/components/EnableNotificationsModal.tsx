import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Bell, BellOff, X } from 'lucide-react';
import { toast } from 'sonner';

declare global {
  interface Window {
    OneSignal: any;
    OneSignalDeferred: any[];
  }
}

interface EnableNotificationsModalProps {
  userId: number;
  branchId: number;
}

export default function EnableNotificationsModal({ userId, branchId }: EnableNotificationsModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isEnabling, setIsEnabling] = useState(false);

  useEffect(() => {
    // Check if user has already seen this modal
    const hasSeenModal = localStorage.getItem('notifications_modal_seen');
    
    if (!hasSeenModal) {
      // Show modal if user hasn't seen it before
      setIsOpen(true);
    }
  }, []);

  const handleEnableNotifications = async () => {
    setIsEnabling(true);
    
    try {
      // Wait for OneSignal to be ready
      if (!window.OneSignalDeferred) {
        toast.error('نظام الإشعارات غير متاح حالياً');
        setIsEnabling(false);
        return;
      }

      // Use OneSignalDeferred to ensure SDK is loaded
      window.OneSignalDeferred.push(async function(OneSignal: any) {
        try {
          // Request notification permission
          const permission = await OneSignal.Notifications.requestPermission();
          
          if (permission) {
            // Set external user ID and tags
            await OneSignal.login(userId.toString());
            await OneSignal.User.addTags({
              branchId: branchId.toString(),
              userId: userId.toString(),
            });
            
            toast.success('تم تفعيل الإشعارات بنجاح! ستصلك إشعارات عند وجود طلبات جديدة');
            
            // Mark modal as seen
            localStorage.setItem('notifications_modal_seen', 'true');
            setIsOpen(false);
          } else {
            toast.error('تم رفض إذن الإشعارات. يمكنك تفعيلها لاحقاً من إعدادات المتصفح');
            localStorage.setItem('notifications_modal_seen', 'true');
            setIsOpen(false);
          }
          setIsEnabling(false);
        } catch (error) {
          console.error('Error enabling notifications:', error);
          toast.error('حدث خطأ أثناء تفعيل الإشعارات: ' + (error as Error).message);
          setIsEnabling(false);
        }
      });
    } catch (error) {
      console.error('Error enabling notifications:', error);
      toast.error('حدث خطأ أثناء تفعيل الإشعارات');
      setIsEnabling(false);
    }
  };

  const handleSkip = () => {
    // Mark modal as seen so it doesn't show again
    localStorage.setItem('notifications_modal_seen', 'true');
    setIsOpen(false);
    toast.info('يمكنك تفعيل الإشعارات لاحقاً من الإعدادات');
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center justify-center mb-4">
            <div className="bg-blue-100 p-4 rounded-full">
              <Bell className="h-12 w-12 text-blue-600" />
            </div>
          </div>
          <DialogTitle className="text-center text-2xl">تفعيل الإشعارات</DialogTitle>
          <DialogDescription className="text-center text-base">
            فعّل الإشعارات لتصلك تنبيهات فورية عند:
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-4">
          <div className="flex items-start gap-3 p-3 bg-green-50 rounded-lg">
            <Bell className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-semibold text-green-900">طلب جديد</p>
              <p className="text-sm text-green-700">إشعار فوري عند تعيين طلب جديد لك</p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg">
            <Bell className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-semibold text-blue-900">تعديل الطلب</p>
              <p className="text-sm text-blue-700">تنبيه عند تعديل تفاصيل أي طلب</p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 bg-orange-50 rounded-lg">
            <Bell className="h-5 w-5 text-orange-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-semibold text-orange-900">رسائل مهمة</p>
              <p className="text-sm text-orange-700">استلام رسائل من الإدارة</p>
            </div>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-col gap-2">
          <Button
            onClick={handleEnableNotifications}
            disabled={isEnabling}
            className="w-full"
            size="lg"
          >
            <Bell className="ml-2 h-5 w-5" />
            {isEnabling ? 'جاري التفعيل...' : 'تفعيل الإشعارات'}
          </Button>

          <Button
            onClick={handleSkip}
            variant="ghost"
            className="w-full"
            size="lg"
          >
            <X className="ml-2 h-4 w-4" />
            تخطي (يمكن التفعيل لاحقاً)
          </Button>
        </DialogFooter>

        <p className="text-xs text-center text-muted-foreground mt-2">
          يمكنك تفعيل أو إيقاف الإشعارات في أي وقت من صفحة الإعدادات
        </p>
      </DialogContent>
    </Dialog>
  );
}
