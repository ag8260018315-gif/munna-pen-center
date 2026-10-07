"use client";

import { useEffect } from "react";
import { WhatsAppIcon } from "@/components/icons/whatsapp";
import { Button, ExternalButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/section";
import { ErrorState } from "@/components/ui/state-panels";
import { buildWhatsAppUrl, whatsAppMessages } from "@/lib/whatsapp";

export default function SiteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <Container className="py-20">
      <ErrorState
        title="Something went wrong"
        actions={
          <>
            <Button onClick={reset}>Try again</Button>
            <ExternalButtonLink href={buildWhatsAppUrl(whatsAppMessages.general)} variant="whatsapp">
              <WhatsAppIcon className="size-5" />
              WhatsApp Us
            </ExternalButtonLink>
          </>
        }
      >
        <p>We could not load this page. Please try again — or contact us directly and we will help with your requirement.</p>
      </ErrorState>
    </Container>
  );
}
