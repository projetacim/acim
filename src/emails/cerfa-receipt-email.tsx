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

interface CerfaReceiptEmailProps {
  donation: Donation;
  member: Member;
}

const baseUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : 'http://localhost:9002';

export const CerfaReceiptEmail = ({
  donation,
  member,
}: CerfaReceiptEmailProps) => (
  <Html>
    <Head />
    <Preview>Votre reçu fiscal ACIM est disponible</Preview>
    <Body style={main}>
      <Container style={container}>
        <Img
          src={`${baseUrl}/logo.png`}
          width="100"
          height="100"
          alt="ACIM Logo"
          style={logo}
        />
        <Heading style={h1}>Votre reçu fiscal ACIM</Heading>
        <Text style={text}>
          Bonjour {member.nom},
        </Text>
        <Text style={text}>
          Nous vous remercions sincèrement pour votre don de {donation.totalAmount.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}.
          Votre soutien est précieux pour notre association.
        </Text>
        <Text style={text}>
          Vous trouverez en pièce jointe de cet e-mail votre reçu fiscal (CERFA) n° **{donation.cerfaNumber}**. Ce document est à conserver pour votre déclaration de revenus.
        </Text>
        <Text style={text}>
          Encore merci pour votre générosité.
        </Text>
        <Text style={text}>
          Cordialement,
          <br />
          L'équipe de l'ACIM
        </Text>
        <Text style={footer}>
          Association Cultuelle Israélite de Montpellier (ACIM)
        </Text>
      </Container>
    </Body>
  </Html>
);

export default CerfaReceiptEmail;

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
