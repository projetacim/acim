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
import { PlusCircle, Pencil, Trash2, CheckCircle, XCircle, X, ChevronsUpDown, Check } from 'lucide-react';
import type { Donation, Member, DonationCategory, Transaction, Payment } from '@/lib/types';
import { useForm, useFieldArray, type SubmitHandler, useWatch } from 'react-hook-form';
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
} from '@/components/ui/dialog';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Calendar } from '@/components/ui/calendar';
import { CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Checkbox } from '@/components/ui/checkbox';


const paymentSchema = z.object({
  amount: z.coerce.number().min(0.01, "Le montant doit être positif.").default(0),
  date: z.date({ required_error: "La date est requise." }),
  paymentMethod: z.enum(['Carte de crédit', 'Virement bancaire', 'Espèces', 'Chèque']),
});

const donationSchema = z.object({
  memberId: z.string().min(1, 'Veuillez sélectionner un membre.'),
  type: z.enum(['Don', 'Cotisation']),
  donationCategoryId: z.string().optional(),
  totalAmount: z.coerce.number().min(0.01, 'Le montant total doit être supérieur à 0.'),
  payments: z.array(paymentSchema).min(1, "Veuillez ajouter au moins un paiement.").max(3, "Vous ne pouvez pas ajouter plus de 3 paiements."),
  memo: z.string().min(1, 'Le mémo est obligatoire.'),
  cerfaEligible: z.boolean().default(true),
});

type DonationFormValues = z.infer<typeof donationSchema>;

type DonationWithMemberName = Donation & { memberName: string };

export function DonationsTable() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();

  const membersCollection = useMemoFirebase(() => user ? collection(firestore, 'users', user.uid, 'membre') : null, [firestore, user]);
  const donationsCollection = useMemoFirebase(() => user ? collection(firestore, 'users', user.uid, 'donations') : null, [firestore, user]);
  const categoriesCollection = useMemoFirebase(() => collection(firestore, 'donationCategories'), [firestore]);

  const { data: members, isLoading: isLoadingMembers } = useCollection<Member>(membersCollection);
  const { data: donations, isLoading: isLoadingDonations } = useCollection<Donation>(donationsCollection);
  const { data: categories, isLoading: isLoadingCategories } = useCollection<DonationCategory>(categoriesCollection);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);
  const [selectedDonation, setSelectedDonation] = useState<DonationWithMemberName | null>(null);
  
  const form = useForm<DonationFormValues>({
    resolver: zodResolver(donationSchema),
    defaultValues: {
      memberId: '',
      type: 'Don',
      donationCategoryId: '',
      totalAmount: 0,
      payments: [],
      memo: '',
      cerfaEligible: true,
    },
  });
  
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "payments"
  });

  const watchPayments = useWatch({ control: form.control, name: 'payments' });
  const watchTotalAmount = useWatch({ control: form.control, name: 'totalAmount' });
  const donationType = useWatch({ control: form.control, name: 'type' });
  
  const paidAmount = useMemo(() => {
    if (!watchPayments) return 0;
    return watchPayments.reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
  }, [watchPayments]);

  const remainingAmount = useMemo(() => {
    const total = Number(watchTotalAmount) || 0;
    return total - paidAmount;
  }, [watchTotalAmount, paidAmount]);

  const paymentStatus = useMemo(() => {
    const total = watchTotalAmount || 0;
    if (paidAmount <= 0) return 'EN ATTENTE';
    if (paidAmount < total) return 'Partiel';
    return 'Payé';
  }, [paidAmount, watchTotalAmount]);


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

  useEffect(() => {
    if (isFormOpen) {
      if (selectedDonation) {
        form.reset({
          memberId: selectedDonation.memberId,
          type: selectedDonation.type,
          donationCategoryId: selectedDonation.donationCategoryId || '',
          totalAmount: selectedDonation.totalAmount,
          payments: selectedDonation.payments.map(p => ({...p, date: new Date(p.date)})),
          memo: selectedDonation.memo || '',
          cerfaEligible: selectedDonation.cerfaEligible,
        });
      } else {
        form.reset({
          memberId: '',
          type: 'Don',
          donationCategoryId: '',
          totalAmount: 0,
          payments: [{ amount: 0, date: new Date(), paymentMethod: 'Espèces' }],
          memo: '',
          cerfaEligible: true,
        });
      }
    }
  }, [selectedDonation, isFormOpen, form]);

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
    
    const paidSum = data.payments.reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
    let finalPaymentStatus: 'EN ATTENTE' | 'Partiel' | 'Payé';

    if (paidSum <= 0) {
        finalPaymentStatus = 'EN ATTENTE';
    } else if (paidSum < data.totalAmount) {
        finalPaymentStatus = 'Partiel';
    } else {
        finalPaymentStatus = 'Payé';
    }
    
    const donationData: Omit<Donation, 'id' | 'createdAt'> = {
        ...data,
        totalAmount: Number(data.totalAmount),
        donationCategoryId: data.type === 'Don' ? data.donationCategoryId : '',
        payments: data.payments.map(p => ({...p, amount: Number(p.amount), date: p.date.toISOString()})),
        paymentStatus: finalPaymentStatus,
    };

    try {
      if (selectedDonation) {
        // Update
        const donationRef = doc(firestore, 'users', user.uid, 'donations', selectedDonation.id);
        await setDocumentNonBlocking(donationRef, { ...donationData, createdAt: selectedDonation.createdAt }, { merge: true });
        toast({ title: 'Don mis à jour' });
        // TODO: Handle transaction updates if necessary
      } else {
        // Create
        const collectionRef = collection(firestore, 'users', user.uid, 'donations');
        const newDoc = await addDocumentNonBlocking(collectionRef, { ...donationData, createdAt: new Date().toISOString() });
        
        if (newDoc) {
            const transactionData: Omit<Transaction, 'id' | 'createdAt'>[] = data.payments.map(p => ({
              type: donationData.type,
              relatedId: newDoc.id,
              amount: Number(p.amount),
              date: p.date.toISOString(),
              paymentMethod: p.paymentMethod,
              memo: donationData.memo
            }));
            
            const transactionRef = collection(firestore, 'users', user.uid, 'transactions');
            for(const trans of transactionData){
                 await addDocumentNonBlocking(transactionRef, {...trans, createdAt: new Date().toISOString()});
            }
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
    // TODO: Also delete the associated transactions
    const docRef = doc(firestore, 'users', user.uid, 'donations', selectedDonation.id);
    await deleteDocumentNonBlocking(docRef);
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
                  <TableCell colSpan={7} className="p-6 text-center text-muted-foreground">
                    Aucun don ou cotisation trouvé.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      
      <Dialog open={isFormOpen} onOpenChange={handleCloseForm}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{selectedDonation ? 'Modifier le don' : 'Ajouter un don/cotisation'}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 py-4">
              <FormField
                control={form.control}
                name="memberId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Membre</FormLabel>
                     <FormControl>
                        <Command>
                            <CommandInput placeholder="Rechercher par nom, email, mémo..." className="border-black"/>
                            <CommandList>
                            <CommandEmpty>Aucun membre trouvé.</CommandEmpty>
                            <CommandGroup>
                                {members?.map((member) => (
                                <CommandItem
                                    value={`${member.nom} ${member.email} ${member.memo}`}
                                    key={member.id}
                                    onSelect={() => {
                                        form.setValue("memberId", member.id);
                                    }}
                                >
                                    <Check
                                    className={cn(
                                        "mr-2 h-4 w-4",
                                        member.id === field.value ? "opacity-100" : "opacity-0"
                                    )}
                                    />
                                    <div>
                                        <p>{member.nom}
                                         <span className="ml-2 text-xs text-muted-foreground">({field.value === member.id ? 'Sélectionné' : 'Sélectionner'})</span>
                                        </p>
                                        <p className="text-xs text-muted-foreground">{member.email} - {member.adresse}</p>
                                    </div>
                                </CommandItem>
                                ))}
                            </CommandGroup>
                            </CommandList>
                        </Command>
                    </FormControl>
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
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
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
                          <FormControl><SelectTrigger><SelectValue placeholder="Sélectionner une catégorie" /></SelectTrigger></FormControl>
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
              <div className="grid grid-cols-2 gap-4 items-end">
                <FormField
                    control={form.control}
                    name="totalAmount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Montant Total du Don (€)</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" {...field} onChange={e => field.onChange(parseFloat(e.target.value) || 0)} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="space-y-2 rounded-md bg-muted p-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Payé</span>
                      <span>{paidAmount.toLocaleString('fr-FR', {style: 'currency', currency: 'EUR'})}</span>
                    </div>
                    <div className="flex justify-between font-medium">
                      <span className="text-muted-foreground">Reste à régler</span>
                      <span>{remainingAmount.toLocaleString('fr-FR', {style: 'currency', currency: 'EUR'})}</span>
                    </div>
                    <div className="flex justify-between items-center pt-1">
                      <span className="text-muted-foreground">Statut</span>
                      {getStatusBadge(paymentStatus)}
                    </div>
                  </div>
              </div>
              <div>
                <FormLabel>Paiements</FormLabel>
                <div className="space-y-4 rounded-md border p-4 mt-2">
                  {fields.map((field, index) => (
                    <div key={field.id} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-start relative">
                      <FormField
                        control={form.control}
                        name={`payments.${index}.amount`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Montant (€)</FormLabel>
                            <FormControl><Input type="number" step="0.01" {...field} onChange={e => field.onChange(parseFloat(e.target.value) || 0)} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`payments.${index}.paymentMethod`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Moyen</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
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
                        name={`payments.${index}.date`}
                        render={({ field }) => (
                          <FormItem className="flex flex-col">
                             <FormLabel className="mb-2">Date</FormLabel>
                             <Popover>
                              <PopoverTrigger asChild>
                                <FormControl>
                                  <Button variant={"outline"} className={cn("pl-3 text-left font-normal",!field.value && "text-muted-foreground")}>
                                    {field.value ? format(field.value, "d MMMM yyyy", { locale: fr }) : <span>Choisir une date</span>}
                                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                  </Button>
                                </FormControl>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0" align="start">
                                <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus locale={fr} />
                              </PopoverContent>
                            </Popover>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <Button type="button" variant="ghost" size="icon" className="text-destructive hover:text-destructive absolute -right-2 top-5 md:relative md:right-auto md:top-auto md:mt-7" onClick={() => remove(index)}>
                          <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  {fields.length < 3 && (
                    <Button type="button" variant="outline" size="sm" onClick={() => append({ amount: 0, date: new Date(), paymentMethod: 'Espèces' })}>
                      <PlusCircle className="mr-2 h-4 w-4" /> Ajouter un paiement
                    </Button>
                  )}
                </div>
              </div>
              <FormField
                control={form.control}
                name="memo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Mémo</FormLabel>
                    <FormControl><Textarea placeholder="Informations complémentaires..." {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
               <FormField
                control={form.control}
                name="cerfaEligible"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md border p-4">
                     <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange}/></FormControl>
                    <div className="space-y-1 leading-none"><FormLabel>Éligible pour un reçu fiscal (CERFA)</FormLabel></div>
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
              Cette action est irréversible. Le don de {selectedDonation?.totalAmount}€ par {selectedDonation?.memberName} sera supprimé.
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
