import { donations, members } from '@/lib/data';
import { DonationsTable } from './components/donations-table';

export default function DonationsPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-3xl font-bold tracking-tight">Donation Tracking</h1>
      <DonationsTable initialDonations={donations} members={members} />
    </div>
  );
}
