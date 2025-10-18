
'use client';
import { useState, useMemo, useEffect } from 'react';
import { useFirestore, useCollection, useMemoFirebase, useUser, updateDocumentNonBlocking } from '@/firebase';
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { Donation, Member, DonationCategory } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { numberToWords } from '@/lib/number-to-words';
import { ScrollArea } from '@/components/ui/scroll-area';

type DonationWithMemberAndCategory = Donation & { memberName: string; categoryName?: string };

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


export function CerfaTable() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();

  const membersCollection = useMemoFirebase(() => user ? collection(firestore, 'users', user.uid, 'membre') : null, [firestore, user]);
  const donationsCollection = useMemoFirebase(() => user ? query(collection(firestore, 'users', user.uid, 'donations'), where('cerfaNumber', '!=', '')) : null, [firestore, user]);
  const categoriesCollection = useMemoFirebase(() => user ? collection(firestore, 'donationCategories') : null, [firestore, user]);

  const { data: members, isLoading: isLoadingMembers } = useCollection<Member>(membersCollection);
  const { data: donations, isLoading: isLoadingDonations } = useCollection<Donation>(donationsCollection);
  const { data: categories, isLoading: isLoadingCategories } = useCollection<DonationCategory>(categoriesCollection);

  const cerfaDonations = useMemo(() => {
    if (!donations || !members || !categories) return [];
    
    const memberMap = new Map(members.map(m => [m.id, m.nom]));
    const categoryMap = new Map(categories.map(c => [c.id, c.name]));
    
    return donations
      .filter(d => d.cerfaNumber) // Redundant with query, but safe
      .map(d => ({
        ...d,
        memberName: memberMap.get(d.memberId) || 'Membre inconnu',
        categoryName: d.donationCategoryId ? categoryMap.get(d.donationCategoryId) : ''
      }))
      .sort((a, b) => b.cerfaNumber!.localeCompare(a.cerfaNumber!));

  }, [donations, members, categories]);
  
  
  const handleCerfaClick = async (donation: DonationWithMemberAndCategory) => {
     if (!firestore || !user || !donation.cerfaNumber) return;
    
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

        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const textColor = rgb(0, 0, 0);

        const lastPayment = donation.payments.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
        const paymentDate = new Date(lastPayment.date);
        const formattedDate = `${paymentDate.getDate().toString().padStart(2, '0')}/${(paymentDate.getMonth() + 1).toString().padStart(2, '0')}/${paymentDate.getFullYear()}`;

        const paymentMethods = [...new Set(donation.payments.map(p => {
            if (p.paymentMethod === 'Carte de crédit') return 'CB';
            return p.paymentMethod;
        }))].join(', ');

        page.drawText(donation.cerfaNumber, { ...cerfaCoordinates.cerfaId, font, size: 10, color: textColor });
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
  };

  const isLoading = isLoadingMembers || isLoadingDonations || isLoadingCategories;

  return (
    <>
      <ScrollArea className="h-96 w-full rounded-md border">
        <Table>
            <TableHeader>
            <TableRow>
                <TableHead>N° CERFA</TableHead>
                <TableHead>Membre</TableHead>
                <TableHead className="hidden sm:table-cell">Type</TableHead>
                <TableHead className="hidden md:table-cell">Catégorie</TableHead>
                <TableHead className="hidden lg:table-cell">Mémo</TableHead>
                <TableHead className="text-right">Montant</TableHead>
            </TableRow>
            </TableHeader>
            <TableBody>
            {isLoading && Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                    <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell className="hidden sm:table-cell"><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
                    <TableCell className="hidden md:table-cell"><Skeleton className="h-4 w-28" /></TableCell>
                    <TableCell className="hidden lg:table-cell"><Skeleton className="h-4 w-40" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-4 w-16" /></TableCell>
                </TableRow>
            ))}
            {!isLoading && cerfaDonations.map((donation) => (
                <TableRow key={donation.id}>
                    <TableCell>
                        <Button 
                            variant="link" 
                            className="p-0 h-auto font-medium"
                            onClick={() => handleCerfaClick(donation)}
                        >
                            {donation.cerfaNumber}
                        </Button>
                    </TableCell>
                    <TableCell className="font-medium">{donation.memberName}</TableCell>
                    <TableCell className="hidden sm:table-cell">
                        <Badge variant={donation.type === 'Don' ? 'secondary' : 'outline'}>{donation.type}</Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">{donation.categoryName}</TableCell>
                    <TableCell className="text-muted-foreground truncate max-w-xs hidden lg:table-cell">{donation.memo}</TableCell>
                    <TableCell className="text-right font-medium">{donation.totalAmount.toLocaleString('fr-FR', {style: 'currency', currency: 'EUR'})}</TableCell>
                </TableRow>
            ))}
            {!isLoading && cerfaDonations.length === 0 && (
                <TableRow>
                <TableCell colSpan={6} className="p-6 text-center text-muted-foreground">
                    Aucun CERFA généré pour le moment.
                </TableCell>
                </TableRow>
            )}
            </TableBody>
        </Table>
      </ScrollArea>
    </>
  );
}

    