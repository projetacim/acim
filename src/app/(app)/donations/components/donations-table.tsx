'use client';

import { useState, useEffect, useMemo } from 'react';
import { useFirestore, useCollection, useMemoFirebase, addDocumentNonBlocking, setDocumentNonBlocking, deleteDocumentNonBlocking, useUser } from '@/firebase';
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
import { PlusCircle, Pencil, Trash2, CheckCircle, XCircle } from 'lucide-react';
import type { Donation, Member, DonationCategory, Transaction } from '@/lib/types';
import { useForm, type SubmitHandler, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Checkbox } from '@/components/ui/checkbox';


const donationSchema = z.object({
  memberId: z.string().min(1, 'Veuillez sélectionner un membre.'),
  type: z.enum(['Don', 'Cotisation']),
  donationCategoryId: z.string().optional(),
  amount: z.coerce.number().min(0.01, 'Le montant doit être supérieur à 0.'),
  paymentMethod: z.enum(['Carte de crédit', 'Virement bancaire', 'Espèces', 'Chèque']),
  date: z.date({ required_error: 'La date est requise.' }),
  memo: z.string().optional(),
  cerfaEligible: z.boolean().default(true),
});

type DonationFormValues = z.infer<typeof donationSchema>;

type DonationWithMemberName = Donation & { memberName: string };

export function DonationsTable() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();

  // Data fetching
  const membersCollection = useMemoFirebase(() => user ? collection(firestore, 'users', user.uid, 'membre') : null, [firestore, user]);
  const donationsCollection = useMemoFirebase(() => user ? collection(firestore, 'users', user.uid, 'donations') : null, [firestore, user]);
  const categoriesCollection = useMemoFirebase(() => collection(firestore, 'donationCategories'), [firestore]);

  const { data: members, isLoading: isLoadingMembers } = useCollection<Member>(membersCollection);
  const { data: donations, isLoading: isLoadingDonations } = useCollection<Donation>(donationsCollection);
  const { data: categories, isLoading: isLoadingCategories } = useCollection<DonationCategory>(categoriesCollection);

  // State
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);
  const [selectedDonation, setSelectedDonation] = useState<DonationWithMemberName | null>(null);

  const form = useForm<DonationFormValues>({
    resolver: zodResolver(donationSchema),
    defaultValues: {
      memberId: '',
      type: 'Don',
      donationCategoryId: '',
      amount: 0,
      paymentMethod: 'Espèces',
      memo: '',
      cerfaEligible: true,
    },
  });

  const donationType = useWatch({ control: form.control, name: 'type' });

  // Memoized derived data
  const donationsWithMemberNames = useMemo(() => {
    if (!donations || !members) return [];
    const memberMap = new Map(members.map(m => [m.id, m.nom]));
    return donations.map(d => ({
      ...d,
      memberName: memberMap.get(d.memberId) || 'Membre inconnu'
    })).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [donations, members]);

  // Effects
  useEffect(() => {
    if (selectedDonation) {
      form.reset({
        memberId: selectedDonation.memberId,
        type: selectedDonation.type,
        donationCategoryId: selectedDonation.donationCategoryId || '',
        amount: selectedDonation.amount,
        paymentMethod: selectedDonation.paymentMethod,
        date: new Date(selectedDonation.date),
        memo: selectedDonation.memo || '',
        cerfaEligible: selectedDonation.cerfaEligible,
      });
    } else {
      form.reset({
        memberId: '',
        type: 'Don',
        donationCategoryId: '',
        amount: 0,
        paymentMethod: 'Espèces',
        memo: '',
        cerfaEligible: true,
        date: new Date()
      });
    }
  }, [selectedDonation, form]);

  // Handlers
  const handleOpenForm = (donation?: DonationWithMemberName) => {
    setSelectedDonation(donation || null);
    setIsFormOpen(true);
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setSelectedDonation(null);
    form.reset();
  };

  const onSubmit: SubmitHandler<DonationFormValues> = async (data) => {
    if (!firestore || !user) {
      toast({ variant: "destructive", title: "Erreur", description: "Utilisateur ou base de données non disponible." });
      return;
    }

    const donationData: Omit<Donation, 'id' | 'createdAt'> = {
      ...data,
      amount: Number(data.amount),
      date: data.date.toISOString(),
      donationCategoryId: data.type === 'Don' ? data.donationCategoryId : '',
    };

    try {
      if (selectedDonation) {
        // Update
        const donationRef = doc(firestore, 'users', user.uid, 'donations', selectedDonation.id);
        await setDocumentNonBlocking(donationRef, { ...donationData, createdAt: selectedDonation.createdAt }, { merge: true });
        toast({ title: 'Don mis à jour' });
        // Optionally update transaction too, if fields that are duplicated can change
      } else {
        // Create
        const collectionRef = collection(firestore, 'users', user.uid, 'donations');
        const newDoc = await addDocumentNonBlocking(collectionRef, { ...donationData, createdAt: new Date().toISOString() });
        
        if (newDoc) {
          const transactionData: Omit<Transaction, 'id' | 'createdAt'> = {
            type: donationData.type,
            relatedId: newDoc.id,
            amount: donationData.amount,
            date: donationData.date,
            paymentMethod: donationData.paymentMethod,
            memo: donationData.memo
          };
          const transactionRef = collection(firestore, 'users', user.uid, 'transactions');
          await addDocumentNonBlocking(transactionRef, {...transactionData, createdAt: new Date().toISOString()});
        }
        
        toast({ title: 'Don ajouté', description: `Un nouveau don/cotisation a été enregistré.` });
      }
      handleCloseForm();
    } catch (e: any) {
        console.error("Error saving donation", e);
        toast({ variant: "destructive", title: "Erreur de sauvegarde", description: e.message });
    }
  };
  
  const handleDelete = async () => {
    if (!firestore || !selectedDonation || !user) return;

    const docRef = doc(firestore, 'users', user.uid, 'donations', selectedDonation.id);
    await deleteDocumentNonBlocking(docRef);
    // TODO: Also delete the associated transaction
    toast({
      variant: 'destructive',
      title: 'Don supprimé',
      description: `Le don de ${selectedDonation.memberName} a été supprimé.`,
    });
    setIsDeleteAlertOpen(false);
    setSelectedDonation(null);
  };
  
  const openDeleteAlert = (donation: DonationWithMemberName) => {
    setSelectedDonation(donation);
    setIsDeleteAlertOpen(true);
  }

  const isLoading = isLoadingMembers || isLoadingDonations || isLoadingCategories;

  return (
    <>
      <Card>
        <CardHeader>
             <div className="flex items-center justify-between">
                <CardTitle>Historique</CardTitle>
                <Button onClick={() => handleOpenForm()}>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Ajouter
                </Button>
            </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Membre</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Montant</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Éligible CERFA</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                  <TableCell className="text-right"><Skeleton className="h-4 w-16" /></TableCell>
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
                  <TableCell className="text-right">{donation.amount.toLocaleString('fr-FR', {style: 'currency', currency: 'EUR'})}</TableCell>
                  <TableCell>{format(new Date(donation.date), 'd MMMM yyyy', {locale: fr})}</TableCell>
                  <TableCell>
                    {donation.cerfaEligible 
                        ? <CheckCircle className="h-5 w-5 text-green-500" /> 
                        : <XCircle className="h-5 w-5 text-muted-foreground" />}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button variant="ghost" size="icon" onClick={() => handleOpenForm(donation)}>
                        <Pencil className="h-4 w-4" />
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
                  <TableCell colSpan={6} className="p-6 text-center text-muted-foreground">
                    Aucun don ou cotisation trouvé.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedDonation ? 'Modifier le don' : 'Ajouter un don/cotisation'}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
              <FormField
                control={form.control}
                name="memberId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Membre</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Sélectionner un membre" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {isLoadingMembers ? <SelectItem value="loading" disabled>Chargement...</SelectItem> : members?.map(member => (
                          <SelectItem key={member.id} value={member.id}>{member.nom}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Type</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Don">Don</SelectItem>
                          <SelectItem value="Cotisation">Cotisation</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {donationType === 'Don' && (
                  <FormField
                    control={form.control}
                    name="donationCategoryId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Sous-catégorie de don</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Sélectionner une catégorie" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {isLoadingCategories ? <SelectItem value="loading" disabled>Chargement...</SelectItem> : categories?.map(cat => (
                              <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Montant (€)</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="paymentMethod"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Moyen de paiement</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Espèces">Espèces</SelectItem>
                          <SelectItem value="Chèque">Chèque</SelectItem>
                          <SelectItem value="Carte de crédit">Carte de crédit</SelectItem>
                          <SelectItem value="Virement bancaire">Virement bancaire</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                 <FormField
                  control={form.control}
                  name="date"
                  render={({ field }) => (
                    <FormItem className="flex flex-col pt-2">
                       <FormLabel className="mb-[10px]">Date</FormLabel>
                       <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant={"outline"}
                              className={cn(
                                "pl-3 text-left font-normal",
                                !field.value && "text-muted-foreground"
                              )}
                            >
                              {field.value ? (
                                format(field.value, "d MMMM yyyy", { locale: fr })
                              ) : (
                                <span>Choisir une date</span>
                              )}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            disabled={(date) =>
                              date > new Date() || date < new Date("1900-01-01")
                            }
                            initialFocus
                            locale={fr}
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="memo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Mémo (facultatif)</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Informations complémentaires..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
               <FormField
                control={form.control}
                name="cerfaEligible"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md border p-4">
                     <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>
                        Éligible pour un reçu fiscal (CERFA)
                      </FormLabel>
                    </div>
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={handleCloseForm}>Annuler</Button>
                <Button type="submit">Enregistrer</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      
      <AlertDialog open={isDeleteAlertOpen} onOpenChange={setIsDeleteAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Êtes-vous sûr ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. Le don de {selectedDonation?.amount}€ par {selectedDonation?.memberName} sera supprimé.
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
