'use client';
import { useState, useMemo } from 'react';
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
import { Pencil, Trash2, CheckCircle, XCircle, Search, ListFilter, PlusCircle } from 'lucide-react';
import type { Donation, Member, Payment } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';


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

  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilters, setTypeFilters] = useState<string[]>([]);
  const [statusFilters, setStatusFilters] = useState<string[]>([]);
  
  const donationsWithMemberNames = useMemo(() => {
    if (!donations || !members) return [];
    const memberMap = new Map(members.map(m => [m.id, m.nom]));
    return donations.map(d => ({
      ...d,
      memberName: memberMap.get(d.memberId) || 'Membre inconnu'
    }))
    .filter(donation => {
        // Filter by search query (member name)
        const searchLower = searchQuery.toLowerCase();
        const memberNameMatch = donation.memberName.toLowerCase().includes(searchLower);

        // Filter by type
        const typeMatch = typeFilters.length === 0 || typeFilters.includes(donation.type);
        
        // Filter by status
        const statusMatch = statusFilters.length === 0 || statusFilters.includes(donation.paymentStatus);

        return memberNameMatch && typeMatch && statusMatch;
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [donations, members, searchQuery, typeFilters, statusFilters]);
  
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

  const handleTypeFilterChange = (type: string) => {
    setTypeFilters(prev => 
      prev.includes(type) ? prev.filter(s => s !== type) : [...prev, type]
    );
  };

  const handleStatusFilterChange = (status: string) => {
    setStatusFilters(prev => 
      prev.includes(status) ? prev.filter(s => s !== status) : [...prev, status]
    );
  };

  const activeFiltersCount = typeFilters.length + statusFilters.length;
  const isLoading = isLoadingMembers || isLoadingDonations;

  return (
    <>
      <div className="space-y-1 mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Gestion des Dons et Cotisations</h1>
        <p className="text-muted-foreground">
          Consultez, modifiez et suivez tous les dons et cotisations.
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Historique des dons et cotisations</CardTitle>
              <CardDescription>Liste de tous les dons et cotisations enregistrés.</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative w-full max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher par membre..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="gap-2">
                    <ListFilter className="h-4 w-4" />
                    Filtres
                    {activeFiltersCount > 0 && <span className="ml-1 h-5 w-5 flex items-center justify-center rounded-full bg-primary text-primary-foreground text-xs">{activeFiltersCount}</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-56 p-3">
                  <div className="space-y-4">
                    <h4 className="font-medium leading-none">Type</h4>
                    <div className="grid gap-2">
                      <Label className="flex items-center gap-2 font-normal">
                        <Checkbox checked={typeFilters.includes('Don')} onCheckedChange={() => handleTypeFilterChange('Don')} />Don
                      </Label>
                      <Label className="flex items-center gap-2 font-normal">
                        <Checkbox checked={typeFilters.includes('Cotisation')} onCheckedChange={() => handleTypeFilterChange('Cotisation')} />Cotisation
                      </Label>
                    </div>
                     <h4 className="font-medium leading-none">Statut</h4>
                    <div className="grid gap-2">
                      <Label className="flex items-center gap-2 font-normal">
                        <Checkbox checked={statusFilters.includes('Payé')} onCheckedChange={() => handleStatusFilterChange('Payé')} />Payé
                      </Label>
                      <Label className="flex items-center gap-2 font-normal">
                        <Checkbox checked={statusFilters.includes('Partiel')} onCheckedChange={() => handleStatusFilterChange('Partiel')} />Partiel
                      </Label>
                      <Label className="flex items-center gap-2 font-normal">
                        <Checkbox checked={statusFilters.includes('EN ATTENTE')} onCheckedChange={() => handleStatusFilterChange('EN ATTENTE')} />En attente
                      </Label>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
               <Button asChild>
                <Link href="/donations/new">
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Ajouter un don
                </Link>
              </Button>
            </div>
          </div>
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
