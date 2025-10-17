'use client';

import { useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MoreHorizontal, ShieldCheck, FileWarning, Loader2, Sparkles } from 'lucide-react';
import type { Donation, Member } from '@/lib/types';
import { monitorDonationPatterns, type AutomatedComplianceMonitoringOutput } from '@/ai/flows/automated-compliance-monitoring';
import { Card, CardContent } from '@/components/ui/card';
import { format, parseISO } from 'date-fns';

type DonationsTableProps = {
  initialDonations: Donation[];
  members: Member[];
};

export function DonationsTable({ initialDonations, members }: DonationsTableProps) {
  const [donations] = useState<Donation[]>(initialDonations);
  const [isComplianceCheckOpen, setIsComplianceCheckOpen] = useState(false);
  const [selectedDonation, setSelectedDonation] = useState<Donation | null>(null);
  const [complianceResult, setComplianceResult] = useState<AutomatedComplianceMonitoringOutput | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleOpenComplianceCheck = async (donation: Donation) => {
    setSelectedDonation(donation);
    setIsComplianceCheckOpen(true);
    setIsLoading(true);
    setComplianceResult(null);

    try {
      const result = await monitorDonationPatterns({
        donationData: JSON.stringify(donation),
      });
      setComplianceResult(result);
    } catch (error) {
      console.error('Compliance check failed:', error);
      setComplianceResult({
        isAnomalous: true,
        explanation: 'An error occurred while checking compliance.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getPaymentBadgeVariant = (method: Donation['paymentMethod']) => {
    switch (method) {
      case 'Credit Card':
        return 'default';
      case 'PayPal':
        return 'secondary';
      case 'Bank Transfer':
        return 'outline';
      case 'Check':
        return 'destructive';
      default:
        return 'secondary';
    }
  };

  return (
    <>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Member</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Payment Method</TableHead>
                <TableHead className="hidden md:table-cell">Date</TableHead>
                <TableHead>
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {donations.map((donation) => (
                <TableRow key={donation.id}>
                  <TableCell>
                    <div className="font-medium">{donation.memberName}</div>
                    <div className="text-sm text-muted-foreground">
                      {members.find(m => m.id === donation.memberId)?.email}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">${donation.amount.toLocaleString()}</TableCell>
                  <TableCell>
                    <Badge variant={getPaymentBadgeVariant(donation.paymentMethod)}>{donation.paymentMethod}</Badge>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">{format(parseISO(donation.date), 'MMMM d, yyyy')}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button aria-haspopup="true" size="icon" variant="ghost">
                          <MoreHorizontal className="h-4 w-4" />
                          <span className="sr-only">Toggle menu</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleOpenComplianceCheck(donation)}>
                          <ShieldCheck className="mr-2 h-4 w-4" />
                          Check Compliance
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isComplianceCheckOpen} onOpenChange={setIsComplianceCheckOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Automated Compliance Check
            </DialogTitle>
            <DialogDescription>
              AI-powered analysis of donation for member: {selectedDonation?.memberName}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {isLoading && (
              <div className="flex flex-col items-center justify-center gap-4 text-center">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="text-muted-foreground">Analyzing donation patterns...</p>
              </div>
            )}
            {complianceResult && !isLoading && (
              <div className="space-y-4">
                {complianceResult.isAnomalous ? (
                  <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
                    <div className="flex items-center gap-3">
                      <FileWarning className="h-8 w-8 text-destructive" />
                      <h3 className="text-lg font-semibold text-destructive">Anomaly Detected</h3>
                    </div>
                    <p className="mt-2 text-sm text-destructive/90">{complianceResult.explanation}</p>
                  </div>
                ) : (
                  <div className="rounded-lg border border-green-500/50 bg-green-500/10 p-4">
                     <div className="flex items-center gap-3">
                      <ShieldCheck className="h-8 w-8 text-green-600" />
                      <h3 className="text-lg font-semibold text-green-700">No Issues Found</h3>
                    </div>
                    <p className="mt-2 text-sm text-green-600/90">{complianceResult.explanation}</p>
                  </div>
                )}
                {complianceResult.recommendedCerfaForm && (
                  <div>
                    <h4 className="font-semibold">Recommended CERFA Form</h4>
                    <p className="text-sm text-muted-foreground">{complianceResult.recommendedCerfaForm}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
