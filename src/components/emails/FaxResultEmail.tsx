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

export type FaxResultEmailProps = {
  faxTo: string;
  trackUrl: string;
  /** User-uploaded PDF is attached when true */
  hasPdfAttachment: boolean;
};

export function FaxResultEmail({
  faxTo,
  trackUrl,
  hasPdfAttachment,
}: FaxResultEmailProps) {
  const preview = hasPdfAttachment
    ? "Fax delivered — your PDF is attached"
    : "Fax delivered — see status page for receipt";

  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>{APP_NAME}</Heading>
          <Text style={paragraph}>
            Your fax to <strong>{faxTo}</strong> reached the remote fax machine
            successfully.
          </Text>
          {hasPdfAttachment ? (
            <Text style={paragraph}>
              Your <strong>uploaded PDF</strong> is attached to this message for
              your records.
            </Text>
          ) : (
            <Text style={paragraph}>
              We couldn&apos;t attach your file automatically. Open your status
              page to download a transmission receipt if available.
            </Text>
          )}
          <Section style={section}>
            <Text style={label}>Status page</Text>
            <Link href={trackUrl} style={link}>
              {trackUrl}
            </Link>
          </Section>
          <Text style={muted}>
            If you did not request this, you can ignore this email.
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

const label = {
  color: "#64748b",
  fontSize: "12px",
  textTransform: "uppercase" as const,
  letterSpacing: "0.04em",
  margin: "0 0 6px",
};

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
