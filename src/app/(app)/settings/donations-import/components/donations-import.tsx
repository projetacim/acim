'use client';

import { useState, useMemo } from 'react';
import { useFirestore, useUser, addDocumentNonBlocking } from '@/firebase';
import { collection } from 'firebase/firestore';
import * as XLSX from 'xlsx';
import { useData } from '@/app/(app)/data-provider';
import type { Member, Donation, Transaction, DonationCategory } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { UploadCloud, Loader2, CheckCircle, AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

type ImportedDonation = {
  email_membre: string;
  type: 'Don' | 'Cotisation';
  categorie_don?: string;
  montant_total: number;
  date_paiement: string; // Expected format: YYYY-MM-DD
  moyen_paiement: 'Carte de crédit' | 'Virement bancaire' | 'Espèces' | 'Chèque';
  memo?: string;
  eligible_cerfa: 'oui' | 'non';
};

type ProcessedDonation = {
  memberExists: boolean;
  memberId?: string;
  memberName?: string;
  donationData: Omit<Donation, 'id' | 'memberId' | 'createdAt'>;
  transactionData: Omit<Transaction, 'id' | 'relatedId' | 'createdAt'>;
  originalRow: ImportedDonation;
};

export function DonationsImport() {
  const { members, categories, isLoading: isDataLoading } = useData();
  const { toast } = useToast();
  const firestore = useFirestore();
  const { user } = useUser();

  const [fileName, setFileName] = useState('');
  const [processedDonations, setProcessedDonations] = useState<ProcessedDonation[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const { membersByEmail, categoriesByName } = useMemo(() => {
    const membersByEmail = new Map(members?.map(m => [m.email.toLowerCase(), m]));
    const categoriesByName = new Map(categories?.map(c => [c.name.toLowerCase(), c]));
    return { membersByEmail, categoriesByName };
  }, [members, categories]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setFileName(file.name);
    setProcessedDonations([]);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array', cellDates: true });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json<any>(worksheet);

        const donationsToProcess: ImportedDonation[] = json.map(row => ({
          email_membre: String(row.email_membre || '').trim(),
          type: row.type === 'Cotisation' ? 'Cotisation' : 'Don',
          categorie_don: String(row.categorie_don || '').trim(),
          montant_total: Number(row.montant_total || 0),
          date_paiement: row.date_paiement instanceof Date ? row.date_paiement.toISOString().split('T')[0] : String(row.date_paiement || '').trim(),
          moyen_paiement: row.moyen_paiement || 'Espèces',
          memo: String(row.memo || ''),
          eligible_cerfa: String(row.eligible_cerfa || 'non').toLowerCase() as 'oui' | 'non',
        }));

        processDonations(donationsToProcess);

      } catch (error) {
        console.error("Erreur de lecture du fichier:", error);
        toast({
          variant: 'destructive',
          title: 'Erreur de lecture',
          description: 'Impossible de lire le fichier. Assurez-vous que c\'est un fichier Excel valide.',
        });
      } finally {
        setIsProcessing(false);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const processDonations = (imported: ImportedDonation[]) => {
    const processed = imported.map(row => {
      const member = membersByEmail.get(row.email_membre.toLowerCase());
      const category = categoriesByName.get(row.categorie_don?.toLowerCase() ?? '');
      
      const paymentDate = new Date(row.date_paiement);

      const donationData: Omit<Donation, 'id' | 'memberId' | 'createdAt'> = {
        type: row.type,
        donationCategoryId: row.type === 'Don' ? category?.id : undefined,
        totalAmount: row.montant_total,
        payments: [{
          amount: row.montant_total,
          date: paymentDate.toISOString(),
          paymentMethod: row.moyen_paiement,
        }],
        paymentStatus: 'Payé',
        memo: row.memo || '',
        cerfaEligible: row.eligible_cerfa === 'oui',
      };

      const transactionData: Omit<Transaction, 'id' | 'relatedId' | 'createdAt'> = {
        type: row.type,
        amount: row.montant_total,
        date: paymentDate.toISOString(),
        paymentMethod: row.moyen_paiement,
        memo: row.memo,
      };
      
      return {
        memberExists: !!member,
        memberId: member?.id,
        memberName: member?.nom,
        donationData,
        transactionData,
        originalRow: row,
      };
    });
    setProcessedDonations(processed);
    toast({
      title: 'Fichier traité',
      description: `${processed.length} dons prêts à être importés.`,
    });
  };

  const handleImport = async () => {
    const validDonations = processedDonations.filter(p => p.memberExists);
    if (validDonations.length === 0) {
      toast({ variant: 'destructive', title: 'Aucune donnée valide', description: 'Aucun don à importer car les membres correspondants n\'ont pas été trouvés.' });
      return;
    }
    
    setIsImporting(true);
    if (!firestore || !user) {
      toast({ variant: 'destructive', title: 'Erreur', description: 'Utilisateur ou base de données non disponible.' });
      setIsImporting(false);
      return;
    }
    
    let successfulImports = 0;
    
    for (const item of validDonations) {
      try {
        const donationToSave = {
          ...item.donationData,
          memberId: item.memberId!,
          createdAt: new Date().toISOString(),
        };

        const donationsCollection = collection(firestore, 'users', user.uid, 'donations');
        const newDonationRef = await addDocumentNonBlocking(donationsCollection, donationToSave);

        if (newDonationRef) {
          const transactionToSave = {
            ...item.transactionData,
            relatedId: newDonationRef.id,
            createdAt: new Date().toISOString(),
          };
          const transactionsCollection = collection(firestore, 'users', user.uid, 'transactions');
          await addDocumentNonBlocking(transactionsCollection, transactionToSave);
        }
        
        successfulImports++;
      } catch (e) {
        console.error('Failed to import donation for member:', item.originalRow.email_membre, e);
      }
    }
    
    setIsImporting(false);
    toast({
      title: 'Importation terminée',
      description: `${successfulImports} sur ${validDonations.length} dons valides ont été importés.`,
    });

    setProcessedDonations([]);
    setFileName('');
  };

  const donationsWithoutMembers = processedDonations.filter(p => !p.memberExists);

  return (
    <div className="grid gap-8">
      <Card>
        <CardHeader>
          <CardTitle>Téléverser un fichier de dons</CardTitle>
          <CardDescription>
            Le fichier doit avoir les colonnes : email_membre, type, montant_total, date_paiement, moyen_paiement.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex w-full items-center space-x-2">
            <Input id="excel-file" type="file" accept=".xlsx, .xls" onChange={handleFileChange} className="hidden" disabled={isDataLoading} />
            <Button asChild variant="outline" disabled={isDataLoading}>
              <label htmlFor="excel-file" className="cursor-pointer">
                {isDataLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Chargement...</> : <><UploadCloud className="mr-2 h-4 w-4" /> Choisir un fichier</>}
              </label>
            </Button>
            {isProcessing && <Loader2 className="h-5 w-5 animate-spin" />}
            {fileName && !isProcessing && <span className="text-sm text-muted-foreground">{fileName}</span>}
          </div>
        </CardContent>
      </Card>

      {donationsWithoutMembers.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Membres non trouvés</AlertTitle>
          <AlertDescription>
            {donationsWithoutMembers.length} don(s) ne peuvent pas être importés car l'email du membre associé n'a pas été trouvé. Veuillez vérifier les emails ou importer les membres manquants d'abord.
             <ul className="mt-2 list-disc list-inside">
              {donationsWithoutMembers.slice(0, 5).map((d, i) => <li key={i}>{d.originalRow.email_membre}</li>)}
             {donationsWithoutMembers.length > 5 && <li>et {donationsWithoutMembers.length - 5} autres...</li>}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {processedDonations.length > 0 && (
        <Card>
          <CardHeader className='flex-row items-center justify-between'>
            <div>
              <CardTitle>Aperçu de l'importation</CardTitle>
              <CardDescription>{processedDonations.filter(p => p.memberExists).length} dons valides seront importés.</CardDescription>
            </div>
            <Button onClick={handleImport} disabled={isImporting || processedDonations.filter(p => p.memberExists).length === 0}>
              {isImporting ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Importation...</>
              ) : (
                <><CheckCircle className="mr-2 h-4 w-4" /> Confirmer l'importation</>
              )}
            </Button>
          </CardHeader>
          <CardContent>
            <div className="max-h-[400px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Membre</TableHead>
                    <TableHead>Montant</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {processedDonations.slice(0, 20).map((item, index) => (
                    <TableRow key={index} className={!item.memberExists ? 'bg-destructive/10' : ''}>
                      <TableCell>
                        <div className="font-medium">{item.memberName || 'Membre Inconnu'}</div>
                        <div className="text-sm text-muted-foreground">{item.originalRow.email_membre}</div>
                      </TableCell>
                      <TableCell>{item.originalRow.montant_total.toLocaleString('fr-FR', {style: 'currency', currency: 'EUR'})}</TableCell>
                      <TableCell>{item.originalRow.date_paiement}</TableCell>
                      <TableCell>{item.originalRow.type}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {processedDonations.length > 20 && (
              <p className="text-center text-sm text-muted-foreground mt-4">
                Et {processedDonations.length - 20} autres dons...
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
