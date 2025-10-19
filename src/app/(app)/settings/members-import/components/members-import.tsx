
'use client';

import { useState } from 'react';
import { useFirestore, useUser } from '@/firebase';
import { addDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { collection } from 'firebase/firestore';
import * as XLSX from 'xlsx';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { UploadCloud, Loader2, CheckCircle, FileDown } from 'lucide-react';

type ImportedMember = {
  nom: string;
  email: string;
  telephone?: string;
  adresse?: string;
  doc?: string;
  memo?: string;
  role?: string;
  membershipStatus?: 'Active' | 'Inactive' | 'Pending';
};

export function MembersImport() {
  const [importedMembers, setImportedMembers] = useState<ImportedMember[]>([]);
  const [fileName, setFileName] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const { toast } = useToast();
  const firestore = useFirestore();
  const { user } = useUser();

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
            role: String(row.role || 'membre'),
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
    
    if (!firestore || !user) {
        toast({ variant: 'destructive', title: 'Erreur', description: 'Utilisateur ou base de données non disponible.' });
        setIsImporting(false);
        return;
    }

    const membersCollection = collection(firestore, 'users', user.uid, 'membre');
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

  const downloadTemplate = () => {
    const sampleData = [
      {
        nom: "John Doe",
        email: "john.doe@example.com",
        telephone: "0612345678",
        adresse: "1 rue de la Paix, 75001 Paris",
        doc: "M",
        memo: "Membre fondateur",
        role: "admin"
      },
      {
        nom: "Jane Smith",
        email: "jane.smith@example.com",
        telephone: "0787654321",
        adresse: "2 avenue des Champs, 75008 Paris",
        doc: "C",
        memo: "",
        role: "membre"
      }
    ];
    const worksheet = XLSX.utils.json_to_sheet(sampleData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Modèle Membres");
    XLSX.writeFile(workbook, "modele_import_membres.xlsx");
  };

  return (
    <div className="grid gap-8">
      <Card>
        <CardHeader>
          <CardTitle>Téléverser un fichier Excel</CardTitle>
          <CardDescription>
            Le fichier doit avoir les colonnes : nom, email, telephone, adresse, doc, memo, role.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-2">
            <Input id="excel-file" type="file" accept=".xlsx, .xls" onChange={handleFileChange} className="hidden" />
            <Button asChild variant="outline">
                <label htmlFor="excel-file" className="cursor-pointer">
                    <UploadCloud className="mr-2 h-4 w-4" />
                    Choisir un fichier
                </label>
            </Button>
            <Button onClick={downloadTemplate} variant="secondary" size="sm">
                <FileDown className="mr-2 h-4 w-4" />
                Télécharger le modèle
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
                    <TableHead>Rôle</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {importedMembers.slice(0, 20).map((member, index) => (
                    <TableRow key={index}>
                      <TableCell>{member.nom}</TableCell>
                      <TableCell>{member.email}</TableCell>
                      <TableCell>{member.telephone}</TableCell>
                      <TableCell>{member.adresse}</TableCell>
                      <TableCell>{member.role}</TableCell>
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
