import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { RefreshCw, Trash2, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function DeletedBranches() {
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);
  const [branchToRestore, setBranchToRestore] = useState<any>(null);

  const { data: deletedBranches, isLoading, refetch } = trpc.branches.listDeleted.useQuery();

  const restoreBranchMutation = trpc.branches.restore.useMutation({
    onSuccess: () => {
      toast.success("تم استعادة الفرع بنجاح");
      setRestoreDialogOpen(false);
      setBranchToRestore(null);
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || "فشل استعادة الفرع");
    },
  });

  const getDaysRemaining = (deletedAt: string) => {
    const deleted = new Date(deletedAt);
    const expiryDate = new Date(deleted.getTime() + 30 * 24 * 60 * 60 * 1000);
    const now = new Date();
    const daysRemaining = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return daysRemaining;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto"></div>
          <p className="mt-4 text-muted-foreground">جاري التحميل...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-red-600 to-orange-600 bg-clip-text text-transparent">
            الفروع المحذوفة
          </h1>
          <p className="text-muted-foreground mt-2">
            يمكن استعادة الفروع المحذوفة خلال 30 يوم من تاريخ الحذف
          </p>
        </div>
        <Button onClick={() => refetch()} variant="outline">
          <RefreshCw className="w-4 h-4 ml-2" />
          تحديث
        </Button>
      </div>

      {/* Empty State */}
      {!deletedBranches || deletedBranches.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Trash2 className="w-16 h-16 text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">لا توجد فروع محذوفة</h3>
            <p className="text-muted-foreground text-center">
              جميع الفروع نشطة حالياً
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {deletedBranches.map((branch: any) => {
            const daysRemaining = getDaysRemaining(branch.deletedAt);
            const isExpiringSoon = daysRemaining <= 7;

            return (
              <Card key={branch.id} className="hover:shadow-lg transition-shadow border-red-200">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-xl text-red-600">{branch.name}</CardTitle>
                      <CardDescription>كود: {branch.code}</CardDescription>
                    </div>
                    <Badge variant={isExpiringSoon ? "destructive" : "secondary"}>
                      {daysRemaining} يوم متبقي
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* معلومات الفرع */}
                  <div className="space-y-2 text-sm">
                    {branch.phone && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        📞 {branch.phone}
                      </div>
                    )}
                    {branch.address && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        📍 {branch.address}
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-muted-foreground">
                      🗓️ تاريخ الحذف: {new Date(branch.deletedAt).toLocaleDateString('ar-IQ')}
                    </div>
                  </div>

                  {/* تحذير إذا كان قريب من الانتهاء */}
                  {isExpiringSoon && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
                      <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-red-800">
                        ⚠️ سيتم حذف هذا الفرع نهائياً خلال {daysRemaining} يوم
                      </p>
                    </div>
                  )}

                  {/* زر الاستعادة */}
                  <Button 
                    variant="outline" 
                    className="w-full border-emerald-600 text-emerald-600 hover:bg-emerald-50"
                    onClick={() => {
                      setBranchToRestore(branch);
                      setRestoreDialogOpen(true);
                    }}
                  >
                    <RefreshCw className="w-4 h-4 ml-2" />
                    استعادة الفرع
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Dialog لاستعادة الفرع */}
      <Dialog open={restoreDialogOpen} onOpenChange={setRestoreDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>استعادة الفرع</DialogTitle>
            <DialogDescription>
              هل أنت متأكد من استعادة الفرع "{branchToRestore?.name}"؟
            </DialogDescription>
          </DialogHeader>

          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
            <p className="text-sm text-emerald-800">
              ✅ سيتم استعادة الفرع وجميع بياناته وسيصبح نشطاً مرة أخرى.
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setRestoreDialogOpen(false)}>
              إلغاء
            </Button>
            <Button 
              className="bg-gradient-to-r from-emerald-600 to-teal-600"
              onClick={() => restoreBranchMutation.mutate({ id: branchToRestore?.id })}
              disabled={restoreBranchMutation.isPending}
            >
              {restoreBranchMutation.isPending ? "جاري الاستعادة..." : "استعادة الفرع"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
