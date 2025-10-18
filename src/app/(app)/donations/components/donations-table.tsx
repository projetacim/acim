
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
import { Pencil, Trash2, XCircle, FileWarning, Mail, Loader2 } from 'lucide-react';
import type { Donation, Member, Payment, DonationCategory } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { useRouter } from 'next/navigation';
import { openCerfaPdf } from '@/lib/pdf';
import { sendCerfaEmail } from '@/lib/email';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useData } from '@/app/(app)/data-provider';


type DonationWithDetails = Donation & { memberName: string; categoryName?: string; };

interface DonationsTableProps {
    selectedMemberId: string | null;
    onEditDonation: (donationId: string) => void;
}

export function DonationsTable({ selectedMemberId, onEditDonation }: DonationsTableProps) {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const router = useRouter();

  const { members, donations, categories, isLoading } = useData();
  
  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);
  const [isCancelAlertOpen, setIsCancelAlertOpen] = useState(false);
  const [isSendingMail, setIsSendingMail] = useState<string | null>(null);
  const [selectedDonation, setSelectedDonation] = useState<DonationWithDetails | null>(null);

  const processedDonations = useMemo(() => {
    if (!donations || !members || !categories) return [];
    
    const memberMap = new Map(members.map(m => [m.id, m]));
    const categoryMap = new Map(categories.map(c => [c.id, c.name]));
    
    let filteredDonations = donations;
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
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  }, [donations, members, categories, selectedMemberId]);
  
  const getPaidAmount = (payments: Payment[] | undefined) => {
      if(!payments) return 0;
      return payments.reduce((acc, p) => acc + p.amount, 0);
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

  return (
    <>
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
                {!selectedMemberId && <TableCell className="font-medium">{donation.memberName}</TableCell>}
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
                    {selectedMemberId ? 'Aucun don trouvé pour ce membre.' : 'Aucun don trouvé.'}
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
