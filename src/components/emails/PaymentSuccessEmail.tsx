import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import { APP_NAME } from "@/lib/constants";

export type PaymentSuccessEmailProps = {
  faxTo: string;
  trackUrl: string;
};

export function PaymentSuccessEmail({
  faxTo,
  trackUrl,
}: PaymentSuccessEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Payment received — your fax send has started</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>{APP_NAME}</Heading>
          <Text style={paragraph}>
            Thanks — your payment was confirmed and we&apos;ve started sending
            your fax to <strong>{faxTo}</strong>.
          </Text>
          <Section style={section}>
            <Text style={paragraph}>
              <strong>Track delivery status</strong> (no login required; link
              expires in 24 hours):
            </Text>
            <Link href={trackUrl} style={link}>
              {trackUrl}
            </Link>
          </Section>
          <Text style={muted}>
            You&apos;ll get another email when the carrier reports final
            delivery. If you did not request this, you can ignore this email.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

const main = {
  backgroundColor: "#f6f9fc",
  fontFamily:
    '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
};

const container = {
  margin: "0 auto",
  padding: "32px 24px",
  maxWidth: "560px",
};

const h1 = {
  color: "#0f172a",
  fontSize: "22px",
  fontWeight: "600",
  margin: "0 0 24px",
};

const section = { margin: "16px 0" };

const paragraph = {
  color: "#334155",
  fontSize: "15px",
  lineHeight: "1.55",
  margin: "0 0 12px",
};

const link = {
  color: "#009cff",
  fontSize: "14px",
  wordBreak: "break-all" as const,
};

const muted = {
  color: "#64748b",
  fontSize: "13px",
  lineHeight: "1.5",
  margin: "24px 0 0",
};
