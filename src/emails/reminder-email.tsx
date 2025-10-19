
import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Link,
  Preview,
  Text,
} from '@react-email/components';
import * as React from 'react';
import type { Donation, Member } from '@/lib/types';

interface ReminderEmailProps {
  donation: Donation & { remainingAmount: number };
  member: Member;
}

const baseUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : 'http://localhost:9002';

export const ReminderEmail = ({
  donation,
  member,
}: ReminderEmailProps) => (
  <Html>
    <Head />
    <Preview>Rappel de paiement pour votre don à l'ACIM</Preview>
    <Body style={main}>
      <Container style={container}>
        <Img
          src={`${baseUrl}/logo.png`}
          width="100"
          height="100"
          alt="ACIM Logo"
          style={logo}
        />
        <Heading style={h1}>Rappel de Paiement</Heading>
        <Text style={text}>
          Bonjour {member.nom},
        </Text>
        <Text style={text}>
          Sauf erreur de notre part, il semble que votre {donation.type.toLowerCase()} d'un montant total de <strong>{donation.totalAmount.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}</strong> ne soit pas encore entièrement soldé.
        </Text>
        <Text style={text}>
          Le montant restant à régler est de <strong>{donation.remainingAmount.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}</strong>.
        </Text>
        <Text style={text}>
          Si vous avez déjà effectué le paiement, veuillez ne pas tenir compte de cet e-mail. Sinon, nous vous serions reconnaissants de bien vouloir régulariser la situation dès que possible.
        </Text>
        <Text style={text}>
          Pour toute question, n'hésitez pas à nous contacter.
        </Text>
        <Text style={text}>
          Cordialement,
          <br />
          L'équipe de l'ACIM
        </Text>
        <Text style={footer}>
          ACIM - Tel: 01.23.45.67.89
        </Text>
      </Container>
    </Body>
  </Html>
);

export default ReminderEmail;

const main = {
  backgroundColor: '#f6f9fc',
  padding: '10px 0',
};

const container = {
  backgroundColor: '#ffffff',
  border: '1px solid #f0f0f0',
  padding: '45px',
};

const logo = {
  margin: '0 auto',
};

const h1 = {
  color: '#1d1c1d',
  fontSize: '36px',
  fontWeight: '700',
  margin: '30px 0',
  padding: '0',
  lineHeight: '42px',
};

const text = {
  color: '#000',
  fontSize: '14px',
  lineHeight: '24px',
};

const footer = {
  color: '#666',
  fontSize: '12px',
  lineHeight: '24px',
};
