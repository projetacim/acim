
'use client';
import { useState, useMemo, useEffect } from 'react';
import { useFirestore, useUser, updateDocumentNonBlocking } from '@/firebase';
import { doc, getDoc } from 'firebase/firestore';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { Donation, Member, DonationCategory } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { PDFDocument, rgb, StandardFonts, degrees } from 'pdf-lib';
import { numberToWords } from '@/lib/number-to-words';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Search } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { DateRange } from 'react-day-picker';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useData } from '@/app/(app)/data-provider';


type DonationWithMemberAndCategory = Donation & { memberName: string; categoryName?: string };

// PDF generation constants and helpers
const A4_HEIGHT_POINTS = 841.89;
const mmToPoints = (mm: number) => mm * 2.83465;

const cerfaCoordinates = {
    cerfaId:          { x: mmToPoints(174),  y: A4_HEIGHT_POINTS - mmToPoints(24) },
    donorName:        { x: mmToPoints(35),   y: A4_HEIGHT_POINTS - mmToPoints(51) },
    donorAddress:     { x: mmToPoints(35),   y: A4_HEIGHT_POINTS - mmToPoints(60) },
    paymentDate:      { x: mmToPoints(163),  y: A4_HEIGHT_POINTS - mmToPoints(256) },
    amountInDigits:   { x: mmToPoints(41),   y: A4_HEIGHT_POINTS - mmToPoints(207) },
    amountInWords:    { x: mmToPoints(115),  y: A4_HEIGHT_POINTS - mmToPoints(207) },
    signatureDate:    { x: mmToPoints(163),  y: A4_HEIGHT_POINTS - mmToPoints(256) },
    signatureDate2:   { x: mmToPoints(55),   y: A4_HEIGHT_POINTS - mmToPoints(240) },
    paymentMethod:    { x: mmToPoints(55),   y: A4_HEIGHT_POINTS - mmToPoints(247.5)}
};


export function CerfaTable() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const { members, donations, categories, isLoading } = useData();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [dateRange, setDateRange] = useState<DateRange | undefined>();

  const cerfaDonations = useMemo(() => {
    if (!donations || !members || !categories) return [];
    
    const memberMap = new Map(members.map(m => [m.id, m.nom]));
    const categoryMap = new Map(categories.map(c => [c.id, c.name]));
    
    return donations
      .filter(d => d.cerfaNumber) // Redundant with query, but safe
      .map(d => ({
        ...d,
        memberName: memberMap.get(d.memberId) || 'Membre inconnu',
        categoryName: d.donationCategoryId ? categoryMap.get(d.donationCategoryId) : ''
      }))
      .filter(d => {
        // Date range filter for cerfaDate
        if (d.cerfaDate) {
            if (dateRange?.from && dateRange?.to) {
                const cerfaDate = new Date(d.cerfaDate);
                return cerfaDate >= dateRange.from && cerfaDate <= dateRange.to;
            }
            if (dateRange?.from) {
                const cerfaDate = new Date(d.cerfaDate);
                return cerfaDate >= dateRange.from;
            }
        } else if (dateRange) { // If filtering by date but cerfaDate is missing, exclude it
            return false;
        }
        return true;
      })
      .filter(d => {
        // Search query filter
        const searchLower = searchQuery.toLowerCase();
        return (
          d.memberName.toLowerCase().includes(searchLower) ||
          (d.memo && d.memo.toLowerCase().includes(searchLower)) ||
          d.cerfaNumber!.toLowerCase().includes(searchLower)
        );
      })
      .sort((a, b) => b.cerfaNumber!.localeCompare(a.cerfaNumber!));

  }, [donations, members, categories, searchQuery, dateRange]);
  
  const getStatusBadge = (status: Donation['paymentStatus']) => {
    switch (status) {
      case 'Payé':
        return <Badge className="bg-green-100 text-green-800 border-green-200">Payé</Badge>;
      case 'Partiel':
        return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">Partiel</Badge>;
      case 'EN ATTENTE':
        return <Badge variant="outline">En attente</Badge>;
       case 'Annulé':
        return <Badge variant="destructive">Annulé</Badge>;
      default:
        return <Badge variant="secondary">Inconnu</Badge>;
    }
  };
  
  const handleCerfaClick = async (donation: DonationWithMemberAndCategory) => {
     if (!firestore || !user || !donation.cerfaNumber) return;
    
    try {
        const memberDocRef = doc(firestore, 'users', user.uid, 'membre', donation.memberId);
        const memberSnap = await getDoc(memberDocRef);
        if (!memberSnap.exists()) {
            toast({ variant: 'destructive', title: 'Erreur', description: 'Membre introuvable.' });
            return;
        }
        const member = memberSnap.data() as Member;

        const templateBytes = await fetch('/cerfa_template.pdf').then(res => res.arrayBuffer());
        const pdfDoc = await PDFDocument.load(templateBytes);
        const page = pdfDoc.getPages()[0];
        const { width, height } = page.getSize();

        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
        const textColor = rgb(0, 0, 0);

        if (donation.paymentStatus === 'Annulé') {
            page.drawText('ANNULÉ', {
                x: width / 2 - 150,
                y: height / 2 + 100,
                font: boldFont,
                size: 100,
                color: rgb(1, 0, 0),
                opacity: 0.2,
                rotate: degrees(-45),
            });
        }

        const lastPayment = donation.payments.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
        const paymentDate = new Date(lastPayment.date);
        const formattedDate = format(paymentDate, 'dd/MM/yyyy');
        
        const cerfaDate = donation.cerfaDate ? new Date(donation.cerfaDate) : new Date();
        const formattedCerfaDate = format(cerfaDate, 'dd/MM/yyyy');

        const paymentMethods = [...new Set(donation.payments.map(p => {
            if (p.paymentMethod === 'Carte de crédit') return 'CB';
            return p.paymentMethod;
        }))].join(', ');

        page.drawText(donation.cerfaNumber, { ...cerfaCoordinates.cerfaId, font, size: 10, color: textColor });
        page.drawText(member.nom, { ...cerfaCoordinates.donorName, font, size: 10, color: textColor });
        page.drawText(member.adresse || '', { ...cerfaCoordinates.donorAddress, font, size: 10, color: textColor });
        
        page.drawText(donation.totalAmount.toFixed(2), { ...cerfaCoordinates.amountInDigits, font, size: 10, color: textColor });
        page.drawText(numberToWords(donation.totalAmount) + ' euros', { ...cerfaCoordinates.amountInWords, font, size: 8, color: textColor });
        
        page.drawText(formattedDate, { ...cerfaCoordinates.paymentDate, font, size: 10, color: textColor });
        page.drawText(formattedCerfaDate, { ...cerfaCoordinates.signatureDate, font, size: 10, color: textColor });
        page.drawText(formattedCerfaDate, { ...cerfaCoordinates.signatureDate2, font, size: 10, color: textColor });

        page.drawText(paymentMethods, { ...cerfaCoordinates.paymentMethod, font, size: 10, color: textColor });

        const pdfBytes = await pdfDoc.save();
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
        
    } catch (error) {
        console.error("Failed to generate PDF:", error);
        toast({ variant: 'destructive', title: 'Erreur PDF', description: 'La génération du fichier CERFA a échoué.' });
    }
  };

  return (
    <>
      <div className="flex flex-col md:flex-row items-center gap-4 mb-4">
        <div className="relative w-full md:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher par n°, membre, mémo..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Popover>
            <PopoverTrigger asChild>
              <Button
                id="date"
                variant={"outline"}
                className={cn(
                  "w-full justify-start text-left font-normal md:w-auto",
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
                  <span>Filtrer par date CERFA</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
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

      <ScrollArea className="h-96 w-full rounded-md border">
        <Table>
            <TableHeader>
            <TableRow>
                <TableHead>N° CERFA</TableHead>
                <TableHead>Date CERFA</TableHead>
                <TableHead>Membre</TableHead>
                <TableHead className="hidden sm:table-cell">Type</TableHead>
                <TableHead className="hidden lg:table-cell">Catégorie</TableHead>
                <TableHead className="hidden lg:table-cell">Mémo</TableHead>
                <TableHead className="text-right">Montant</TableHead>
                <TableHead>Statut</TableHead>
            </TableRow>
            </TableHeader>
            <TableBody>
            {isLoading && Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                    <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell className="hidden sm:table-cell"><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
                    <TableCell className="hidden lg:table-cell"><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell className="hidden lg:table-cell"><Skeleton className="h-4 w-40" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-24 rounded-full" /></TableCell>
                </TableRow>
            ))}
            {!isLoading && cerfaDonations.map((donation) => (
                <TableRow key={donation.id} className={cn(donation.paymentStatus === 'Annulé' && 'bg-red-50 dark:bg-red-900/20')}>
                    <TableCell>
                        <Button 
                            variant="link" 
                            className={cn("p-0 h-auto font-medium", donation.paymentStatus === 'Annulé' && 'text-red-500')}
                            onClick={() => handleCerfaClick(donation)}
                        >
                            {donation.cerfaNumber}
                        </Button>
                    </TableCell>
                    <TableCell>
                        {donation.cerfaDate ? format(new Date(donation.cerfaDate), 'dd/MM/yyyy') : '-'}
                    </TableCell>
                    <TableCell className="font-medium">{donation.memberName}</TableCell>
                    <TableCell className="hidden sm:table-cell">
                        <Badge variant={donation.type === 'Don' ? 'secondary' : 'outline'}>{donation.type}</Badge>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">{donation.categoryName}</TableCell>
                    <TableCell className="text-muted-foreground truncate max-w-xs hidden lg:table-cell">
                      {donation.memo && donation.memo.length > 40 ? (
                        <Tooltip>
                            <TooltipTrigger>
                            <span className="cursor-help">{donation.memo.substring(0, 40)}...</span>
                            </TooltipTrigger>
                            <TooltipContent>
                            <p className="max-w-xs">{donation.memo}</p>
                            </TooltipContent>
                        </Tooltip>
                        ) : (
                        donation.memo
                        )}
                    </TableCell>
                    <TableCell className="text-right font-medium">{donation.totalAmount.toLocaleString('fr-FR', {style: 'currency', currency: 'EUR'})}</TableCell>
                    <TableCell>{getStatusBadge(donation.paymentStatus)}</TableCell>
                </TableRow>
            ))}
            {!isLoading && cerfaDonations.length === 0 && (
                <TableRow>
                <TableCell colSpan={8} className="p-6 text-center text-muted-foreground">
                    {searchQuery || dateRange ? "Aucun CERFA ne correspond à vos critères." : "Aucun CERFA généré pour le moment."}
                </TableCell>
                </TableRow>
            )}
            </TableBody>
        </Table>
      </ScrollArea>
    </>
  );
}

    
