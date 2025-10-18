'use client';
import { useMemo } from 'react';
import { useFirestore, useCollection, useMemoFirebase, useUser } from '@/firebase';
import { collection } from 'firebase/firestore';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import type { Donation, Member, Payment } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { useRouter } from 'next/navigation';

type DonationWithMemberName = Donation & { memberName: string };

export function PendingDonationsTable() {
  const firestore = useFirestore();
  const { user } = useUser();
  const router = useRouter();

  const membersCollection = useMemoFirebase(() => user ? collection(firestore, 'users', user.uid, 'membre') : null, [firestore, user]);
  const donationsCollection = useMemoFirebase(() => user ? collection(firestore, 'users', user.uid, 'donations') : null, [firestore, user]);

  const { data: members, isLoading: isLoadingMembers } = useCollection<Member>(membersCollection);
  const { data: donations, isLoading: isLoadingDonations } = useCollection<Donation>(donationsCollection);
  
  const pendingDonations = useMemo(() => {
    if (!donations || !members) return [];
    const memberMap = new Map(members.map(m => [m.id, m.nom]));
    
    return donations
      .filter(d => d.paymentStatus === 'EN ATTENTE' || d.paymentStatus === 'Partiel')
      .map(d => ({
        ...d,
        memberName: memberMap.get(d.memberId) || 'Membre inconnu'
      }))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  }, [donations, members]);
  
  const getPaidAmount = (payments: Payment[] | undefined) => {
      if(!payments) return 0;
      return payments.reduce((acc, p) => acc + p.amount, 0);
  }
  
  const getStatusBadge = (status: Donation['paymentStatus']) => {
    switch (status) {
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
    <div className="rounded-md border">
        <Table>
            <TableHeader>
            <TableRow>
                <TableHead>Membre</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Montant Total</TableHead>
                <TableHead className="text-right">Reste à payer</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Date de création</TableHead>
            </TableRow>
            </TableHeader>
            <TableBody>
            {isLoading && Array.from({ length: 2 }).map((_, i) => (
                <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-24 rounded-full" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                </TableRow>
            ))}
            {!isLoading && pendingDonations.map((donation) => (
                <TableRow key={donation.id}>
                    <TableCell className="font-medium">{donation.memberName}</TableCell>
                    <TableCell>
                        <Badge variant={donation.type === 'Don' ? 'secondary' : 'outline'}>{donation.type}</Badge>
                    </TableCell>
                    <TableCell className="text-right">{donation.totalAmount.toLocaleString('fr-FR', {style: 'currency', currency: 'EUR'})}</TableCell>
                    <TableCell className="text-right text-destructive font-medium">{(donation.totalAmount - getPaidAmount(donation.payments)).toLocaleString('fr-FR', {style: 'currency', currency: 'EUR'})}</TableCell>
                    <TableCell>{getStatusBadge(donation.paymentStatus)}</TableCell>
                    <TableCell>{new Date(donation.createdAt).toLocaleDateString('fr-FR')}</TableCell>
                </TableRow>
            ))}
            {!isLoading && pendingDonations.length === 0 && (
                <TableRow>
                <TableCell colSpan={6} className="p-6 text-center text-muted-foreground">
                    Aucun don en attente ou partiel trouvé.
                </TableCell>
                </TableRow>
            )}
            </TableBody>
        </Table>
      </div>
  );
}
