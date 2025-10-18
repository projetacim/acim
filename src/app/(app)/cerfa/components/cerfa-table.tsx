
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
import { openCerfaPdf, generateCerfaPdf } from '@/lib/pdf';
import { sendCerfaEmail } from '@/lib/email';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Search, Mail, Loader2 } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { DateRange } from 'react-day-picker';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useData } from '@/app/(app)/data-provider';


type DonationWithMemberAndCategory = Donation & { memberName: string; categoryName?: string };

export function CerfaTable() {
  const { user } = useUser();
  const { toast } = useToast();
  const { members, donations, categories, isLoading } = useData();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [isSendingMail, setIsSendingMail] = useState<string | null>(null);


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
    const member = members?.find(m => m.id === donation.memberId);
    if (!member) {
        toast({ variant: 'destructive', title: 'Erreur', description: 'Membre introuvable.' });
        return;
    }
    try {
        await openCerfaPdf(donation, member);
    } catch(error) {
        console.error("Failed to open PDF:", error);
        toast({ variant: 'destructive', title: 'Erreur PDF', description: 'La génération du fichier CERFA a échoué.' });
    }
  };

  const handleSendMail = async (e: React.MouseEvent, donation: DonationWithMemberAndCategory) => {
      e.stopPropagation();
      const member = members?.find(m => m.id === donation.memberId);
      if (!member) {
        toast({ variant: 'destructive', title: 'Erreur', description: 'Membre introuvable.' });
        return;
      }
      
      if (!donation.cerfaEmail && !member.email) {
          toast({ variant: 'destructive', title: 'Action impossible', description: 'Aucune adresse e-mail trouvée pour ce donateur.' });
          return;
      }

      setIsSendingMail(donation.id);
      try {
          const result = await sendCerfaEmail(donation, member);
          if (result.success) {
              toast({ title: 'Email envoyé', description: `Le duplicata du CERFA a été envoyé à ${donation.cerfaEmail || member.email}.` });
          } else {
              throw new Error(result.error || 'Une erreur inconnue est survenue.');
          }
      } catch (error: any) {
          console.error("Failed to send email:", error);
          toast({ variant: 'destructive', title: 'Erreur d\'envoi', description: error.message });
      } finally {
          setIsSendingMail(null);
      }
  }

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
                        <div className="flex items-center gap-2">
                            <Button 
                                variant="link" 
                                className={cn("p-0 h-auto font-medium", donation.paymentStatus === 'Annulé' && 'text-red-500')}
                                onClick={() => handleCerfaClick(donation)}
                            >
                                {donation.cerfaNumber}
                            </Button>
                            {donation.cerfaNumber && (
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => handleSendMail(e, donation)} disabled={isSendingMail === donation.id}>
                                            {isSendingMail === donation.id ? <Loader2 className="h-4 w-4 animate-spin"/> : <Mail className="h-4 w-4"/>}
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p>Envoyer le duplicata par e-mail</p>
                                    </TooltipContent>
                                </Tooltip>
                            )}
                        </div>
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
