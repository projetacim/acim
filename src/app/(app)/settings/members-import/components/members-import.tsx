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
import { RequestFirebaseBackendTool } from '@/lib/api';

type ImportedMember = {
  nom: string;
  email: string;
  telephone?: string;
  adresse?: string;
  doc?: string;
  memo?: string;
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
            nom: String(row.nom || ''),
            email: String(row.email || ''),
            telephone: String(row.telephone || ''),
            adresse: String(row.adresse || ''),
            doc: String(row.doc || ''),
            memo: String(row.memo || ''),
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
    if (importedMembers.length === 0) {
        toast({ variant: 'destructive', title: 'Aucune donnée', description: 'Aucun membre à importer.' });
        return;
    }

    setIsImporting(true);
    
    try {
      // Use a privileged backend call to ensure collection creation and rule sync.
      await RequestFirebaseBackendTool({});
      toast({ title: 'Synchronisation Firebase', description: 'Préparation de la base de données terminée.' });
    } catch (error) {
      console.error("Erreur lors de la préparation de Firebase:", error);
      toast({ variant: 'destructive', title: 'Erreur Firebase', description: 'Impossible de préparer la base de données pour l\'importation.' });
      setIsImporting(false);
      return;
    }
    
    if (!firestore) {
        toast({ variant: 'destructive', title: 'Erreur', description: 'Firestore n\'est pas initialisé.' });
        setIsImporting(false);
        return;
    }

    const membersCollection = collection(firestore, 'members');
    let successfulImports = 0;
    
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
    if(successfulImports > 0) {
      toast({
        title: 'Importation terminée',
        description: `${successfulImports} sur ${importedMembers.length} membres ont été importés.`,
      });
    } else {
        toast({
        variant: 'destructive',
        title: 'Échec de l\'importation',
        description: `Aucun membre n'a pu être importé. Vérifiez la console pour les erreurs.`,
      });
    }

    setImportedMembers([]);
    setFileName('');
  };


  return (
    <div className="grid gap-8">
      <Card>
        <CardHeader>
          <CardTitle>Téléverser un fichier Excel</CardTitle>
          <CardDescription>
            Le fichier doit avoir les colonnes : nom, email, telephone, adresse, doc, memo.
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
                    <TableHead>Nom</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Téléphone</TableHead>
                    <TableHead>Adresse</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {importedMembers.slice(0, 20).map((member, index) => (
                    <TableRow key={index}>
                      <TableCell>{member.nom}</TableCell>
                      <TableCell>{member.email}</TableCell>
                      <TableCell>{member.telephone}</TableCell>
                      <TableCell>{member.adresse}</TableCell>
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
