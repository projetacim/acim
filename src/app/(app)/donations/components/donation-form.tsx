
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useFirestore, addDocumentNonBlocking, setDocumentNonBlocking, useUser, updateDocumentNonBlocking } from '@/firebase';
import { collection, doc, getDocs, getDoc, query, where } from 'firebase/firestore';
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
import { Calendar } from '@/components/ui/calendar';
import { CalendarIcon, PlusCircle, X, Loader2, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Checkbox } from '@/components/ui/checkbox';
import { PDFDocument, rgb, StandardFonts, degrees } from 'pdf-lib';
import { numberToWords } from '@/lib/number-to-words';

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
  paymentStatus: z.enum(['EN ATTENTE', 'Partiel', 'Payé', 'Annulé']).optional(),
  // CERFA specific fields
  cerfaNom: z.string().optional(),
  cerfaAdresse: z.string().optional(),
  cerfaEmail: z.string().email("Email invalide").optional(),
  cerfaDate: z.date().optional(),
});

type DonationFormValues = z.infer<typeof donationSchema>;

interface DonationFormProps {
  donationId?: string;
  memberIdParam?: string;
  onFormSubmit?: () => void;
}

const A4_HEIGHT_POINTS = 841.89;
const mmToPoints = (mm: number) => mm * 2.83465;

const cerfaCoordinates = {
    cerfaId:          { x: mmToPoints(174),  y: A4_HEIGHT_POINTS - mmToPoints(24) },
    donorName:        { x: mmToPoints(35),   y: A4_HEIGHT_POINTS - mmToPoints(51) },
    donorAddress:     { x: mmToPoints(35),   y: A4_HEIGHT_POINTS - mmToPoints(60) },
    paymentDate:      { x: mmToPoints(163),  y: A4_HEIGHT_POINTS - mmToPoints(256) },
    amountInDigits:   { x: mmToPoints(41),   y: A4_HEIGHT_POINTS - mmToPoints(207) },
    amountInWords:    { x: mmToPoints(115),  y: A4_HEIGHT_POINTS - mmToPoints(207) },
    signatureDate:    { x: mmToPoints(163),  y: A4_HEIGHT_POINTS - mmToPoints(256) },
    signatureDate2:   { x: mmToPoints(55),   y: A4_HEIGHT_POINTS - mmToPoints(240) },
    paymentMethod:    { x: mmToPoints(55),   y: A4_HEIGHT_POINTS - mmToPoints(247.5)}
};


export function DonationForm({ donationId, memberIdParam, onFormSubmit }: DonationFormProps) {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const router = useRouter();

  const [member, setMember] = useState<Member | null>(null);
  const [categories, setCategories] = useState<DonationCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentDonation, setCurrentDonation] = useState<Donation | null>(null);
  
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
      cerfaNom: '',
      cerfaAdresse: '',
      cerfaEmail: '',
      cerfaDate: new Date(),
    },
  });
  
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "payments"
  });

  useEffect(() => {
    async function fetchData() {
      if (!user || !firestore) return;
      setIsLoading(true);
      
      const memberIdToFetch = isEditMode ? null : memberIdParam;

      try {
        const categoriesCollectionRef = collection(firestore, 'users', user.uid, 'donationCategories');
        const categoriesSnapshot = await getDocs(categoriesCollectionRef);
        const categoriesList = categoriesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as DonationCategory[];
        setCategories(categoriesList);

        const benZakaiCategory = categoriesList.find(cat => cat.name.toUpperCase() === 'BEN ZAKAI');
        const defaultCategoryId = benZakaiCategory ? benZakaiCategory.id : '';

        if (isEditMode && donationId) {
          const donationDocRef = doc(firestore, 'users', user.uid, 'donations', donationId);
          const donationSnap = await getDoc(donationDocRef);
          if (donationSnap.exists()) {
            const existingDonation = { ...donationSnap.data(), id: donationSnap.id } as Donation;
            setCurrentDonation(existingDonation);
            form.setValue('memberId', existingDonation.memberId);
            
            const memberDocRef = doc(firestore, 'users', user.uid, 'membre', existingDonation.memberId);
            const memberSnap = await getDoc(memberDocRef);
            if(memberSnap.exists()) {
              const memberData = {id: memberSnap.id, ...memberSnap.data()} as Member;
              setMember(memberData);
              form.setValue('cerfaNom', existingDonation.cerfaNom || memberData.nom);
              form.setValue('cerfaAdresse', existingDonation.cerfaAdresse || memberData.adresse || '');
              form.setValue('cerfaEmail', existingDonation.cerfaEmail || memberData.email || '');
            }

            form.reset({
              memberId: existingDonation.memberId,
              type: existingDonation.type,
              donationCategoryId: existingDonation.donationCategoryId || '',
              totalAmount: existingDonation.totalAmount,
              payments: existingDonation.payments.map(p => ({...p, date: new Date(p.date)})),
              memo: existingDonation.memo || '',
              cerfaEligible: existingDonation.cerfaEligible,
              cerfaNom: existingDonation.cerfaNom || member?.nom || '',
              cerfaAdresse: existingDonation.cerfaAdresse || member?.adresse || '',
              cerfaEmail: existingDonation.cerfaEmail || member?.email || '',
              cerfaDate: existingDonation.cerfaDate ? new Date(existingDonation.cerfaDate) : new Date(),
            });
          }
        } else if (memberIdToFetch) {
            const memberDocRef = doc(firestore, 'users', user.uid, 'membre', memberIdToFetch);
            const memberSnap = await getDoc(memberDocRef);
             if(memberSnap.exists()) {
              const memberData = {id: memberSnap.id, ...memberSnap.data()} as Member;
              setMember(memberData);
              form.reset({
                  memberId: memberData.id,
                  type: 'Don',
                  donationCategoryId: defaultCategoryId,
                  totalAmount: 0,
                  payments: [{ amount: 0, date: new Date(), paymentMethod: 'Carte de crédit' }],
                  memo: '',
                  cerfaEligible: true,
                  cerfaNom: memberData.nom,
                  cerfaAdresse: memberData.adresse || '',
                  cerfaEmail: memberData.email,
                  cerfaDate: new Date(),
              });
            } else {
                 toast({ variant: "destructive", title: "Erreur", description: "Membre non trouvé." });
            }
        }
      } catch (error) {
        console.error("Failed to fetch data:", error);
        toast({
          variant: "destructive",
          title: "Erreur de chargement",
          description: "Impossible de charger les données nécessaires.",
        });
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, [donationId, memberIdParam, isEditMode, user, firestore, form, toast]);


  const watchPayments = useWatch({ control: form.control, name: 'payments' });
  const watchTotalAmount = useWatch({ control: form.control, name: 'totalAmount' });
  const donationType = useWatch({ control: form.control, name: 'type' });
  const watchCerfaEligible = useWatch({ control: form.control, name: 'cerfaEligible' });
  
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
        const cerfaNumber = `${year}-${nextId.toString().padStart(4, '0')}`;
        return cerfaNumber;
    } catch(err) {
        console.error("Error generating CERFA number: ", err);
        toast({ variant: 'destructive', title: 'Erreur Permission CERFA', description: 'Impossible de générer un numéro CERFA.' });
        return null;
    }
  };


  const onSubmit: SubmitHandler<DonationFormValues> = async (data) => {
    if (!firestore || !user) {
      toast({ variant: "destructive", title: "Erreur", description: "Utilisateur ou base de données non disponible." });
      return;
    }
    
    let finalPaymentStatus = paymentStatus;
    
    let donationData: Partial<Donation> = {
        ...data,
        totalAmount: Number(data.totalAmount),
        donationCategoryId: data.type === 'Don' ? data.donationCategoryId : '',
        payments: data.payments.map(p => ({...p, amount: Number(p.amount), date: p.date.toISOString()})),
        paymentStatus: finalPaymentStatus,
        cerfaDate: data.cerfaDate?.toISOString(),
    };

    try {
      if (isEditMode && currentDonation) {
        const donationDocRef = doc(firestore, 'users', user.uid, 'donations', donationId);
        
        const wasPaid = currentDonation.paymentStatus === 'Payé';
        const isNowPaid = finalPaymentStatus === 'Payé';

        if(isNowPaid && !wasPaid && data.cerfaEligible && !currentDonation.cerfaNumber) {
            const newCerfaNumber = await generateCerfaNumber();
            if(newCerfaNumber){
                donationData.cerfaNumber = newCerfaNumber;
                donationData.cerfaDate = (data.cerfaDate || new Date()).toISOString();
                 toast({ title: 'N° CERFA généré', description: `Le numéro ${newCerfaNumber} a été assigné.` });
            }
        }
        
        await updateDocumentNonBlocking(donationDocRef, donationData);
        toast({ title: 'Don mis à jour' });
      } else {
        const collectionRef = collection(firestore, 'users', user.uid, 'donations');
        const donationToSave: Partial<Donation> & { createdAt: string } = { ...donationData, createdAt: new Date().toISOString() };

        if(finalPaymentStatus === 'Payé' && data.cerfaEligible) {
            const newCerfaNumber = await generateCerfaNumber();
             if(newCerfaNumber){
                donationToSave.cerfaNumber = newCerfaNumber;
                donationToSave.cerfaDate = (data.cerfaDate || new Date()).toISOString();
                 toast({ title: 'N° CERFA généré', description: `Le numéro ${newCerfaNumber} a été assigné.` });
            }
        }

        const newDocRef = await addDocumentNonBlocking(collectionRef, donationToSave);
        
        if (newDocRef) {
            const transactionData: Omit<Transaction, 'id' | 'createdAt'>[] = data.payments.map(p => ({
              type: donationToSave.type as 'Don' | 'Cotisation',
              relatedId: newDocRef.id,
              amount: Number(p.amount),
              date: p.date.toISOString(),
              paymentMethod: p.paymentMethod,
              memo: donationToSave.memo
            }));
            
            const transactionRef = collection(firestore, 'users', user.uid, 'transactions');
            for(const trans of transactionData){
                 await addDocumentNonBlocking(transactionRef, {...trans, createdAt: new Date().toISOString()});
            }
        }
        
        toast({ title: 'Don ajouté', description: `Un nouveau don/cotisation a été enregistré.` });
      }
      if (onFormSubmit) {
        onFormSubmit();
      } else {
        router.push('/');
      }
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
       case 'Annulé':
        return <Badge variant="destructive">Annulé</Badge>;
      default:
        return <Badge variant="secondary">Inconnu</Badge>;
    }
  };

  const handleGenerateCerfa = async () => {
    if (!firestore || !user || !currentDonation || !member) {
      toast({ variant: 'destructive', title: 'Erreur', description: 'Données manquantes pour générer le CERFA.' });
      return;
    }

    try {
        const templateBytes = await fetch('/cerfa_template.pdf').then(res => res.arrayBuffer());
        const pdfDoc = await PDFDocument.load(templateBytes);
        const page = pdfDoc.getPages()[0];
        
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const textColor = rgb(0, 0, 0);
        
        const formValues = form.getValues();
        
        const lastPayment = formValues.payments.sort((a,b) => b.date.getTime() - a.date.getTime())[0];
        const paymentDate = new Date(lastPayment.date);
        const formattedDate = format(paymentDate, 'dd/MM/yyyy');
        
        const cerfaDate = formValues.cerfaDate || new Date();
        const formattedCerfaDate = format(cerfaDate, 'dd/MM/yyyy');

        const paymentMethods = [...new Set(formValues.payments.map(p => {
            if (p.paymentMethod === 'Carte de crédit') return 'CB';
            return p.paymentMethod;
        }))].join(', ');
        
        page.drawText(currentDonation.cerfaNumber || 'N/A', { ...cerfaCoordinates.cerfaId, font, size: 10, color: textColor });
        page.drawText(formValues.cerfaNom || '', { ...cerfaCoordinates.donorName, font, size: 10, color: textColor });
        page.drawText(formValues.cerfaAdresse || '', { ...cerfaCoordinates.donorAddress, font, size: 10, color: textColor });
        
        page.drawText(formValues.totalAmount.toFixed(2), { ...cerfaCoordinates.amountInDigits, font, size: 10, color: textColor });
        page.drawText(numberToWords(formValues.totalAmount) + ' euros', { ...cerfaCoordinates.amountInWords, font, size: 8, color: textColor });
        
        page.drawText(formattedDate, { ...cerfaCoordinates.paymentDate, font, size: 10, color: textColor });
        page.drawText(formattedCerfaDate, { ...cerfaCoordinates.signatureDate, font, size: 10, color: textColor });
        page.drawText(formattedCerfaDate, { ...cerfaCoordinates.signatureDate2, font, size: 10, color: textColor });
        
        page.drawText(paymentMethods, { ...cerfaCoordinates.paymentMethod, font, size: 10, color: textColor });

        const pdfBytes = await pdfDoc.save();
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
        
    } catch (error) {
        console.error("Failed to generate PDF:", error);
        toast({ variant: 'destructive', title: 'Erreur PDF', description: 'La génération du fichier CERFA a échoué.' });
    }
  };

  if (isLoading) {
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* COLONNE GAUCHE */}
              <div className="space-y-6">
                <FormItem>
                  <FormLabel>Membre</FormLabel>
                  <FormControl>
                    <div className="flex h-10 w-full items-center rounded-md border border-input bg-muted px-3 py-2 text-sm">
                      {member ? member.nom : "Chargement..."}
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>

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
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl><SelectTrigger><SelectValue placeholder="Sélectionner une catégorie" /></SelectTrigger></FormControl>
                          <SelectContent>
                            {isLoading ? <SelectItem value="loading" disabled>Chargement...</SelectItem> : categories?.map(cat => (
                              <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                <FormField
                  control={form.control}
                  name="totalAmount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Montant Total du Don (€)</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" {...field} onChange={e => field.onChange(parseFloat(e.target.value) || 0)} className="border-black" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* COLONNE DROITE */}
              <div className="space-y-6">
                 <div className="space-y-2 rounded-md bg-muted p-3 text-sm">
                    <h3 className="font-medium mb-3">Résumé</h3>
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
                
                 <FormField
                    control={form.control}
                    name="memo"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Mémo</FormLabel>
                        <FormControl><Textarea placeholder="Informations complémentaires..." {...field} className="border-black" /></FormControl>
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
              </div>
            </div>

            {/* PAIEMENTS - pleine largeur */}
            <div className="pt-4">
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
                          <FormControl><Input type="number" step="0.01" {...field} onChange={e => field.onChange(parseFloat(e.target.value) || 0)} className="border-black" /></FormControl>
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
                              <SelectItem value="Carte de crédit">Carte de crédit</SelectItem>
                              <SelectItem value="Virement bancaire">Virement bancaire</SelectItem>
                              <SelectItem value="Espèces">Espèces</SelectItem>
                              <SelectItem value="Chèque">Chèque</SelectItem>
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
                  <Button type="button" variant="outline" size="sm" onClick={() => append({ amount: 0, date: new Date(), paymentMethod: 'Carte de crédit' })}>
                    <PlusCircle className="mr-2 h-4 w-4" /> Ajouter un paiement
                  </Button>
                )}
              </div>
            </div>

            {/* INFORMATIONS CERFA - pleine largeur */}
            {watchCerfaEligible && (
              <div className="space-y-4 rounded-md border border-dashed border-primary/50 bg-primary/5 p-4 mt-4">
                <h3 className="font-semibold text-primary">Informations pour le CERFA</h3>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="cerfaNom"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nom du Donateur (pour le CERFA)</FormLabel>
                          <FormControl><Input {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="cerfaDate"
                      render={({ field }) => (
                        <FormItem className="flex flex-col">
                           <FormLabel className="mb-2">Date de Signature du CERFA</FormLabel>
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
                 </div>
                 <FormField
                    control={form.control}
                    name="cerfaAdresse"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Adresse du Donateur (pour le CERFA)</FormLabel>
                        <FormControl><Textarea {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="cerfaEmail"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email du Donateur (pour envoi)</FormLabel>
                        <FormControl><Input type="email" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  {isEditMode && paymentStatus === 'Payé' && currentDonation?.cerfaNumber && (
                    <Button type="button" onClick={handleGenerateCerfa} variant="secondary">
                        <FileText className="mr-2 h-4 w-4" />
                        Générer le PDF CERFA
                    </Button>
                  )}
              </div>
            )}
          </CardContent>
          <CardFooter className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onFormSubmit}>
              Annuler
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
