'use client';

import { useState } from 'react';
import { useFirestore } from '@/firebase';
import { addDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { collection } from 'firebase/firestore';
import * as XLSX from 'xlsx';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { UploadCloud, Loader2, CheckCircle } from 'lucide-react';

// Assuming your Member type is defined in @/lib/types, and it aligns with your Firestore structure
// We'll add a temporary type here for the imported data
type ImportedMember = {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  address?: string;
  membershipStatus?: 'Active' | 'Inactive' | 'Pending';
};

export function MembersImport() {
  const [importedMembers, setImportedMembers] = useState<ImportedMember[]>([]);
  const [fileName, setFileName] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const { toast } = useToast();
  const firestore = useFirestore();

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setFileName(file.name);
    setImportedMembers([]);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json<any>(worksheet);

        const membersData: ImportedMember[] = json.map(row => ({
            // Adjust these keys to match the column headers in your Excel file
            firstName: row.firstName || '',
            lastName: row.lastName || '',
            email: row.email || '',
            phone: row.phone || undefined,
            address: row.address || undefined,
            membershipStatus: row.membershipStatus || 'Pending',
        }));

        setImportedMembers(membersData);
        toast({
          title: 'Fichier traité',
          description: `${membersData.length} membres trouvés dans le fichier.`,
        });
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
  
  const handleImport = async () => {
    if (!firestore) {
        toast({ variant: 'destructive', title: 'Erreur', description: 'Firestore n\'est pas initialisé.' });
        return;
    }
    if (importedMembers.length === 0) {
        toast({ variant: 'destructive', title: 'Aucune donnée', description: 'Aucun membre à importer.' });
        return;
    }

    setIsImporting(true);
    const membersCollection = collection(firestore, 'members');
    let successfulImports = 0;
    
    // We'll import them one by one. For very large files, a batch write would be better.
    for (const member of importedMembers) {
      try {
        const newMember = {
            ...member,
            joinDate: new Date().toISOString(),
        }
        await addDocumentNonBlocking(membersCollection, newMember);
        successfulImports++;
      } catch(e) {
          console.error('Failed to import member:', member.email, e)
      }
    }

    setIsImporting(false);
    toast({
      title: 'Importation terminée',
      description: `${successfulImports} sur ${importedMembers.length} membres ont été importés.`,
    });
    setImportedMembers([]);
    setFileName('');
  };


  return (
    <div className="grid gap-8">
      <Card>
        <CardHeader>
          <CardTitle>Téléverser un fichier Excel</CardTitle>
          <CardDescription>
            Le fichier doit avoir les colonnes : firstName, lastName, email, phone, address, membershipStatus.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex w-full items-center space-x-2">
            <Input id="excel-file" type="file" accept=".xlsx, .xls" onChange={handleFileChange} className="hidden" />
            <Button asChild variant="outline">
                <label htmlFor="excel-file" className="cursor-pointer">
                    <UploadCloud className="mr-2 h-4 w-4" />
                    Choisir un fichier
                </label>
            </Button>
            {isProcessing && <Loader2 className="h-5 w-5 animate-spin" />}
            {fileName && !isProcessing && <span className="text-sm text-muted-foreground">{fileName}</span>}
          </div>
        </CardContent>
      </Card>

      {importedMembers.length > 0 && (
        <Card>
          <CardHeader className='flex-row items-center justify-between'>
             <div>
                <CardTitle>Aperçu de l'importation</CardTitle>
                <CardDescription>{importedMembers.length} membres seront ajoutés.</CardDescription>
            </div>
            <Button onClick={handleImport} disabled={isImporting}>
              {isImporting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Importation en cours...
                </>
              ) : (
                <>
                 <CheckCircle className="mr-2 h-4 w-4" />
                  Confirmer l'importation
                </>
              )}
            </Button>
          </CardHeader>
          <CardContent>
            <div className="max-h-[400px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Prénom</TableHead>
                    <TableHead>Nom</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Statut</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {importedMembers.slice(0, 20).map((member, index) => (
                    <TableRow key={index}>
                      <TableCell>{member.firstName}</TableCell>
                      <TableCell>{member.lastName}</TableCell>
                      <TableCell>{member.email}</TableCell>
                      <TableCell>{member.membershipStatus}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {importedMembers.length > 20 && (
                <p className="text-center text-sm text-muted-foreground mt-4">
                    Et {importedMembers.length - 20} autres membres...
                </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
