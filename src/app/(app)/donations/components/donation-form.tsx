'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useFirestore, useCollection, useMemoFirebase, addDocumentNonBlocking, setDocumentNonBlocking, useUser, useDoc } from '@/firebase';
import { collection, doc } from 'firebase/firestore';
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
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Calendar } from '@/components/ui/calendar';
import { CalendarIcon, ChevronsUpDown, Check, PlusCircle, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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

interface DonationFormProps {
  donationId?: string;
}

export function DonationForm({ donationId }: DonationFormProps) {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const router = useRouter();

  // Data fetching
  const membersCollection = useMemoFirebase(() => user ? collection(firestore, 'users', user.uid, 'membre') : null, [firestore, user]);
  const categoriesCollection = useMemoFirebase(() => collection(firestore, 'donationCategories'), [firestore]);
  const donationDocRef = useMemoFirebase(() => (donationId && user) ? doc(firestore, 'users', user.uid, 'donations', donationId) : null, [donationId, user, firestore]);

  const { data: members, isLoading: isLoadingMembers } = useCollection<Member>(membersCollection);
  const { data: categories, isLoading: isLoadingCategories } = useCollection<DonationCategory>(categoriesCollection);
  const { data: existingDonation, isLoading: isLoadingDonation } = useDoc<Donation>(donationDocRef);

  const [openMemberPopover, setOpenMemberPopover] = useState(false);
  
  const isEditMode = !!donationId;

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

  // Watchers for reactive UI
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

  // Effect to populate form in edit mode
  useEffect(() => {
    if (isEditMode && existingDonation) {
      form.reset({
        memberId: existingDonation.memberId,
        type: existingDonation.type,
        donationCategoryId: existingDonation.donationCategoryId || '',
        totalAmount: existingDonation.totalAmount,
        payments: existingDonation.payments.map(p => ({...p, date: new Date(p.date)})),
        memo: existingDonation.memo || '',
        cerfaEligible: existingDonation.cerfaEligible,
      });
    } else if (!isEditMode) {
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
  }, [isEditMode, existingDonation, form]);

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
      if (isEditMode) {
        const donationRef = doc(firestore, 'users', user.uid, 'donations', donationId);
        await setDocumentNonBlocking(donationRef, { ...donationData, createdAt: existingDonation?.createdAt }, { merge: true });
        toast({ title: 'Don mis à jour' });
        // TODO: Handle transaction updates if necessary
      } else {
        // Create
        const collectionRef = collection(firestore, 'users', user.uid, 'donations');
        const newDocRef = await addDocumentNonBlocking(collectionRef, { ...donationData, createdAt: new Date().toISOString() });
        
        if (newDocRef) {
            const transactionData: Omit<Transaction, 'id' | 'createdAt'>[] = data.payments.map(p => ({
              type: donationData.type,
              relatedId: newDocRef.id,
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
      router.push('/donations');
    } catch (e: any) {
        console.error("Error saving donation", e);
        toast({ variant: "destructive", title: "Erreur de sauvegarde", description: e.message });
    }
  };
  
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

  if (isLoadingDonation) {
    return <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin"/></div>
  }

  return (
    <Card>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <CardHeader>
            <CardTitle>{isEditMode ? 'Modifier le don' : 'Ajouter un don/cotisation'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <FormField
              control={form.control}
              name="memberId"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Membre</FormLabel>
                  <Popover open={openMemberPopover} onOpenChange={setOpenMemberPopover}>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          role="combobox"
                          className={cn(
                            "w-full justify-between",
                            !field.value && "text-muted-foreground"
                          )}
                        >
                          {field.value
                            ? members?.find(
                                (member) => member.id === field.value
                              )?.nom
                            : "Sélectionner un membre"}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                      <Command>
                        <CommandInput placeholder="Rechercher un membre..." />
                        <CommandList>
                          <CommandEmpty>Aucun membre trouvé.</CommandEmpty>
                          <CommandGroup>
                            {members?.map((member) => (
                              <CommandItem
                                value={member.nom}
                                key={member.id}
                                onSelect={() => {
                                  form.setValue("memberId", member.id);
                                  setOpenMemberPopover(false);
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    member.id === field.value
                                      ? "opacity-100"
                                      : "opacity-0"
                                  )}
                                />
                                {member.nom}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
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
          </CardContent>
          <CardFooter className="flex justify-end gap-2">
            <Button type="button" variant="ghost" asChild>
              <Link href="/donations">Annuler</Link>
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin"/>Enregistrement...</>
              ) : 'Enregistrer'}
            </Button>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}
