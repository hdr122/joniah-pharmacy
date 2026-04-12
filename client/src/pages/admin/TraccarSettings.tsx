import { useState } from "react";
import { Copy, Check, Download, Smartphone, Wifi, WifiOff, Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export default function TraccarSettings() {
  const [copied, setCopied] = useState(false);
  const [testingUserId, setTestingUserId] = useState<number | null>(null);
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [credentials, setCredentials] = useState<{[key: number]: {username: string, password: string}}>({});
  
  // Get all delivery persons
  const { data: deliveryPersons } = trpc.users.getDeliveryPersons.useQuery();
  
  const utils = trpc.useUtils();
  
  // Update Traccar credentials mutation
  const updateCredentialsMutation = trpc.gps.updateTraccarCredentials.useMutation({
    onSuccess: () => {
      toast.success('تم حفظ بيانات Traccar بنجاح');
      setEditingUserId(null);
      utils.users.getDeliveryPersons.invalidate();
    },
    onError: (error) => {
      toast.error('فشل حفظ البيانات', { description: error.message });
    }
  });
  
  // Test connection mutation
  const testConnectionMutation = trpc.gps.testTraccarConnection.useMutation();
  
  // Get current domain
  const serverUrl = `${window.location.origin}/api/traccar`;
  
  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success("تم نسخ الرابط إلى الحافظة");
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error("فشل نسخ الرابط");
    }
  };

  const downloadGuide = (type: 'delivery' | 'admin') => {
    const filename = type === 'delivery' ? 'TRACCAR_DELIVERY_GUIDE.md' : 'TRACCAR_ADMIN_GUIDE.md';
    window.open(`/${filename}`, '_blank');
    toast.success(`تم فتح دليل ${type === 'delivery' ? 'المندوبين' : 'الإدارة'}`);
  };

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">إعدادات Traccar</h1>
        <p className="text-muted-foreground mt-2">
          إعدادات تطبيق Traccar Client لتتبع مواقع المندوبين
        </p>
      </div>

      {/* Server URL Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5" />
            رابط السيرفر (Server URL)
          </CardTitle>
          <CardDescription>
            استخدم هذا الرابط في إعدادات تطبيق Traccar Client على هواتف المندوبين
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="server-url">Server URL</Label>
            <div className="flex gap-2">
              <Input
                id="server-url"
                value={serverUrl}
                readOnly
                className="font-mono text-sm"
                dir="ltr"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => copyToClipboard(serverUrl)}
              >
                {copied ? (
                  <Check className="h-4 w-4 text-green-600" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          <div className="bg-muted p-4 rounded-lg space-y-2">
            <h4 className="font-semibold text-sm">ملاحظة مهمة:</h4>
            <ul className="text-sm space-y-1 list-disc list-inside text-muted-foreground">
              <li>يجب على المندوب إدخال <strong>username</strong> الخاص به في حقل <strong>Device Identifier</strong></li>
              <li>يجب ضبط <strong>Frequency</strong> على <strong>15 seconds</strong></li>
              <li>يجب منح التطبيق صلاحية الموقع <strong>"السماح دائماً"</strong></li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* QR Code Card */}
      <Card>
        <CardHeader>
          <CardTitle>QR Code للإعدادات</CardTitle>
          <CardDescription>
            يمكن للمندوب مسح هذا الكود لنسخ رابط السيرفر تلقائياً
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4">
          <div className="bg-white p-4 rounded-lg border">
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(serverUrl)}`}
              alt="QR Code"
              className="w-48 h-48"
            />
          </div>
          <p className="text-sm text-muted-foreground text-center">
            امسح هذا الكود باستخدام كاميرا الهاتف لنسخ رابط السيرفر
          </p>
        </CardContent>
      </Card>

      {/* Setup Instructions Card */}
      <Card>
        <CardHeader>
          <CardTitle>خطوات الإعداد السريعة</CardTitle>
          <CardDescription>
            دليل سريع لإعداد تطبيق Traccar على هاتف المندوب
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="space-y-3 list-decimal list-inside">
            <li className="text-sm">
              <strong>تحميل التطبيق:</strong> ابحث عن "Traccar Client" في Google Play أو App Store
            </li>
            <li className="text-sm">
              <strong>فتح الإعدادات:</strong> اضغط على أيقونة الإعدادات (⚙️) في التطبيق
            </li>
            <li className="text-sm">
              <strong>Device Identifier:</strong> أدخل username المندوب (مثل: <code className="bg-muted px-1 rounded">ibrahim</code>)
            </li>
            <li className="text-sm">
              <strong>Server URL:</strong> انسخ الرابط أعلاه أو امسح QR Code
            </li>
            <li className="text-sm">
              <strong>Frequency:</strong> اضبطه على <code className="bg-muted px-1 rounded">15 seconds</code>
            </li>
            <li className="text-sm">
              <strong>الصلاحيات:</strong> امنح التطبيق صلاحية "السماح دائماً" للموقع
            </li>
            <li className="text-sm">
              <strong>تفعيل التتبع:</strong> اضغط على "Service status" حتى يصبح أخضر (Online)
            </li>
          </ol>
        </CardContent>
      </Card>

      {/* Download Guides Card */}
      <Card>
        <CardHeader>
          <CardTitle>تحميل أدلة الاستخدام</CardTitle>
          <CardDescription>
            أدلة مفصلة لإعداد واستخدام تطبيق Traccar
          </CardDescription>
        </CardHeader>
        <CardContent className="flex gap-4">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => downloadGuide('delivery')}
          >
            <Download className="h-4 w-4 mr-2" />
            دليل المندوبين
          </Button>
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => downloadGuide('admin')}
          >
            <Download className="h-4 w-4 mr-2" />
            دليل الإدارة
          </Button>
        </CardContent>
      </Card>

      {/* Traccar Credentials Card */}
      <Card>
        <CardHeader>
          <CardTitle>بيانات اعتماد Traccar</CardTitle>
          <CardDescription>
            أدخل اسم المستخدم وكلمة المرور لخادم Traccar لكل مندوب
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {deliveryPersons?.map((person) => {
              const isEditing = editingUserId === person.id;
              const currentCreds = credentials[person.id] || { username: person.traccarUsername || '', password: '' };
              
              return (
                <div key={person.id} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-sm font-semibold">{(person.username || 'U').charAt(0).toUpperCase()}</span>
                      </div>
                      <div>
                        <p className="font-medium">{person.name}</p>
                        <p className="text-sm text-muted-foreground">@{person.username}</p>
                      </div>
                    </div>
                    
                    {!isEditing && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setEditingUserId(person.id);
                          setCredentials({
                            ...credentials,
                            [person.id]: {
                              username: person.traccarUsername || '',
                              password: ''
                            }
                          });
                        }}
                      >
                        {person.traccarUsername ? 'تعديل' : 'إضافة'}
                      </Button>
                    )}
                  </div>
                  
                  {isEditing ? (
                    <div className="space-y-3">
                      <div className="space-y-2">
                        <Label htmlFor={`username-${person.id}`}>اسم المستخدم (Traccar Username)</Label>
                        <Input
                          id={`username-${person.id}`}
                          value={currentCreds.username}
                          onChange={(e) => setCredentials({
                            ...credentials,
                            [person.id]: { ...currentCreds, username: e.target.value }
                          })}
                          placeholder="أدخل اسم المستخدم"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`password-${person.id}`}>كلمة المرور (Traccar Password)</Label>
                        <Input
                          id={`password-${person.id}`}
                          type="password"
                          value={currentCreds.password}
                          onChange={(e) => setCredentials({
                            ...credentials,
                            [person.id]: { ...currentCreds, password: e.target.value }
                          })}
                          placeholder="أدخل كلمة المرور"
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => {
                            updateCredentialsMutation.mutate({
                              deliveryPersonId: person.id,
                              traccarUsername: currentCreds.username,
                              traccarPassword: currentCreds.password
                            });
                          }}
                          disabled={!currentCreds.username || !currentCreds.password || updateCredentialsMutation.isPending}
                        >
                          {updateCredentialsMutation.isPending ? 'جاري الحفظ...' : 'حفظ'}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setEditingUserId(null)}
                        >
                          إلغاء
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground">
                      {person.traccarUsername ? (
                        <p>اسم المستخدم: <code className="bg-muted px-2 py-1 rounded">{person.traccarUsername}</code></p>
                      ) : (
                        <p className="text-orange-600">لم يتم إضافة بيانات Traccar بعد</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            
            {!deliveryPersons || deliveryPersons.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>لا يوجد مندوبون</p>
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {/* Test Connection Card */}
      <Card>
        <CardHeader>
          <CardTitle>اختبار الاتصال</CardTitle>
          <CardDescription>
            اختبر اتصال Traccar لكل مندوب للتأكد من عمل التتبع
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {deliveryPersons?.map((person) => {
              const isTesting = testingUserId === person.id;
              
              return (
                <div key={person.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="text-sm font-semibold">{(person.username || 'U').charAt(0).toUpperCase()}</span>
                    </div>
                    <div>
                      <p className="font-medium">{person.username || 'غير محدد'}</p>
                      <p className="text-sm text-muted-foreground">{person.phone || 'لا يوجد رقم'}</p>
                    </div>
                  </div>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isTesting}
                    onClick={async () => {
                      setTestingUserId(person.id);
                      try {
                        const result = await testConnectionMutation.mutateAsync({
                          deliveryPersonId: person.id
                        });
                        
                        if (result.connected) {
                          toast.success(
                            `✅ ${person.username} متصل`,
                            { description: result.message }
                          );
                        } else {
                          toast.error(
                            `❌ ${person.username} غير متصل`,
                            { description: result.message }
                          );
                        }
                      } catch (error: any) {
                        toast.error('فشل الاختبار', {
                          description: error.message || 'حدث خطأ أثناء اختبار الاتصال'
                        });
                      } finally {
                        setTestingUserId(null);
                      }
                    }}
                  >
                    {isTesting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        جاري الاختبار...
                      </>
                    ) : (
                      <>
                        <Wifi className="h-4 w-4 mr-2" />
                        اختبار الاتصال
                      </>
                    )}
                  </Button>
                </div>
              );
            })}
            
            {!deliveryPersons || deliveryPersons.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <WifiOff className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>لا يوجد مندوبون للاختبار</p>
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {/* Troubleshooting Card */}
      <Card>
        <CardHeader>
          <CardTitle>حل المشاكل الشائعة</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <h4 className="font-semibold text-sm mb-2">المندوب لا يظهر على الخريطة؟</h4>
              <ul className="text-sm space-y-1 list-disc list-inside text-muted-foreground">
                <li>تأكد من أن Service status = Online (أخضر)</li>
                <li>تأكد من صحة Server URL</li>
                <li>تأكد من صحة Device Identifier (username)</li>
                <li>تأكد من منح صلاحية الموقع "السماح دائماً"</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-sm mb-2">الموقع يتحدث ببطء؟</h4>
              <ul className="text-sm space-y-1 list-disc list-inside text-muted-foreground">
                <li>تحقق من إعدادات Frequency (يجب أن تكون 15 ثانية)</li>
                <li>تأكد من اتصال الإنترنت (4G/5G أو WiFi)</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-sm mb-2">التطبيق يتوقف في الخلفية؟</h4>
              <ul className="text-sm space-y-1 list-disc list-inside text-muted-foreground">
                <li>أندرويد: اذهب لإعدادات الهاتف → التطبيقات → Traccar → البطارية → "غير محدود"</li>
                <li>آيفون: اذهب لإعدادات الهاتف → الخصوصية → خدمات الموقع → Traccar → "دائماً"</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
