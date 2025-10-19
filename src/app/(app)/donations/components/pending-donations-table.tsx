
'use client';
import { useMemo, useState, useEffect } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import type { Donation, Member, Payment, Transaction } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { useRouter } from 'next/navigation';
import { useData } from '@/app/(app)/data-provider';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { CalendarIcon, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useFirestore, useUser, addDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase';
import { collection, query, where, getDocs, doc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { sendCerfaEmail } from '@/lib/email';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';


type DonationWithMemberName = Donation & { memberName: string; categoryName?: string };

interface PendingDonationsTableProps {
  selectedMemberId: string | null;
  onEditDonation: (donationId: string) => void;
}

export function PendingDonationsTable({ selectedMemberId, onEditDonation }: PendingDonationsTableProps) {
  const router = useRouter();
  const { members, donations, categories, isLoading } = useData();
  const [selectedDonations, setSelectedDonations] = useState<string[]>([]);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  
  // Payment dialog state
  const [paymentMethod, setPaymentMethod] = useState<'Carte de crédit' | 'Virement bancaire' | 'Espèces' | 'Chèque'>('Carte de crédit');
  const [paymentDate, setPaymentDate] = useState<Date | undefined>(new Date());
  const [cerfaNom, setCerfaNom] = useState('');
  const [cerfaAdresse, setCerfaAdresse] = useState('');
  const [cerfaEmail, setCerfaEmail] = useState('');
  const [cerfaDate, setCerfaDate] = useState<Date | undefined>(new Date());

  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  
  const getPaidAmount = (payments: Payment[] | undefined) => {
      if(!payments) return 0;
      return payments.reduce((acc, p) => acc + p.amount, 0);
  }

  const pendingDonations = useMemo(() => {
    if (!donations || !members || !categories) return [];
    
    const memberMap = new Map(members.map(m => [m.id, m]));
    const categoryMap = new Map(categories.map(c => [c.id, c.name]));
    
    let filteredList = donations.filter(d => (d.paymentStatus === 'EN ATTENTE' || d.paymentStatus === 'Partiel'));
    
    // If a member is selected, filter by that member
    if (selectedMemberId) {
        filteredList = filteredList.filter(d => d.memberId === selectedMemberId);
    }
    
    return filteredList
      .map(d => ({
        ...d,
        memberName: memberMap.get(d.memberId)?.nom || 'Membre inconnu',
        member: memberMap.get(d.memberId),
        categoryName: d.donationCategoryId ? categoryMap.get(d.donationCategoryId) : '',
        remainingAmount: d.totalAmount - getPaidAmount(d.payments),
      }))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  }, [donations, members, categories, selectedMemberId]);
  
  const totalSelectedAmount = useMemo(() => {
    if (selectedDonations.length === 0) return 0;
    return selectedDonations.reduce((total, donationId) => {
      const donation = pendingDonations.find(d => d.id === donationId);
      return total + (donation?.remainingAmount || 0);
    }, 0);
  }, [selectedDonations, pendingDonations]);

  useEffect(() => {
    if (isPaymentDialogOpen) {
        const firstSelectedId = selectedDonations[0];
        const firstDonation = pendingDonations.find(d => d.id === firstSelectedId);
        const member = firstDonation?.member;
        
        if (member) {
            setCerfaNom(firstDonation?.cerfaNom || member.nom || '');
            setCerfaAdresse(firstDonation?.cerfaAdresse || member.adresse || '');
            setCerfaEmail(firstDonation?.cerfaEmail || member.email || '');
            setCerfaDate(firstDonation?.cerfaDate ? new Date(firstDonation.cerfaDate) : new Date());
        }
    }
  }, [isPaymentDialogOpen, selectedDonations, pendingDonations]);

  
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

  const handleSelectDonation = (donationId: string) => {
    setSelectedDonations(prev => 
      prev.includes(donationId) 
        ? prev.filter(id => id !== donationId) 
        : [...prev, donationId]
    );
  };

  const generateCerfaNumber = async () => {
    if (!firestore || !user) return null;

    const year = new Date().getFullYear();
    const donationsRef = collection(firestore, 'users', user.uid, 'donations');
    const q = query(donationsRef, where("cerfaNumber", ">=", `${year}-0000`), where("cerfaNumber", "<", `${year+1}-0000`));

    try {
        const querySnapshot = await getDocs(q);
        const existingNumbers = querySnapshot.docs.map(doc => doc.data().cerfaNumber);
        let nextId = 1;
        while (existingNumbers.includes(`${year}-${nextId.toString().padStart(4, '0')}`)) {
            nextId++;
        }
        return `${year}-${nextId.toString().padStart(4, '0')}`;
    } catch(err) {
        console.error("Error generating CERFA number: ", err);
        return null;
    }
  };


  const handleProcessPayment = async () => {
    if (!firestore || !user || !paymentDate || selectedDonations.length === 0) return;
    setIsProcessingPayment(true);
    let successCount = 0;

    for (const donationId of selectedDonations) {
      const donation = pendingDonations.find(d => d.id === donationId);
      if (!donation || donation.remainingAmount <= 0) continue;
      
      const newPayment: Payment = {
        amount: donation.remainingAmount,
        date: paymentDate.toISOString(),
        paymentMethod: paymentMethod,
      };

      const updatedPayments = [...donation.payments, newPayment];
      const donationUpdate: Partial<Donation> = {
        payments: updatedPayments,
        paymentStatus: 'Payé',
        cerfaNom,
        cerfaAdresse,
        cerfaEmail,
        cerfaDate: cerfaDate?.toISOString(),
      };

      let emailSent = false;
      try {
        if(donation.cerfaEligible && !donation.cerfaNumber) {
            const newCerfaNumber = await generateCerfaNumber();
            if(newCerfaNumber) {
                donationUpdate.cerfaNumber = newCerfaNumber;
                // If cerfaDate wasn't set in dialog, use now.
                donationUpdate.cerfaDate = (cerfaDate || new Date()).toISOString();
            }
        }
        
        const donationDocRef = doc(firestore, 'users', user.uid, 'donations', donationId);
        await updateDocumentNonBlocking(donationDocRef, donationUpdate);

        const updatedDonation = { ...donation, ...donationUpdate } as Donation;

        // Send email if applicable
        if (updatedDonation.paymentStatus === 'Payé' && updatedDonation.cerfaEligible && updatedDonation.cerfaNumber && updatedDonation.cerfaEmail && donation.member) {
             const result = await sendCerfaEmail(updatedDonation, donation.member);
             emailSent = result.success;
        }

        // Create transaction
        const transactionData: Omit<Transaction, 'id' | 'createdAt'> = {
            type: donation.type,
            relatedId: donation.id,
            amount: newPayment.amount,
            date: newPayment.date,
            paymentMethod: newPayment.paymentMethod,
            memo: `Règlement solde don: ${donation.memo || ''}`
        };
        const transactionRef = collection(firestore, 'users', user.uid, 'transactions');
        await addDocumentNonBlocking(transactionRef, {...transactionData, createdAt: new Date().toISOString()});

        successCount++;
        let toastMessage = `Don de ${donation.totalAmount}€ soldé.`;
        if (emailSent) toastMessage += ' Email CERFA envoyé.';
        toast({ title: 'Paiement enregistré', description: toastMessage });

      } catch (error) {
          console.error(`Erreur lors du traitement du don ${donation.id}:`, error);
          toast({ variant: 'destructive', title: 'Erreur de paiement', description: `Le paiement pour le don de ${donation.totalAmount}€ a échoué.` });
      }
    }

    setIsProcessingPayment(false);
    setIsPaymentDialogOpen(false);
    setSelectedDonations([]);
  };

  return (
    <>
      <div className="flex justify-end mb-4">
        {selectedMemberId && selectedDonations.length > 0 && (
            <Button onClick={() => setIsPaymentDialogOpen(true)}>
                Encaisser la sélection ({selectedDonations.length} / {totalSelectedAmount.toLocaleString('fr-FR', {style: 'currency', currency: 'EUR'})})
            </Button>
        )}
      </div>
      <div className="w-full rounded-md border">
          <Table>
              <TableHeader>
              <TableRow>
                  {selectedMemberId && (
                    <TableHead className="w-[50px]">
                      <Checkbox
                        checked={pendingDonations.length > 0 && selectedDonations.length === pendingDonations.length}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedDonations(pendingDonations.map(d => d.id));
                          } else {
                            setSelectedDonations([]);
                          }
                        }}
                        aria-label="Tout sélectionner"
                      />
                    </TableHead>
                  )}
                  <TableHead>Membre</TableHead>
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
              {isLoading && Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}>
                      {selectedMemberId && <TableCell><Skeleton className="h-4 w-4" /></TableCell>}
                      <TableCell><Skeleton className="h-4 w-28" /></TableCell>
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
                  <TableRow 
                    key={donation.id}
                    onClick={() => onEditDonation(donation.id)}
                    className="cursor-pointer"
                    data-state={selectedMemberId && selectedDonations.includes(donation.id) ? 'selected' : ''}
                  >
                      {selectedMemberId && (
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={selectedDonations.includes(donation.id)}
                            onCheckedChange={() => handleSelectDonation(donation.id)}
                            aria-label={`Sélectionner le don de ${donation.totalAmount}€`}
                          />
                        </TableCell>
                      )}
                      <TableCell className="font-medium">{donation.memberName}</TableCell>
                      <TableCell>
                          <Badge variant={donation.type === 'Don' ? 'secondary' : 'outline'}>{donation.type}</Badge>
                      </TableCell>
                      <TableCell>{donation.categoryName}</TableCell>
                      <TableCell className="text-muted-foreground hidden sm:table-cell">
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
                      <TableCell className="text-right">{donation.totalAmount.toLocaleString('fr-FR', {style: 'currency', currency: 'EUR'})}</TableCell>
                      <TableCell className="text-right text-destructive font-medium">{donation.remainingAmount.toLocaleString('fr-FR', {style: 'currency', currency: 'EUR'})}</TableCell>
                      <TableCell>{getStatusBadge(donation.paymentStatus)}</TableCell>
                      <TableCell className="hidden md:table-cell">{new Date(donation.createdAt).toLocaleDateString('fr-FR')}</TableCell>
                  </TableRow>
              ))}
              {!isLoading && pendingDonations.length === 0 && (
                  <TableRow>
                  <TableCell colSpan={selectedMemberId ? 9 : 8} className="p-6 text-center text-muted-foreground">
                      {selectedMemberId ? 'Aucun don en attente ou partiel pour ce membre.' : 'Aucun don en attente ou partiel.'}
                  </TableCell>
                  </TableRow>
              )}
              </TableBody>
          </Table>
      </div>

      <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
          <DialogContent className="sm:max-w-2xl">
              <DialogHeader>
                  <DialogTitle>Confirmer l'encaissement</DialogTitle>
                  <DialogDescription>
                    Vous êtes sur le point de solder {selectedDonations.length} don(s) pour un total de {totalSelectedAmount.toLocaleString('fr-FR', {style: 'currency', currency: 'EUR'})}.
                  </DialogDescription>
              </DialogHeader>
              <div className="grid gap-6 py-4">
                  <div>
                    <h3 className="text-sm font-medium mb-2">Informations de Paiement</h3>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label htmlFor="paymentMethod">Moyen de paiement</Label>
                            <Select onValueChange={(value: 'Carte de crédit' | 'Virement bancaire' | 'Espèces' | 'Chèque') => setPaymentMethod(value)} defaultValue={paymentMethod}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Carte de crédit">Carte de crédit</SelectItem>
                                    <SelectItem value="Virement bancaire">Virement bancaire</SelectItem>
                                    <SelectItem value="Espèces">Espèces</SelectItem>
                                    <SelectItem value="Chèque">Chèque</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                         <div>
                            <Label htmlFor="paymentDate">Date de paiement</Label>
                             <Popover>
                                <PopoverTrigger asChild>
                                    <Button variant={"outline"} className={cn("w-full justify-start text-left font-normal",!paymentDate && "text-muted-foreground")}>
                                    {paymentDate ? format(paymentDate, "d MMMM yyyy", { locale: fr }) : <span>Choisir une date</span>}
                                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                <Calendar mode="single" selected={paymentDate} onSelect={setPaymentDate} initialFocus locale={fr} />
                                </PopoverContent>
                            </Popover>
                        </div>
                    </div>
                  </div>

                 <div className="space-y-2">
                    <h3 className="text-sm font-medium text-primary">Informations pour le CERFA</h3>
                     <div className="space-y-4 rounded-md border border-dashed border-primary/50 bg-primary/5 p-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <Label htmlFor="cerfaNom">Nom du Donateur (pour le CERFA)</Label>
                                <Input id="cerfaNom" value={cerfaNom} onChange={(e) => setCerfaNom(e.target.value)} />
                            </div>
                            <div>
                               <Label htmlFor="cerfaDate">Date de Signature du CERFA</Label>
                               <Popover>
                                <PopoverTrigger asChild>
                                    <Button variant={"outline"} className={cn("w-full justify-start text-left font-normal",!cerfaDate && "text-muted-foreground")}>
                                    {cerfaDate ? format(cerfaDate, "d MMMM yyyy", { locale: fr }) : <span>Choisir une date</span>}
                                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar mode="single" selected={cerfaDate} onSelect={setCerfaDate} initialFocus locale={fr} />
                                </PopoverContent>
                               </Popover>
                            </div>
                        </div>
                        <div>
                            <Label htmlFor="cerfaAdresse">Adresse du Donateur (pour le CERFA)</Label>
                            <Textarea id="cerfaAdresse" value={cerfaAdresse} onChange={(e) => setCerfaAdresse(e.target.value)} />
                        </div>
                        <div>
                            <Label htmlFor="cerfaEmail">Email du Donateur (pour envoi)</Label>
                            <Input id="cerfaEmail" type="email" value={cerfaEmail} onChange={(e) => setCerfaEmail(e.target.value)} />
                        </div>
                     </div>
                 </div>

              </div>
              <DialogFooter>
                  <Button variant="ghost" onClick={() => setIsPaymentDialogOpen(false)}>Annuler</Button>
                  <Button onClick={handleProcessPayment} disabled={isProcessingPayment}>
                      {isProcessingPayment ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}
                      Confirmer et Payer
                  </Button>
              </DialogFooter>
          </DialogContent>
      </Dialog>
    </>
  );
}
