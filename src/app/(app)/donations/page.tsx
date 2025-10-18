'use client';
import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useFirestore, useCollection, useMemoFirebase, deleteDocumentNonBlocking, useUser } from '@/firebase';
import { collection, doc } from 'firebase/firestore';
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
import { Pencil, Trash2, CheckCircle, XCircle } from 'lucide-react';
import type { Donation, Member, Payment } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

type DonationWithMemberName = Donation & { memberName: string };

export default function DonationsPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();

  const membersCollection = useMemoFirebase(() => user ? collection(firestore, 'users', user.uid, 'membre') : null, [firestore, user]);
  const donationsCollection = useMemoFirebase(() => user ? collection(firestore, 'users', user.uid, 'donations') : null, [firestore, user]);

  const { data: members, isLoading: isLoadingMembers } = useCollection<Member>(membersCollection);
  const { data: donations, isLoading: isLoadingDonations } = useCollection<Donation>(donationsCollection);
  
  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);
  const [selectedDonation, setSelectedDonation] = useState<DonationWithMemberName | null>(null);
  
  const donationsWithMemberNames = useMemo(() => {
    if (!donations || !members) return [];
    const memberMap = new Map(members.map(m => [m.id, m.nom]));
    return donations.map(d => ({
      ...d,
      memberName: memberMap.get(d.memberId) || 'Membre inconnu'
    })).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [donations, members]);
  
  const getPaidAmount = (payments: Payment[]) => {
      if(!payments) return 0;
      return payments.reduce((acc, p) => acc + p.amount, 0);
  }
  
  const handleDelete = async () => {
    if (!firestore || !selectedDonation || !user) return;
    const donationDocRef = doc(firestore, 'users', user.uid, 'donations', selectedDonation.id);
    
    const transactionCollectionRef = collection(firestore, 'users', user.uid, 'transactions');
    const { getDocs, query, where } = await import('firebase/firestore');
    const q = query(transactionCollectionRef, where("relatedId", "==", selectedDonation.id));
    const querySnapshot = await getDocs(q);
    querySnapshot.forEach(async (document) => {
        await deleteDocumentNonBlocking(document.ref);
    });

    await deleteDocumentNonBlocking(donationDocRef);

    toast({
      variant: 'destructive',
      title: 'Don supprimé',
      description: `Le don de ${selectedDonation.memberName} et les transactions associées ont été supprimés.`,
    });
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
      <div className="space-y-1 mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Gestion des Dons et Cotisations</h1>
        <p className="text-muted-foreground">
          Enregistrez, modifiez et suivez tous les dons et cotisations. Pour ajouter un don, allez sur la page des membres.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Historique des dons et cotisations</CardTitle>
          <CardDescription>Liste de tous les dons et cotisations enregistrés.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Membre</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Montant</TableHead>
                <TableHead className="text-right">Payé</TableHead>
                <TableHead>Statut</TableHead>
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
                  <TableCell>
                    {donation.cerfaEligible 
                        ? <CheckCircle className="h-5 w-5 text-green-500" /> 
                        : <XCircle className="h-5 w-5 text-muted-foreground" />}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                       <Button variant="ghost" size="icon" asChild>
                        <Link href={`/donations/${donation.id}/edit`}>
                          <Pencil className="h-4 w-4" />
                        </Link>
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => openDeleteAlert(donation)} className="text-destructive hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
               {!isLoading && donationsWithMemberNames.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="p-6 text-center text-muted-foreground">
                    Aucun don ou cotisation trouvé.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      
      <AlertDialog open={isDeleteAlertOpen} onOpenChange={setIsDeleteAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Êtes-vous sûr ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. Le don de {selectedDonation?.totalAmount}€ par {selectedDonation?.memberName} sera supprimé, ainsi que toutes les transactions associées.
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
