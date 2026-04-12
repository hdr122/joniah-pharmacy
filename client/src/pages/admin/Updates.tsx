import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Bell, Calendar, Tag } from "lucide-react";

export default function Updates() {
  const { data: updates, isLoading } = trpc.updates.list.useQuery();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "update":
        return "تحديث";
      case "news":
        return "خبر";
      case "feature":
        return "ميزة جديدة";
      case "maintenance":
        return "صيانة";
      default:
        return type;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case "update":
        return "bg-blue-500/10 text-blue-500";
      case "news":
        return "bg-green-500/10 text-green-500";
      case "feature":
        return "bg-purple-500/10 text-purple-500";
      case "maintenance":
        return "bg-orange-500/10 text-orange-500";
      default:
        return "bg-gray-500/10 text-gray-500";
    }
  };

  return (
    <div className="container mx-auto py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">التحديثات والأخبار</h1>
        <p className="text-muted-foreground">آخر التحديثات والأخبار من الإدارة</p>
      </div>

      <div className="grid gap-6">
        {updates && updates.length === 0 && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16">
              <Bell className="w-16 h-16 text-muted-foreground mb-4" />
              <p className="text-xl font-semibold mb-2">لا توجد تحديثات</p>
              <p className="text-muted-foreground text-center">
                لم يتم نشر أي تحديثات أو أخبار بعد
              </p>
            </CardContent>
          </Card>
        )}

        {updates?.map((update) => (
          <Card key={update.id} className="overflow-hidden hover:shadow-lg transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge className={getTypeColor(update.type)}>
                      <Tag className="w-3 h-3 ml-1" />
                      {getTypeLabel(update.type)}
                    </Badge>
                  </div>
                  <CardTitle className="text-2xl mb-2">{update.title}</CardTitle>
                  <CardDescription className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    {new Date(update.createdAt).toLocaleDateString("ar-IQ", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="prose prose-sm max-w-none">
                <p className="text-base leading-relaxed whitespace-pre-wrap">{update.content}</p>
              </div>
              {update.imageUrl && (
                <div className="mt-4">
                  <img
                    src={update.imageUrl}
                    alt={update.title}
                    className="rounded-lg w-full h-auto object-cover max-h-96"
                  />
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
