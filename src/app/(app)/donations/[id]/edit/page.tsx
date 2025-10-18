
'use client';

import { DonationForm } from '../../components/donation-form';

export default function EditDonationPage({ params }: { params: { id: string } }) {
  return <DonationForm donationId={params.id} />;
}
