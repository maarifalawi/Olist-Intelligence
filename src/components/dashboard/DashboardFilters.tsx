import { useState } from 'react';
import { format } from 'date-fns';
import { CalendarIcon, Filter, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useData } from '@/context/DataContext';
import { getFilterOptions } from '@/lib/analytics';
import { cn } from '@/lib/utils';

export function DashboardFilters() {
  const { orderMart, filters, setFilters, resetFilters } = useData();
  const [isExpanded, setIsExpanded] = useState(false);
  
  const options = getFilterOptions(orderMart);
  
  const activeFilterCount = 
    (filters.dateRange.start ? 1 : 0) +
    (filters.dateRange.end ? 1 : 0) +
    filters.customerStates.length +
    filters.sellerStates.length +
    filters.categories.length +
    filters.paymentTypes.length;

  const handleStateChange = (type: 'customer' | 'seller', value: string) => {
    if (value === 'all') {
      setFilters(type === 'customer' ? { customerStates: [] } : { sellerStates: [] });
    } else {
      const current = type === 'customer' ? filters.customerStates : filters.sellerStates;
      const newValues = current.includes(value) 
        ? current.filter(s => s !== value)
        : [...current, value];
      setFilters(type === 'customer' ? { customerStates: newValues } : { sellerStates: newValues });
    }
  };

  const handleCategoryChange = (value: string) => {
    if (value === 'all') {
      setFilters({ categories: [] });
    } else {
      const newValues = filters.categories.includes(value)
        ? filters.categories.filter(c => c !== value)
        : [...filters.categories, value];
      setFilters({ categories: newValues });
    }
  };

  const handlePaymentChange = (value: string) => {
    if (value === 'all') {
      setFilters({ paymentTypes: [] });
    } else {
      const newValues = filters.paymentTypes.includes(value)
        ? filters.paymentTypes.filter(p => p !== value)
        : [...filters.paymentTypes, value];
      setFilters({ paymentTypes: newValues });
    }
  };

  return (
    <div className="dashboard-section !p-4 mb-6">
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsExpanded(!isExpanded)}
          className="gap-2"
        >
          <Filter className="w-4 h-4" />
          Filter
          {activeFilterCount > 0 && (
            <Badge variant="secondary" className="ml-1">
              {activeFilterCount}
            </Badge>
          )}
        </Button>
        
        {activeFilterCount > 0 && (
          <Button variant="ghost" size="sm" onClick={resetFilters} className="text-muted-foreground">
            <X className="w-4 h-4 mr-1" />
            Reset
          </Button>
        )}
      </div>

      {isExpanded && (
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 animate-fade-in">
          {/* Date Start */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
              Tanggal Mulai
            </label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal h-9",
                    !filters.dateRange.start && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {filters.dateRange.start 
                    ? format(filters.dateRange.start, "dd/MM/yyyy")
                    : "Pilih tanggal"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={filters.dateRange.start || undefined}
                  onSelect={(date) => setFilters({ dateRange: { ...filters.dateRange, start: date || null } })}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Date End */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
              Tanggal Akhir
            </label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal h-9",
                    !filters.dateRange.end && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {filters.dateRange.end 
                    ? format(filters.dateRange.end, "dd/MM/yyyy")
                    : "Pilih tanggal"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={filters.dateRange.end || undefined}
                  onSelect={(date) => setFilters({ dateRange: { ...filters.dateRange, end: date || null } })}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Customer State */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
              State Customer
            </label>
            <Select
              value={filters.customerStates.length === 0 ? 'all' : filters.customerStates[0]}
              onValueChange={(v) => handleStateChange('customer', v)}
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Semua state" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua State</SelectItem>
                {options.customerStates.map(state => (
                  <SelectItem key={state} value={state}>{state}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Seller State */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
              State Seller
            </label>
            <Select
              value={filters.sellerStates.length === 0 ? 'all' : filters.sellerStates[0]}
              onValueChange={(v) => handleStateChange('seller', v)}
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Semua state" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua State</SelectItem>
                {options.sellerStates.map(state => (
                  <SelectItem key={state} value={state}>{state}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Category */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
              Kategori
            </label>
            <Select
              value={filters.categories.length === 0 ? 'all' : filters.categories[0]}
              onValueChange={handleCategoryChange}
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Semua kategori" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Kategori</SelectItem>
                {options.categories.slice(0, 30).map(cat => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Payment Type */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
              Tipe Pembayaran
            </label>
            <Select
              value={filters.paymentTypes.length === 0 ? 'all' : filters.paymentTypes[0]}
              onValueChange={handlePaymentChange}
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Semua tipe" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Tipe</SelectItem>
                {options.paymentTypes.map(type => (
                  <SelectItem key={type} value={type}>{type}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {/* Active filters display */}
      {activeFilterCount > 0 && !isExpanded && (
        <div className="mt-3 flex flex-wrap gap-2">
          {filters.dateRange.start && (
            <Badge variant="secondary" className="text-xs">
              Dari: {format(filters.dateRange.start, "dd/MM/yy")}
            </Badge>
          )}
          {filters.dateRange.end && (
            <Badge variant="secondary" className="text-xs">
              Sampai: {format(filters.dateRange.end, "dd/MM/yy")}
            </Badge>
          )}
          {filters.customerStates.map(s => (
            <Badge key={`cs-${s}`} variant="secondary" className="text-xs">Customer: {s}</Badge>
          ))}
          {filters.sellerStates.map(s => (
            <Badge key={`ss-${s}`} variant="secondary" className="text-xs">Seller: {s}</Badge>
          ))}
          {filters.categories.map(c => (
            <Badge key={`cat-${c}`} variant="secondary" className="text-xs">{c}</Badge>
          ))}
          {filters.paymentTypes.map(p => (
            <Badge key={`pay-${p}`} variant="secondary" className="text-xs">{p}</Badge>
          ))}
        </div>
      )}
    </div>
  );
}
