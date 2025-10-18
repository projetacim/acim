
'use client';
import { useMemo } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import type { Donation, Member, Payment, DonationCategory } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { useRouter } from 'next/navigation';
import { useData } from '@/app/(app)/data-provider';


type DonationWithMemberName = Donation & { memberName: string; categoryName?: string };

interface PendingDonationsTableProps {
  selectedMemberId: string | null;
}

export function PendingDonationsTable({ selectedMemberId }: PendingDonationsTableProps) {
  const router = useRouter();
  const { members, donations, categories, isLoading } = useData();
  
  const pendingDonations = useMemo(() => {
    if (!donations || !members || !selectedMemberId || !categories) return [];
    
    const memberMap = new Map(members.map(m => [m.id, m.nom]));
    const categoryMap = new Map(categories.map(c => [c.id, c.name]));
    
    return donations
      .filter(d => d.memberId === selectedMemberId && (d.paymentStatus === 'EN ATTENTE' || d.paymentStatus === 'Partiel'))
      .map(d => ({
        ...d,
        memberName: memberMap.get(d.memberId) || 'Membre inconnu',
        categoryName: d.donationCategoryId ? categoryMap.get(d.donationCategoryId) : ''
      }))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  }, [donations, members, categories, selectedMemberId]);
  
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
      case 'Annulé':
        return <Badge variant="destructive">Annulé</Badge>;
      default:
        return <Badge variant="secondary">Inconnu</Badge>;
    }
  };

  if (!selectedMemberId) {
    return (
       <div className="rounded-md border p-6 text-center text-muted-foreground">
          Sélectionnez un membre pour voir ses dons en attente.
       </div>
    )
  }

  return (
    <div className="w-full rounded-md border">
        <Table>
            <TableHeader>
            <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Catégorie</TableHead>
                <TableHead className="hidden sm:table-cell">Mémo</TableHead>
                <TableHead className="text-right">Montant Total</TableHead>
                <TableHead className="text-right">Reste à payer</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="hidden md:table-cell">Date de création</TableHead>
            </TableRow>
            </TableHeader>
            <TableBody>
            {isLoading && Array.from({ length: 1 }).map((_, i) => (
                <TableRow key={i}>
                    <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell className="hidden sm:table-cell"><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-24 rounded-full" /></TableCell>
                    <TableCell className="hidden md:table-cell"><Skeleton className="h-4 w-24" /></TableCell>
                </TableRow>
            ))}
            {!isLoading && pendingDonations.map((donation) => (
                <TableRow key={donation.id} onClick={() => router.push(`/donations/${donation.id}/edit`)} className="cursor-pointer">
                    <TableCell>
                        <Badge variant={donation.type === 'Don' ? 'secondary' : 'outline'}>{donation.type}</Badge>
                    </TableCell>
                     <TableCell>{donation.categoryName}</TableCell>
                    <TableCell className="text-muted-foreground truncate max-w-xs hidden sm:table-cell">{donation.memo}</TableCell>
                    <TableCell className="text-right">{donation.totalAmount.toLocaleString('fr-FR', {style: 'currency', currency: 'EUR'})}</TableCell>
                    <TableCell className="text-right text-destructive font-medium">{(donation.totalAmount - getPaidAmount(donation.payments)).toLocaleString('fr-FR', {style: 'currency', currency: 'EUR'})}</TableCell>
                    <TableCell>{getStatusBadge(donation.paymentStatus)}</TableCell>
                    <TableCell className="hidden md:table-cell">{new Date(donation.createdAt).toLocaleDateString('fr-FR')}</TableCell>
                </TableRow>
            ))}
            {!isLoading && pendingDonations.length === 0 && (
                <TableRow>
                <TableCell colSpan={7} className="p-6 text-center text-muted-foreground">
                    Aucun don en attente ou partiel pour ce membre.
                </TableCell>
                </TableRow>
            )}
            </TableBody>
        </Table>
      </div>
  );
}

