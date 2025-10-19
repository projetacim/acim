

'use client';
import { useState, useMemo, useEffect } from 'react';
import { useFirestore, deleteDocumentNonBlocking, useUser, updateDocumentNonBlocking } from '@/firebase';
import { collection, doc, getDocs, query, where, updateDoc, getDoc } from 'firebase/firestore';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Pencil, Trash2, XCircle, FileWarning, Mail, Loader2, Link as LinkIcon, Search, Calendar as CalendarIcon, Filter, X } from 'lucide-react';
import type { Donation, Member, Payment, DonationCategory } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { useRouter } from 'next/navigation';
import { openCerfaPdf } from '@/lib/cerfa-actions';
import { sendCerfaEmail } from '@/lib/email';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useData } from '@/app/(app)/data-provider';
import { Input } from '@/components/ui/input';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { DateRange } from 'react-day-picker';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';


type DonationWithDetails = Donation & { memberName: string; categoryName?: string; };

interface DonationsTableProps {
    selectedMemberId: string | null;
    onEditDonation: (donationId: string) => void;
    onSelectMember: (memberId: string) => void;
}

export function DonationsTable({ selectedMemberId, onEditDonation, onSelectMember }: DonationsTableProps) {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const router = useRouter();

  const { members, donations, categories, isLoading } = useData();
  
  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);
  const [isCancelAlertOpen, setIsCancelAlertOpen] = useState(false);
  const [isSendingMail, setIsSendingMail] = useState<string | null>(null);
  const [selectedDonation, setSelectedDonation] = useState<DonationWithDetails | null>(null);
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');

  const processedDonations = useMemo(() => {
    if (!donations || !members || !categories) return [];
    
    const memberMap = new Map(members.map(m => [m.id, m]));
    const categoryMap = new Map(categories.map(c => [c.id, c.name]));
    
    let filteredDonations = donations;

    // Filter by selected member if any
    if(selectedMemberId) {
        filteredDonations = donations.filter(d => d.memberId === selectedMemberId);
    }
    
    return filteredDonations
      .map(d => {
        const member = memberMap.get(d.memberId);
        return {
          ...d,
          memberName: member?.nom || 'Membre inconnu',
          memberAddress: member?.adresse || '',
          categoryName: d.donationCategoryId ? categoryMap.get(d.donationCategoryId) : ''
        } as DonationWithDetails
      })
      .filter(d => {
        // Date range filter on createdAt
        const donationDate = new Date(d.createdAt);
        if (dateRange?.from && donationDate < dateRange.from) return false;
        if (dateRange?.to && donationDate > dateRange.to) return false;

        // Type filter
        if (typeFilter !== 'all' && d.type !== typeFilter) return false;

        // Category filter (only if type is 'Don')
        if (typeFilter === 'Don' && categoryFilter !== 'all' && d.donationCategoryId !== categoryFilter) return false;

        // Status filter
        if (statusFilter !== 'all' && d.paymentStatus !== statusFilter) return false;

        // Search query filter
        const searchLower = searchQuery.toLowerCase();
        if(searchLower) {
            return (
                d.memberName.toLowerCase().includes(searchLower) ||
                (d.memo && d.memo.toLowerCase().includes(searchLower)) ||
                (d.cerfaNumber && d.cerfaNumber.toLowerCase().includes(searchLower))
            );
        }
        return true;
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  }, [donations, members, categories, selectedMemberId, dateRange, typeFilter, statusFilter, categoryFilter, searchQuery]);
  
  useEffect(() => {
    // Reset category filter if type is not 'Don' anymore
    if (typeFilter !== 'Don') {
      setCategoryFilter('all');
    }
  }, [typeFilter]);

  const stats = useMemo(() => {
    const totalAmount = processedDonations.reduce((acc, d) => acc + d.totalAmount, 0);
    const donationCount = processedDonations.length;
    const averageDonation = donationCount > 0 ? totalAmount / donationCount : 0;
    return { totalAmount, donationCount, averageDonation };
  }, [processedDonations]);

  const clearFilters = () => {
    setSearchQuery('');
    setDateRange(undefined);
    setTypeFilter('all');
    setStatusFilter('all');
    setCategoryFilter('all');
  }

  const handleCerfaClick = async (donation: DonationWithDetails) => {
    if (!donation.cerfaNumber) {
        toast({ variant: 'destructive', title: 'Action impossible', description: 'Aucun numéro de CERFA à générer.' });
        return;
    }
    if (!firestore || !user) return;
    const member = members?.find(m => m.id === donation.memberId);
    if (!member) {
        toast({ variant: 'destructive', title: 'Erreur', description: 'Membre introuvable.' });
        return;
    }

    await openCerfaPdf(donation, member);
  };
  
  const handleSendMail = async (e: React.MouseEvent, donation: DonationWithDetails) => {
      e.stopPropagation();
      if (!firestore || !user) return;

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


  const handleDelete = async () => {
    if (!firestore || !selectedDonation || !user) return;
    const donationDocRef = doc(firestore, 'users', user.uid, 'donations', selectedDonation.id);
    
    const transactionCollectionRef = collection(firestore, 'users', user.uid, 'transactions');
    const q = query(transactionCollectionRef, where("relatedId", "==", selectedDonation.id));
    
    try {
      const querySnapshot = await getDocs(q);
      const deletePromises = querySnapshot.docs.map(document => deleteDocumentNonBlocking(document.ref));
      await Promise.all(deletePromises);
  
      await deleteDocumentNonBlocking(donationDocRef);
  
      toast({
        variant: 'destructive',
        title: 'Don supprimé',
        description: `Le don de ${selectedDonation.totalAmount.toLocaleString('fr-FR', {style: 'currency', currency: 'EUR'})} par ${selectedDonation.memberName} a été supprimé, ainsi que toutes les transactions associées.`,
      });
    } catch (error) {
       console.error("Error deleting donation and/or transactions:", error);
       toast({
        variant: 'destructive',
        title: 'Erreur de suppression',
        description: "Une erreur est survenue.",
      });
    }

    setIsDeleteAlertOpen(false);
    setSelectedDonation(null);
  };
  
  const handleCancelDonation = async () => {
    if (!firestore || !selectedDonation || !user) return;
    const donationDocRef = doc(firestore, 'users', user.uid, 'donations', selectedDonation.id);
    try {
      await updateDocumentNonBlocking(donationDocRef, { paymentStatus: 'Annulé' });
      toast({
        title: 'Don annulé',
        description: `Le don de ${selectedDonation.memberName} a été marqué comme annulé.`,
      });
    } catch (error) {
      console.error("Error canceling donation:", error);
      toast({ variant: 'destructive', title: 'Erreur', description: "L'annulation du don a échoué." });
    }
    setIsCancelAlertOpen(false);
    setSelectedDonation(null);
  };

  const openDeleteAlert = (donation: DonationWithDetails) => {
    setSelectedDonation(donation);
    setIsDeleteAlertOpen(true);
  }
  
  const openCancelAlert = (donation: DonationWithDetails) => {
    setSelectedDonation(donation);
    setIsCancelAlertOpen(true);
  };
  
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

  const hasActiveFilters = dateRange || typeFilter !== 'all' || statusFilter !== 'all' || categoryFilter !== 'all' || searchQuery;

  return (
    <>
      <div className="space-y-4">
        {/* Filters */}
        <div className="flex flex-col gap-2 md:flex-row md:flex-wrap md:items-center">
             <Popover>
                <PopoverTrigger asChild>
                <Button id="date" variant={"outline"} className={cn("w-full md:w-auto justify-start text-left font-normal", !dateRange && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateRange?.from ? (dateRange.to ? (<>{format(dateRange.from, "d LLL, y", {locale:fr})} - {format(dateRange.to, "d LLL, y", {locale:fr})}</>) : (format(dateRange.from, "d LLL, y", {locale:fr}))) : (<span>Filtrer par date</span>)}
                </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                    <Calendar initialFocus mode="range" defaultMonth={dateRange?.from} selected={dateRange} onSelect={setDateRange} numberOfMonths={2} locale={fr}/>
                </PopoverContent>
            </Popover>
             <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-full md:w-[180px]">
                    <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">Tous les types</SelectItem>
                    <SelectItem value="Don">Don</SelectItem>
                    <SelectItem value="Cotisation">Cotisation</SelectItem>
                </SelectContent>
            </Select>

            {typeFilter === 'Don' && (
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-full md:w-[180px]">
                    <SelectValue placeholder="Catégorie" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">Toutes les catégories</SelectItem>
                    {categories?.map(cat => (
                        <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
            )}

            <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full md:w-[180px]">
                    <SelectValue placeholder="Statut" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">Tous les statuts</SelectItem>
                    <SelectItem value="Payé">Payé</SelectItem>
                    <SelectItem value="Partiel">Partiel</SelectItem>
                    <SelectItem value="EN ATTENTE">En attente</SelectItem>
                    <SelectItem value="Annulé">Annulé</SelectItem>
                </SelectContent>
            </Select>
            {hasActiveFilters && <Button variant="ghost" onClick={clearFilters}><X className="mr-2 h-4 w-4"/>Effacer</Button>}
        </div>
        
        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-3">
             <Card>
                <CardContent className="p-4">
                    <div className="text-sm font-medium text-muted-foreground">Montant Total</div>
                    <div className="text-2xl font-bold">{stats.totalAmount.toLocaleString('fr-FR', {style: 'currency', currency: 'EUR'})}</div>
                </CardContent>
            </Card>
             <Card>
                <CardContent className="p-4">
                    <div className="text-sm font-medium text-muted-foreground">Nombre de Dons</div>
                    <div className="text-2xl font-bold">{stats.donationCount}</div>
                </CardContent>
            </Card>
             <Card>
                <CardContent className="p-4">
                    <div className="text-sm font-medium text-muted-foreground">Don Moyen</div>
                    <div className="text-2xl font-bold">{stats.averageDonation.toLocaleString('fr-FR', {style: 'currency', currency: 'EUR'})}</div>
                </CardContent>
            </Card>
        </div>
      </div>

      <ScrollArea className="h-96 w-full rounded-md border">
        <Table>
            <TableHeader>
            <TableRow>
                {!selectedMemberId && <TableHead>Membre</TableHead>}
                <TableHead>Type</TableHead>
                <TableHead>Catégorie</TableHead>
                <TableHead className="hidden sm:table-cell">Mémo</TableHead>
                <TableHead className="text-right">Montant</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>N° CERFA</TableHead>
                <TableHead>Date CERFA</TableHead>
                <TableHead className="text-right">Actions</TableHead>
            </TableRow>
            </TableHeader>
            <TableBody>
            {isLoading && Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i}>
                    {!selectedMemberId && <TableCell><Skeleton className="h-4 w-32" /></TableCell>}
                    <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell className="hidden sm:table-cell"><Skeleton className="h-4 w-28" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-24 rounded-full" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-8 w-20" /></TableCell>
                </TableRow>
            ))}
            {!isLoading && processedDonations.map((donation) => (
                <TableRow key={donation.id} className={cn(donation.paymentStatus === 'Annulé' && 'bg-red-50 dark:bg-red-900/20')}>
                {!selectedMemberId && 
                  <TableCell>
                      <Button variant="link" className="p-0 h-auto font-medium text-left" onClick={() => onSelectMember(donation.memberId)}>
                         <LinkIcon className="h-3 w-3 mr-2"/>
                         {donation.memberName}
                      </Button>
                  </TableCell>
                }
                <TableCell>
                    <Badge variant={donation.type === 'Don' ? 'secondary' : 'outline'}>{donation.type}</Badge>
                </TableCell>
                <TableCell>{donation.categoryName}</TableCell>
                <TableCell className="hidden sm:table-cell">
                    {donation.memo && donation.memo.length > 30 ? (
                    <Tooltip>
                        <TooltipTrigger>
                        <span className="cursor-help">{donation.memo.substring(0, 30)}...</span>
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
                <TableCell>
                    <div className="flex items-center gap-2">
                        {donation.cerfaEligible ? (
                            <Button 
                                variant="link" 
                                className={cn("p-0 h-auto", donation.paymentStatus === 'Annulé' && 'text-red-500')}
                                onClick={() => handleCerfaClick(donation)}
                                disabled={!donation.cerfaNumber}
                            >
                                {donation.cerfaNumber || 'N/A'}
                            </Button>
                        ) : (
                            <span className="text-muted-foreground">Non éligible</span>
                        )}
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
                <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-0 md:gap-2">
                        <Button variant="ghost" size="icon" onClick={() => onEditDonation(donation.id)} disabled={donation.paymentStatus === 'Payé' || donation.paymentStatus === 'Annulé'}>
                          <Pencil className="h-4 w-4" />
                          <span className="sr-only">Modifier</span>
                        </Button>
                        {donation.cerfaNumber ? (
                             <Button variant="ghost" size="icon" onClick={() => openCancelAlert(donation)} className="text-destructive hover:text-destructive" disabled={donation.paymentStatus === 'Annulé'}>
                               <FileWarning className="h-4 w-4" />
                               <span className="sr-only">Annuler le don</span>
                            </Button>
                        ) : (
                            <Button variant="ghost" size="icon" onClick={() => openDeleteAlert(donation)} className="text-destructive hover:text-destructive" disabled={donation.paymentStatus === 'Annulé'}>
                                <Trash2 className="h-4 w-4" />
                                <span className="sr-only">Supprimer</span>
                            </Button>
                        )}
                    </div>
                </TableCell>
                </TableRow>
            ))}
            {!isLoading && processedDonations.length === 0 && (
                <TableRow>
                <TableCell colSpan={selectedMemberId ? 8 : 9} className="p-6 text-center text-muted-foreground">
                    {hasActiveFilters ? 'Aucun don ne correspond à vos critères.' : (selectedMemberId ? 'Aucun don trouvé pour ce membre.' : 'Aucun don trouvé.')}
                </TableCell>
                </TableRow>
            )}
            </TableBody>
        </Table>
      </ScrollArea>
      
      <AlertDialog open={isDeleteAlertOpen} onOpenChange={setIsDeleteAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Êtes-vous sûr ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. Le don de ${selectedDonation?.totalAmount.toLocaleString('fr-FR', {style: 'currency', currency: 'EUR'})} par ${selectedDonation?.memberName} sera supprimé, ainsi que toutes les transactions associées.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={isCancelAlertOpen} onOpenChange={setIsCancelAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Annuler le don avec CERFA ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. Le don de ${selectedDonation?.totalAmount.toLocaleString('fr-FR', {style: 'currency', currency: 'EUR'})} par ${selectedDonation?.memberName} sera marqué comme "Annulé". Le reçu fiscal (CERFA n°{selectedDonation?.cerfaNumber}) sera invalidé.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Retour</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancelDonation} className="bg-destructive hover:bg-destructive/90">
              Confirmer l'annulation
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
