import type { Metadata } from "next";
import { Container, Eyebrow, Card } from "@/components/ui";
import { PortfolioView } from "@/components/portfolio-view";

export const metadata: Metadata = {
  title: "Portfolio",
  description: "Your launches, balances and creator earnings on LuxuryPad.",
};

export default function PortfolioPage() {
  return (
    <Container className="py-14 sm:py-20">
      <div className="max-w-2xl space-y-4">
        <Eyebrow>Portfolio</Eyebrow>
        <h1 className="display text-[clamp(2.4rem,5.5vw,3.4rem)]">Your position.</h1>
        <p className="text-[15px] leading-relaxed text-muted">
          Chain data is authoritative. Nothing here is cached from a previous session.
        </p>
      </div>
      <Card className="mt-10 p-6">
        <PortfolioView />
      </Card>
    </Container>
  );
}
