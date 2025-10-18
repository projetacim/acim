
'use client';
import { useState, useMemo, useEffect } from 'react';
import { useFirestore, useCollection, useMemoFirebase, deleteDocumentNonBlocking, useUser } from '@/firebase';
import { collection, doc, getDocs, query, where, updateDoc } from 'firebase/firestore';
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
import { Pencil, Trash2 } from 'lucide-react';
import type { Donation, Member, Payment } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { useRouter } from 'next/navigation';
import jsPDF from 'jspdf';

type DonationWithMemberName = Donation & { memberName: string };

interface DonationsTableProps {
    selectedMemberId: string | null;
}

export function DonationsTable({ selectedMemberId }: DonationsTableProps) {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const router = useRouter();

  const membersCollection = useMemoFirebase(() => user ? collection(firestore, 'users', user.uid, 'membre') : null, [firestore, user]);
  const donationsCollection = useMemoFirebase(() => user ? collection(firestore, 'users', user.uid, 'donations') : null, [firestore, user]);

  const { data: members, isLoading: isLoadingMembers } = useCollection<Member>(membersCollection);
  const { data: donations, isLoading: isLoadingDonations } = useCollection<Donation>(donationsCollection);
  
  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);
  const [selectedDonation, setSelectedDonation] = useState<DonationWithMemberName | null>(null);

  const donationsWithMemberNames = useMemo(() => {
    if (!donations || !members) return [];
    const memberMap = new Map(members.map(m => [m.id, m.nom]));
    
    let filteredDonations = donations;
    if(selectedMemberId) {
        filteredDonations = donations.filter(d => d.memberId === selectedMemberId);
    }
    
    return filteredDonations
      .map(d => ({
        ...d,
        memberName: memberMap.get(d.memberId) || 'Membre inconnu'
      }))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  }, [donations, members, selectedMemberId]);
  
  const getPaidAmount = (payments: Payment[] | undefined) => {
      if(!payments) return 0;
      return payments.reduce((acc, p) => acc + p.amount, 0);
  }

  const generateCerfaNumber = async (donationId: string) => {
    if (!firestore || !user || !donations) return;
    
    const year = new Date().getFullYear();
    // Filter donations for the current year that already have a CERFA number
    const yearDonations = donations.filter(d => d.cerfaNumber && d.cerfaNumber.startsWith(year.toString()));
    const nextId = yearDonations.length + 1;
    const cerfaNumber = `${year}-${nextId.toString().padStart(4, '0')}`;

    const donationDocRef = doc(firestore, 'users', user.uid, 'donations', donationId);
    await updateDoc(donationDocRef, { cerfaNumber: cerfaNumber });
    
    toast({ title: 'N° CERFA généré', description: `Le numéro ${cerfaNumber} a été assigné.` });
    return cerfaNumber;
  };
  
  const handleCerfaClick = async (donation: DonationWithMemberName) => {
    if (!donation.cerfaEligible) return;

    let cerfaNumber = donation.cerfaNumber;
    if (!cerfaNumber && donation.paymentStatus === 'Payé') {
        cerfaNumber = await generateCerfaNumber(donation.id);
    }
    
    if (cerfaNumber) {
        // Placeholder for PDF generation
        console.log(`Generating PDF for CERFA ${cerfaNumber}`);
        const doc = new jsPDF();
        doc.text(`Reçu fiscal CERFA N°: ${cerfaNumber}`, 10, 10);
        doc.text(`Donateur: ${donation.memberName}`, 10, 20);
        doc.text(`Montant: ${donation.totalAmount.toLocaleString('fr-FR', {style: 'currency', currency: 'EUR'})}`, 10, 30);
        doc.save(`cerfa-${cerfaNumber}.pdf`);
    } else {
        toast({ variant: 'destructive', title: 'Action impossible', description: 'Le don doit être entièrement payé pour générer un CERFA.' });
    }
  };


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
        description: `Le don de ${selectedDonation.memberName} et les transactions associées ont été supprimés.`,
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
  
  const openDeleteAlert = (donation: DonationWithMemberName) => {
    setSelectedDonation(donation);
    setIsDeleteAlertOpen(true);
  }
  
  const getStatusBadge = (status: Donation['paymentStatus']) => {
    switch (status) {
      case 'Payé':
        return <Badge className="bg-green-100 text-green-800 border-green-200">Payé</Badge>;
      case 'Partiel':
        return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">Partiel</Badge>;
      case 'EN ATTENTE':
        return <Badge variant="outline">En attente</Badge>;
      default:
        return <Badge variant="secondary">Inconnu</Badge>;
    }
  };

  const isLoading = isLoadingMembers || isLoadingDonations;

  return (
    <>
      <div className="rounded-md border">
        <Table>
            <TableHeader>
            <TableRow>
                {!selectedMemberId && <TableHead>Membre</TableHead>}
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Montant Total</TableHead>
                <TableHead className="text-right">Montant Payé</TableHead>
                <TableHead>Statut Paiement</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>N° CERFA</TableHead>
                <TableHead className="text-right">Actions</TableHead>
            </TableRow>
            </TableHeader>
            <TableBody>
            {isLoading && Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i}>
                {!selectedMemberId && <TableCell><Skeleton className="h-4 w-32" /></TableCell>}
                <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
                <TableCell className="text-right"><Skeleton className="h-4 w-16" /></TableCell>
                <TableCell className="text-right"><Skeleton className="h-4 w-16" /></TableCell>
                <TableCell><Skeleton className="h-6 w-24 rounded-full" /></TableCell>
                <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                <TableCell className="text-right"><Skeleton className="h-8 w-20" /></TableCell>
                </TableRow>
            ))}
            {!isLoading && donationsWithMemberNames.map((donation) => (
                <TableRow key={donation.id}>
                {!selectedMemberId && <TableCell className="font-medium">{donation.memberName}</TableCell>}
                <TableCell>
                    <Badge variant={donation.type === 'Don' ? 'secondary' : 'outline'}>{donation.type}</Badge>
                </TableCell>
                <TableCell className="text-right">{donation.totalAmount.toLocaleString('fr-FR', {style: 'currency', currency: 'EUR'})}</TableCell>
                <TableCell className="text-right">{getPaidAmount(donation.payments).toLocaleString('fr-FR', {style: 'currency', currency: 'EUR'})}</TableCell>
                <TableCell>{getStatusBadge(donation.paymentStatus)}</TableCell>
                <TableCell>{new Date(donation.createdAt).toLocaleDateString('fr-FR')}</TableCell>
                <TableCell>
                    {donation.cerfaEligible ? (
                        <Button 
                            variant="link" 
                            className="p-0 h-auto"
                            onClick={() => handleCerfaClick(donation)}
                            disabled={donation.paymentStatus !== 'Payé' && !donation.cerfaNumber}
                        >
                            {donation.cerfaNumber || (donation.paymentStatus === 'Payé' ? 'Générer' : 'N/A')}
                        </Button>
                    ) : (
                        <span className="text-muted-foreground">Non éligible</span>
                    )}
                </TableCell>
                <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => router.push(`/donations/${donation.id}/edit`)}>
                        <Pencil className="h-4 w-4" />
                        <span className="sr-only">Modifier</span>
                        </Button>
                    <Button variant="ghost" size="icon" onClick={() => openDeleteAlert(donation)} className="text-destructive hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                        <span className="sr-only">Supprimer</span>
                    </Button>
                    </div>
                </TableCell>
                </TableRow>
            ))}
            {!isLoading && donationsWithMemberNames.length === 0 && (
                <TableRow>
                <TableCell colSpan={selectedMemberId ? 7 : 8} className="p-6 text-center text-muted-foreground">
                    {selectedMemberId ? 'Aucun don trouvé pour ce membre.' : 'Aucun don trouvé.'}
                </TableCell>
                </TableRow>
            )}
            </TableBody>
        </Table>
      </div>
      
      <AlertDialog open={isDeleteAlertOpen} onOpenChange={setIsDeleteAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Êtes-vous sûr ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. Le don de {selectedDonation?.totalAmount.toLocaleString('fr-FR', {style: 'currency', currency: 'EUR'})} par {selectedDonation?.memberName} sera supprimé, ainsi que toutes les transactions associées.
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
    </>
  );
}
