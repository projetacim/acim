
'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useFirestore, useCollection, useMemoFirebase, deleteDocumentNonBlocking, useUser } from '@/firebase';
import { collection, doc, query, where, getDocs } from 'firebase/firestore';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { MoreHorizontal, Pencil, Trash2, CheckCircle, XCircle } from 'lucide-react';
import type { Donation, Member, Payment, Transaction } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

type DonationWithMemberName = Donation & { memberName: string };

export default function DonationsPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();

  // Data fetching
  const membersCollection = useMemoFirebase(() => user ? collection(firestore, 'users', user.uid, 'membre') : null, [firestore, user]);
  const donationsCollection = useMemoFirebase(() => user ? collection(firestore, 'users', user.uid, 'donations') : null, [firestore, user]);

  const { data: members, isLoading: isLoadingMembers } = useCollection<Member>(membersCollection);
  const { data: donations, isLoading: isLoadingDonations } = useCollection<Donation>(donationsCollection);
  
  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);
  const [selectedDonation, setSelectedDonation] = useState<DonationWithMemberName | null>(null);

  const donationsWithMemberNames: DonationWithMemberName[] = useMemo(() => {
    if (!donations || !members) return [];
    const memberMap = new Map(members.map(m => [m.id, m.nom]));
    return donations.map(d => ({
      ...d,
      memberName: memberMap.get(d.memberId) || 'Membre inconnu'
    })).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [donations, members]);
  
  const getPaidAmount = (payments: Payment[] | undefined) => {
      if(!payments) return 0;
      return payments.reduce((acc, p) => acc + p.amount, 0);
  }
  
  const handleDelete = async () => {
    if (!firestore || !selectedDonation || !user) return;

    const donationDocRef = doc(firestore, 'users', user.uid, 'donations', selectedDonation.id);
    
    // Also delete associated transactions
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
      <div className="flex flex-col gap-6">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">Gestion des Dons et Cotisations</h1>
          <p className="text-muted-foreground">
            Consultez, modifiez et suivez tous les dons et cotisations. Pour ajouter un don, allez sur la page des membres.
          </p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Historique des dons</CardTitle>
            <CardDescription>
                Voici la liste de tous les dons enregistrés.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Membre</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Montant Total</TableHead>
                  <TableHead className="text-right">Montant Payé</TableHead>
                  <TableHead>Statut Paiement</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Éligible CERFA</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-24 rounded-full" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-6 rounded-full" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-8 w-20" /></TableCell>
                  </TableRow>
                ))}
                {!isLoading && donationsWithMemberNames.map((donation) => (
                  <TableRow key={donation.id}>
                    <TableCell className="font-medium">{donation.memberName}</TableCell>
                    <TableCell>
                      <Badge variant={donation.type === 'Don' ? 'secondary' : 'outline'}>{donation.type}</Badge>
                    </TableCell>
                    <TableCell className="text-right">{donation.totalAmount.toLocaleString('fr-FR', {style: 'currency', currency: 'EUR'})}</TableCell>
                    <TableCell className="text-right">{getPaidAmount(donation.payments).toLocaleString('fr-FR', {style: 'currency', currency: 'EUR'})}</TableCell>
                    <TableCell>{getStatusBadge(donation.paymentStatus)}</TableCell>
                    <TableCell>{new Date(donation.createdAt).toLocaleDateString('fr-FR')}</TableCell>
                    <TableCell>
                      {donation.cerfaEligible 
                          ? <CheckCircle className="h-5 w-5 text-green-500" /> 
                          : <XCircle className="h-5 w-5 text-muted-foreground" />}
                    </TableCell>
                    <TableCell className="text-right">
                       <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <span className="sr-only">Ouvrir le menu</span>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuItem asChild>
                             <Link href={`/donations/${donation.id}/edit`}>
                                <Pencil className="mr-2 h-4 w-4" /> Modifier
                             </Link>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => openDeleteAlert(donation)} className="text-destructive">
                             <Trash2 className="mr-2 h-4 w-4" /> Supprimer
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
                 {!isLoading && donationsWithMemberNames.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="p-6 text-center text-muted-foreground">
                      Aucun don pour le moment.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
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
