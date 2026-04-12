import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Bell, Mail, Check, CheckCheck, Package, Clock, XCircle, ArrowLeft, LogOut } from "lucide-react";
import { useLocation } from "wouter";

export default function DeliveryNotifications() {
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();

  const { data: notifications, isLoading: loadingNotifications } = trpc.notifications.list.useQuery();
  const { data: messages, isLoading: loadingMessages } = trpc.messages.list.useQuery();
  const { data: unreadNotifications } = trpc.notifications.unreadCount.useQuery();
  const { data: unreadMessages } = trpc.messages.unreadCount.useQuery();
  const { data: user } = trpc.auth.me.useQuery();

  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => {
      window.location.href = "/";
    },
  });

  const markNotificationMutation = trpc.notifications.markAsRead.useMutation({
    onSuccess: () => {
      utils.notifications.list.invalidate();
      utils.notifications.unreadCount.invalidate();
    },
  });

  const markAllNotificationsMutation = trpc.notifications.markAllAsRead.useMutation({
    onSuccess: () => {
      toast.success("تم تحديد جميع الإشعارات كمقروءة");
      utils.notifications.list.invalidate();
      utils.notifications.unreadCount.invalidate();
    },
  });

  const markMessageMutation = trpc.messages.markAsRead.useMutation({
    onSuccess: () => {
      utils.messages.list.invalidate();
      utils.messages.unreadCount.invalidate();
    },
  });

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "order_assigned":
        return <Package className="w-5 h-5 text-blue-600" />;
      case "order_delivered":
        return <CheckCheck className="w-5 h-5 text-green-600" />;
      case "order_postponed":
        return <Clock className="w-5 h-5 text-orange-600" />;
      case "order_returned":
        return <XCircle className="w-5 h-5 text-purple-600" />;
      case "message":
        return <Mail className="w-5 h-5 text-emerald-600" />;
      default:
        return <Bell className="w-5 h-5 text-gray-600" />;
    }
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString("ar-IQ", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 lg:p-8" dir="rtl">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                onClick={() => setLocation("/delivery/dashboard")}
              >
                <ArrowLeft className="w-4 h-4 ml-2" />
                العودة
              </Button>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">الإشعارات والرسائل</h1>
                <p className="text-gray-600 mt-2">مرحباً {user?.name}</p>
              </div>
            </div>
            <Button
              variant="outline"
              className="border-red-300 text-red-700 hover:bg-red-50"
              onClick={() => logoutMutation.mutate()}
            >
              <LogOut className="w-4 h-4 ml-2" />
              تسجيل الخروج
            </Button>
          </div>
        </div>

        <Tabs defaultValue="notifications" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="notifications" className="relative">
              <Bell className="w-4 h-4 ml-2" />
              الإشعارات
              {(unreadNotifications || 0) > 0 && (
                <Badge className="mr-2 bg-red-500">{unreadNotifications}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="messages" className="relative">
              <Mail className="w-4 h-4 ml-2" />
              الرسائل
              {(unreadMessages || 0) > 0 && (
                <Badge className="mr-2 bg-red-500">{unreadMessages}</Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="notifications" className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold">جميع الإشعارات</h2>
              {(unreadNotifications || 0) > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => markAllNotificationsMutation.mutate()}
                >
                  <CheckCheck className="w-4 h-4 ml-2" />
                  تحديد الكل كمقروء
                </Button>
              )}
            </div>

            {loadingNotifications ? (
              <Card>
                <CardContent className="p-8 text-center text-gray-500">
                  جاري التحميل...
                </CardContent>
              </Card>
            ) : notifications && notifications.length > 0 ? (
              <div className="space-y-3">
                {notifications.map((notification: any) => (
                  <Card
                    key={notification.id}
                    className={`cursor-pointer transition-all hover:shadow-md ${
                      !notification.isRead ? "border-r-4 border-r-emerald-500 bg-emerald-50/30" : ""
                    }`}
                    onClick={() => {
                      if (!notification.isRead) {
                        markNotificationMutation.mutate({ id: notification.id });
                      }
                    }}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start gap-4">
                        <div className="flex-shrink-0">
                          {getNotificationIcon(notification.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <h3 className="font-semibold text-gray-900">{notification.title}</h3>
                            {!notification.isRead && (
                              <Badge variant="secondary" className="bg-emerald-100 text-emerald-700">
                                جديد
                              </Badge>
                            )}
                          </div>
                          <p className="text-gray-600 mt-1">{notification.message}</p>
                          <p className="text-sm text-gray-500 mt-2">
                            {formatDate(notification.createdAt)}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="p-8 text-center">
                  <Bell className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-500">لا توجد إشعارات</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="messages" className="space-y-4">
            <h2 className="text-xl font-semibold">الرسائل من الإدارة</h2>

            {loadingMessages ? (
              <Card>
                <CardContent className="p-8 text-center text-gray-500">
                  جاري التحميل...
                </CardContent>
              </Card>
            ) : messages && messages.length > 0 ? (
              <div className="space-y-3">
                {messages.map((message: any) => (
                  <Card
                    key={message.id}
                    className={`cursor-pointer transition-all hover:shadow-md ${
                      !message.isRead ? "border-r-4 border-r-blue-500 bg-blue-50/30" : ""
                    }`}
                    onClick={() => {
                      if (!message.isRead) {
                        markMessageMutation.mutate({ id: message.id });
                      }
                    }}
                  >
                    <CardHeader>
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="text-lg">{message.title}</CardTitle>
                        {!message.isRead && (
                          <Badge variant="secondary" className="bg-blue-100 text-blue-700">
                            جديد
                          </Badge>
                        )}
                      </div>
                      <CardDescription>{formatDate(message.createdAt)}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p className="text-gray-700 whitespace-pre-wrap">{message.content}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="p-8 text-center">
                  <Mail className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-500">لا توجد رسائل</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>

        {/* Footer */}
        <footer className="bg-white rounded-xl shadow-sm p-6 border border-gray-200 text-center">
          <p className="text-gray-600">
            جميع الحقوق محفوظة لـ <span className="font-bold text-emerald-600">HarthHDR</span> © {new Date().getFullYear()}
          </p>
        </footer>
      </div>
    </div>
  );
}
