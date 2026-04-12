import { AlertTriangle, Clock, Wrench } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface MaintenanceProps {
  message?: string;
  estimatedEndTime?: string | null;
}

export default function Maintenance({ message, estimatedEndTime }: MaintenanceProps) {
  const defaultMessage = "الموقع تحت الصيانة حالياً. سنعود قريباً!";
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 to-teal-50 p-4">
      <Card className="max-w-md w-full">
        <CardContent className="pt-6 text-center space-y-6">
          {/* أيقونة الصيانة */}
          <div className="flex justify-center">
            <div className="relative">
              <div className="absolute inset-0 bg-yellow-400 rounded-full blur-xl opacity-50 animate-pulse"></div>
              <div className="relative bg-gradient-to-br from-yellow-400 to-orange-500 p-6 rounded-full">
                <Wrench className="h-16 w-16 text-white" />
              </div>
            </div>
          </div>

          {/* العنوان */}
          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-gray-900">
              الموقع تحت الصيانة
            </h1>
            <div className="flex items-center justify-center gap-2 text-yellow-600">
              <AlertTriangle className="h-5 w-5" />
              <span className="text-sm font-medium">نعمل على تحسين الخدمة</span>
            </div>
          </div>

          {/* الرسالة */}
          <p className="text-gray-600 text-lg leading-relaxed">
            {message || defaultMessage}
          </p>

          {/* وقت الانتهاء المتوقع */}
          {estimatedEndTime && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center justify-center gap-2 text-blue-700">
                <Clock className="h-5 w-5" />
                <div className="text-sm">
                  <p className="font-semibold">الوقت المتوقع للانتهاء:</p>
                  <p>{new Date(estimatedEndTime).toLocaleString('ar-IQ', { hour12: false,
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}</p>
                </div>
              </div>
            </div>
          )}

          {/* رسالة إضافية */}
          <div className="text-sm text-gray-500 space-y-1">
            <p>نعتذر عن أي إزعاج قد يسببه ذلك</p>
            <p>شكراً لتفهمكم وصبركم</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
