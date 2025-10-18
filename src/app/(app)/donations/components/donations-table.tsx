
'use client';
import { useState, useMemo, useEffect } from 'react';
import { useFirestore, useCollection, useMemoFirebase, deleteDocumentNonBlocking, useUser, updateDocumentNonBlocking } from '@/firebase';
import { collection, doc, getDocs, query, where, updateDoc, getDoc } from 'firebase/firestore';
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
import { Pencil, Trash2, XCircle, FileWarning } from 'lucide-react';
import type { Donation, Member, Payment, DonationCategory } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { useRouter } from 'next/navigation';
import { PDFDocument, rgb, StandardFonts, degrees } from 'pdf-lib';
import { numberToWords } from '@/lib/number-to-words';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';


type DonationWithDetails = Donation & { memberName: string; categoryName?: string; };

interface DonationsTableProps {
    selectedMemberId: string | null;
}

// PDF generation constants and helpers
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


export function DonationsTable({ selectedMemberId }: DonationsTableProps) {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const router = useRouter();

  const membersCollection = useMemoFirebase(() => user ? collection(firestore, 'users', user.uid, 'membre') : null, [firestore, user]);
  const donationsCollection = useMemoFirebase(() => user ? collection(firestore, 'users', user.uid, 'donations') : null, [firestore, user]);
  const categoriesCollection = useMemoFirebase(() => user ? collection(firestore, 'donationCategories') : null, [firestore, user]);

  const { data: members, isLoading: isLoadingMembers } = useCollection<Member>(membersCollection);
  const { data: donations, isLoading: isLoadingDonations } = useCollection<Donation>(donationsCollection);
  const { data: categories, isLoading: isLoadingCategories } = useCollection<DonationCategory>(categoriesCollection);
  
  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);
  const [isCancelAlertOpen, setIsCancelAlertOpen] = useState(false);
  const [selectedDonation, setSelectedDonation] = useState<DonationWithDetails | null>(null);

  const processedDonations = useMemo(() => {
    if (!donations || !members || !categories) return [];
    
    const memberMap = new Map(members.map(m => [m.id, m.nom]));
    const categoryMap = new Map(categories.map(c => [c.id, c.name]));
    
    let filteredDonations = donations;
    if(selectedMemberId) {
        filteredDonations = donations.filter(d => d.memberId === selectedMemberId);
    }
    
    return filteredDonations
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

  const generateCerfaNumber = async (donationId: string) => {
    if (!firestore || !user) return;

    const year = new Date().getFullYear();
    const donationsRef = collection(firestore, 'users', user.uid, 'donations');
    
    const q = query(donationsRef, where("cerfaNumber", ">=", `${year}-0000`), where("cerfaNumber", "<", `${year+1}-0000`));

    try {
        const querySnapshot = await getDocs(q);
        const nextId = querySnapshot.docs.length + 1;
        const cerfaNumber = `${year}-${nextId.toString().padStart(4, '0')}`;
        const donationDocRef = doc(firestore, 'users', user.uid, 'donations', donationId);
        
        await updateDocumentNonBlocking(donationDocRef, { cerfaNumber: cerfaNumber });
        
        toast({ title: 'N° CERFA généré', description: `Le numéro ${cerfaNumber} a été assigné.` });
        return cerfaNumber;
    } catch(err) {
        console.error("Error generating CERFA number: ", err);
        toast({ variant: 'destructive', title: 'Erreur Permission CERFA', description: 'Impossible de sauvegarder le numéro CERFA.' });
        return null;
    }
  };
  
  const handleCerfaClick = async (donation: DonationWithDetails) => {
    if (!donation.cerfaEligible) return;
     if (!firestore || !user) return;

    let cerfaNumber = donation.cerfaNumber;
    if (!cerfaNumber && donation.paymentStatus === 'Payé') {
        const generatedNumber = await generateCerfaNumber(donation.id);
        if (!generatedNumber) return; // Stop if number generation failed
        cerfaNumber = generatedNumber;
    }
    
    if (cerfaNumber) {
        try {
            const memberDocRef = doc(firestore, 'users', user.uid, 'membre', donation.memberId);
            const memberSnap = await getDoc(memberDocRef);
            if (!memberSnap.exists()) {
                toast({ variant: 'destructive', title: 'Erreur', description: 'Membre introuvable.' });
                return;
            }
            const member = memberSnap.data() as Member;

            const templateBytes = await fetch('/cerfa_template.pdf').then(res => res.arrayBuffer());
            const pdfDoc = await PDFDocument.load(templateBytes);
            const page = pdfDoc.getPages()[0];
            const { width, height } = page.getSize();

            const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
            const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
            const textColor = rgb(0, 0, 0);

            if (donation.paymentStatus === 'Annulé') {
                page.drawText('ANNULÉ', {
                    x: width / 2 - 150,
                    y: height / 2 + 100,
                    font: boldFont,
                    size: 100,
                    color: rgb(1, 0, 0),
                    opacity: 0.2,
                    rotate: degrees(-45),
                });
            }

            const lastPayment = donation.payments.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
            const paymentDate = new Date(lastPayment.date);
            const formattedDate = `${paymentDate.getDate().toString().padStart(2, '0')}/${(paymentDate.getMonth() + 1).toString().padStart(2, '0')}/${paymentDate.getFullYear()}`;

            const paymentMethods = [...new Set(donation.payments.map(p => {
                if (p.paymentMethod === 'Carte de crédit') return 'CB';
                return p.paymentMethod;
            }))].join(', ');

            page.drawText(cerfaNumber, { ...cerfaCoordinates.cerfaId, font, size: 10, color: textColor });
            page.drawText(member.nom, { ...cerfaCoordinates.donorName, font, size: 10, color: textColor });
            page.drawText(member.adresse || '', { ...cerfaCoordinates.donorAddress, font, size: 10, color: textColor });
            
            page.drawText(donation.totalAmount.toFixed(2), { ...cerfaCoordinates.amountInDigits, font, size: 10, color: textColor });
            page.drawText(numberToWords(donation.totalAmount) + ' euros', { ...cerfaCoordinates.amountInWords, font, size: 8, color: textColor });
            
            page.drawText(formattedDate, { ...cerfaCoordinates.paymentDate, font, size: 10, color: textColor });
            page.drawText(formattedDate, { ...cerfaCoordinates.signatureDate, font, size: 10, color: textColor });
            page.drawText(formattedDate, { ...cerfaCoordinates.signatureDate2, font, size: 10, color: textColor });

            page.drawText(paymentMethods, { ...cerfaCoordinates.paymentMethod, font, size: 10, color: textColor });

            const pdfBytes = await pdfDoc.save();
            const blob = new Blob([pdfBytes], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);
            window.open(url, '_blank');
            
        } catch (error) {
            console.error("Failed to generate PDF:", error);
            toast({ variant: 'destructive', title: 'Erreur PDF', description: 'La génération du fichier CERFA a échoué.' });
        }
    } else {
        toast({ variant: 'destructive', title: 'Action impossible', description: 'Le don doit être entièrement payé pour générer un CERFA.' });
    }
  };


  const handleDelete = async () => {
    if (!firestore || !selectedDonation || !user) return;
    const donationDocRef = doc(firestore, 'users', user.uid, 'donations', selectedDonation.id);
    
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
  
  const handleCancelDonation = async () => {
    if (!firestore || !selectedDonation || !user) return;
    const donationDocRef = doc(firestore, 'users', user.uid, 'donations', selectedDonation.id);
    try {
      await updateDocumentNonBlocking(donationDocRef, { paymentStatus: 'Annulé' });
      toast({
        title: 'Don annulé',
        description: `Le don de ${selectedDonation.memberName} a été marqué comme annulé.`,
      });
    } catch (error) {
      console.error("Error canceling donation:", error);
      toast({ variant: 'destructive', title: 'Erreur', description: "L'annulation du don a échoué." });
    }
    setIsCancelAlertOpen(false);
    setSelectedDonation(null);
  };

  const openDeleteAlert = (donation: DonationWithDetails) => {
    setSelectedDonation(donation);
    setIsDeleteAlertOpen(true);
  }
  
  const openCancelAlert = (donation: DonationWithDetails) => {
    setSelectedDonation(donation);
    setIsCancelAlertOpen(true);
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

  const isLoading = isLoadingMembers || isLoadingDonations || isLoadingCategories;

  return (
    <>
      <ScrollArea className="h-96 w-full rounded-md border">
        <Table>
            <TableHeader>
            <TableRow>
                {!selectedMemberId && <TableHead>Membre</TableHead>}
                <TableHead>Type</TableHead>
                <TableHead>Catégorie</TableHead>
                <TableHead className="hidden sm:table-cell">Mémo</TableHead>
                <TableHead className="text-right">Montant</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>N° CERFA</TableHead>
                <TableHead className="text-right">Actions</TableHead>
            </TableRow>
            </TableHeader>
            <TableBody>
            {isLoading && Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i}>
                    {!selectedMemberId && <TableCell><Skeleton className="h-4 w-32" /></TableCell>}
                    <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell className="hidden sm:table-cell"><Skeleton className="h-4 w-28" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-24 rounded-full" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-8 w-20" /></TableCell>
                </TableRow>
            ))}
            {!isLoading && processedDonations.map((donation) => (
                <TableRow key={donation.id} className={cn(donation.paymentStatus === 'Annulé' && 'bg-red-50 dark:bg-red-900/20')}>
                {!selectedMemberId && <TableCell className="font-medium">{donation.memberName}</TableCell>}
                <TableCell>
                    <Badge variant={donation.type === 'Don' ? 'secondary' : 'outline'}>{donation.type}</Badge>
                </TableCell>
                <TableCell>{donation.categoryName}</TableCell>
                <TableCell className="hidden sm:table-cell">
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
                <TableCell className="text-right font-medium">{donation.totalAmount.toLocaleString('fr-FR', {style: 'currency', currency: 'EUR'})}</TableCell>
                <TableCell>{getStatusBadge(donation.paymentStatus)}</TableCell>
                <TableCell>
                    {donation.cerfaEligible ? (
                        <Button 
                            variant="link" 
                            className={cn("p-0 h-auto", donation.paymentStatus === 'Annulé' && 'text-red-500')}
                            onClick={() => handleCerfaClick(donation)}
                            disabled={donation.paymentStatus !== 'Payé' && !donation.cerfaNumber && donation.paymentStatus !== 'Annulé'}
                        >
                            {donation.cerfaNumber || (donation.paymentStatus === 'Payé' ? 'Générer' : 'N/A')}
                        </Button>
                    ) : (
                        <span className="text-muted-foreground">Non éligible</span>
                    )}
                </TableCell>
                <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-0 md:gap-2">
                        <Button variant="ghost" size="icon" onClick={() => router.push(`/donations/${donation.id}/edit`)} disabled={donation.paymentStatus === 'Payé' || donation.paymentStatus === 'Annulé'}>
                          <Pencil className="h-4 w-4" />
                          <span className="sr-only">Modifier</span>
                        </Button>
                        {donation.cerfaNumber ? (
                             <Button variant="ghost" size="icon" onClick={() => openCancelAlert(donation)} className="text-destructive hover:text-destructive" disabled={donation.paymentStatus === 'Annulé'}>
                               <FileWarning className="h-4 w-4" />
                               <span className="sr-only">Annuler le don</span>
                            </Button>
                        ) : (
                            <Button variant="ghost" size="icon" onClick={() => openDeleteAlert(donation)} className="text-destructive hover:text-destructive" disabled={donation.paymentStatus === 'Annulé'}>
                                <Trash2 className="h-4 w-4" />
                                <span className="sr-only">Supprimer</span>
                            </Button>
                        )}
                    </div>
                </TableCell>
                </TableRow>
            ))}
            {!isLoading && processedDonations.length === 0 && (
                <TableRow>
                <TableCell colSpan={selectedMemberId ? 7 : 8} className="p-6 text-center text-muted-foreground">
                    {selectedMemberId ? 'Aucun don trouvé pour ce membre.' : 'Aucun don trouvé.'}
                </TableCell>
                </TableRow>
            )}
            </TableBody>
        </Table>
      </ScrollArea>
      
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

      <AlertDialog open={isCancelAlertOpen} onOpenChange={setIsCancelAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Annuler le don avec CERFA ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. Le don de {selectedDonation?.totalAmount.toLocaleString('fr-FR', {style: 'currency', currency: 'EUR'})} par {selectedDonation?.memberName} sera marqué comme "Annulé". Le reçu fiscal (CERFA n°{selectedDonation?.cerfaNumber}) sera invalidé.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Retour</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancelDonation} className="bg-destructive hover:bg-destructive/90">
              Confirmer l'annulation
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

    

    