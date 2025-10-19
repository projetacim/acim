

'use client';

import { useState, useMemo } from 'react';
import { useData } from '@/app/(app)/data-provider';
import { DateRange } from 'react-day-picker';
import { format, subDays } from 'date-fns';
import { fr } from 'date-fns/locale';
import Link from 'next/link';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartStyle } from '@/components/ui/chart';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { CalendarIcon, TrendingUp, Users, DollarSign, PenLine, FileDown, FileType } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Transaction, Donation, Member, DonationCategory } from '@/lib/types';
import { numberToWords } from '@/lib/number-to-words';
import { Separator } from '@/components/ui/separator';
import { Tooltip as UiTooltip, TooltipContent as UiTooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';


const CHART_COLORS = {
  'Carte de crédit': 'hsl(var(--chart-1))',
  'Virement bancaire': 'hsl(var(--chart-2))',
  'Espèces': 'hsl(var(--chart-3))',
  'Chèque': 'hsl(var(--chart-4))',
  'Autre': 'hsl(var(--chart-5))',
};

type PaymentMethod = keyof typeof CHART_COLORS;

const CustomLegend = (props: any) => {
  const { payload } = props;
  return (
    <ul className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
      {payload.map((entry: any, index: any) => (
        <li key={`item-${index}`} className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
            <span>{entry.value}</span>
          </div>
          <span className="font-medium">
            {entry.payload.value.toLocaleString('fr-FR', {style: 'currency', currency: 'EUR'})}
          </span>
        </li>
      ))}
    </ul>
  );
};


export function BilanView() {
  const { transactions, donations, members, categories, isLoading } = useData();
  const { toast } = useToast();
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 29),
    to: new Date(),
  });

  const enrichedTransactions = useMemo(() => {
    if (!transactions || !donations || !members || !categories) return [];

    const donationsMap = new Map(donations.map(d => [d.id, d]));
    const membersMap = new Map(members.map(m => [m.id, m]));
    const categoriesMap = new Map(categories.map(c => [c.id, c.name]));

    return transactions
        .map(t => {
            const relatedDonation = donationsMap.get(t.relatedId);
            if (!relatedDonation) return null;

            const member = membersMap.get(relatedDonation.memberId);
            const categoryName = relatedDonation.donationCategoryId
                ? categoriesMap.get(relatedDonation.donationCategoryId)
                : undefined;

            return {
                ...t,
                memberName: member?.nom || 'Inconnu',
                categoryName: categoryName || '',
            };
        })
        .filter(Boolean) as (Transaction & { memberName: string; categoryName: string })[];

  }, [transactions, donations, members, categories]);


  const filteredTransactions = useMemo(() => {
    if (!enrichedTransactions) return [];
    return enrichedTransactions.filter(t => {
      const transactionDate = new Date(t.date);
      if (dateRange?.from && transactionDate < dateRange.from) return false;
      if (dateRange?.to && transactionDate > dateRange.to) return false;
      return true;
    });
  }, [enrichedTransactions, dateRange]);

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

  const chartConfig = useMemo(() => {
    return chartData.reduce((acc, item) => {
        acc[item.name] = { label: item.name, color: item.fill };
        return acc;
    }, {} as any)
  }, [chartData]);

  const getDateHeader = () => {
    return `Période du ${dateRange?.from ? format(dateRange.from, 'dd/MM/yyyy') : 'début'} au ${dateRange?.to ? format(dateRange.to, 'dd/MM/yyyy') : 'fin'}`;
  }
  
  const exportToExcel = () => {
    const dateHeader = getDateHeader();

    const summaryHeader = ['Moyen de Paiement', 'Montant Total'];
    const summaryData = chartData.map(item => [item.name, item.value]);

    const transactionsHeader = ['Date', 'Membre', 'Type', 'Catégorie', 'Moyen de paiement', 'Montant', 'Mémo'];
    const transactionsData = filteredTransactions.map(t => [
      format(new Date(t.date), 'dd/MM/yyyy'),
      t.memberName,
      t.type,
      t.categoryName,
      t.paymentMethod,
      t.amount,
      t.memo,
    ]);

    const worksheet = XLSX.utils.aoa_to_sheet([]);
    
    XLSX.utils.sheet_add_aoa(worksheet, [[dateHeader]], { origin: 'A1' });
    XLSX.utils.sheet_add_aoa(worksheet, [[]], { origin: 'A2' });
    
    XLSX.utils.sheet_add_aoa(worksheet, [summaryHeader], { origin: 'A3' });
    XLSX.utils.sheet_add_aoa(worksheet, summaryData, { origin: 'A4' });
    
    const nextRow = 4 + summaryData.length;
    XLSX.utils.sheet_add_aoa(worksheet, [[]], { origin: `A${nextRow}` });

    XLSX.utils.sheet_add_aoa(worksheet, [transactionsHeader], { origin: `A${nextRow + 1}` });
    XLSX.utils.sheet_add_aoa(worksheet, transactionsData, { origin: `A${nextRow + 2}` });

    const columnWidths = [
      {wch: 15}, {wch: 25}, {wch: 15}, {wch: 20}, {wch: 20}, {wch: 15}, {wch: 40}
    ];
    worksheet['!cols'] = columnWidths;

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Bilan');
    XLSX.writeFile(workbook, `bilan_transactions_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);

    toast({ title: 'Exportation réussie', description: 'Le fichier Excel a été téléchargé.' });
  };
  
  const exportToPdf = () => {
    const doc = new jsPDF();
    const pageHeight = doc.internal.pageSize.getHeight();
    let currentY = 20;

    // Titre et Période
    doc.setFontSize(18);
    doc.text('Bilan Financier', 14, currentY);
    currentY += 8;
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(getDateHeader(), 14, currentY);
    currentY += 15;

    // Cartes de statistiques
    doc.setDrawColor(230); // light grey for borders
    const cardWidth = 45;
    const cardHeight = 20;
    const cards = [
        {title: 'Total Revenus', value: stats.total.toLocaleString('fr-FR', {style: 'currency', currency: 'EUR'})},
        {title: 'Total Dons', value: stats.dons.toLocaleString('fr-FR', {style: 'currency', currency: 'EUR'})},
        {title: 'Total Cotisations', value: stats.cotisations.toLocaleString('fr-FR', {style: 'currency', currency: 'EUR'})},
        {title: 'Transactions', value: `+${stats.count}`}
    ];
    
    cards.forEach((card, index) => {
        const x = 14 + (index * (cardWidth + 5));
        doc.roundedRect(x, currentY, cardWidth, cardHeight, 3, 3, 'S');
        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text(card.title, x + 5, currentY + 7);
        doc.setFontSize(12);
        doc.setTextColor(0);
        doc.setFont('helvetica', 'bold');
        doc.text(card.value, x + 5, currentY + 14);
        doc.setFont('helvetica', 'normal');
    });
    currentY += cardHeight + 15;


    // Auto-table pour les moyens de paiement et les transactions
    (doc as any).autoTable({
        startY: currentY,
        head: [['Répartition par moyen de paiement', 'Montant']],
        body: chartData.map(d => [d.name, d.value.toLocaleString('fr-FR', {style: 'currency', currency: 'EUR'})]),
        theme: 'striped',
        headStyles: { fillColor: [41, 128, 185] },
        tableWidth: 'auto',
        columnStyles: { 1: { halign: 'right' } }
    });

    currentY = (doc as any).autoTable.previous.finalY + 10;
    
    (doc as any).autoTable({
        startY: currentY,
        head: [['Date', 'Membre', 'Type', 'Catégorie', 'Mémo', 'Montant']],
        body: filteredTransactions.map(t => [
            format(new Date(t.date), 'dd/MM/yy'),
            t.memberName,
            t.type,
            t.categoryName,
            t.memo || '',
            t.amount.toLocaleString('fr-FR', {style: 'currency', currency: 'EUR'})
        ]),
        theme: 'grid',
        headStyles: { fillColor: [41, 128, 185] },
        columnStyles: { 5: { halign: 'right' } }
    });

    doc.save(`bilan_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
    toast({ title: 'Exportation réussie', description: 'Le fichier PDF a été téléchargé.' });
  }

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
       <div className="flex justify-end gap-2">
         <Button onClick={exportToPdf} variant="outline" disabled={filteredTransactions.length === 0}>
            <FileType className="mr-2 h-4 w-4" />
            Exporter en PDF
         </Button>
         <Button onClick={exportToExcel} variant="outline" disabled={filteredTransactions.length === 0}>
            <FileDown className="mr-2 h-4 w-4" />
            Exporter en Excel
         </Button>
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

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-7">
        <Card className="lg:col-span-3">
            <CardHeader>
                <CardTitle>Répartition par moyen de paiement</CardTitle>
            </CardHeader>
            <CardContent className="h-[340px] flex items-center justify-center">
               {chartData.length > 0 ? (
                <ChartContainer config={chartConfig} className="min-h-[250px] w-full">
                    <PieChart>
                        <ChartTooltip
                            cursor={false}
                            content={<ChartTooltipContent hideLabel />}
                        />
                        <Pie data={chartData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80} labelLine={false}>
                             {chartData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.fill} name={entry.name} />
                            ))}
                        </Pie>
                        <Legend content={<CustomLegend />} verticalAlign="bottom" align="center" />
                    </PieChart>
                </ChartContainer>
                 ) : (
                    <div className="text-muted-foreground">Aucune donnée de paiement pour cette période.</div>
                )}
            </CardContent>
        </Card>
        <Card className="lg:col-span-4">
          <CardHeader>
            <CardTitle>Détail des Transactions</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[340px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Membre</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Catégorie</TableHead>
                    <TableHead>Mémo</TableHead>
                    <TableHead className="text-right">Montant</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTransactions.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="font-medium">{t.memberName}</TableCell>
                      <TableCell><Badge variant={t.type === 'Don' ? 'secondary' : 'outline'}>{t.type}</Badge></TableCell>
                      <TableCell>{t.categoryName}</TableCell>
                      <TableCell>
                          {t.memo && t.memo.length > 25 ? (
                            <UiTooltip>
                                <TooltipTrigger>
                                <span className="cursor-help text-muted-foreground">{t.memo.substring(0, 25)}...</span>
                                </TooltipTrigger>
                                <UiTooltipContent>
                                <p className="max-w-xs">{t.memo}</p>
                                </UiTooltipContent>
                            </UiTooltip>
                            ) : (
                            <span className="text-muted-foreground">{t.memo}</span>
                            )}
                      </TableCell>
                      <TableCell className="text-right font-medium">{t.amount.toLocaleString('fr-FR', {style: 'currency', currency: 'EUR'})}</TableCell>
                    </TableRow>
                  ))}
                   {filteredTransactions.length === 0 && (
                        <TableRow>
                        <TableCell colSpan={5} className="p-6 text-center text-muted-foreground">
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
    </div>
  );
}
