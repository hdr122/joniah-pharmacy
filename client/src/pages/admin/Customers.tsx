import { useState, useEffect } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Loader2, Users, Search, Phone, Mail, MapPin, ExternalLink, Filter, X, Download, ChevronDown } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { SearchableSelect } from "@/components/SearchableSelect";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";

const CUSTOMERS_PER_PAGE = 500;

export default function Customers() {
  const [, setLocation] = useLocation();
  const searchParams = useSearch();
  
  // Parse URL params for filter state
  const urlParams = new URLSearchParams(searchParams);
  const initialFilterMode = (urlParams.get('filterMode') as any) || 'all';
  const initialSearchQuery = urlParams.get('search') || '';
  const initialOrderCountOperator = (urlParams.get('orderCountOp') as any) || 'gt';
  const initialOrderCount = parseInt(urlParams.get('orderCount') || '5');
  const initialInactiveDays = parseInt(urlParams.get('inactiveDays') || '30');
  const initialInactiveMonths = parseInt(urlParams.get('inactiveMonths') || '0');
  const initialInactiveSinceDate = urlParams.get('inactiveSince') || '';
  const initialOrderStatusFilter = (urlParams.get('orderStatus') as any) || 'delivered';
  const initialDeliveryPersonId = urlParams.get('deliveryPersonId') || '';
  const initialRegionId = urlParams.get('regionId') || '';
  const initialSpentRange = (urlParams.get('spentRange') as any) || '';
  
  const [searchQuery, setSearchQuery] = useState(initialSearchQuery);
  const [filterMode, setFilterMode] = useState<'all' | 'orderCount' | 'inactive' | 'advanced' | 'orderStatus' | 'spentRange'>(initialFilterMode);
  const [spentRange, setSpentRange] = useState<'all' | 'under50k' | '50k-100k' | '100k-500k' | 'over500k'>(initialSpentRange || 'all');
  
  // Order count filter
  const [orderCountOperator, setOrderCountOperator] = useState<'gt' | 'lt' | 'eq'>(initialOrderCountOperator);
  const [orderCount, setOrderCount] = useState<number>(initialOrderCount);
  
  // Inactive filter
  const [inactiveDays, setInactiveDays] = useState<number>(initialInactiveDays);
  const [inactiveMonths, setInactiveMonths] = useState<number>(initialInactiveMonths);
  const [inactiveSinceDate, setInactiveSinceDate] = useState<string>(initialInactiveSinceDate);
  
  // Order status filter
  const [orderStatusFilter, setOrderStatusFilter] = useState<'delivered' | 'returned' | 'cancelled' | 'postponed'>(initialOrderStatusFilter);
  const [deliveryPersonId, setDeliveryPersonId] = useState<string>(initialDeliveryPersonId);
  const [regionId, setRegionId] = useState<string>(initialRegionId);
  
  // Pagination
  const [displayLimit, setDisplayLimit] = useState(CUSTOMERS_PER_PAGE);
  
  // toast from sonner
  
  // Update URL params when filters change
  useEffect(() => {
    const params = new URLSearchParams();
    if (filterMode !== 'all') params.set('filterMode', filterMode);
    if (searchQuery) params.set('search', searchQuery);
    if (orderCountOperator !== 'gt') params.set('orderCountOp', orderCountOperator);
    if (orderCount !== 5) params.set('orderCount', orderCount.toString());
    if (inactiveDays !== 30) params.set('inactiveDays', inactiveDays.toString());
    if (inactiveMonths !== 0) params.set('inactiveMonths', inactiveMonths.toString());
    if (inactiveSinceDate) params.set('inactiveSince', inactiveSinceDate);
    if (orderStatusFilter !== 'delivered') params.set('orderStatus', orderStatusFilter);
    if (deliveryPersonId) params.set('deliveryPersonId', deliveryPersonId);
    if (regionId) params.set('regionId', regionId);
    if (spentRange) params.set('spentRange', spentRange);
    
    const newSearch = params.toString();
    const currentPath = window.location.pathname;
    setLocation(`${currentPath}${newSearch ? '?' + newSearch : ''}`, { replace: true });
  }, [filterMode, searchQuery, orderCountOperator, orderCount, inactiveDays, inactiveMonths, inactiveSinceDate, orderStatusFilter, deliveryPersonId, regionId, spentRange]);
  
  const { data: customers, isLoading } = trpc.customers.list.useQuery();
  const { data: searchResults } = trpc.customers.search.useQuery(
    { query: searchQuery, spentRange: spentRange !== 'all' ? spentRange : undefined },
    { enabled: searchQuery.length > 0 || (!!spentRange && spentRange !== 'all') }
  );
  
  // Filtered customers based on selected mode
  const { data: orderCountFiltered } = trpc.customers.filterByOrderCount.useQuery(
    { operator: orderCountOperator, count: orderCount },
    { enabled: filterMode === 'orderCount' }
  );
  
  const { data: inactiveFiltered } = trpc.customers.getInactive.useQuery(
    {
      days: inactiveDays > 0 ? inactiveDays : undefined,
      months: inactiveMonths > 0 ? inactiveMonths : undefined,
      sinceDate: inactiveSinceDate || undefined,
    },
    { enabled: filterMode === 'inactive' }
  );
  
  const { data: advancedFiltered } = trpc.customers.filterAdvanced.useQuery(
    {
      orderCountOperator,
      orderCount,
      inactiveDays: inactiveDays > 0 ? inactiveDays : undefined,
      inactiveMonths: inactiveMonths > 0 ? inactiveMonths : undefined,
      inactiveSinceDate: inactiveSinceDate || undefined,
    },
    { enabled: filterMode === 'advanced' }
  );
  
  const { data: orderStatusFiltered } = trpc.customers.search.useQuery(
    { query: '', orderStatus: orderStatusFilter },
    { enabled: filterMode === 'orderStatus' }
  );
  
  // Get delivery persons and regions for filters
  const { data: deliveryPersons } = trpc.users.getDeliveryPersons.useQuery();
  const { data: regions } = trpc.regions.list.useQuery();
  
  const allCustomers = searchQuery.length > 0 ? searchResults :
                       filterMode === 'orderCount' ? orderCountFiltered :
                       filterMode === 'inactive' ? inactiveFiltered :
                       filterMode === 'advanced' ? advancedFiltered :
                       filterMode === 'orderStatus' ? orderStatusFiltered :
                       filterMode === 'spentRange' ? searchResults :
                       customers;
  
  // Apply delivery person and region filters
  let filteredCustomers = allCustomers || [];
  if (deliveryPersonId) {
    filteredCustomers = filteredCustomers.filter((c: any) => 
      c.lastDeliveryPersonId?.toString() === deliveryPersonId
    );
  }
  if (regionId) {
    filteredCustomers = filteredCustomers.filter((c: any) => 
      c.regionId?.toString() === regionId
    );
  }
  
  // Paginate
  const displayCustomers = filteredCustomers.slice(0, displayLimit);
  const hasMore = filteredCustomers.length > displayLimit;
  
  // Export to CSV
  const exportToCSV = () => {
    if (!filteredCustomers || filteredCustomers.length === 0) {
      toast.error("لا توجد بيانات للتصدير");
      return;
    }
    
    const headers = ['الاسم', 'رقم الهاتف', 'البريد الإلكتروني', 'العنوان 1', 'العنوان 2', 'المنطقة', 'الملاحظات'];
    const rows = filteredCustomers.map((c: any) => [
      c.name || '',
      c.phone || '',
      c.email || '',
      c.address1 || '',
      c.address2 || '',
      c.regionName || '',
      c.notes || '',
    ]);
    
    const csvContent = [
      headers.join(','),
      ...rows.map((row: any) => row.map((cell: any) => `"${cell}"`).join(','))
    ].join('\n');
    
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `customers_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    
    toast.success("تم التصدير بنجاح", {
      description: `تم تصدير ${filteredCustomers.length} زبون`,
    });
  };
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }
  
  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">قائمة الزبائن</h1>
          <p className="text-gray-600 mt-2">إدارة بيانات الزبائن وسجل طلباتهم</p>
        </div>
        <Button
          onClick={exportToCSV}
          className="bg-emerald-600 hover:bg-emerald-700 gap-2"
        >
          <Download className="w-4 h-4" />
          تصدير Excel
        </Button>
      </div>

      {/* Filters Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-emerald-600" />
            فلاتر الزبائن
          </CardTitle>
          <CardDescription>اختر الفلاتر المطلوبة لعرض الزبائن</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Filter Mode Buttons */}
            <div className="flex flex-wrap gap-2">
              <Button
                variant={filterMode === 'all' ? 'default' : 'outline'}
                onClick={() => setFilterMode('all')}
                className={filterMode === 'all' ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
              >
                <Users className="w-4 h-4 ml-2" />
                جميع الزبائن
              </Button>
              <Button
                variant={filterMode === 'orderCount' ? 'default' : 'outline'}
                onClick={() => setFilterMode('orderCount')}
                className={filterMode === 'orderCount' ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
              >
                حسب عدد الطلبات
              </Button>
              <Button
                variant={filterMode === 'inactive' ? 'default' : 'outline'}
                onClick={() => setFilterMode('inactive')}
                className={filterMode === 'inactive' ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
              >
                زبائن غير نشطين
              </Button>
              <Button
                variant={filterMode === 'advanced' ? 'default' : 'outline'}
                onClick={() => setFilterMode('advanced')}
                className={filterMode === 'advanced' ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
              >
                فلاتر متقدمة
              </Button>
              <Button
                variant={filterMode === 'orderStatus' ? 'default' : 'outline'}
                onClick={() => setFilterMode('orderStatus')}
                className={filterMode === 'orderStatus' ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
              >
                حسب حالة الطلبات
              </Button>
              <Button
                variant={filterMode === 'spentRange' ? 'default' : 'outline'}
                onClick={() => setFilterMode('spentRange')}
                className={filterMode === 'spentRange' ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
              >
                حسب إجمالي المشتريات
              </Button>
            </div>
            
            {/* Delivery Person and Region Filters */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>المندوب</Label>
                <SearchableSelect
                  value={deliveryPersonId}
                  onValueChange={setDeliveryPersonId}
                  options={[
                    { value: '', label: 'جميع المندوبين' },
                    ...(deliveryPersons || []).map((dp: any) => ({
                      value: dp.id.toString(),
                      label: dp.name || dp.username || `مندوب ${dp.id}`
                    }))
                  ]}
                  placeholder="اختر المندوب"
                  searchPlaceholder="ابحث عن المندوب..."
                  emptyText="لا توجد نتائج"
                  className="mt-2"
                />
              </div>
              <div>
                <Label>المنطقة</Label>
                <SearchableSelect
                  value={regionId}
                  onValueChange={setRegionId}
                  options={[
                    { value: '', label: 'جميع المناطق' },
                    ...(regions || []).map((r: any) => ({
                      value: r.id.toString(),
                      label: r.name
                    }))
                  ]}
                  placeholder="اختر المنطقة"
                  searchPlaceholder="ابحث عن المنطقة..."
                  emptyText="لا توجد نتائج"
                  className="mt-2"
                />
              </div>
            </div>
            
            {/* Order Count Filter */}
            {filterMode === 'orderCount' && (
              <div className="grid grid-cols-2 gap-4 p-4 border rounded-lg bg-gray-50">
                <div>
                  <Label>العملية</Label>
                  <Select value={orderCountOperator} onValueChange={(v: any) => setOrderCountOperator(v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gt">أكثر من</SelectItem>
                      <SelectItem value="lt">أقل من</SelectItem>
                      <SelectItem value="eq">يساوي</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>عدد الطلبات</Label>
                  <Input
                    type="number"
                    value={orderCount}
                    onChange={(e) => setOrderCount(parseInt(e.target.value) || 0)}
                    min={0}
                  />
                </div>
              </div>
            )}
            
            {/* Inactive Filter */}
            {filterMode === 'inactive' && (
              <div className="grid grid-cols-3 gap-4 p-4 border rounded-lg bg-gray-50">
                <div>
                  <Label>عدد الأيام</Label>
                  <Input
                    type="number"
                    value={inactiveDays}
                    onChange={(e) => setInactiveDays(parseInt(e.target.value) || 0)}
                    min={0}
                    placeholder="30"
                  />
                </div>
                <div>
                  <Label>عدد الأشهر</Label>
                  <Input
                    type="number"
                    value={inactiveMonths}
                    onChange={(e) => setInactiveMonths(parseInt(e.target.value) || 0)}
                    min={0}
                    placeholder="0"
                  />
                </div>
                <div>
                  <Label>منذ تاريخ</Label>
                  <Input
                    type="date"
                    value={inactiveSinceDate}
                    onChange={(e) => setInactiveSinceDate(e.target.value)}
                  />
                </div>
              </div>
            )}
            
            {/* Order Status Filter */}
            {filterMode === 'orderStatus' && (
              <div className="p-4 border rounded-lg bg-gray-50">
                <Label>حالة الطلبات</Label>
                <Select value={orderStatusFilter} onValueChange={(v: any) => setOrderStatusFilter(v)}>
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="delivered">الطلبات المسلمة</SelectItem>
                    <SelectItem value="returned">الطلبات المرجوعة</SelectItem>
                    <SelectItem value="cancelled">الطلبات الملغية</SelectItem>
                    <SelectItem value="postponed">الطلبات المؤجلة</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground mt-2">
                  عرض الزبائن الذين لديهم طلبات بالحالة المختارة
                </p>
              </div>
            )}
            
            {/* Spent Range Filter */}
            {filterMode === 'spentRange' && (
              <div className="p-4 border rounded-lg bg-gray-50">
                <Label>إجمالي المشتريات</Label>
                <Select value={spentRange} onValueChange={(v: any) => setSpentRange(v)}>
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder="اختر نطاق القيمة" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">جميع الزبائن</SelectItem>
                    <SelectItem value="under50k">أقل من 50,000 دينار</SelectItem>
                    <SelectItem value="50k-100k">50,000 - 100,000 دينار</SelectItem>
                    <SelectItem value="100k-500k">100,000 - 500,000 دينار</SelectItem>
                    <SelectItem value="over500k">أكثر من 500,000 دينار</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground mt-2">
                  عرض الزبائن حسب إجمالي قيمة مشترياتهم (الطلبات المسلمة فقط)
                </p>
              </div>
            )}

            {/* Advanced Filter */}
            {filterMode === 'advanced' && (
              <div className="space-y-4 p-4 border rounded-lg bg-gray-50">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>عدد الطلبات</Label>
                    <div className="flex gap-2">
                      <Select value={orderCountOperator} onValueChange={(v: any) => setOrderCountOperator(v)}>
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="gt">أكثر من</SelectItem>
                          <SelectItem value="lt">أقل من</SelectItem>
                          <SelectItem value="eq">يساوي</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input
                        type="number"
                        value={orderCount}
                        onChange={(e) => setOrderCount(parseInt(e.target.value) || 0)}
                        min={0}
                      />
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label>عدد الأيام</Label>
                    <Input
                      type="number"
                      value={inactiveDays}
                      onChange={(e) => setInactiveDays(parseInt(e.target.value) || 0)}
                      min={0}
                    />
                  </div>
                  <div>
                    <Label>عدد الأشهر</Label>
                    <Input
                      type="number"
                      value={inactiveMonths}
                      onChange={(e) => setInactiveMonths(parseInt(e.target.value) || 0)}
                      min={0}
                    />
                  </div>
                  <div>
                    <Label>منذ تاريخ</Label>
                    <Input
                      type="date"
                      value={inactiveSinceDate}
                      onChange={(e) => setInactiveSinceDate(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            )}
            
            {/* Search */}
            <div className="flex items-center gap-2">
              <Search className="w-4 h-4 text-gray-500" />
              <Input
                placeholder="ابحث بالاسم، رقم الهاتف، أو البريد الإلكتروني..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="max-w-md"
              />
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Results Card */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-emerald-600" />
              الزبائن ({filteredCustomers?.length || 0})
            </CardTitle>
            <Badge variant="outline" className="text-sm">
              عرض {displayCustomers?.length || 0} من {filteredCustomers?.length || 0}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {!displayCustomers || displayCustomers.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Users className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p>لا توجد بيانات زبائن</p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>الاسم</TableHead>
                    <TableHead>رقم الهاتف</TableHead>
                    <TableHead>البريد الإلكتروني</TableHead>
                    <TableHead>العنوان</TableHead>
                    <TableHead>إجمالي المشتريات</TableHead>
                    <TableHead>الإجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayCustomers.map((customer: any) => (
                    <TableRow key={customer.id}>
                      <TableCell className="font-medium">
                        {customer.name || "غير محدد"}
                      </TableCell>
                      <TableCell>
                        {customer.phone ? (
                          <div className="flex items-center gap-2">
                            <Phone className="w-4 h-4 text-gray-500" />
                            {customer.phone}
                          </div>
                        ) : (
                          <span className="text-gray-400">غير محدد</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {customer.email ? (
                          <div className="flex items-center gap-2">
                            <Mail className="w-4 h-4 text-gray-500" />
                            {customer.email}
                          </div>
                        ) : (
                          <span className="text-gray-400">غير محدد</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {customer.address1 ? (
                          <div className="flex items-center gap-2">
                            <MapPin className="w-4 h-4 text-gray-500" />
                            <span className="truncate max-w-xs">{customer.address1}</span>
                          </div>
                        ) : (
                          <span className="text-gray-400">غير محدد</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {customer.totalSpent !== undefined ? (
                          <div className="font-medium text-emerald-600">
                            {new Intl.NumberFormat('en-US').format(customer.totalSpent)} دينار
                          </div>
                        ) : (
                          <span className="text-gray-400">0 دينار</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Link href={`/admin/customers/${customer.id}`}>
                          <Button variant="outline" size="sm" className="gap-2">
                            <ExternalLink className="w-4 h-4" />
                            عرض التفاصيل
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              
              {hasMore && (
                <div className="flex justify-center mt-6">
                  <Button
                    onClick={() => setDisplayLimit(prev => prev + CUSTOMERS_PER_PAGE)}
                    variant="outline"
                    className="gap-2"
                  >
                    <ChevronDown className="w-4 h-4" />
                    إظهار المزيد ({Math.min(CUSTOMERS_PER_PAGE, filteredCustomers.length - displayLimit)} زبون)
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
