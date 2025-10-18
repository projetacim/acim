
'use client';

import { DonationForm } from '../../components/donation-form';

export default function EditDonationPage({ params }: { params: { id: string } }) {
  if (!params.id) return null;
  return <DonationForm donationId={params.id} />;
}
