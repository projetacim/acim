
'use client';

import { useState, useMemo, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { useData } from '@/app/(app)/data-provider';
import { useFirestore, useUser, addDocumentNonBlocking } from '@/firebase';
import { collection } from 'firebase/firestore';
import type { Member, Donation, Transaction, DonationCategory } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, UploadCloud, Check, ChevronsUpDown } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { openCerfaPdf } from '@/lib/cerfa-actions';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';

type StripeRow = {
  'Type de don': string;
  Titre: string;
  Nom: string;
  Prénom: string;
  Adresse: string;
  CP: string;
  Ville: string;
  Pays: string;
  'E-mail': string;
  Portable: string;
  Montant: string | number; // Can be string or number
  'Frais/Commissions': number;
  'Numéro reçu': string;
  'Moyen de paiement': string;
  'Date & Heure': string | Date;
  Commentaire: string;
};

type ProcessedRow = {
  id: string;
  nom: string;
  email: string;
  adresse: string;
  portable: string;
  montant: number;
  numeroRecu: string;
  dateHeure: Date;
  memo: string;
  initialMemberId?: string;
  matched: boolean;
};

const DONATEUR_INVITE_ID = 'DONATEUR_INVITE';

// Self-contained Combobox Component
function MemberCombobox({ members, value, onSelect }: { members: { value: string, label: string }[], value: string, onSelect: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const selectedLabel = members.find((m) => m.value === value)?.label || "Sélectionner un membre...";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
        >
          <span className="truncate">{selectedLabel}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0">
        <Command>
          <CommandInput placeholder="Rechercher un membre..." />
          <CommandList>
            <CommandEmpty>Aucun membre trouvé.</CommandEmpty>
            <CommandGroup>
              {members.map((member) => (
                <CommandItem
                  key={member.value}
                  value={member.label}
                  onSelect={() => {
                    onSelect(member.value === value ? "" : member.value);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === member.value ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {member.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}


export function StripeImportView() {
  const { members, categories, isLoading: isDataLoading } = useData();
  const { toast } = useToast();
  const firestore = useFirestore();
  const { user } = useUser();

  const [fileName, setFileName] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isImporting, setIsImporting] = useState<string | null>(null);
  const [processedRows, setProcessedRows] = useState<ProcessedRow[]>([]);
  const [selectedMembers, setSelectedMembers] = useState<Record<string, string>>({});
  const [selectedCategories, setSelectedCategories] = useState<Record<string, string>>({});

  const membersByEmail = useMemo(() => {
    return new Map(members?.map(m => [m.email?.toLowerCase() || '', m]));
  }, [members]);

  const allMembersForSelect = useMemo(() => {
    const regularMembers = members
      ?.map(m => ({ value: m.id, label: m.nom }))
      .sort((a, b) => a.label.localeCompare(b.label)) || [];
      
    return [
      { value: DONATEUR_INVITE_ID, label: 'DONATEUR (invité)' },
      ...regularMembers,
    ];
  }, [members]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setFileName(file.name);
    setProcessedRows([]);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array', cellDates: true });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json<StripeRow>(worksheet, { raw: false, cellDates: true });

        const newSelectedMembers: Record<string, string> = {};
        const newProcessedRows = json.map((row, index): ProcessedRow => {
          const email = (row['E-mail'] || '').toLowerCase();
          const matchedMember = membersByEmail.get(email);
          const rowId = `${index}-${email}`;

          if (matchedMember) {
            newSelectedMembers[rowId] = matchedMember.id;
          }
          
          const montantStr = String(row.Montant || '0')
              .replace('€', '')
              .replace(/\s/g, '') // remove spaces
              .replace(',', '.');
          const montant = parseFloat(montantStr) || 0;

          return {
            id: rowId,
            nom: `${row.Nom} ${row.Prénom}`.trim(),
            email: row['E-mail'] || '',
            adresse: `${row.Adresse || ''}, ${row.CP || ''} ${row.Ville || ''}`.trim(),
            portable: row.Portable || '',
            montant: montant,
            numeroRecu: String(row['Numéro reçu'] || ''),
            dateHeure: row['Date & Heure'] instanceof Date ? row['Date & Heure'] : new Date(),
            memo: row.Commentaire || '',
            initialMemberId: matchedMember?.id,
            matched: !!matchedMember,
          };
        });

        setProcessedRows(newProcessedRows);
        setSelectedMembers(newSelectedMembers);
        toast({ title: 'Fichier traité', description: `${newProcessedRows.length} lignes prêtes.` });
      } catch (error) {
        console.error("Erreur de lecture:", error);
        toast({ variant: 'destructive', title: 'Erreur', description: "Impossible de lire le fichier." });
      } finally {
        setIsProcessing(false);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleAttribuer = async (row: ProcessedRow) => {
     if (!firestore || !user) return;
     
     setIsImporting(row.id);
     
     const selectedMemberId = selectedMembers[row.id];
     const selectedCategoryId = selectedCategories[row.id];

     if (!selectedMemberId) {
         toast({ variant: 'destructive', title: 'Erreur', description: 'Veuillez sélectionner un membre.' });
         setIsImporting(null);
         return;
     }

     const isInvite = selectedMemberId === DONATEUR_INVITE_ID;
     
     const donation: Omit<Donation, 'id' | 'createdAt'> = {
         memberId: isInvite ? DONATEUR_INVITE_ID : selectedMemberId,
         type: 'Don',
         donationCategoryId: selectedCategoryId,
         totalAmount: row.montant,
         payments: [{
             amount: row.montant,
             date: row.dateHeure.toISOString(),
             paymentMethod: 'Carte de crédit',
         }],
         paymentStatus: 'Payé',
         cerfaEligible: true,
         cerfaNumber: row.numeroRecu,
         cerfaDate: row.dateHeure.toISOString(),
         cerfaNom: row.nom,
         cerfaAdresse: row.adresse,
         cerfaEmail: row.email,
         memo: isInvite 
            ? `Donateur: ${row.nom}\nEmail: ${row.email}\nTel: ${row.portable}\n${row.memo}` 
            : row.memo,
     };

     try {
        const donationRef = await addDocumentNonBlocking(collection(firestore, 'users', user.uid, 'donations'), {
            ...donation,
            createdAt: new Date().toISOString()
        });

        const transaction: Omit<Transaction, 'id' | 'createdAt'> = {
            type: 'Don',
            relatedId: donationRef.id,
            amount: row.montant,
            date: row.dateHeure.toISOString(),
            paymentMethod: 'Carte de crédit',
            memo: `Import Stripe - ${row.nom}`
        };

        await addDocumentNonBlocking(collection(firestore, 'users', user.uid, 'transactions'), {
            ...transaction,
            createdAt: new Date().toISOString()
        });
        
        if (isInvite) {
            const memberPlaceholder: Member = {
                id: DONATEUR_INVITE_ID,
                nom: row.nom,
                adresse: row.adresse,
                email: row.email,
                telephone: row.portable,
                joinDate: '',
                membershipStatus: 'Pending',
            };
            await openCerfaPdf({ ...donation, id: donationRef.id, createdAt: new Date().toISOString() }, memberPlaceholder);
        }

        toast({ title: 'Succès', description: `Le don de ${row.nom} a été attribué.` });
        setProcessedRows(prev => prev.filter(r => r.id !== row.id));

     } catch(e) {
        console.error("Erreur d'attribution", e);
        toast({ variant: 'destructive', title: 'Erreur', description: "L'attribution du don a échoué." });
     } finally {
        setIsImporting(null);
     }
  };

  const handleSelectMember = (rowId: string, memberId: string) => {
    setSelectedMembers(prev => ({ ...prev, [rowId]: memberId }));
  };

  const handleSelectCategory = (rowId: string, categoryId: string) => {
    setSelectedCategories(prev => ({ ...prev, [rowId]: categoryId }));
  };

  return (
    <div className="grid gap-8">
      <Card>
        <CardHeader>
          <CardTitle>Téléverser un Fichier Stripe</CardTitle>
          <CardDescription>
            Importez votre fichier Excel pour rapprocher les dons.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-2">
            <Input id="excel-file" type="file" accept=".xlsx, .xls" onChange={handleFileChange} className="hidden" disabled={isDataLoading || isProcessing} />
            <Button asChild variant="outline" disabled={isDataLoading || isProcessing}>
              <label htmlFor="excel-file" className="cursor-pointer">
                {(isDataLoading || isProcessing) ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UploadCloud className="mr-2 h-4 w-4" />} 
                {isDataLoading ? "Chargement..." : isProcessing ? "Traitement..." : "Choisir un fichier"}
              </label>
            </Button>
            {fileName && !isProcessing && <span className="text-sm text-muted-foreground">{fileName}</span>}
          </div>
        </CardContent>
      </Card>

      {processedRows.length > 0 && (
        <Card>
            <CardHeader>
                <CardTitle>Rapprochement des Dons</CardTitle>
                <CardDescription>Assignez chaque don importé à un membre et une catégorie.</CardDescription>
            </CardHeader>
            <CardContent>
                <ScrollArea className="h-[60vh]">
                <Table>
                    <TableHeader>
                    <TableRow>
                        <TableHead className="w-[200px]">Nom</TableHead>
                        <TableHead className="w-[320px]">Membre</TableHead>
                        <TableHead className="w-[200px]">Catégorie</TableHead>
                        <TableHead>Montant</TableHead>
                        <TableHead>N° Reçu</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Commentaire</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                    </TableHeader>
                    <TableBody>
                        {processedRows.map((row) => (
                            <TableRow key={row.id} className={cn(row.matched && 'bg-green-500/10')}>
                                <TableCell className="font-medium align-top">
                                  {row.nom}
                                  <div className="text-xs text-muted-foreground">{row.email}</div>
                                </TableCell>
                                <TableCell className="align-top">
                                  <MemberCombobox 
                                     members={allMembersForSelect}
                                     value={selectedMembers[row.id] || ''}
                                     onSelect={(value) => handleSelectMember(row.id, value)}
                                  />
                                </TableCell>
                                <TableCell className="align-top">
                                     <Select 
                                      value={selectedCategories[row.id]}
                                      onValueChange={(value) => handleSelectCategory(row.id, value)}
                                    >
                                      <SelectTrigger>
                                        <SelectValue placeholder="Sélectionner..." />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {categories?.map((c) => (
                                          <SelectItem key={c.id} value={c.id}>
                                            {c.name}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                </TableCell>
                                <TableCell className="align-top">{row.montant.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}</TableCell>
                                <TableCell className="align-top">{row.numeroRecu}</TableCell>
                                <TableCell className="align-top text-xs">{format(row.dateHeure, 'dd/MM/yy HH:mm', {locale: fr})}</TableCell>
                                <TableCell className="text-muted-foreground align-top max-w-[200px] truncate">{row.memo}</TableCell>
                                <TableCell className="text-right align-top">
                                    <Button size="sm" onClick={() => handleAttribuer(row)} disabled={isImporting === row.id || !selectedMembers[row.id]}>
                                       {isImporting === row.id ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Attribuer'}
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
                </ScrollArea>
            </CardContent>
        </Card>
      )}

    </div>
  );
}
