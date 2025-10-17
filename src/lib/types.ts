export type Member = {
  id: string;
  nom: string;
  email: string;
  telephone?: string;
  adresse?: string;
  doc?: string;
  memo?: string;
  membershipStatus: 'Active' | 'Inactive' | 'Pending';
  joinDate: string;
  avatarUrl: string;
};

export type Donation = {
  id: string;
  memberId: string;
  memberName: string;
  amount: number;
  date: string;
  paymentMethod: 'Credit Card' | 'Bank Transfer' | 'PayPal' | 'Check';
};

export type DonationCategory = {
  id: string;
  name: string;
  description?: string;
};
