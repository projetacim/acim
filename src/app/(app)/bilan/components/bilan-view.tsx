
'use client';

import { useState, useMemo } from 'react';
import { useData } from '@/app/(app)/data-provider';
import { DateRange } from 'react-day-picker';
import { format, subDays } from 'date-fns';
import { fr } from 'date-fns/locale';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartStyle } from '@/components/ui/chart';
import { PieChart, Pie, Cell, Tooltip } from 'recharts';
import { CalendarIcon, TrendingUp, Users, DollarSign, PenLine } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Transaction } from '@/lib/types';
import { numberToWords } from '@/lib/number-to-words';
import { Separator } from '@/components/ui/separator';


const CHART_COLORS = {
  'Carte de crédit': 'hsl(var(--chart-1))',
  'Virement bancaire': 'hsl(var(--chart-2))',
  'Espèces': 'hsl(var(--chart-3))',
  'Chèque': 'hsl(var(--chart-4))',
  'Autre': 'hsl(var(--chart-5))',
};

type PaymentMethod = keyof typeof CHART_COLORS;

export function BilanView() {
  const { transactions, isLoading } = useData();
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 29),
    to: new Date(),
  });

  const filteredTransactions = useMemo(() => {
    if (!transactions) return [];
    return transactions.filter(t => {
      const transactionDate = new Date(t.date);
      if (dateRange?.from && transactionDate < dateRange.from) return false;
      if (dateRange?.to && transactionDate > dateRange.to) return false;
      return true;
    });
  }, [transactions, dateRange]);

  const stats = useMemo(() => {
    const total = filteredTransactions.reduce((acc, t) => acc + t.amount, 0);
    const dons = filteredTransactions.filter(t => t.type === 'Don').reduce((acc, t) => acc + t.amount, 0);
    const cotisations = filteredTransactions.filter(t => t.type === 'Cotisation').reduce((acc, t) => acc + t.amount, 0);
    return { total, dons, cotisations, count: filteredTransactions.length };
  }, [filteredTransactions]);

  const chartData = useMemo(() => {
    const dataByMethod = filteredTransactions.reduce((acc, t) => {
      const method = t.paymentMethod as PaymentMethod;
      if (!acc[method]) {
        acc[method] = 0;
      }
      acc[method] += t.amount;
      return acc;
    }, {} as Record<PaymentMethod, number>);
    
    return Object.entries(dataByMethod)
      .map(([name, value]) => ({ name, value, fill: CHART_COLORS[name as PaymentMethod] || CHART_COLORS['Autre'] }))
      .sort((a,b) => b.value - a.value);

  }, [filteredTransactions]);
  
  const totalInWords = useMemo(() => {
    const words = numberToWords(stats.total);
    return words.charAt(0).toUpperCase() + words.slice(1);
  }, [stats.total]);


  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
            <Card className="lg:col-span-4"><Skeleton className="h-80" /></Card>
            <Card className="lg:col-span-3"><Skeleton className="h-80" /></Card>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
       <div className="flex justify-end">
         <Popover>
            <PopoverTrigger asChild>
              <Button
                id="date"
                variant={"outline"}
                className={cn(
                  "w-[300px] justify-start text-left font-normal",
                  !dateRange && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateRange?.from ? (
                  dateRange.to ? (
                    <>
                      {format(dateRange.from, "d LLL, y", {locale:fr})} -{" "}
                      {format(dateRange.to, "d LLL, y", {locale:fr})}
                    </>
                  ) : (
                    format(dateRange.from, "d LLL, y", {locale:fr})
                  )
                ) : (
                  <span>Choisir une période</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                initialFocus
                mode="range"
                defaultMonth={dateRange?.from}
                selected={dateRange}
                onSelect={setDateRange}
                numberOfMonths={2}
                locale={fr}
              />
            </PopoverContent>
          </Popover>
       </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total des Revenus</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{stats.total.toLocaleString('fr-FR', {style: 'currency', currency: 'EUR'})}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total des Dons</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{stats.dons.toLocaleString('fr-FR', {style: 'currency', currency: 'EUR'})}</div></CardContent>
        </Card>
         <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total des Cotisations</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{stats.cotisations.toLocaleString('fr-FR', {style: 'currency', currency: 'EUR'})}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Nombre de transactions</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">+{stats.count}</div></CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-2">
            <CardHeader>
                <CardTitle>Répartition par moyen de paiement</CardTitle>
            </CardHeader>
            <CardContent>
                <ChartContainer config={{}} className="h-64 w-full">
                    <PieChart>
                        <Tooltip
                            cursor={false}
                            content={<ChartTooltipContent hideLabel indicator="dot" />}
                        />
                        <Pie data={chartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                            {chartData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.fill} />
                            ))}
                        </Pie>
                    </PieChart>
                </ChartContainer>
            </CardContent>
        </Card>
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Détail des Transactions</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-80">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Moyen</TableHead>
                    <TableHead className="text-right">Montant</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTransactions.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell>{format(new Date(t.date), 'dd/MM/yyyy')}</TableCell>
                      <TableCell><Badge variant={t.type === 'Don' ? 'secondary' : 'outline'}>{t.type}</Badge></TableCell>
                      <TableCell><Badge variant="outline">{t.paymentMethod}</Badge></TableCell>
                      <TableCell className="text-right font-medium">{t.amount.toLocaleString('fr-FR', {style: 'currency', currency: 'EUR'})}</TableCell>
                    </TableRow>
                  ))}
                   {filteredTransactions.length === 0 && (
                        <TableRow>
                        <TableCell colSpan={4} className="p-6 text-center text-muted-foreground">
                            Aucune transaction sur cette période.
                        </TableCell>
                        </TableRow>
                    )}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
            <CardTitle className="flex items-center gap-2">
                <PenLine className="h-5 w-5 text-muted-foreground" />
                Arrêté en lettres
            </CardTitle>
            <CardDescription>
                Total des revenus de la période sélectionnée, en toutes lettres.
            </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
             {chartData.length > 0 ? (
              <ul className="space-y-2 text-sm">
                {chartData.map(item => (
                  <li key={item.name} className="flex justify-between items-baseline">
                    <span className="font-medium">{item.name}:</span>
                    <span className="italic text-muted-foreground">{numberToWords(item.value)} euros</span>
                  </li>
                ))}
                <Separator className="my-2" />
                <li className="flex justify-between items-baseline pt-2">
                    <span className="font-semibold text-base text-primary">Total:</span>
                     <p className="text-base font-semibold italic text-primary">
                        {totalInWords} euros.
                    </p>
                </li>
              </ul>
            ) : (
                <p className="text-lg font-semibold italic text-primary">
                    {totalInWords} euros.
                </p>
            )}
        </CardContent>
      </Card>
    </div>
  );

    